"""
Load clearly-labelled illustrative results for non-NIRF ranking systems.

Phase 3 acceptance asks that the public portal "accurately plots dummy
historical data". NIRF already plots its real published tables; QS and THE
results are entered by DORA, so before that happens this command fills them
with demo rows the portal marks as "Illustrative data" everywhere they appear.

    python manage.py seed_demo_rankings          # add/refresh demo rows
    python manage.py seed_demo_rankings --clear  # remove every demo row

The figures are invented. Rows DORA has entered (is_demo=False) are never
touched, and editing a demo row in the admin turns it into a real one.
Refuses to run with DEBUG off unless --force.
"""
from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from apps.rankings.models import ExternalRankingResult

DEMO_ROWS = {
    'QS_WORLD': [(2022, '801-1000'), (2023, '801-1000'), (2024, '701-750'), (2025, '651-700'), (2026, '601-650')],
    'QS_ASIA': [(2022, '201-250'), (2023, '185'), (2024, '172'), (2025, '161'), (2026, '149')],
    'THE_WORLD': [(2022, '601-800'), (2023, '601-800'), (2024, '501-600'), (2025, '501-600'), (2026, '401-500')],
    'THE_ASIA': [(2022, '151-160'), (2023, '131-140'), (2024, '121-130'), (2025, '111-120'), (2026, '98')],
}


class Command(BaseCommand):
    help = 'Add (or with --clear remove) illustrative QS/THE results for the public portal.'

    def add_arguments(self, parser):
        parser.add_argument('--clear', action='store_true', help='Remove every demo row and exit.')
        parser.add_argument('--force', action='store_true', help='Allow running with DEBUG off.')

    def handle(self, *args, **opts):
        if opts['clear']:
            deleted, _ = ExternalRankingResult.objects.filter(is_demo=True).delete()
            self.stdout.write(self.style.SUCCESS(f'Removed {deleted} demo row(s).'))
            return
        if not settings.DEBUG and not opts['force']:
            raise CommandError('Refusing to add demo rankings with DEBUG off; pass --force on a non-production install.')

        added = skipped = 0
        for system, rows in DEMO_ROWS.items():
            for year, rank in rows:
                existing = ExternalRankingResult.objects.filter(system=system, system_label='', year=year).first()
                if existing and not existing.is_demo:
                    skipped += 1  # DORA's real entry wins
                    continue
                ExternalRankingResult.objects.update_or_create(
                    system=system, system_label='', year=year,
                    defaults={'rank_text': rank, 'is_demo': True, 'published': True,
                              'notes': 'Illustrative demo data, not a published result.'},
                )
                added += 1
        self.stdout.write(self.style.SUCCESS(
            f'{added} demo result(s) in place; {skipped} real result(s) left untouched. '
            'Remove with --clear before going live.'
        ))
