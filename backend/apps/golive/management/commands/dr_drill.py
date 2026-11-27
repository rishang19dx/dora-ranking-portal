from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from apps.golive import audit
from apps.golive.drill import run_drill


class Command(BaseCommand):
    help = ('Disaster-recovery drill: restore the latest backup (or --backup) into a scratch '
            'database, verify every row and file came back, and record RPO/RTO. Production '
            'data is not touched. Pass --witness to record a witnessed drill (pilot KPI).')

    def add_arguments(self, parser):
        parser.add_argument('--backup', default=None, help='Archive to restore (default: latest).')
        parser.add_argument('--fresh', action='store_true', help='Take a new backup first (RPO ~ 0).')
        parser.add_argument('--witness', default='', help='Name and designation of the witness.')
        parser.add_argument('--notes', default='')

    def handle(self, *args, **options):
        drill = run_drill(
            archive=Path(options['backup']) if options['backup'] else None,
            fresh=options['fresh'],
            witness=options['witness'].strip(),
            notes=options['notes'],
        )
        audit.record('DR_DRILL', delta={
            'drillId': drill.id,
            'archive': drill.backup_name,
            'rpoHours': round(drill.rpo_hours, 3),
            'rtoHours': round(drill.rto_hours, 3),
            'integrityOk': drill.integrity_ok,
            'witnessedBy': drill.witnessed_by,
        })

        line = (f'Drill {drill.id}: RPO {drill.rpo_hours:.2f} h (target {settings.DR_TARGET_RPO_HOURS:g}), '
                f'RTO {drill.rto_hours * 60:.1f} min (target {settings.DR_TARGET_RTO_HOURS:g} h), '
                f'integrity {"OK" if drill.integrity_ok else "FAILED"}.')
        if drill.meets_targets:
            self.stdout.write(self.style.SUCCESS(line + ' PASS'))
        else:
            detail = drill.details.get('restore', {}).get('error') or drill.details.get('mismatches') \
                or drill.details.get('verify', {}).get('errors')
            raise CommandError(line + f' FAIL ({detail})')
