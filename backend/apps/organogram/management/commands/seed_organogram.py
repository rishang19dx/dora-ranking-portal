import json
from pathlib import Path
from django.core.management.base import BaseCommand
from django.db import transaction
from apps.organogram.models import OrgUnit, NodalOfficer, OfficerStatus

class Command(BaseCommand):
    help = 'Seeds the database with organogram units and initial nodal officer contacts'

    def handle(self, *args, **options):
        fixtures_dir = Path(__file__).resolve().parent.parent.parent / 'fixtures'
        units_file = fixtures_dir / 'org_units.json'

        if not units_file.exists():
            self.stdout.write(self.style.ERROR(f'Fixtures file not found: {units_file}'))
            return

        with open(units_file, 'r', encoding='utf-8') as f:
            units_data = json.load(f)

        self.stdout.write(f'Loaded {len(units_data)} units from fixture.')

        with transaction.atomic():
            # Pass 1: Upsert units without foreign key references
            unit_objs = {}
            for item in units_data:
                unit, created = OrgUnit.objects.update_or_create(
                    id=item['id'],
                    defaults={
                        'name': item['name'],
                        'short_name': item.get('shortName'),
                        'type': item['type'],
                        'head': item.get('head'),
                        'email': item.get('email'),
                        'description': item.get('description'),
                        'data_scopes': item.get('dataScopes', []),
                    }
                )
                unit_objs[unit.id] = unit

            # Pass 2: Set parent references
            for item in units_data:
                parent_id = item.get('parentId')
                if parent_id and parent_id in unit_objs:
                    unit = unit_objs[item['id']]
                    unit.parent = unit_objs[parent_id]
                    unit.save(update_fields=['parent'])

            self.stdout.write(self.style.SUCCESS(f'Successfully seeded {len(unit_objs)} OrgUnits.'))

            # Pass 3: Seed Nodal Officers from organogram units with an email
            seeded_officers = 0
            for unit in OrgUnit.objects.filter(email__isnull=False).exclude(email=''):
                officer_id = f"seed-{unit.id}"
                officer, created = NodalOfficer.objects.update_or_create(
                    email=unit.email,
                    defaults={
                        'id': officer_id,
                        'name': unit.head or unit.name,
                        'designation': unit.head,
                        'status': OfficerStatus.INVITED,
                        'notes': 'Imported from the institute organogram.',
                    }
                )
                officer.assigned_units.add(unit)
                if created:
                    seeded_officers += 1

            self.stdout.write(self.style.SUCCESS(f'Successfully verified/seeded {seeded_officers} initial Nodal Officers.'))
