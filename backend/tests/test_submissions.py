import pytest
import json
from io import BytesIO
import openpyxl
from django.utils import timezone
from django.core.exceptions import ValidationError
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from apps.organogram.models import OrgUnit, NodalOfficer
from apps.data_requests.models import DataRequest, DataRequestTarget, PortalAccessGrant, ProofUpload, TargetStatus
from apps.data_requests.services import dispatch_data_request
from apps.submissions.models import (
    FormSchema,
    SectionSubmission,
    SubmissionRecord,
    RecordVerification,
    SubmissionAuditLog,
    SubmissionStatus,
    VerificationStatus,
)
from apps.submissions.year_engine import (
    latest_academic_year_start,
    latest_calendar_year,
    next_academic_year_start,
    academic_year_label,
    resolve_year_series,
    resolve_batch_years,
)
from apps.submissions.validation_engine import (
    amount_in_words_inr,
    evaluate_derive,
    validate_rule,
    validate_block_data,
)
from apps.submissions.cross_checks import run_cross_checks
from apps.submissions.rollup import compute_category_rollup
from apps.submissions.dcs_export import generate_category_excel

User = get_user_model()

@pytest.fixture
def api_client():
    return APIClient()

@pytest.fixture
def admin_user(db):
    return User.objects.create_user(
        username='submissions_admin',
        email='submissions_admin@iitmandi.ac.in',
        password='password123',
        role='ADMIN'
    )

@pytest.fixture
def seeded_db(db):
    from django.core.management import call_command
    call_command('seed_organogram')
    call_command('load_form_schema')

# -----------------------------------------------------------------------------
# 1. Year Engine Tests (Golden Vectors for Cycle 2026 and 2027)
# -----------------------------------------------------------------------------

def test_year_engine_cycles():
    # Cycle 2026 vectors
    assert latest_academic_year_start(2026) == 2024
    assert next_academic_year_start(2026) == 2025
    assert resolve_year_series('academic', 3, 2026) == ["2024-25", "2023-24", "2022-23"]
    assert resolve_year_series('academic', 6, 2026) == ["2024-25", "2023-24", "2022-23", "2021-22", "2020-21", "2019-20"]
    assert resolve_year_series('calendar', 3, 2026) == [2024, 2023, 2022]
    assert academic_year_label(next_academic_year_start(2026)) == "2025-26"

    # Cycle 2027 vectors
    assert latest_academic_year_start(2027) == 2025
    assert resolve_year_series('academic', 3, 2027) == ["2025-26", "2024-25", "2023-24"]
    assert resolve_year_series('calendar', 3, 2027) == [2025, 2024, 2023]
    assert academic_year_label(next_academic_year_start(2027)) == "2026-27"

    # Placement batch rules
    ug_batch = resolve_batch_years('2022-23', 'UG4')
    assert ug_batch['entryAcademicYear'] == '2019-20'
    assert ug_batch['lateralAcademicYear'] == '2020-21'

    pg_batch = resolve_batch_years('2022-23', 'PG2')
    assert pg_batch['entryAcademicYear'] == '2021-22'
    assert pg_batch['lateralAcademicYear'] is None

# -----------------------------------------------------------------------------
# 2. Validation & Derive Engine Tests
# -----------------------------------------------------------------------------

def test_derive_and_currency_words():
    # INR in words tests
    assert amount_in_words_inr(2200000) == "Twenty Two Lakh"
    assert amount_in_words_inr(1850000) == "Eighteen Lakh Fifty Thousand"
    assert amount_in_words_inr(1700000) == "Seventeen Lakh"
    assert amount_in_words_inr(1234567) == "Twelve Lakh Thirty Four Thousand Five Hundred Sixty Seven"
    assert amount_in_words_inr(150000000) == "Fifteen Crore"
    assert amount_in_words_inr(0) == "Zero"

    # Derive sum
    field_def = {'id': 'total', 'derive': {'fn': 'sum', 'of': ['male', 'female']}}
    assert evaluate_derive(field_def, {'male': 120, 'female': 30}) == 150

    # Derive amountInWordsInr
    words_field = {'id': 'words', 'derive': {'fn': 'amountInWordsInr', 'of': 'amount'}}
    assert evaluate_derive(words_field, {'amount': 2200000}) == "Twenty Two Lakh"

