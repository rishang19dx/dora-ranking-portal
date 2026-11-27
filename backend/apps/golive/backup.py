"""
Portable, verifiable backups of the whole portal: database plus proof files.

A backup is one gzip'd tarball:

    manifest.json   when, which version, row counts per model, and a SHA-256
                    for every other member of the archive
    db.json         every row, as Django fixtures (natural foreign keys), so
                    the same archive restores into PostgreSQL or SQLite
    media/...       the proof repository, byte for byte

and a sidecar `<name>.sha256` holding the archive's own digest, so a copy that
was truncated or tampered with in transit is refused before anything is
touched. `restore_backup` verifies first and only then flushes and reloads.

The database dump is logical (dumpdata), not pg_dump: it is engine-neutral,
which is what makes the scratch-database DR drill possible. The runbook adds
a nightly pg_dump alongside it for operators who want a native dump too.
"""

from __future__ import annotations

import hashlib
import io
import json
import os
import shutil
import tarfile
import tempfile
from collections import Counter
from dataclasses import dataclass, field
from datetime import datetime, timezone as dt_timezone
from pathlib import Path, PurePosixPath
from typing import Dict, List, Optional

from django.apps import apps
from django.conf import settings
from django.core.management import call_command
from django.db import connection, transaction

ARCHIVE_PREFIX = 'arp-backup-'
ARCHIVE_SUFFIX = '.tar.gz'
FORMAT_VERSION = 1

# Rebuilt by migrate/flush on the target, or not business data.
EXCLUDED_MODELS = ['contenttypes', 'auth.permission', 'sessions']


class BackupError(Exception):
    pass


@dataclass
class VerifyResult:
    ok: bool
    name: str
    created_at: Optional[datetime] = None
    counts: Dict[str, int] = field(default_factory=dict)
    files: int = 0
    errors: List[str] = field(default_factory=list)

    def as_dict(self):
        return {
            'ok': self.ok,
            'name': self.name,
            'createdAt': self.created_at.isoformat() if self.created_at else None,
            'counts': self.counts,
            'files': self.files,
            'errors': self.errors,
        }


