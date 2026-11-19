import json
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError
from django.db import connection

from apps.golive import audit
from apps.golive import backup as backup_lib


class Command(BaseCommand):
    help = ('Replace the database and proof files with the contents of a backup archive. '
            'DESTRUCTIVE: every current row is removed first. The archive is verified before '
            'anything is touched.')

    def add_arguments(self, parser):
        parser.add_argument('archive', help='Path to an arp-backup-*.tar.gz archive.')
        parser.add_argument('--yes', action='store_true', help='Do not ask for confirmation.')
        parser.add_argument('--json', action='store_true', help='Print restored row counts as JSON.')

    def handle(self, *args, **options):
        path = Path(options['archive'])
        check = backup_lib.verify_backup(path)
        if not check.ok:
            raise CommandError('Refusing to restore: ' + '; '.join(check.errors))

        if not options['yes']:
            db = connection.settings_dict.get('NAME')
            answer = input(f'This will ERASE database "{db}" and the media folder, then load '
                           f'{path.name}. Type "restore" to continue: ')
            if answer.strip() != 'restore':
                raise CommandError('Aborted.')

        try:
            backup_lib.restore_backup(path)
        except backup_lib.BackupError as exc:
            raise CommandError(str(exc))

        counts = {k: v for k, v in backup_lib.live_counts().items() if v}
        audit.record('RESTORE', delta={'archive': path.name, 'rows': sum(counts.values())})

        if options['json']:
            self.stdout.write(json.dumps({'archive': path.name, 'counts': counts}))
        else:
            self.stdout.write(self.style.SUCCESS(f'Restored {path.name}: {sum(counts.values())} rows.'))
