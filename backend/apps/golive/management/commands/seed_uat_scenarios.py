from django.core.management.base import BaseCommand

from apps.golive.models import UatScenario
from apps.golive.uat_scenarios import SCENARIOS


class Command(BaseCommand):
    help = 'Load (or refresh) the UAT scenario script. Recorded executions are kept.'

    def handle(self, *args, **options):
        codes = []
        for order, spec in enumerate(SCENARIOS, start=1):
            UatScenario.objects.update_or_create(
                code=spec['code'],
                defaults={
                    'title': spec['title'],
                    'area': spec['area'],
                    'role': spec['role'],
                    'priority': spec['priority'],
                    'steps': spec['steps'],
                    'expected': spec['expected'],
                    'order': order,
                    'active': True,
                },
            )
            codes.append(spec['code'])
        retired = UatScenario.objects.exclude(code__in=codes).update(active=False)
        self.stdout.write(self.style.SUCCESS(f'{len(codes)} UAT scenarios loaded; {retired} retired.'))
