"""
Fetch any NIRF ranking cycle that has been published but is not cached yet.

Run on a schedule (see docker-compose's `scheduler` service and
scripts/deploy.sh). Safe to run as often as you like: cached years are never
re-fetched, and a cycle NIRF has not published yet is simply reported as
pending. A newly saved year becomes the latest on every dashboard on its
next read - no restart and no code change.
"""

from django.core.management.base import BaseCommand, CommandError

from apps.rankings.scraper import fetch_lock, refresh_new_publications, scrape_nirf_data


class Command(BaseCommand):
    help = 'Fetch newly published NIRF ranking cycles that are not cached yet.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--full', action='store_true',
            help='Re-fetch every year, not just the missing ones.',
        )

    def handle(self, *args, **opts):
        report = {}
        with fetch_lock() as acquired:
            if not acquired:
                self.stdout.write('Another ranking fetch is running; skipping this run.')
                return
            ok = scrape_nirf_data(report=report) if opts['full'] else refresh_new_publications(report=report)

        for year, category, rows in report.get('fetched', []):
            self.stdout.write(self.style.SUCCESS(f'  fetched {year} {category}: {rows} institutions'))
        pending = report.get('unpublished', [])
        if pending:
            listed = ', '.join(f'{y} {c}' for y, c in pending)
            self.stdout.write(f'  not published yet: {listed}')
        if not report.get('fetched') and not pending and not report.get('failed'):
            self.stdout.write('  every published cycle is already cached.')

        if not ok:
            failed = ', '.join(f'{y} {c}' for y, c in report.get('failed', []))
            raise CommandError(f'Could not fetch: {failed}. They will be retried on the next run.')