def test_validation_rules_and_golden_vectors():
    # UG Placement Golden Vector 2022-23: placed 207, graduated 232, higher 24
    rule_placed = {'op': 'lte', 'left': 'placed', 'right': 'graduated'}
    assert validate_rule(rule_placed, {'placed': 207, 'graduated': 232}) is True
    assert validate_rule(rule_placed, {'placed': 240, 'graduated': 232}) is False

    rule_sum = {'op': 'lteSum', 'leftParts': ['placed', 'higherStudies'], 'rightParts': ['graduated']}
    assert validate_rule(rule_sum, {'placed': 207, 'higherStudies': 24, 'graduated': 232}) is True

    # Student strength state split: total = within + outside + country
    rule_state = {'op': 'sumEquals', 'target': 'total', 'parts': ['withinState', 'outsideState', 'outsideCountry']}
    assert validate_rule(rule_state, {'total': 100, 'withinState': 20, 'outsideState': 75, 'outsideCountry': 5}) is True
    assert validate_rule(rule_state, {'total': 100, 'withinState': 20, 'outsideState': 70, 'outsideCountry': 5}) is False

    # SDG Waste 2026: Solid 720 tons = Dry 288 + Wet 432
    rule_waste = {'op': 'sumEquals', 'target': 'totalSolidTons', 'parts': ['dryTons', 'wetTons'], 'tolerancePct': 2}
    assert validate_rule(rule_waste, {'totalSolidTons': 720, 'dryTons': 288, 'wetTons': 432}) is True

# -----------------------------------------------------------------------------
# 3. Audit Log Immutability and PII-Free Storage
# -----------------------------------------------------------------------------

@pytest.mark.django_db
def test_audit_log_immutability_and_pii_safety(seeded_db):
    log = SubmissionAuditLog.objects.create(
        actor_type='OFFICER',
        actor_id='no_test',
        action='UPDATE',
        delta={'updatedField': 'experienceMonths', 'count': 5}
    )
    # Attempt update: must raise ValidationError
    with pytest.raises(ValidationError):
        log.actor_type = 'ADMIN'
        log.save()

    # Attempt delete: must raise ValidationError
    with pytest.raises(ValidationError):
        log.delete()

# -----------------------------------------------------------------------------
# 4. End-to-End Submission, Validation, Token Scoping & Rollup
# -----------------------------------------------------------------------------

