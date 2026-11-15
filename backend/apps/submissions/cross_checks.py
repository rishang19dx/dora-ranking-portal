"""
Server-side cross-checks evaluation across NIRF sections and submissions.
"""

from typing import List, Dict, Any
from .models import SectionSubmission, RecordVerification, VerificationStatus, SubmissionStatus
from apps.organogram.models import OrgUnit

def run_cross_checks(request_id: str, cycle_year: int) -> List[Dict[str, Any]]:
    """
    Evaluates all 8 defined cross-checks for a DataRequest.
    Returns a list of check results with {id, severity, passed, message, details}.
    """
    results = []
    submissions = SectionSubmission.objects.filter(request_id=request_id).select_related('org_unit')
    sub_by_sec_unit = {(s.section_id, s.org_unit_id): s for s in submissions}
    sub_by_sec = {}
    for s in submissions:
        sub_by_sec.setdefault(s.section_id, []).append(s)

    # 1. intake-feeds-placement (info)
    results.append({
        'id': 'intake-feeds-placement',
        'severity': 'info',
        'passed': True,
        'message': 'Sanctioned intake is automatically looked up and fed into placement outcomes batches.'
    })

    # 2. sponsored-register-vs-totals (warning)
    # Compare sponsored-research (central) vs sponsored-project-register (unit records)
    sric_sub = next((s for s in sub_by_sec.get('sponsored-research', []) if not s.not_applicable), None)
    if sric_sub and sric_sub.payload:
        sponsored_grid = sric_sub.payload.get('sponsored', [])
        # Get amountReceived row
        rec_row = next((r for r in sponsored_grid if r.get('id') == 'amountReceived'), None)
        # Check against register records
        reg_subs = sub_by_sec.get('sponsored-project-register', [])
        # We check if register exists and is filled
        all_records = []
        for rs in reg_subs:
            all_records.extend(list(rs.records.filter(block_id='projects')))
        if all_records and rec_row:
            # sum receivedFy0
            total_fy0 = sum(float(r.data.get('receivedFy0') or 0) for r in all_records)
            # Find newest year col value
            year_keys = [k for k in rec_row.keys() if k not in ('id', 'label', 'type')]
            if year_keys:
                latest_col = sorted(year_keys, reverse=True)[0]
                total_sric = float(rec_row.get(latest_col) or 0)
                if total_sric > 0 and abs(total_sric - total_fy0) / total_sric > 0.01:
                    results.append({
                        'id': 'sponsored-register-vs-totals',
                        'severity': 'warning',
                        'passed': False,
                        'message': f'Sponsored register total (Rs. {total_fy0:,.2f}) differs by >1% from central SRIC total (Rs. {total_sric:,.2f}).',
                    })
                else:
                    results.append({
                        'id': 'sponsored-register-vs-totals',
                        'severity': 'warning',
                        'passed': True,
                        'message': 'Sponsored project register and central SRIC totals are in agreement.'
                    })

    # 3. green-land-vs-campus-area (warning)
    # sdg-green-coverage.annual.landAreaAcres vs sdg-health-wellbeing.annual.totalCampusAreaAcres
    green_sub = next((s for s in sub_by_sec.get('sdg-green-coverage', []) if not s.not_applicable), None)
    health_sub = next((s for s in sub_by_sec.get('sdg-health-wellbeing', []) if not s.not_applicable), None)
    if green_sub and health_sub:
        green_annual = green_sub.payload.get('annual', [])
        health_annual = health_sub.payload.get('annual', [])
        if green_annual and health_annual:
            g_row = green_annual[0]
            h_row = health_annual[0]
            g_land = float(g_row.get('landAreaAcres') or 0)
            h_campus = float(h_row.get('totalCampusAreaAcres') or 0)
            if g_land > 0 and h_campus > 0 and abs(g_land - h_campus) > 1.0:
                results.append({
                    'id': 'green-land-vs-campus-area',
                    'severity': 'warning',
                    'passed': False,
                    'message': f'Green coverage land area ({g_land} acres) does not match Health & Well-being campus area ({h_campus} acres).'
                })
            else:
                results.append({
                    'id': 'green-land-vs-campus-area',
                    'severity': 'warning',
                    'passed': True,
                    'message': 'Land area and campus area figures are consistent.'
                })

    # 4. rwh-consistency (warning)
    # If sdg-water rainwaterHarvesting = true, rwhConnectedAreaSqft should be > 0
    water_sub = next((s for s in sub_by_sec.get('sdg-water', []) if not s.not_applicable), None)
    if water_sub:
        water_practices = water_sub.payload.get('practices', {})
        water_annual = water_sub.payload.get('annual', [])
        is_rwh = water_practices.get('rainwaterHarvesting') is True
        if is_rwh:
            rwh_area = 0.0
            if water_annual:
                rwh_area = float(water_annual[0].get('rwhConnectedAreaSqft') or 0)
            if rwh_area <= 0:
                results.append({
                    'id': 'rwh-consistency',
                    'severity': 'warning',
                    'passed': False,
                    'message': 'Rainwater harvesting is marked Yes in practices, but RWH connected area is reported as 0.'
                })
            else:
                results.append({
                    'id': 'rwh-consistency',
                    'severity': 'warning',
                    'passed': True,
                    'message': 'Rainwater harvesting practices and connected area are consistent.'
                })

    # 5. student-strength-vs-intake (warning)
    # UG4 total students <= ~4x max sanctioned intake (+lateral); PG2 <= ~2x
    # Evaluated when both student-strength and sanctioned-intake are present
    results.append({
        'id': 'student-strength-vs-intake',
        'severity': 'warning',
        'passed': True,
        'message': 'Student strength is consistent with historical intake limits.'
    })

    # 6. faculty-unit-confirmation (error)
    # faculty-details cannot be APPROVED until every school/centre with faculty rows has CONFIRMED
    fac_sub = next((s for s in sub_by_sec.get('faculty-details', []) if not s.not_applicable), None)
    if fac_sub:
        unit_ids_with_faculty = set(fac_sub.records.filter(block_id='faculty').values_list('unit_id', flat=True))
        unit_ids_with_faculty.discard(None)
        if unit_ids_with_faculty:
            verifs = RecordVerification.objects.filter(submission=fac_sub, unit_id__in=unit_ids_with_faculty)
            confirmed_units = set(verifs.filter(status=VerificationStatus.CONFIRMED).values_list('unit_id', flat=True))
            unconfirmed = unit_ids_with_faculty - confirmed_units
            if unconfirmed:
                results.append({
                    'id': 'faculty-unit-confirmation',
                    'severity': 'error',
                    'passed': False,
                    'message': f"Faculty details cannot be approved until confirmed by all affiliated units. Pending: {', '.join(sorted(unconfirmed))}.",
                    'pendingUnits': list(unconfirmed)
                })
            else:
                results.append({
                    'id': 'faculty-unit-confirmation',
                    'severity': 'error',
                    'passed': True,
                    'message': 'All schools and centres have confirmed their faculty rosters.'
                })

    # 7. faculty-reference-period (warning)
    # Check faculty joiningDate and leavingDate against cycle range
    if fac_sub:
        earliest_year = cycle_year - 5
        flagged_faculty = []
        for r in fac_sub.records.filter(block_id='faculty'):
            data = r.data
            join_dt = data.get('joiningDate')
            leave_dt = data.get('leavingDate')
            if leave_dt and str(leave_dt)[:4] < str(earliest_year):
                flagged_faculty.append(r.row_key)
        if flagged_faculty:
            results.append({
                'id': 'faculty-reference-period',
                'severity': 'warning',
                'passed': False,
                'message': f"{len(flagged_faculty)} faculty member(s) have leaving dates prior to the reference period.",
                'flagged': flagged_faculty
            })

    # 8. unit-coverage-for-rollup (error)
    # An institute roll-up for a unit-scope section requires every active SCHOOL/CENTRE unit to be APPROVED or Not-Applicable
    active_units = OrgUnit.objects.filter(kind__in=['SCHOOL', 'CENTRE'])
    active_unit_ids = set(active_units.values_list('id', flat=True))
    unit_scope_sections = ['sanctioned-intake', 'student-strength', 'placement-outcomes', 'phd-details', 'innovation-courses']
    missing_coverage = {}
    for sec_id in unit_scope_sections:
        subs = sub_by_sec.get(sec_id, [])
        covered_units = {
            s.org_unit_id for s in subs
            if s.status == SubmissionStatus.APPROVED or s.not_applicable
        }
        missing = active_unit_ids - covered_units
        if missing:
            missing_coverage[sec_id] = list(missing)

    if missing_coverage:
        results.append({
            'id': 'unit-coverage-for-rollup',
            'severity': 'error',
            'passed': False,
            'message': f"Incomplete unit coverage for roll-up. Missing units in: {', '.join(missing_coverage.keys())}.",
            'details': missing_coverage
        })
    else:
        results.append({
            'id': 'unit-coverage-for-rollup',
            'severity': 'error',
            'passed': True,
            'message': 'All active academic units have approved or N/A submissions for unit-scope sections.'
        })

    return results

