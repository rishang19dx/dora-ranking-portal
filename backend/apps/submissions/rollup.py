"""
Roll-up engine for NIRF submissions across schools and centres.
Computes institute-level totals for categories and generates DCS export structures.
"""

from typing import Dict, Any, List, Optional
from apps.organogram.models import OrgUnit
from .models import SectionSubmission, FormSchema, SubmissionStatus

def compute_category_rollup(
    category_id: str,
    cycle_year: int,
    request_id: Optional[str] = None,
    allow_partial: bool = False
) -> Dict[str, Any]:
    """
    Computes aggregated institute totals for a NIRF category.
    """
    schema_obj = FormSchema.objects.filter(framework='NIRF', is_active=True).first()
    if not schema_obj:
        raise ValueError("No active NIRF schema found.")

    schema = schema_obj.content
    cat_def = next((c for c in schema.get('categories', []) if c['id'] == category_id), None)
    if not cat_def:
        raise ValueError(f"Category '{category_id}' not found in schema.")

    section_map = {s['id']: s for s in schema.get('sections', [])}
    category_section_ids = cat_def.get('sections', [])

    # Fetch relevant submissions
    sub_qs = SectionSubmission.objects.all().select_related('org_unit')
    if request_id:
        sub_qs = sub_qs.filter(request_id=request_id)
    else:
        sub_qs = sub_qs.filter(request__cycle_year=cycle_year)

    submissions = list(sub_qs)
    sub_by_sec: Dict[str, List[SectionSubmission]] = {}
    for s in submissions:
        sub_by_sec.setdefault(s.section_id, []).append(s)

    active_units = list(OrgUnit.objects.filter(kind__in=['SCHOOL', 'CENTRE']))
    active_unit_ids = {u.id for u in active_units}

    sections_result = {}
    coverage_report = {}

    for sec_id in category_section_ids:
        sec_def = section_map.get(sec_id)
        if not sec_def:
            continue

        ownership = sec_def.get('ownership', {})
        submit_by = ownership.get('submitBy', 'central')
        subs = sub_by_sec.get(sec_id, [])

        if submit_by == 'unit':
            covered_units = {
                s.org_unit_id for s in subs
                if (s.status == SubmissionStatus.APPROVED or s.not_applicable)
            }
            missing = active_unit_ids - covered_units
            coverage_report[sec_id] = {
                'totalEligible': len(active_unit_ids),
                'covered': len(covered_units),
                'missingUnits': list(missing),
                'complete': len(missing) == 0
            }

            if not allow_partial and missing:
                # Still compute what we have, but flag in coverage
                pass

            # Roll up unit submissions
            rolled_blocks = {}
            for blk in sec_def.get('blocks', []):
                b_id = blk['id']
                kind = blk['kind']

                if kind == 'grid':
                    # Aggregate grid rows
                    aggregated_rows = {}
                    for s in subs:
                        if s.not_applicable:
                            continue
                        raw_grid_data = s.payload.get(b_id, [])
                        if isinstance(raw_grid_data, dict):
                            grid_data = []
                            for r_k, r_v in raw_grid_data.items():
                                if isinstance(r_v, dict):
                                    row_dict = dict(r_v)
                                    if 'id' not in row_dict:
                                        row_dict['id'] = r_k
                                    grid_data.append(row_dict)
                        elif isinstance(raw_grid_data, list):
                            grid_data = raw_grid_data
                        else:
                            grid_data = []

                        for r in grid_data:
                            if not isinstance(r, dict):
                                continue
                            # Row key could be programme or level or id
                            row_key = r.get('id') or r.get('programmeId') or r.get('programme') or r.get('nirfLevel') or 'total'
                            if row_key not in aggregated_rows:
                                aggregated_rows[row_key] = dict(r)
                            else:
                                for k, v in r.items():
                                    if isinstance(v, (int, float)):
                                        aggregated_rows[row_key][k] = aggregated_rows[row_key].get(k, 0) + v

                    rolled_blocks[b_id] = list(aggregated_rows.values())

                elif kind == 'records':
                    all_records = []
                    for s in subs:
                        if s.not_applicable:
                            continue
                        for rec in s.records.filter(block_id=b_id):
                            all_records.append(rec.data)
                    rolled_blocks[b_id] = all_records

            sections_result[sec_id] = {
                'definition': sec_def,
                'submitBy': 'unit',
                'blocks': rolled_blocks,
                'coverage': coverage_report[sec_id]
            }

        else:
            # Central submission: take primary owner unit's submission
            primary_unit_id = ownership.get('primaryOwnerUnitId')
            sub = next((s for s in subs if s.org_unit_id == primary_unit_id and not s.not_applicable), None)
            if not sub:
                sub = next((s for s in subs if not s.not_applicable), None)

            rolled_blocks = {}
            if sub:
                for blk in sec_def.get('blocks', []):
                    b_id = blk['id']
                    if blk['kind'] == 'records':
                        rolled_blocks[b_id] = [r.data for r in sub.records.filter(block_id=b_id)]
                    else:
                        rolled_blocks[b_id] = sub.payload.get(b_id, [] if blk['kind'] == 'grid' else {})

            sections_result[sec_id] = {
                'definition': sec_def,
                'submitBy': 'central',
                'submissionId': sub.id if sub else None,
                'status': sub.status if sub else 'PENDING',
                'blocks': rolled_blocks,
            }

    all_coverage_ok = all(c.get('complete', True) for c in coverage_report.values())

    return {
        'categoryId': category_id,
        'categoryTitle': cat_def.get('label'),
        'dcsTitle': cat_def.get('dcsTitle'),
        'cycleYear': cycle_year,
        'coverageComplete': all_coverage_ok,
        'coverage': coverage_report,
        'sections': sections_result
    }