@pytest.mark.django_db
def test_portal_flow_and_rollup(api_client, seeded_db, admin_user):
    # 1. Dispatch NIRF 2027 request with sections for SCEE
    payload = {
        'title': 'NIRF 2027 Institutional Data Call',
        'framework': 'NIRF',
        'cycleYear': 2027,
        'subject': 'NIRF 2027 Data Call',
        'message': 'Please submit departmental data.',
        'deadline': '2026-12-31T23:59:59Z',
        'sections': [
            {'unitId': 'scee', 'dataItemIds': ['student-intake', 'diversity']},
            {'unitId': 'estate-works', 'dataItemIds': ['pcs-facilities', 'sustainability-practices']}
        ],
        'categories': ['OVERALL', 'ENGINEERING']
    }
    dispatch_res = api_client.post('/api/data-requests/', payload, format='json')
    assert dispatch_res.status_code == 201

    grants = dispatch_res.data['issuedGrants']
    assert len(grants) > 0
    scee_grant = next(g for g in grants if g['unitId'] == 'scee')
    token = scee_grant['portalUrl'].split('/portal/')[1]

    # 2. Get authorized forms
    forms_res = api_client.get(f'/api/portal/{token}/forms/')
    assert forms_res.status_code == 200
    sec_ids = [s['section']['id'] for s in forms_res.data['sections']]
    assert 'student-strength' in sec_ids or 'sanctioned-intake' in sec_ids

    # 3. Test token scoping: unauthorized section returns 404
    unauth_save = api_client.put(
        f'/api/portal/{token}/forms/sdg-energy/',
        {'payload': {}},
        format='json'
    )
    assert unauth_save.status_code == 404

    # 4. Fill Student Strength form with validation error (outside state doesn't add up)
    target_sec = 'student-strength'
    invalid_payload = {
        'strength': [
            {
                'id': 'cse',
                'male': 80,
                'female': 20,
                'total': 100,
                'withinState': 10,
                'outsideState': 50,  # Sum = 60 != 100
                'outsideCountry': 0,
                'economicallyBackward': 10,
                'sociallyChallenged': 30,
                'reimbGovt': 20,
                'reimbInstitution': 10,
                'reimbPrivate': 5,
                'noReimb': 65
            }
        ]
    }
    save_res = api_client.put(
        f'/api/portal/{token}/forms/{target_sec}/',
        {'payload': invalid_payload, 'notApplicable': False, 'revision': 1},
        format='json'
    )
    assert save_res.status_code == 200

    # Try submit: must fail with validation errors
    submit_fail = api_client.post(
        f'/api/portal/{token}/forms/{target_sec}/submit/',
        {},
        format='json'
    )
    assert submit_fail.status_code == 400
    assert 'validationErrors' in submit_fail.data

    # Fix payload
    valid_payload = {
        'strength': [
            {
                'id': 'cse',
                'male': 80,
                'female': 20,
                'total': 100,
                'withinState': 10,
                'outsideState': 90,
                'outsideCountry': 0,
                'economicallyBackward': 10,
                'sociallyChallenged': 30,
                'reimbGovt': 20,
                'reimbInstitution': 10,
                'reimbPrivate': 5,
                'noReimb': 65
            }
        ]
    }
    api_client.put(
        f'/api/portal/{token}/forms/{target_sec}/',
        {'payload': valid_payload, 'notApplicable': False, 'revision': 2},
        format='json'
    )

    # Submit valid form
    submit_ok = api_client.post(
        f'/api/portal/{token}/forms/{target_sec}/submit/',
        {},
        format='json'
    )
    assert submit_ok.status_code == 200
    assert submit_ok.data['status'] == 'SUBMITTED'

    # 5. Admin Maker-Checker actions (Approve, Request Correction, Reopen)
    api_client.force_authenticate(user=admin_user)
    sub_id = submit_ok.data['id']

    # Admin requests correction
    req_corr = api_client.post(
        f'/api/submissions/{sub_id}/actions/',
        {'action': 'requestCorrection', 'comment': 'Please verify reimbursement counts'},
        format='json'
    )
    assert req_corr.status_code == 200
    assert req_corr.data['status'] == 'CORRECTION_REQUESTED'

    # Officer re-submits
    api_client.force_authenticate(user=None)
    resubmit = api_client.post(
        f'/api/portal/{token}/forms/{target_sec}/submit/',
        {},
        format='json'
    )
    assert resubmit.status_code == 200
    assert resubmit.data['status'] == 'SUBMITTED'

    # Admin approves
    api_client.force_authenticate(user=admin_user)
    approve_res = api_client.post(
        f'/api/submissions/{sub_id}/actions/',
        {'action': 'approve', 'comment': 'Verified with academic section'},
        format='json'
    )
    assert approve_res.status_code == 200
    assert approve_res.data['status'] == 'APPROVED'

    # 6. Test Category Rollup & Excel Export
    rollup_res = api_client.get('/api/nirf/cycles/2027/rollup/?category=OVERALL&allowPartial=1')
    assert rollup_res.status_code == 200
    assert 'sections' in rollup_res.data

    export_res = api_client.get('/api/nirf/cycles/2027/export/?category=OVERALL&allowPartial=1')
    assert export_res.status_code == 200
    assert export_res['Content-Type'] == 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    wb = openpyxl.load_workbook(BytesIO(export_res.content))
    assert len(wb.sheetnames) > 0

# -----------------------------------------------------------------------------
# 5. SDG Anomaly Warning Tests (Land Area 56 vs 503, RWH 0 with Harvesting=Yes)
# -----------------------------------------------------------------------------

