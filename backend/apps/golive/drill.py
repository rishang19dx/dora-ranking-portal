"""
Disaster-recovery drill: restore a real backup into a throwaway database and
prove the data came back, measuring RPO and RTO along the way.

The restore runs in a child process pointed at a scratch SQLite file and a
scratch media folder (DJANGO_SQLITE_PATH / DJANGO_MEDIA_ROOT), so production
data is never touched, whichever engine production runs on.
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
import tempfile
from datetime import datetime, timezone as dt_timezone
from pathlib import Path
from typing import Optional

from django.conf import settings

from . import backup as backup_lib
from .models import DisasterRecoveryDrill, DrillKind


def restore_into_scratch(archive: Path, scratch_dir: Path, timeout: int = 3600) -> dict:
    """Migrate a scratch database, restore the archive into it, return its row counts."""
    env = os.environ.copy()
    env.pop('DATABASE_URL', None)
    env['DJANGO_SQLITE_PATH'] = str(scratch_dir / 'drill.sqlite3')
    env['DJANGO_MEDIA_ROOT'] = str(scratch_dir / 'media')
    manage = str(Path(settings.BASE_DIR) / 'manage.py')

    def run(*args):
        return subprocess.run(
            [sys.executable, manage, *args], env=env, capture_output=True, text=True, timeout=timeout,
        )

    migrated = run('migrate', '--noinput')
    if migrated.returncode != 0:
        return {'ok': False, 'error': 'migrate failed: ' + migrated.stderr[-2000:]}
    restored = run('restore_portal', str(archive), '--yes', '--json')
    if restored.returncode != 0:
        return {'ok': False, 'error': 'restore failed: ' + restored.stderr[-2000:]}
    try:
        payload = json.loads(restored.stdout.strip().splitlines()[-1])
    except (ValueError, IndexError):
        return {'ok': False, 'error': 'restore produced no row counts.'}
    media_files = sum(1 for p in (scratch_dir / 'media').rglob('*') if p.is_file()) \
        if (scratch_dir / 'media').exists() else 0
    return {'ok': True, 'counts': payload.get('counts', {}), 'mediaFiles': media_files}


def run_drill(
    *,
    archive: Optional[Path] = None,
    fresh: bool = False,
    witness: str = '',
    notes: str = '',
    user=None,
) -> DisasterRecoveryDrill:
    if archive is None:
        latest = None if fresh else backup_lib.latest_backup()
        archive = Path(latest['path']) if latest else backup_lib.create_backup(label='drill')
    archive = Path(archive)

    # The clock starts when the "failure" is declared: from here on, the
    # restore is what an operator would do for real.
    failure_declared_at = datetime.now(dt_timezone.utc)
    check = backup_lib.verify_backup(archive)
    details = {'archive': archive.name, 'verify': check.as_dict()}
    integrity_ok = False

    if check.ok:
        with tempfile.TemporaryDirectory(prefix='arp-drill-') as tmp:
            outcome = restore_into_scratch(archive, Path(tmp))
        details['restore'] = outcome
        if outcome.get('ok'):
            expected = check.counts
            restored = outcome.get('counts', {})
            mismatches = {
                k: {'expected': expected.get(k, 0), 'restored': restored.get(k, 0)}
                for k in set(expected) | set(restored)
                if expected.get(k, 0) != restored.get(k, 0)
            }
            details['mismatches'] = mismatches
            files_ok = outcome.get('mediaFiles', 0) == check.files
            details['mediaFilesExpected'] = check.files
            integrity_ok = not mismatches and files_ok

    restored_at = datetime.now(dt_timezone.utc)
    return DisasterRecoveryDrill.objects.create(
        kind=DrillKind.WITNESSED if witness else DrillKind.AUTOMATED,
        backup_name=archive.name,
        backup_created_at=check.created_at or failure_declared_at,
        failure_declared_at=failure_declared_at,
        restored_at=restored_at,
        integrity_ok=integrity_ok,
        details=details,
        witnessed_by=witness,
        notes=notes,
        recorded_by=user if getattr(user, 'is_authenticated', False) else None,
    )
