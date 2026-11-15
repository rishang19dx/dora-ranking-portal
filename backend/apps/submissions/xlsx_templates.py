"""
Standardised Excel templates for records blocks (spec 2.3).

Departments already keep their rosters and registers in spreadsheets; the
template lets them fill one in the exact shape the importer expects, so the
upload lands first time instead of failing on header names.

Layout, chosen so a filled template round-trips through the importer:

* "Data" (the active sheet) - one header row of field labels, nothing else.
  The importer reads the active sheet and treats every row after the header
  as a record, so guidance cannot live here.
* "Instructions" - what each column means, whether it is required and what
  values it accepts.
* "Lists" (hidden) - the option lists behind the dropdowns.
"""

import io
from typing import Dict, List, Optional

import openpyxl
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.datavalidation import DataValidation

from apps.organogram.models import OrgUnit

HEADER_FILL = PatternFill(start_color='1E293B', end_color='1E293B', fill_type='solid')
REQUIRED_FILL = PatternFill(start_color='9F1239', end_color='9F1239', fill_type='solid')
HEADER_FONT = Font(bold=True, color='FFFFFF')
TEMPLATE_ROWS = 500  # rows covered by dropdowns/number checks

TYPE_HINTS = {
    'integer': 'Whole number',
    'decimal': 'Number',
    'currencyInr': 'Amount in rupees (digits only)',
    'percent': 'Percentage, 0-100',
    'date': 'Date (YYYY-MM-DD or DD/MM/YYYY)',
    'year': 'Four-digit year',
    'yearLabel': 'Year label, e.g. 2024-25',
    'boolean': 'Yes or No',
    'enum': 'Choose from the list',
    'multiEnum': 'One or more options, separated by commas',
    'orgUnit': 'School / centre code',
    'recordRef': 'Name as listed in the related table',
    'text': 'Text',
    'longText': 'Text',
}


def template_fields(block_def: dict) -> List[dict]:
    """Fields an officer fills in: everything except schema-derived ones."""
    return [f for f in block_def.get('fields', []) if not f.get('derive')]


def _options(field: dict, enums: dict) -> List[dict]:
    opts = field.get('options')
    if not opts and field.get('enum') in (enums or {}):
        opts = enums[field['enum']].get('options', [])
    return [o if isinstance(o, dict) else {'value': o, 'label': o} for o in (opts or [])]


def build_records_template(section_def: dict, block_def: dict, enums: Optional[Dict] = None) -> io.BytesIO:
    enums = enums or {}
    fields = template_fields(block_def)
    wb = openpyxl.Workbook()

    data = wb.active
    data.title = 'Data'
    lists = wb.create_sheet('Lists')
    lists.sheet_state = 'hidden'
    guide = wb.create_sheet('Instructions')

    list_col = 0
    unit_codes = list(
        OrgUnit.objects.filter(kind__in=['SCHOOL', 'CENTRE']).order_by('id').values_list('id', flat=True)
    )

    for col, field in enumerate(fields, start=1):
        letter = get_column_letter(col)
        cell = data.cell(row=1, column=col, value=field.get('label') or field['id'])
        cell.font = HEADER_FONT
        cell.fill = REQUIRED_FILL if field.get('required') else HEADER_FILL
        cell.alignment = Alignment(wrap_text=True, vertical='center')
        data.column_dimensions[letter].width = max(16, min(42, len(str(cell.value)) + 6))
        target = f'{letter}2:{letter}{TEMPLATE_ROWS + 1}'

        ftype = field.get('type') or 'text'
        choices: List[str] = []
        if ftype == 'enum':
            choices = [o.get('label', o.get('value')) for o in _options(field, enums)]
        elif ftype == 'boolean':
            choices = ['Yes', 'No']
        elif ftype == 'orgUnit':
            choices = unit_codes

        if choices:
            list_col += 1
            list_letter = get_column_letter(list_col)
            for i, choice in enumerate(choices, start=1):
                lists.cell(row=i, column=list_col, value=choice)
            dv = DataValidation(
                type='list',
                formula1=f"=Lists!${list_letter}$1:${list_letter}${len(choices)}",
                allow_blank=not field.get('required'),
                showErrorMessage=True,
                errorTitle='Not an accepted value',
                error=f"Choose a value for '{field.get('label')}' from the list.",
            )
            data.add_data_validation(dv)
            dv.add(target)
        elif ftype in ('integer', 'decimal', 'currencyInr', 'percent'):
            minimum = field.get('min', 0 if ftype in ('currencyInr', 'percent') else None)
            maximum = field.get('max', 100 if ftype == 'percent' else None)
            if minimum is not None or maximum is not None:
                if maximum is None:
                    dv = DataValidation(
                        type='whole' if ftype == 'integer' else 'decimal',
                        operator='greaterThanOrEqual', formula1=str(minimum),
                    )
                else:
                    dv = DataValidation(
                        type='whole' if ftype == 'integer' else 'decimal',
                        operator='between', formula1=str(minimum or 0), formula2=str(maximum),
                    )
                dv.showErrorMessage = True
                dv.errorTitle = 'Out of range'
                dv.error = f"'{field.get('label')}' must be {TYPE_HINTS[ftype].lower()}" + (
                    f" of at least {minimum}" if minimum is not None else '') + '.'
                data.add_data_validation(dv)
                dv.add(target)

    data.freeze_panes = 'A2'
    data.row_dimensions[1].height = 34

    # Instructions
    guide.append([f"{section_def.get('title', section_def['id'])} - {block_def.get('title', block_def['id'])}"])
    guide['A1'].font = Font(bold=True, size=13)
    guide.append(['Fill the "Data" sheet: one row per record, keep the header row as it is. '
                  'Red headers are required. Upload the file through the portal section\'s '
                  '"Import from CSV/XLSX" button.'])
    guide.append([])
    guide.append(['Column', 'Required', 'Accepted values', 'Notes'])
    for c in guide[4]:
        c.font = Font(bold=True)
    for field in fields:
        ftype = field.get('type') or 'text'
        accepted = TYPE_HINTS.get(ftype, 'Text')
        if ftype == 'enum':
            labels = [o.get('label', o.get('value')) for o in _options(field, enums)]
            accepted = 'One of: ' + '; '.join(map(str, labels))
        guide.append([
            field.get('label') or field['id'],
            'Yes' if field.get('required') else 'No',
            accepted,
            field.get('help', ''),
        ])
    for letter, width in (('A', 38), ('B', 10), ('C', 60), ('D', 60)):
        guide.column_dimensions[letter].width = width
    for row in guide.iter_rows(min_row=5):
        for c in row:
            c.alignment = Alignment(wrap_text=True, vertical='top')

    wb.active = 0
    out = io.BytesIO()
    wb.save(out)
    out.seek(0)
    return out