@pytest.mark.django_db
def test_sdg_anomalies_flag_warnings(seeded_db):
    req = DataRequest.objects.create(
        reference="DORA/2026/NIRF/999",
        title="SDG 2026 Check",
        framework="NIRF",
        cycle_year=2026,
        deadline=timezone.now()
    )
    estate_unit = OrgUnit.objects.get(id='estate-works')
    dean_students = OrgUnit.objects.get(id='dean-students')

    # Green coverage land area = 56
    SectionSubmission.objects.create(
        request=req,
        org_unit=estate_unit,
        section_id='sdg-green-coverage',
        schema_version='1.0.0',
        status=SubmissionStatus.SUBMITTED,
        payload={
            'annual': [{'landAreaAcres': 56.0, 'greenAreaAcres': 30.0}]
        }
    )

    # Health & Wellbeing campus area = 503
    SectionSubmission.objects.create(
        request=req,
        org_unit=dean_students,
        section_id='sdg-health-wellbeing',
        schema_version='1.0.0',
        status=SubmissionStatus.SUBMITTED,
        payload={
            'annual': [{'totalCampusAreaAcres': 503.0}]
        }
    )

    # Water with RWH = True but rwhConnectedAreaSqft = 0
    SectionSubmission.objects.create(
        request=req,
        org_unit=estate_unit,
        section_id='sdg-water',
        schema_version='1.0.0',
        status=SubmissionStatus.SUBMITTED,
        payload={
            'practices': {'rainwaterHarvesting': True},
            'annual': [{'rwhConnectedAreaSqft': 0.0}]
        }
    )

    checks = run_cross_checks(req.id, 2026)
    check_map = {c['id']: c for c in checks}

    # Land area vs campus area mismatch raises warning
    assert check_map['green-land-vs-campus-area']['passed'] is False
    assert check_map['green-land-vs-campus-area']['severity'] == 'warning'

    # RWH consistency raises warning
    assert check_map['rwh-consistency']['passed'] is False
    assert check_map['rwh-consistency']['severity'] == 'warning'

@pytest.mark.django_db
def test_programme_registry_and_import(api_client, seeded_db, admin_user):
    api_client.force_authenticate(user=admin_user)

    # 1. Create a programme
    create_res = api_client.post('/api/programmes/', {
        'unitId': 'scee',
        'name': 'B.Tech in Computer Science and Engineering',
        'nirfLevel': 'UG4',
        'active': True,
        'startAcademicYear': '2015-16'
    }, format='json')
    assert create_res.status_code == 201
    prog_id = create_res.data['id']

    # 2. List programmes
    list_res = api_client.get('/api/programmes/?unitId=scee')
    assert list_res.status_code == 200
    assert len(list_res.data) == 1

    # 3. CSV Import
    csv_data = (
        "unit,name,level,active,startAcademicYear\n"
        "sbs,B.Tech in Bioengineering,UG4,True,2018-19\n"
        "sbs,M.Tech in Biotechnology,PG2,True,2020-21\n"
    ).encode('utf-8')
    csv_file = BytesIO(csv_data)
    csv_file.name = "programmes.csv"

    import_res = api_client.post('/api/programmes/import/', {'file': csv_file}, format='multipart')
    assert import_res.status_code == 200
    assert import_res.data['created'] == 2

    # Verify programmes created
    sbs_progs = api_client.get('/api/programmes/?unitId=sbs')
    assert len(sbs_progs.data) == 2

    # 4. Delete programme
    del_res = api_client.delete(f'/api/programmes/{prog_id}/')
    assert del_res.status_code == 204

