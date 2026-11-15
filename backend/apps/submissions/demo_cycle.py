"""
A complete mock NIRF cycle, driven through the real endpoints.

Phase 1's acceptance criterion is that "the system successfully generates a
complete, compliant NIRF export based on mock data inputs, and the
maker-checker audit trail correctly logs all data modifications". This module
produces that cycle end to end - every section of every category, entered
through the portal, submitted by the maker, approved by the checker, exported -
so the criterion can be demonstrated (``seed_demo_cycle``) and kept true in CI
(``test_phase1_acceptance``).

Values are generated from the schema itself and nudged to satisfy its
cross-field rules, so a schema change is exercised automatically.

Safety: grants go only to dedicated demo officers on the reserved ``.invalid``
domain (RFC 2606, undeliverable by definition) and no mail is sent, so running
this can never email a real nodal officer.
"""

from datetime import date, timedelta
from typing import Any, Dict, List, Optional, Tuple

from django.utils import timezone

from apps.data_requests.models import DataRequest, DataRequestTarget, TargetStatus
from apps.data_requests.services import issue_grant
from apps.organogram.models import NodalOfficer, OfficerStatus, OrgUnit

from .models import FormSchema
from .validation_engine import apply_block_derives
from .views import resolve_section_schema

DEMO_DOMAIN = 'demo.invalid'
DEMO_NOTE = 'Mock data generated for the Phase 1 acceptance demonstration.'
NUMERIC = {'integer', 'decimal', 'currencyInr', 'percent'}


# ---------------------------------------------------------------------------
# Value generation
# ---------------------------------------------------------------------------

def _first_option(field: dict, enums: dict):
    options = field.get('options')
    if not options and field.get('enum') in enums:
        options = enums[field['enum']].get('options', [])
    values = [o.get('value') if isinstance(o, dict) else o for o in (options or [])]
    real = [v for v in values if str(v).lower() != 'other']
    return (real or values or [None])[0]


def mock_value(field: dict, idx: int, ctx: dict) -> Any:
    """A plausible, in-bounds value for one field."""
    ftype = field.get('type') or 'text'
    label = field.get('label') or field.get('id')
    if ftype == 'integer':
        return int(field.get('min') or 0) + 10 + (idx * 7) % 90
    if ftype == 'decimal':
        return round(float(field.get('min') or 0) + 12.5 + (idx * 3) % 40, 2)
    if ftype == 'currencyInr':
        return int(field.get('min') or 0) + 100000 * (1 + idx % 50)
    if ftype == 'percent':
        return 60 + idx % 35
    if ftype == 'boolean':
        return True
    if ftype == 'enum':
        return _first_option(field, ctx['enums'])
    if ftype == 'multiEnum':
        first = _first_option(field, ctx['enums'])
        return [first] if first is not None else []
    if ftype == 'date':
        # Dates rise with field order, so start < end and filing < grant hold.
        order = ctx.get('date_order', {}).get(field.get('id'), 0)
        return (date(2022, 4, 1) + timedelta(days=120 * order + idx)).isoformat()
    if ftype == 'year':
        return 2024
    if ftype == 'yearLabel':
        return '2024-25'
    if ftype == 'orgUnit':
        return ctx.get('school_id') or ctx['unit_id']
    if ftype == 'recordRef':
        return f'Mock Venture {idx}'
    return f'Mock {label} {idx}'


def _num(value) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0.0


def _split(total: float, parts: int) -> List[int]:
    total = int(round(total))
    base, extra = divmod(total, parts)
    return [base + (1 if i < extra else 0) for i in range(parts)]


