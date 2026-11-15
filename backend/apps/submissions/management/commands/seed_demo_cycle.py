"""
Runs a complete mock NIRF cycle and writes the four DCS workbooks to disk.

This is the Phase 1 acceptance demonstration ("a complete, compliant NIRF
export based on mock data inputs"). Every return is entered through the real
portal endpoints, submitted, approved and exported, so the audit trail it
leaves is the genuine article.

It writes mock data into the database, so it refuses to run with DEBUG off
unless --force is given. Demo officers use the reserved .invalid domain and
no mail is sent.
"""

from pathlib import Path

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from rest_framework.test import APIClient

from apps.submissions.demo_cycle import run_demo_cycle


class Command(BaseCommand):
    help = 'Run a full mock NIRF cycle through the portal and export the four DCS workbooks.'

    def add_arguments(self, parser):
        parser.add_argument('--cycle-year', type=int, default=2027)
        parser.add_argument('--checker', default='admin',
                            help='Username of the ADMIN/DIRECTOR account that approves the returns.')
        parser.add_argument('--out', default='demo_exports',
                            help='Directory the DCS workbooks are written to.')
        parser.add_argument('--force', action='store_true',
                            help='Allow running with DEBUG off. This writes mock data to the database.')

    def handle(self, *args, **opts):
        if not settings.DEBUG and not opts['force']:
            raise CommandError(
                'Refusing to write mock data with DEBUG off. Re-run with --force on a '
                'non-production database if you really mean it.'
            )

        checker = get_user_model().objects.filter(username=opts['checker']).first()
        if checker is None:
            raise CommandError(f"No user '{opts['checker']}'. Pass --checker <admin username>.")
        if getattr(checker, 'role', None) not in ('ADMIN', 'DIRECTOR') and not checker.is_superuser:
            raise CommandError(f"'{checker.username}' is not an ADMIN or DIRECTOR and cannot approve.")

        admin = APIClient()
        admin.force_authenticate(user=checker)
        self.stdout.write(f"Running mock NIRF {opts['cycle_year']} cycle...")
        result = run_demo_cycle(APIClient(), admin, cycle_year=opts['cycle_year'])

        out = Path(opts['out'])
        out.mkdir(parents=True, exist_ok=True)
        for category, content in result['exports'].items():
            path = out / f"NIRF_{opts['cycle_year']}_{category}_DCS_DEMO.xlsx"
            path.write_bytes(content)
            self.stdout.write(f'  wrote {path}')

        self.stdout.write(
            f"Request {result['request'].reference}: {result['units']} units, "
            f"{result['submitted']} returns submitted, {result['approved']} approved, "
            f"{len(result['exports'])} workbooks."
        )
        if result['failures']:
            for failure in result['failures'][:20]:
                self.stdout.write(self.style.WARNING(f'  {failure}'))
            raise CommandError(f"{len(result['failures'])} step(s) failed; see above.")
        self.stdout.write(self.style.SUCCESS('Mock cycle complete: every return approved and exported.'))