@pytest.mark.django_db
def test_faculty_import_and_unit_confirmation_workflow(api_client, seeded_db, admin_user):
    # Ensure nodal officers exist for units
    fac_unit = OrgUnit.objects.get(id='faculty-service-matters')
    fac_officer = NodalOfficer.objects.create(
        name='AR Faculty Affairs',
        email='ar_faculty@iitmandi.ac.in',
        status='ACTIVE'
    )
    fac_officer.assigned_units.add(fac_unit)

    scee_unit = OrgUnit.objects.get(id='scee')
    scee_officer = NodalOfficer.objects.filter(assigned_units=scee_unit).first()
    if not scee_officer:
        scee_officer = NodalOfficer.objects.create(
            name='SCEE Chair',
            email='chairscee_test@iitmandi.ac.in',
            status='ACTIVE'
        )
        scee_officer.assigned_units.add(scee_unit)

    # 1. Dispatch request with faculty-roster to faculty-service-matters and scee
    payload = {
        'title': 'Faculty Details Call',
        'framework': 'NIRF',
        'cycleYear': 2027,
        'subject': 'Faculty Details',
        'message': 'Upload faculty.',
        'deadline': '2026-12-31T23:59:59Z',
        'sections': [
            {'unitId': 'faculty-service-matters', 'dataItemIds': ['faculty-roster']},
            {'unitId': 'scee', 'dataItemIds': ['faculty-roster']}
        ],
        'categories': ['OVERALL']
    }
    dispatch_res = api_client.post('/api/data-requests/', payload, format='json')
    assert dispatch_res.status_code == 201
    grants = dispatch_res.data['issuedGrants']

    fac_grant = next(g for g in grants if g['unitId'] == 'faculty-service-matters')
    scee_grant = next(g for g in grants if g['unitId'] == 'scee')
    fac_token = fac_grant['portalUrl'].split('/portal/')[1]
    scee_token = scee_grant['portalUrl'].split('/portal/')[1]

    # Initialize forms
    api_client.get(f'/api/portal/{fac_token}/forms/')

    # 2. Import Faculty CSV
    csv_content = (
        "employeeId,name,designation,gender,qualification,experienceMonths,currentlyWorking,joiningDate,associationType,unitId\n"
        "EMP001,Dr. John Doe,Professor,Male,Ph.D,120,True,2014-07-01,Regular,scee\n"
    ).encode('utf-8')
    csv_file = BytesIO(csv_content)
    csv_file.name = "faculty_roster.csv"

    imp_res = api_client.post(
        f'/api/portal/{fac_token}/forms/faculty-details/records/import/',
        {'file': csv_file, 'blockId': 'faculty'},
        format='multipart'
    )
    assert imp_res.status_code == 200
    assert imp_res.data['created'] == 1

    # Submit faculty submission
    sub_res = api_client.post(
        f'/api/portal/{fac_token}/forms/faculty-details/submit/',
        {},
        format='json'
    )
    assert sub_res.status_code == 200
    sub_id = sub_res.data['id']

    # 3. Admin attempts to approve -> blocked because scee confirmation is pending!
    api_client.force_authenticate(user=admin_user)
    appr_fail = api_client.post(
        f'/api/submissions/{sub_id}/actions/',
        {'action': 'approve', 'comment': 'Attempting approval'},
        format='json'
    )
    assert appr_fail.status_code == 400
    assert 'Confirmation pending' in appr_fail.data['error']

    # 4. SCEE confirms its faculty rows
    api_client.force_authenticate(user=None)
    conf_res = api_client.post(
        f'/api/portal/{scee_token}/forms/faculty-details/records/confirm/',
        {'status': 'CONFIRMED', 'comment': 'All SCEE faculty verified.'},
        format='json'
    )
    assert conf_res.status_code == 200
    assert conf_res.data['status'] == 'CONFIRMED'

    # 5. Admin approves -> now succeeds!
    api_client.force_authenticate(user=admin_user)
    appr_ok = api_client.post(
        f'/api/submissions/{sub_id}/actions/',
        {'action': 'approve', 'comment': 'All school confirmations received'},
        format='json'
    )
    assert appr_ok.status_code == 200
    assert appr_ok.data['status'] == 'APPROVED'

# -----------------------------------------------------------------------------
# 9. Published 2026 Golden Vectors Test
# -----------------------------------------------------------------------------

