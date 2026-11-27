import json
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError

from apps.golive import backup as backup_lib


class Command(BaseCommand):
    help = 'Check a backup archive (checksums, manifest, row counts) without restoring it.'

    def add_arguments(self, parser):
        parser.add_argument('archive', nargs='?', help='Archive path (default: latest in BACKUP_DIR).')
        parser.add_argument('--json', action='store_true')

    def handle(self, *args, **options):
        if options['archive']:
            path = Path(options['archive'])
        else:
            latest = backup_lib.latest_backup()
            if latest is None:
                raise CommandError('No backups found in BACKUP_DIR.')
            path = Path(latest['path'])

        result = backup_lib.verify_backup(path)
        if options['json']:
            self.stdout.write(json.dumps(result.as_dict()))
        elif result.ok:
            self.stdout.write(self.style.SUCCESS(
                f'{path.name}: OK ({sum(result.counts.values())} rows, {result.files} files, '
                f'created {result.created_at:%Y-%m-%d %H:%M} UTC).'
            ))
        if not result.ok:
            raise CommandError(f'{path.name}: FAILED - ' + '; '.join(result.errors))
