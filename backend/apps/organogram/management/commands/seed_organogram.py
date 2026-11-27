import json
from pathlib import Path
from django.core.management.base import BaseCommand
from django.db import models, transaction
from apps.organogram.models import OrgUnit, NodalOfficer, OfficerStatus

class Command(BaseCommand):
    help = (
        'Seeds the organogram units and their initial nodal officer contacts. '
        'Safe to re-run: structural fields are refreshed from the fixture, but '
        'contact details an operator has set are preserved.'
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--reset-contacts',
            action='store_true',
            help=(
                'Also overwrite unit mailboxes and officer records with the '
                'fixture values. The mailboxes in the fixture are placeholders, '
                'so this discards real contact details entered after go-live. '
                'Off by default because deploys re-run this command.'
            ),
        )

    def handle(self, *args, **options):
        reset_contacts = options.get('reset_contacts', False)
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
            preserved_emails = 0
            for item in units_data:
                existing = OrgUnit.objects.filter(id=item['id']).first()

                # Structural fields always track the fixture.
                defaults = {
                    'name': item['name'],
                    'short_name': item.get('shortName'),
                    'kind': item.get('kind', 'OFFICE'),
                    'type': item['type'],
                    'head': item.get('head'),
                    'description': item.get('description'),
                    'data_scopes': item.get('dataScopes', []),
                }

                # The fixture's mailboxes are placeholders standing in until the
                # institute's real addresses are entered. Deploys re-run this
                # command, so an address already in the database wins unless the
                # operator explicitly asks for a reset.
                if reset_contacts or not existing or not (existing.email or '').strip():
                    defaults['email'] = item.get('email')
                elif existing:
                    preserved_emails += 1

                unit, created = OrgUnit.objects.update_or_create(
                    id=item['id'],
                    defaults=defaults,
                )
                unit_objs[unit.id] = unit

            # Pass 2: Set parent references
            for item in units_data:
                parent_id = item.get('parentId')
                if parent_id and parent_id in unit_objs:
                    unit = unit_objs[item['id']]
                    unit.parent = unit_objs[parent_id]
                    unit.save(update_fields=['parent'])

            # Pass 2.5: Handle retired units ('se', 'se-faculty-body') superseded by 'smme'
            retire_ids = ['se', 'se-faculty-body']
            smme_unit = unit_objs.get('smme')
            for ret_id in retire_ids:
                ret_unit = OrgUnit.objects.filter(id=ret_id).first()
                if ret_unit:
                    # Reassign NodalOfficers
                    for officer in ret_unit.nodal_officers.all():
                        officer.assigned_units.remove(ret_unit)
                        if smme_unit:
                            officer.assigned_units.add(smme_unit)
                    # Reassign DataRequestTargets if app installed
                    try:
                        from apps.data_requests.models import DataRequestTarget
                        if smme_unit:
                            DataRequestTarget.objects.filter(org_unit=ret_unit).update(org_unit=smme_unit)
                    except Exception:
                        pass
                    ret_unit.delete()
                    self.stdout.write(self.style.WARNING(f'Retired unit {ret_id} successfully removed.'))

            self.stdout.write(self.style.SUCCESS(f'Successfully seeded {len(unit_objs)} OrgUnits.'))

            # Pass 3: Seed Nodal Officers from organogram units with an email
            seeded_officers = 0
            preserved_officers = 0
            for unit in OrgUnit.objects.filter(email__isnull=False).exclude(email=''):
                officer = NodalOfficer.objects.filter(email=unit.email).first()
                seed_id = f"seed-{unit.id}"

                if officer is None:
                    existing_seed = NodalOfficer.objects.filter(id=seed_id).first()
                    if existing_seed is not None:
                        # This unit already has its seeded officer, but the
                        # mailbox has since changed. Move that officer to the new
                        # address rather than creating a duplicate (and colliding
                        # on the deterministic seed id).
                        existing_seed.email = unit.email
                        existing_seed.save(update_fields=['email'])
                        officer = existing_seed
                        preserved_officers += 1
                    else:
                        officer = NodalOfficer.objects.create(
                            id=seed_id,
                            email=unit.email,
                            name=unit.head or unit.name,
                            designation=unit.head,
                            status=OfficerStatus.INVITED,
                            notes='Imported from the institute organogram.',
                        )
                        seeded_officers += 1
                elif reset_contacts:
                    officer.name = unit.head or unit.name
                    officer.designation = unit.head
                    officer.status = OfficerStatus.INVITED
                    officer.notes = 'Imported from the institute organogram.'
                    officer.save(update_fields=['name', 'designation', 'status', 'notes'])
                else:
                    # An existing officer may have been renamed, re-designated or
                    # activated through the roster UI; re-seeding must not undo
                    # that or push them back to INVITED.
                    preserved_officers += 1

                officer.assigned_units.add(unit)

            self.stdout.write(self.style.SUCCESS(
                f'Nodal officers: {seeded_officers} created, {preserved_officers} left untouched.'
            ))

            if preserved_emails and not reset_contacts:
                self.stdout.write(self.style.WARNING(
                    f'Preserved {preserved_emails} unit mailbox(es) already set in the database. '
                    f'Pass --reset-contacts to overwrite them with the fixture placeholders.'
                ))

            # Surface the units that still cannot be sent a data request.
            unreachable = list(
                OrgUnit.objects
                .filter(kind__in=['SCHOOL', 'CENTRE'])
                .filter(models.Q(email__isnull=True) | models.Q(email=''))
                .values_list('id', flat=True)
            )
            if unreachable:
                self.stdout.write(self.style.WARNING(
                    f'{len(unreachable)} school/centre unit(s) have no mailbox and cannot receive '
                    f'a data request until one is set: {", ".join(sorted(unreachable))}'
                ))