def test_published_2026_overall_golden_vectors():
    """
    Asserts IIT Mandi published 2026 Overall NIRF values pass validation with 0 errors.
    """
    with open('apps/submissions/fixtures/nirf_form_schema.json') as f:
        schema = json.load(f)

    sec_map = {s['id']: s for s in schema['sections']}

    # 1. PhD Enrolment (FT: 915, PT: 66)
    phd_sec = sec_map['phd-details']
    enr_blk = next(b for b in phd_sec['blocks'] if b['id'] == 'enrolment')
    enr_blk['resolvedRows'] = enr_blk['rowAxis']['rows']
    enr_blk['resolvedColumns'] = enr_blk['columnAxis']['fields']
    enr_data = {'fullTime': {'total': 915}, 'partTime': {'total': 66}}
    errs, warns = validate_block_data(enr_blk, enr_data)
    assert len(errs) == 0

    # 2. PhD Graduated (FT: 71, 54, 64; PT: 5, 3, 10 for 2024-25, 2023-24, 2022-23)
    grad_blk = next(b for b in phd_sec['blocks'] if b['id'] == 'graduated')
    grad_blk['resolvedRows'] = grad_blk['rowAxis']['rows']
    grad_blk['resolvedColumns'] = [{'id': y, 'label': y} for y in ['2024-25', '2023-24', '2022-23']]
    grad_data = {
        'fullTime': {'2024-25': 71, '2023-24': 54, '2022-23': 64},
        'partTime': {'2024-25': 5, '2023-24': 3, '2022-23': 10}
    }
    errs, warns = validate_block_data(grad_blk, grad_data)
    assert len(errs) == 0

    # 3. UG Placement Batches
    plc_sec = sec_map['placement-outcomes']
    ug_blk = next(b for b in plc_sec['blocks'] if b['id'] == 'ug')
    ug_blk['resolvedRows'] = [
        {'id': '2022-23', 'label': '2022-23'},
        {'id': '2023-24', 'label': '2023-24'},
        {'id': '2024-25', 'label': '2024-25'}
    ]
    ug_blk['resolvedColumns'] = ug_blk['columnAxis']['fields']
    ug_data = {
        '2022-23': {'intake': 258, 'admitted': 240, 'lateralEntry': 0, 'graduated': 232, 'placed': 207, 'higherStudies': 24},
        '2023-24': {'intake': 301, 'admitted': 293, 'lateralEntry': 0, 'graduated': 280, 'placed': 199, 'higherStudies': 73},
        '2024-25': {'intake': 301, 'admitted': 284, 'lateralEntry': 0, 'graduated': 272, 'placed': 211, 'higherStudies': 61}
    }
    errs, warns = validate_block_data(ug_blk, ug_data)
    assert len(errs) == 0

    # 4. PG Placement Batches
    pg_blk = next(b for b in plc_sec['blocks'] if b['id'] == 'pg')
    pg_blk['resolvedRows'] = [
        {'id': '2022-23', 'label': '2022-23'},
        {'id': '2023-24', 'label': '2023-24'},
        {'id': '2024-25', 'label': '2024-25'}
    ]
    pg_blk['resolvedColumns'] = pg_blk['columnAxis']['fields']
    pg_data = {
        '2022-23': {'intake': 413, 'admitted': 301, 'graduated': 247, 'placed': 156, 'higherStudies': 91},
        '2023-24': {'intake': 300, 'admitted': 300, 'graduated': 266, 'placed': 110, 'higherStudies': 111},
        '2024-25': {'intake': 248, 'admitted': 248, 'graduated': 216, 'placed': 127, 'higherStudies': 89}
    }
    errs, warns = validate_block_data(pg_blk, pg_data)
    assert len(errs) == 0

    # 5. SDG Waste (Solid: 720, Horticulture: 13, Dry: 288, Wet: 432)
    wst_sec = sec_map['sdg-waste']
    wst_blk = next(b for b in wst_sec['blocks'] if b['id'] == 'annual')
    wst_blk['resolvedRows'] = [{'id': '2024-25', 'label': '2024-25'}]
    wst_blk['resolvedColumns'] = wst_blk['columnAxis']['fields']
    wst_data = {
        '2024-25': {'totalSolidTons': 720, 'horticultureTons': 13, 'dryTons': 288, 'wetTons': 432}
    }
    errs, warns = validate_block_data(wst_blk, wst_data)
    assert len(errs) == 0

# -----------------------------------------------------------------------------
# 10. Published 2026 SDG Anomalies Raise Warnings Test
# -----------------------------------------------------------------------------

