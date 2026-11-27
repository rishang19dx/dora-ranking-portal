import json
import hashlib
from pathlib import Path
from django.core.management.base import BaseCommand
from django.db import transaction
from apps.submissions.models import FormSchema

class Command(BaseCommand):
    help = 'Loads and registers a NIRF DCS form schema JSON fixture'

    def add_arguments(self, parser):
        parser.add_argument(
            'path',
            nargs='?',
            type=str,
            help='Path to the nirf form schema JSON file'
        )

    def handle(self, *args, **options):
        schema_path_arg = options.get('path')
        if schema_path_arg:
            schema_file = Path(schema_path_arg).resolve()
        else:
            schema_file = Path(__file__).resolve().parent.parent.parent / 'fixtures' / 'nirf_form_schema.json'

        if not schema_file.exists():
            self.stdout.write(self.style.ERROR(f'Schema file not found at: {schema_file}'))
            return

        with open(schema_file, 'r', encoding='utf-8') as f:
            content = json.load(f)

        canonical_json = json.dumps(content, sort_keys=True)
        checksum = hashlib.sha256(canonical_json.encode('utf-8')).hexdigest()
        framework = content.get('framework', 'NIRF')
        version = content.get('$schemaVersion', '1.0.0')

        existing = FormSchema.objects.filter(checksum=checksum).first()
        if existing and existing.is_active:
            self.stdout.write(self.style.SUCCESS(
                f"FormSchema '{framework}' v{existing.version} (checksum {checksum[:8]}) is already loaded and active."
            ))
            return

        with transaction.atomic():
            FormSchema.objects.filter(framework=framework, is_active=True).update(is_active=False)
            schema = FormSchema.objects.create(
                framework=framework,
                version=version,
                content=content,
                checksum=checksum,
                is_active=True
            )
            self.stdout.write(self.style.SUCCESS(
                f"Successfully loaded and activated '{framework}' schema v{version} ({schema.id}, checksum {checksum[:8]})."
            ))