def _sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, 'rb') as fh:
        for chunk in iter(lambda: fh.read(1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()


def backup_dir() -> Path:
    path = Path(settings.BACKUP_DIR)
    path.mkdir(parents=True, exist_ok=True)
    return path


def _business_models():
    excluded_apps = {e for e in EXCLUDED_MODELS if '.' not in e}
    excluded_models = {e for e in EXCLUDED_MODELS if '.' in e}
    for model in apps.get_models():
        if model._meta.app_label in excluded_apps or model._meta.label_lower in excluded_models:
            continue
        if not model._meta.managed or model._meta.proxy:
            continue
        yield model


def live_counts() -> Dict[str, int]:
    """Row count per model in the connected database, as the manifest records it."""
    return {m._meta.label_lower: m._default_manager.using(connection.alias).count() for m in _business_models()}


def _dump_database() -> bytes:
    out = io.StringIO()
    call_command(
        'dumpdata',
        natural_foreign=True,
        exclude=EXCLUDED_MODELS,
        stdout=out,
        verbosity=0,
    )
    return out.getvalue().encode('utf-8')


def _parse_name_timestamp(name: str) -> Optional[datetime]:
    stem = name[len(ARCHIVE_PREFIX):-len(ARCHIVE_SUFFIX)] if name.startswith(ARCHIVE_PREFIX) else ''
    try:
        return datetime.strptime(stem[:16], '%Y%m%dT%H%M%SZ').replace(tzinfo=dt_timezone.utc)
    except ValueError:
        return None


def create_backup(dest: Optional[Path] = None, label: str = '') -> Path:
    """Write a new archive (and its .sha256) and return the archive path."""
    dest = Path(dest) if dest else backup_dir()
    dest.mkdir(parents=True, exist_ok=True)

    now = datetime.now(dt_timezone.utc)
    safe_label = ''.join(c for c in label if c.isalnum() or c in '-_')[:40]
    name = f"{ARCHIVE_PREFIX}{now:%Y%m%dT%H%M%SZ}{('-' + safe_label) if safe_label else ''}{ARCHIVE_SUFFIX}"
    archive_path = dest / name
    if archive_path.exists():
        raise BackupError(f'{archive_path} already exists.')

    # Dump and count inside one transaction so the manifest describes exactly
    # the rows that were dumped (REPEATABLE READ on PostgreSQL).
    with transaction.atomic():
        db_bytes = _dump_database()
        counts = Counter(obj['model'] for obj in json.loads(db_bytes or b'[]'))

    media_root = Path(settings.MEDIA_ROOT)
    media_files = []
    if media_root.exists():
        media_files = sorted(p for p in media_root.rglob('*') if p.is_file())

    files_manifest = {'db.json': {'sha256': _sha256_bytes(db_bytes), 'size': len(db_bytes)}}
    for p in media_files:
        rel = 'media/' + p.relative_to(media_root).as_posix()
        files_manifest[rel] = {'sha256': _sha256_file(p), 'size': p.stat().st_size}

    manifest = {
        'formatVersion': FORMAT_VERSION,
        'createdAt': now.isoformat(),
        'appVersion': getattr(settings, 'APP_VERSION', ''),
        'databaseEngine': connection.vendor,
        'label': label,
        'counts': dict(sorted(counts.items())),
        'files': files_manifest,
    }
    manifest_bytes = json.dumps(manifest, indent=2).encode('utf-8')

    tmp_path = archive_path.with_suffix(archive_path.suffix + '.part')
    with tarfile.open(tmp_path, 'w:gz') as tar:
        for member_name, data in (('manifest.json', manifest_bytes), ('db.json', db_bytes)):
            info = tarfile.TarInfo(member_name)
            info.size = len(data)
            info.mtime = int(now.timestamp())
            tar.addfile(info, io.BytesIO(data))
        for p in media_files:
            tar.add(p, arcname='media/' + p.relative_to(media_root).as_posix(), recursive=False)
    os.replace(tmp_path, archive_path)

    digest = _sha256_file(archive_path)
    (dest / (name + '.sha256')).write_text(f"{digest}  {name}\n", encoding='utf-8')
    return archive_path


def list_backups(directory: Optional[Path] = None) -> List[dict]:
    directory = Path(directory) if directory else backup_dir()
    if not directory.exists():
        return []
    rows = []
    for p in directory.glob(f'{ARCHIVE_PREFIX}*{ARCHIVE_SUFFIX}'):
        created = _parse_name_timestamp(p.name)
        if created is None:
            continue
        rows.append({
            'name': p.name,
            'path': str(p),
            'createdAt': created,
            'size': p.stat().st_size,
            'hasChecksum': (p.parent / (p.name + '.sha256')).exists(),
        })
    rows.sort(key=lambda r: r['createdAt'], reverse=True)
    return rows


def latest_backup(directory: Optional[Path] = None) -> Optional[dict]:
    rows = list_backups(directory)
    return rows[0] if rows else None


def prune_backups(keep: Optional[int] = None, directory: Optional[Path] = None) -> List[str]:
    keep = settings.BACKUP_RETENTION_COUNT if keep is None else keep
    removed = []
    for row in list_backups(directory)[max(keep, 1):]:
        path = Path(row['path'])
        path.unlink(missing_ok=True)
        (path.parent / (path.name + '.sha256')).unlink(missing_ok=True)
        removed.append(row['name'])
    return removed


def _safe_member_path(name: str) -> bool:
    p = PurePosixPath(name)
    return not p.is_absolute() and '..' not in p.parts and name not in ('', '.')


def verify_backup(archive: Path) -> VerifyResult:
    """Check the sidecar digest, the manifest digests and the row counts."""
    archive = Path(archive)
    result = VerifyResult(ok=False, name=archive.name)
    if not archive.exists():
        result.errors.append('Archive not found.')
        return result

    sidecar = archive.parent / (archive.name + '.sha256')
    if sidecar.exists():
        expected = sidecar.read_text(encoding='utf-8').split()[0].strip()
        if expected != _sha256_file(archive):
            result.errors.append('Archive checksum does not match its .sha256 file.')
            return result
    else:
        result.errors.append('Missing .sha256 checksum file.')
        return result

    try:
        with tarfile.open(archive, 'r:gz') as tar:
            members = {m.name: m for m in tar.getmembers()}
            for name, member in members.items():
                if not _safe_member_path(name) or not (member.isfile() or member.isdir()):
                    result.errors.append(f'Unsafe archive member: {name!r}')
            if result.errors:
                return result
            if 'manifest.json' not in members or 'db.json' not in members:
                result.errors.append('Archive is missing manifest.json or db.json.')
                return result
            manifest = json.loads(tar.extractfile(members['manifest.json']).read())
            expected_files = manifest.get('files', {})
            for name, meta in expected_files.items():
                member = members.get(name)
                if member is None:
                    result.errors.append(f'Missing member listed in manifest: {name}')
                    continue
                data = tar.extractfile(member).read()
                if _sha256_bytes(data) != meta.get('sha256'):
                    result.errors.append(f'Checksum mismatch: {name}')
                if name == 'db.json':
                    try:
                        objects = json.loads(data or b'[]')
                    except ValueError:
                        result.errors.append('db.json is not valid JSON.')
                        objects = []
                    counts = dict(Counter(o.get('model') for o in objects))
                    if counts != manifest.get('counts', {}):
                        result.errors.append('Row counts in db.json differ from the manifest.')
                    result.counts = counts
            extra = [n for n, m in members.items() if m.isfile() and n != 'manifest.json' and n not in expected_files]
            if extra:
                result.errors.append(f'Unexpected members not in manifest: {", ".join(sorted(extra)[:5])}')
            result.files = sum(1 for n in expected_files if n.startswith('media/'))
            created = manifest.get('createdAt')
            result.created_at = datetime.fromisoformat(created) if created else None
    except (tarfile.TarError, OSError, ValueError) as exc:
        result.errors.append(f'Archive could not be read: {exc}')
        return result

    result.ok = not result.errors
    return result


def restore_backup(archive: Path, *, media_root: Optional[Path] = None) -> VerifyResult:
    """
    Replace the connected database and media folder with the archive's
    contents. Refuses (and changes nothing) unless the archive verifies.
    """
    archive = Path(archive)
    check = verify_backup(archive)
    if not check.ok:
        raise BackupError('Backup failed verification: ' + '; '.join(check.errors))

    media_root = Path(media_root or settings.MEDIA_ROOT)
    with tempfile.TemporaryDirectory(prefix='arp-restore-') as tmp:
        tmp_path = Path(tmp)
        with tarfile.open(archive, 'r:gz') as tar:
            for member in tar.getmembers():
                if member.isfile():
                    target = tmp_path / PurePosixPath(member.name)
                    target.parent.mkdir(parents=True, exist_ok=True)
                    with tar.extractfile(member) as src, open(target, 'wb') as dst:
                        shutil.copyfileobj(src, dst)

        with transaction.atomic():
            call_command('flush', interactive=False, verbosity=0)
            call_command('loaddata', str(tmp_path / 'db.json'), verbosity=0)

        staged_media = tmp_path / 'media'
        if media_root.exists():
            shutil.rmtree(media_root)
        if staged_media.exists():
            shutil.copytree(staged_media, media_root)
        else:
            media_root.mkdir(parents=True, exist_ok=True)

    return check