@pytest.mark.django_db
def test_published_2026_sdg_anomalies_raise_warnings(seeded_db):
    """
    Asserts the two known anomalies in IIT Mandi's published SDG 2026 data
    raise advisory warnings in cross-checks:
      1. Land area 56 acres vs campus area 503 acres
      2. RWH connected area 0 with rainwater harvesting = Yes
    """
    unit = OrgUnit.objects.first()
    req = DataRequest.objects.create(
        title='SDG 2026 Anomaly Check',
        framework='NIRF',
        cycle_year=2026,
        deadline='2026-12-31T23:59:59Z'
    )

    # Green coverage: 56 acres
    SectionSubmission.objects.create(
        request=req,
        org_unit=unit,
        section_id='sdg-green-coverage',
        status=SubmissionStatus.SUBMITTED,
        payload={'annual': [{'landAreaAcres': 56}]}
    )

    # Health & well-being: 503 acres
    SectionSubmission.objects.create(
        request=req,
        org_unit=unit,
        section_id='sdg-health-wellbeing',
        status=SubmissionStatus.SUBMITTED,
        payload={'annual': [{'totalCampusAreaAcres': 503}]}
    )

    # Water: RWH Yes, but connected area 0
    SectionSubmission.objects.create(
        request=req,
        org_unit=unit,
        section_id='sdg-water',
        status=SubmissionStatus.SUBMITTED,
        payload={
            'practices': {'rainwaterHarvesting': True},
            'annual': [{'rwhConnectedAreaSqft': 0}]
        }
    )

    checks = run_cross_checks(req.id, 2026)
    checks_by_id = {c['id']: c for c in checks}

    # Anomaly 1: green-land-vs-campus-area
    chk1 = checks_by_id.get('green-land-vs-campus-area')
    assert chk1 is not None
    assert chk1['passed'] is False
    assert chk1['severity'] == 'warning'
    assert '56.0 acres' in chk1['message']
    assert '503.0 acres' in chk1['message']

    # Anomaly 2: rwh-consistency
    chk2 = checks_by_id.get('rwh-consistency')
    assert chk2 is not None
    assert chk2['passed'] is False
    assert chk2['severity'] == 'warning'
    assert 'RWH connected area is reported as 0' in chk2['message']

# -----------------------------------------------------------------------------
# 11. Complete End-to-End Workflow Test (Maker-Checker, Rollup & DCS Excel Export)
# -----------------------------------------------------------------------------