def satisfy_rules(row: dict, rules: List[dict], derived: set) -> dict:
    """Nudge a generated row until it meets the block's cross-field rules."""
    for _ in range(3):
        for v in rules:
            rule = v.get('rule', {})
            op = rule.get('op')
            if op == 'sumEquals':
                target, parts = rule['target'], rule.get('parts', [])
                if target in derived:
                    for name, value in zip(parts, _split(_num(row.get(target)), len(parts))):
                        row[name] = value
                else:
                    row[target] = sum(_num(row.get(p)) for p in parts)
            elif op == 'lte':
                left, right = rule['left'], rule['right']
                if _num(row.get(left)) > _num(row.get(right)):
                    row[left] = int(_num(row.get(right)) // 2)
            elif op == 'lteSum':
                lefts, rights = rule.get('leftParts', []), rule.get('rightParts', [])
                cap = sum(_num(row.get(r)) for r in rights)
                if sum(_num(row.get(x)) for x in lefts) > cap:
                    for x in lefts:
                        row[x] = int(cap // (2 * max(len(lefts), 1)))
            elif op == 'dateOrder':
                start, end = rule.get('start'), rule.get('end')
                if row.get(start) and row.get(end) and str(row[start]) > str(row[end]):
                    row[start], row[end] = row[end], row[start]
            elif op == 'requiredIf':
                when = rule.get('when', {})
                if row.get(when.get('field')) == when.get('eq') and row.get(rule['field']) in (None, ''):
                    row[rule['field']] = 'Mock detail'
    return row


def mock_section(resolved_sec: dict, unit_id: str, enums: dict, school_id: str) -> Tuple[dict, dict]:
    """Payload (grids, questionnaires) and records for one section."""
    payload: Dict[str, Any] = {}
    records: Dict[str, List[dict]] = {}

    for blk in resolved_sec.get('blocks', []):
        kind = blk.get('kind')
        ctx = {'enums': enums, 'unit_id': unit_id, 'school_id': school_id}
        rules = blk.get('validations', []) or []

        if kind == 'questionnaire':
            answers = {q['id']: mock_value(q, i, ctx) for i, q in enumerate(blk.get('questions', []))}
            payload[blk['id']] = satisfy_rules(answers, rules, set())

        elif kind == 'grid':
            cols = blk.get('resolvedColumns') or (blk.get('columnAxis') or {}).get('fields', [])
            rows = blk.get('resolvedRows') or (blk.get('rowAxis') or {}).get('rows', [])
            derived_cols = {c['id'] for c in cols if c.get('derive')}
            grid = {}
            for r_idx, row_def in enumerate(rows):
                if row_def.get('derive'):
                    continue
                cells = {}
                for c_idx, col in enumerate(cols):
                    if col.get('derive'):
                        continue
                    eff = dict(col)
                    if row_def.get('type'):
                        eff['type'] = row_def['type']
                    cells[col['id']] = mock_value(eff, r_idx * 10 + c_idx + 1, ctx)
                grid[str(row_def['id'])] = cells
            grid = apply_block_derives(blk, grid, ctx)
            for key in grid:
                grid[key] = satisfy_rules(grid[key], rules, derived_cols)
            payload[blk['id']] = apply_block_derives(blk, grid, ctx)

        elif kind == 'records':
            fields = [f for f in blk.get('fields', []) if not f.get('derive')]
            ctx['date_order'] = {
                f['id']: i for i, f in enumerate(x for x in fields if x.get('type') == 'date')
            }
            rows = []
            for r_idx in range(3):
                row = {}
                for f_idx, f in enumerate(fields):
                    # Optional dates stay blank: a current employee has no
                    # leaving date, and a blank end date satisfies dateOrder.
                    if not f.get('required') and f.get('type') == 'date':
                        continue
                    row[f['id']] = mock_value(f, r_idx * 10 + f_idx + 1, ctx)
                rows.append(satisfy_rules(row, rules, set()))
            records[blk['id']] = rows
    return payload, records


# ---------------------------------------------------------------------------
# The cycle
# ---------------------------------------------------------------------------

def _demo_officer(unit: OrgUnit) -> NodalOfficer:
    officer, _ = NodalOfficer.objects.get_or_create(
        email=f'demo-{unit.id}@{DEMO_DOMAIN}',
        defaults={'name': f'Demo officer ({unit.short_name or unit.name})',
                  'status': OfficerStatus.ACTIVE, 'notes': DEMO_NOTE},
    )
    officer.assigned_units.add(unit)
    return officer


def run_demo_cycle(portal, admin, cycle_year: int = 2027, school_id: str = 'scee',
                   na_unit_kinds=('CENTRE',), reference: Optional[str] = None) -> Dict[str, Any]:
    """
    Run a full mock cycle. `portal` is an unauthenticated API client and
    `admin` one authenticated as a checker. Centres declare the unit-owned
    sections not applicable (they run no degree programmes); schools and
    central offices enter data. Every return is submitted and approved.
    """
    schema_obj = FormSchema.objects.filter(framework='NIRF', is_active=True).first()
    schema = schema_obj.content
    enums = schema.get('enums', {})
    sections = {s['id']: s for s in schema['sections']}
    category_ids = [c['id'] for c in schema['categories']]
    in_scope = sorted({sid for c in schema['categories'] for sid in c['sections']})
    item_ids = sorted({i for sid in in_scope for i in sections[sid].get('catalogueItemIds', [])})

    central_owners = {
        sections[sid]['ownership'].get('primaryOwnerUnitId')
        for sid in in_scope if sections[sid]['ownership'].get('submitBy') == 'central'
    }
    units = list(OrgUnit.objects.filter(kind__in=['SCHOOL', 'CENTRE'])) + list(
        OrgUnit.objects.filter(id__in=central_owners)
    )

    seq = DataRequest.objects.filter(framework='NIRF', cycle_year=cycle_year).count() + 1
    request = DataRequest.objects.create(
        reference=reference or f'DEMO/{cycle_year}/NIRF/{seq:03d}',
        title=f'[DEMO] NIRF {cycle_year} mock acceptance cycle',
        framework='NIRF', cycle_year=cycle_year, categories=category_ids,
        subject='[DEMO] mock cycle', message=DEMO_NOTE,
        deadline=timezone.now() + timedelta(days=30), data_item_ids=item_ids,
        created_by='demo-seeder',
    )

    tokens: Dict[str, str] = {}
    for unit in units:
        DataRequestTarget.objects.create(request=request, org_unit=unit,
                                         data_item_ids=item_ids, status=TargetStatus.PENDING)
        _grant, token, _url = issue_grant(request, unit, _demo_officer(unit), item_ids)
        tokens[unit.id] = token

    failures: List[Dict[str, Any]] = []
    submitted: List[str] = []

    for unit in units:
        token = tokens[unit.id]
        forms = portal.get(f'/api/portal/{token}/forms/').json()
        for item in forms.get('sections', []):
            sid = item['section']['id']
            if sid not in in_scope:
                continue
            sec_def = sections[sid]
            revision = item['submission']['revision']
            unit_owned = sec_def['ownership'].get('submitBy') == 'unit'

            if unit_owned and unit.kind in na_unit_kinds:
                body = {'revision': revision, 'notApplicable': True, 'payload': {}}
            else:
                resolved = resolve_section_schema(sec_def, cycle_year, unit=unit, enums=enums)
                payload, records = mock_section(resolved, unit.id, enums, school_id)
                body = {'revision': revision, 'notApplicable': False,
                        'payload': payload, 'records': records}

            saved = portal.put(f'/api/portal/{token}/forms/{sid}/', body, format='json')
            if saved.status_code != 200:
                failures.append({'unit': unit.id, 'section': sid, 'step': 'save', 'detail': saved.json()})
                continue
            done = portal.post(f'/api/portal/{token}/forms/{sid}/submit/',
                               {'warningNote': DEMO_NOTE}, format='json')
            if done.status_code != 200:
                failures.append({'unit': unit.id, 'section': sid, 'step': 'submit', 'detail': done.json()})
                continue
            submitted.append(done.json()['id'])

    # Faculty rows name the school they belong to; that school confirms them
    # before the checker may approve (the central-owner workflow).
    if school_id in tokens:
        portal.post(f'/api/portal/{tokens[school_id]}/forms/faculty-details/records/confirm/',
                    {'status': 'CONFIRMED', 'comment': DEMO_NOTE}, format='json')

    approved = 0
    for sub_id in submitted:
        res = admin.post(f'/api/submissions/{sub_id}/actions/',
                         {'action': 'approve', 'comment': DEMO_NOTE}, format='json')
        if res.status_code == 200:
            approved += 1
        else:
            failures.append({'submission': sub_id, 'step': 'approve', 'detail': res.json()})

    exports = {}
    for cat in category_ids:
        res = admin.get(f'/api/nirf/cycles/{cycle_year}/export/?category={cat}&requestId={request.id}')
        if res.status_code == 200:
            exports[cat] = res.content
        else:
            failures.append({'category': cat, 'step': 'export', 'detail': res.status_code})

    return {
        'request': request,
        'units': len(units),
        'submitted': len(submitted),
        'approved': approved,
        'exports': exports,
        'failures': failures,
    }
