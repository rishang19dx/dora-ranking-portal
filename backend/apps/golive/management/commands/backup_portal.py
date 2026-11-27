from pathlib import Path

from django.core.management.base import BaseCommand, CommandError

from apps.golive import audit
from apps.golive import backup as backup_lib


class Command(BaseCommand):
    help = ('Write a verified backup archive (database + proof files) to BACKUP_DIR and '
            'apply the retention policy. Schedule nightly; see docs/runbooks/backup-restore.md.')

    def add_arguments(self, parser):
        parser.add_argument('--label', default='', help='Short tag added to the file name, e.g. "pre-release".')
        parser.add_argument('--dest', default=None, help='Directory to write to (default: BACKUP_DIR).')
        parser.add_argument('--no-prune', action='store_true', help='Keep every archive, ignoring retention.')

    def handle(self, *args, **options):
        dest = Path(options['dest']) if options['dest'] else None
        try:
            path = backup_lib.create_backup(dest, label=options['label'])
        except backup_lib.BackupError as exc:
            raise CommandError(str(exc))

        check = backup_lib.verify_backup(path)
        if not check.ok:
            raise CommandError(f'Backup written but failed verification: {"; ".join(check.errors)}')

        removed = [] if options['no_prune'] else backup_lib.prune_backups(directory=dest)
        audit.record('BACKUP', delta={
            'archive': path.name,
            'rows': sum(check.counts.values()),
            'files': check.files,
            'pruned': removed,
        })
        self.stdout.write(self.style.SUCCESS(
            f'Backup written: {path} ({sum(check.counts.values())} rows, {check.files} files).'
        ))
        if removed:
            self.stdout.write(f'Pruned {len(removed)} old archive(s).')