@pytest.mark.django_db
def test_end_to_end_nirf_workflow_and_dcs_export(api_client, seeded_db, admin_user):
    """
    End-to-End Workflow:
      1. Create officers
      2. Dispatch NIRF 2027 request with all 4 categories (Overall, Engineering, Innovation, SDG)
      3. Officer opens link, fills a unit section, imports faculty XLSX, uploads proof, submits
      4. Admin requests a correction (Maker-Checker)
      5. Officer fixes data and resubmits
      6. Admin approves submission
      7. Rollup shows coverage
      8. Overall export XLSX opens with the expected IIT Mandi headings
    """
    # 1. Setup nodal officers for academic and central units
    scee_unit = OrgUnit.objects.get(id='scee')
    scee_officer = NodalOfficer.objects.create(
        name='SCEE Chair',
        email='chairscee_e2e@iitmandi.ac.in',
        status='ACTIVE'
    )
    scee_officer.assigned_units.add(scee_unit)

    fac_unit = OrgUnit.objects.get(id='faculty-service-matters')
    fac_officer = NodalOfficer.objects.create(
        name='Faculty Affairs Lead',
        email='fac_affairs_e2e@iitmandi.ac.in',
        status='ACTIVE'
    )
    fac_officer.assigned_units.add(fac_unit)

    # 2. Dispatch NIRF 2027 request with all 4 categories
    api_client.force_authenticate(user=admin_user)
    dispatch_payload = {
        'title': 'NIRF 2027 Institutional Data Call',
        'framework': 'NIRF',
        'cycleYear': 2027,
        'subject': 'NIRF 2027 Data Collection',
        'message': 'Please submit departmental metrics.',
        'deadline': '2027-01-31T23:59:59Z',
        'categories': ['OVERALL', 'ENGINEERING', 'INNOVATION', 'SDG'],
        'sections': [
            {'unitId': 'scee', 'dataItemIds': ['student-intake', 'faculty-roster']},
            {'unitId': 'faculty-service-matters', 'dataItemIds': ['faculty-roster']}
        ]
    }
    disp_res = api_client.post('/api/data-requests/', dispatch_payload, format='json')
    assert disp_res.status_code == 201
    grants = disp_res.data['issuedGrants']

    scee_grant = next(g for g in grants if g['unitId'] == 'scee')
    fac_grant = next(g for g in grants if g['unitId'] == 'faculty-service-matters')
    scee_token = scee_grant['portalUrl'].split('/portal/')[1]
    fac_token = fac_grant['portalUrl'].split('/portal/')[1]

    # 3. Officer enters data for sanctioned-intake
    api_client.force_authenticate(user=None)
    forms_res = api_client.get(f'/api/portal/{scee_token}/forms/')
    assert forms_res.status_code == 200

    # Save draft
    save_res = api_client.put(
        f'/api/portal/{scee_token}/forms/sanctioned-intake/',
        {
            'revision': 1,
            'notApplicable': False,
            'payload': {
                'intake': {
                    'UG4': {'2025-26': 150, '2024-25': 150, '2023-24': 140}
                }
            }
        },
        format='json'
    )
    assert save_res.status_code == 200

    # Upload proof file
    proof_file = BytesIO(b"PDF PROOF FOR SANCTIONED INTAKE")
    proof_file.name = "intake_proof.pdf"
    upl_res = api_client.post(
        f'/api/portal/{scee_token}/upload/',
        {'file': proof_file, 'dataItemId': 'student-intake'},
        format='multipart'
    )
    assert upl_res.status_code == 201

    # Submit section
    sub_res = api_client.post(
        f'/api/portal/{scee_token}/forms/sanctioned-intake/submit/',
        {},
        format='json'
    )
    assert sub_res.status_code == 200
    sub_id = sub_res.data['id']
    assert sub_res.data['status'] == 'SUBMITTED'

    # 4. Admin requests a correction (Maker-Checker)
    api_client.force_authenticate(user=admin_user)
    corr_res = api_client.post(
        f'/api/submissions/{sub_id}/actions/',
        {'action': 'requestCorrection', 'comment': 'Please check 2023-24 intake count.'},
        format='json'
    )
    assert corr_res.status_code == 200
    assert corr_res.data['status'] == 'CORRECTION_REQUESTED'

    # 5. Officer fixes intake count and resubmits
    api_client.force_authenticate(user=None)
    fix_res = api_client.put(
        f'/api/portal/{scee_token}/forms/sanctioned-intake/',
        {
            'revision': corr_res.data['revision'],
            'notApplicable': False,
            'payload': {
                'intake': {
                    'UG4': {'2025-26': 150, '2024-25': 150, '2023-24': 145}
                }
            }
        },
        format='json'
    )
    assert fix_res.status_code == 200

    resub_res = api_client.post(
        f'/api/portal/{scee_token}/forms/sanctioned-intake/submit/',
        {},
        format='json'
    )
    assert resub_res.status_code == 200
    assert resub_res.data['status'] == 'SUBMITTED'

    # 6. Admin approves submission
    api_client.force_authenticate(user=admin_user)
    appr_res = api_client.post(
        f'/api/submissions/{sub_id}/actions/',
        {'action': 'approve', 'comment': 'Verified with Senate approval documents'},
        format='json'
    )
    assert appr_res.status_code == 200
    assert appr_res.data['status'] == 'APPROVED'

    # 7. Rollup shows coverage
    roll_res = api_client.get('/api/nirf/cycles/2027/rollup/?category=OVERALL')
    assert roll_res.status_code == 200
    assert roll_res.data['categoryId'] == 'OVERALL'
    assert 'sanctioned-intake' in roll_res.data['sections']

    # 8. Overall export XLSX opens with expected headings matching IIT Mandi's PDF
    exp_res = api_client.get('/api/nirf/cycles/2027/export/?category=OVERALL&allowPartial=1')
    assert exp_res.status_code == 200
    assert exp_res['Content-Type'] == 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

    # Parse exported Excel workbook
    wb = openpyxl.load_workbook(BytesIO(exp_res.content))
    assert 'Overall' in wb.sheetnames
    ws = wb['Overall']

    # Check that IIT Mandi DCS headings are present
    sheet_text = " ".join([str(cell.value or '') for row in ws.iter_rows() for cell in row])
    assert "Sanctioned (Approved) Intake" in sheet_text


