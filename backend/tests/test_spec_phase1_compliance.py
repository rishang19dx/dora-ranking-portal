"""
Phase 1 requirements from the proposal that the earlier suite did not pin down.

  2.7  Roster normalisation - spreadsheet labels map to canonical values.
  2.8  Rule-based validation - bounds enforced server-side; missing columns,
       empty rows and corrupt cells in uploaded sheets are flagged.
  2.10 Maker-checker - decisions only from legal states; explicit Reject.
  2.11 Audit trail - old and new values, PII redacted, exports recorded.
"""

from io import BytesIO

import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIClient

from apps.data_requests.models import DataRequest
from apps.data_requests.services import dispatch_data_request
from apps.organogram.models import NodalOfficer, OfficerStatus, OrgUnit
from apps.submissions.audit import REDACTED
from apps.submissions.models import (
    FormSchema,
    SectionSubmission,
    SubmissionAuditLog,
    SubmissionRecord,
    SubmissionStatus,
)
from apps.submissions.validation_engine import check_field_value, normalize_import_value

User = get_user_model()


@pytest.fixture
def seeded(db):
    from django.core.management import call_command
    call_command('seed_organogram')
    call_command('load_form_schema')


@pytest.fixture
def admin(seeded):
    user = User.objects.create_user(
        username='p1admin', email='p1admin@iitmandi.ac.in', password='pw', role='ADMIN'
    )
    c = APIClient()
    c.force_authenticate(user=user)
    return c


def _portal(unit_id, data_item_ids, email):
    """Dispatch a request to one unit and return (token, client)."""
    unit = OrgUnit.objects.get(id=unit_id)
    officer = NodalOfficer.objects.create(name=f'{unit_id} officer', email=email,
                                          status=OfficerStatus.ACTIVE)
    officer.assigned_units.add(unit)
    _req, grants = dispatch_data_request(
        title=f'NIRF 2027 {unit_id}', framework='NIRF', cycle_year=2027,
        subject='s', message='m', deadline='2027-01-31T23:59:59Z',
        sections=[{'unitId': unit_id, 'dataItemIds': data_item_ids}],
        categories=['OVERALL', 'SDG'],
    )
    token = next(g for g in grants if g['officerId'] == officer.id)['portalUrl'].split('/portal/')[1]
    c = APIClient()
    assert c.get(f'/api/portal/{token}/forms/').status_code == 200
    return token, c


def _save(client, token, section_id, payload):
    sub = SectionSubmission.objects.get(section_id=section_id)
    res = client.put(
        f'/api/portal/{token}/forms/{section_id}/',
        {'revision': sub.revision, 'notApplicable': False, 'payload': payload},
        format='json',
    )
    assert res.status_code == 200, res.content
    return res


def _messages(res):
    return [e['message'] for e in res.json().get('validationErrors', [])]


# -----------------------------------------------------------------------------
# 2.8 Server-side bounds
# -----------------------------------------------------------------------------

@pytest.mark.parametrize('field, value, expected', [
    ({'label': 'PhDs', 'type': 'integer', 'min': 0}, -3, 'cannot be negative'),
    ({'label': 'PhDs', 'type': 'integer', 'min': 0}, '4.5', 'whole number'),
    ({'label': 'PhDs', 'type': 'integer', 'min': 0}, 'abc', 'must be a number'),
    ({'label': 'Placement %', 'type': 'percent'}, 140, 'cannot exceed 100%'),
    ({'label': 'Placement %', 'type': 'percent'}, -1, 'cannot be negative'),
    ({'label': 'Grant', 'type': 'currencyInr'}, -10, 'cannot be negative'),
    ({'label': 'Joined', 'type': 'date'}, 'not-a-date', 'valid date'),
    ({'label': 'Year', 'type': 'year'}, '20x5', 'four-digit year'),
    ({'label': 'Gender', 'type': 'enum', 'options': [{'value': 'male'}, {'value': 'female'}]},
     'unknown', 'unrecognised option'),
])
def test_check_field_value_rejects(field, value, expected):
    problem = check_field_value(field, value)
    assert problem and expected in problem, problem


@pytest.mark.parametrize('field, value', [
    ({'type': 'integer', 'min': 0}, 0),
    ({'type': 'integer', 'min': 0}, '12'),
    ({'type': 'percent'}, 100),
    ({'type': 'currencyInr'}, '1,20,000'),
    ({'type': 'integer', 'min': 0}, None),          # blank: requiredness is separate
    ({'type': 'integer', 'min': 0, 'derive': {'fn': 'sum'}}, -5),  # derived: not officer-typed
    ({'type': 'enum', 'options': [{'value': 'a'}], 'allowOther': True}, 'OTHER'),
])
def test_check_field_value_accepts(field, value):
    assert check_field_value(field, value) is None


def test_negative_grid_cell_blocks_submission(admin):
    token, c = _portal('sponsored-research', ['sponsored-projects'], 'sric_bounds@iitmandi.ac.in')
    _save(c, token, 'sponsored-research', {
        'sponsored': {'projects': {'2025-26': -4}, 'amountReceived': {'2025-26': 1000}},
    })
    res = c.post(f'/api/portal/{token}/forms/sponsored-research/submit/', {}, format='json')
    assert res.status_code == 400
    errors = res.json()['validationErrors']
    hit = [e for e in errors if 'cannot be negative' in e['message']]
    assert hit, _messages(res)
    # The error names the cell the way the officer sees it, so it can be traced.
    assert hit[0]['row'] == 'projects' and hit[0]['field'] == '2025-26'
    assert 'Total no. of Sponsored Projects (2025-26)' in hit[0]['message']


def test_percent_over_100_and_bad_option_block_submission(admin):
    token, c = _portal('estate-works', ['sustainability-practices'], 'estate_bounds@iitmandi.ac.in')
    _save(c, token, 'sdg-energy', {'practices': {'ledPct': 140, 'avoidMisuse': True}})
    res = c.post(f'/api/portal/{token}/forms/sdg-energy/submit/', {}, format='json')
    assert res.status_code == 400
    assert any('cannot exceed 100%' in m for m in _messages(res)), _messages(res)


# -----------------------------------------------------------------------------
# 2.7 / 2.8 Spreadsheet import
# -----------------------------------------------------------------------------

def test_import_values_are_normalised():
    schema_enums = {
        'designation': {'options': [
            {'value': 'professor', 'label': 'Professor'},
            {'value': 'assistant_professor', 'label': 'Assistant Professor'},
        ]},
    }
    designation = {'type': 'enum', 'enum': 'designation'}
    assert normalize_import_value(designation, 'Asst. Prof.', schema_enums)[0] == 'assistant_professor'
    assert normalize_import_value(designation, 'PROFESSOR', schema_enums)[0] == 'professor'
    assert normalize_import_value({'type': 'boolean'}, 'Yes')[0] is True
    assert normalize_import_value({'type': 'integer'}, '1,20,000')[0] == 120000
    assert normalize_import_value({'type': 'date'}, '01/07/2014')[0] == '2014-07-01'


def _faculty_import(c, token, csv_text):
    f = BytesIO(csv_text.encode('utf-8'))
    f.name = 'faculty.csv'
    return c.post(f'/api/portal/{token}/forms/faculty-details/records/import/',
                  {'file': f, 'blockId': 'faculty'}, format='multipart')


FACULTY_HEADER = ('employeeId,name,designation,gender,qualification,experienceMonths,'
                  'currentlyWorking,joiningDate,associationType,unitId\n')


def test_import_flags_missing_columns(admin):
    token, c = _portal('faculty-service-matters', ['faculty-roster'], 'fac_cols@iitmandi.ac.in')
    res = _faculty_import(c, token, 'employeeId,name\nE1,Someone\n')
    assert res.status_code == 400
    missing = {m['field'] for m in res.json()['missingColumns']}
    assert {'designation', 'gender', 'joiningDate'} <= missing


def test_import_flags_corrupt_cells_and_skips_empty_rows(admin):
    token, c = _portal('faculty-service-matters', ['faculty-roster'], 'fac_bad@iitmandi.ac.in')
    res = _faculty_import(c, token, FACULTY_HEADER
        + 'E1,Dr A,Asst. Prof.,Female,Ph.D,96,Yes,01/07/2019,Regular,scee\n'
        + ',,,,,,,,,\n'
        + 'E2,Dr B,Professor,Male,Ph.D,abc,Yes,2014-07-01,Regular,scee\n'
        + 'E3,Dr C,Professor,Male,Ph.D,12,Yes,2014-07-01,Regular,nowhere\n')
    assert res.status_code == 200
    body = res.json()
    assert body['created'] == 1
    assert body['skippedEmptyRows'] == 1
    rows_flagged = {(e['row'], e['field']) for e in body['errors']}
    assert (4, 'experienceMonths') in rows_flagged, body['errors']   # sheet row incl. header
    assert (5, 'unitId') in rows_flagged, body['errors']

    stored = SubmissionRecord.objects.get(row_key='E1').data
    assert stored['designation'] == 'assistant_professor'
    assert stored['gender'] == 'female'
    assert stored['currentlyWorking'] is True
    assert stored['joiningDate'] == '2019-07-01'
    assert not SubmissionRecord.objects.filter(row_key='E2').exists(), 'corrupt rows must not be written'


def test_reimport_audits_old_and_new_with_pii_redacted(admin):
    token, c = _portal('faculty-service-matters', ['faculty-roster'], 'fac_audit@iitmandi.ac.in')
    _faculty_import(c, token, FACULTY_HEADER + 'E9,Dr Old,Professor,Male,Ph.D,100,Yes,2014-07-01,Regular,scee\n')
    _faculty_import(c, token, FACULTY_HEADER + 'E9,Dr New,Professor,Male,Ph.D,112,Yes,2014-07-01,Regular,scee\n')

    log = SubmissionAuditLog.objects.filter(action='IMPORT').order_by('-timestamp').first()
    record = log.delta['records'][0]
    assert record['created'] is False
    assert record['rowKey'] == REDACTED, 'employeeId is personal data'
    by_field = {ch['field']: ch for ch in record['changes']}
    assert by_field['experienceMonths']['old'] == 100
    assert by_field['experienceMonths']['new'] == 112
    assert by_field['name'] == {'field': 'name', 'old': REDACTED, 'new': REDACTED, 'pii': True}


# -----------------------------------------------------------------------------
# 2.10 Maker-checker
# -----------------------------------------------------------------------------

def _draft(section_id='sponsored-research', unit_id='sponsored-research', status=SubmissionStatus.DRAFT):
    req = DataRequest.objects.create(
        reference=f'MC-{section_id}-{status}', title='t', framework='NIRF', cycle_year=2027,
        subject='s', message='m', deadline=timezone.now(), categories=['OVERALL'], data_item_ids=[],
    )
    schema = FormSchema.objects.filter(framework='NIRF', is_active=True).first()
    return SectionSubmission.objects.create(
        request=req, org_unit_id=unit_id, section_id=section_id,
        schema_version=schema.version, status=status, payload={},
    )


def test_checker_cannot_approve_an_unsubmitted_draft(admin):
    sub = _draft()
    res = admin.post(f'/api/submissions/{sub.id}/actions/', {'action': 'approve'}, format='json')
    assert res.status_code == 409
    sub.refresh_from_db()
    assert sub.status == SubmissionStatus.DRAFT


def test_explicit_reject_is_recorded(admin):
    sub = _draft(status=SubmissionStatus.SUBMITTED)
    no_reason = admin.post(f'/api/submissions/{sub.id}/actions/', {'action': 'reject'}, format='json')
    assert no_reason.status_code == 400

    res = admin.post(f'/api/submissions/{sub.id}/actions/',
                     {'action': 'reject', 'comment': 'Totals do not match the register.'},
                     format='json')
    assert res.status_code == 200
    assert res.json()['status'] == SubmissionStatus.CORRECTION_REQUESTED

    log = SubmissionAuditLog.objects.get(submission=sub, action='REJECT')
    assert log.delta['fromStatus'] == SubmissionStatus.SUBMITTED
    assert log.delta['toStatus'] == SubmissionStatus.CORRECTION_REQUESTED
    assert log.delta['comment'] == 'Totals do not match the register.'


def test_reopen_needs_a_settled_submission(admin):
    sub = _draft()
    assert admin.post(f'/api/submissions/{sub.id}/actions/', {'action': 'reopen'},
                      format='json').status_code == 409


# -----------------------------------------------------------------------------
# 2.11 Audit trail
# -----------------------------------------------------------------------------

def test_form_edit_audits_old_and_new_values(admin):
    token, c = _portal('sponsored-research', ['sponsored-projects'], 'sric_audit@iitmandi.ac.in')
    _save(c, token, 'sponsored-research', {'sponsored': {'projects': {'2025-26': 180}}})
    _save(c, token, 'sponsored-research', {'sponsored': {'projects': {'2025-26': 184}}})

    log = SubmissionAuditLog.objects.filter(action='UPDATE').order_by('-timestamp').first()
    change = next(ch for ch in log.delta['changes']
                  if ch['row'] == 'projects' and ch['field'] == '2025-26')
    assert change['old'] == 180 and change['new'] == 184
    assert change['block'] == 'sponsored'
    assert log.actor_type == 'OFFICER' and log.actor_id and log.timestamp


def test_export_is_audited(admin):
    res = admin.get('/api/nirf/cycles/2027/export/?category=OVERALL')
    assert res.status_code == 200
    log = SubmissionAuditLog.objects.get(action='EXPORT')
    assert log.delta['kind'] == 'dcs-excel'
    assert log.delta['category'] == 'OVERALL'
    import hashlib
    assert log.delta['sha256'] == hashlib.sha256(res.content).hexdigest()


# -----------------------------------------------------------------------------
# 2.11 Auditor interface onto the audit log
# -----------------------------------------------------------------------------

def _role_client(role, username):
    user = User.objects.create_user(username=username, email=f'{username}@iitmandi.ac.in',
                                    password='pw', role=role)
    c = APIClient()
    c.force_authenticate(user=user)
    return c


@pytest.fixture
def audited_history(admin):
    """A small but realistic trail: an edit, a rejection and an approval."""
    token, c = _portal('sponsored-research', ['sponsored-projects'], 'sric_trail@iitmandi.ac.in')
    _save(c, token, 'sponsored-research', {'sponsored': {'projects': {'2025-26': 180}}})
    _save(c, token, 'sponsored-research', {'sponsored': {'projects': {'2025-26': 184}}})
    sub = SectionSubmission.objects.get(section_id='sponsored-research')
    sub.status = SubmissionStatus.SUBMITTED
    sub.save(update_fields=['status'])
    admin.post(f'/api/submissions/{sub.id}/actions/',
               {'action': 'reject', 'comment': 'Agency count looks low'}, format='json')
    return sub


def test_auditor_can_read_and_filter_the_trail(audited_history):
    auditor = _role_client('AUDITOR', 'trail_auditor')
    everything = auditor.get('/api/audit-log/').json()
    assert everything['count'] >= 3
    assert {'UPDATE', 'REJECT'} <= set(everything['actions'])

    rejects = auditor.get('/api/audit-log/?action=REJECT').json()
    assert rejects['count'] == 1
    row = rejects['results'][0]
    assert row['sectionId'] == 'sponsored-research'
    assert row['actorType'] == 'ADMIN' and row['actorName'] == 'p1admin'
    assert row['delta']['toStatus'] == SubmissionStatus.CORRECTION_REQUESTED

    officer_rows = auditor.get('/api/audit-log/?actorType=OFFICER').json()['results']
    assert officer_rows and all(r['actorType'] == 'OFFICER' for r in officer_rows)
    assert officer_rows[0]['actorName'] == 'sponsored-research officer'


def test_auditor_search_reaches_into_recorded_changes(audited_history):
    auditor = _role_client('AUDITOR', 'search_auditor')
    hits = auditor.get('/api/audit-log/?q=Agency count looks low').json()
    assert hits['count'] == 1 and hits['results'][0]['action'] == 'REJECT'

    edits = auditor.get('/api/audit-log/?q=184').json()
    assert any(r['action'] == 'UPDATE' for r in edits['results'])


def test_audit_log_rejects_bad_filters_and_unprivileged_users(audited_history):
    auditor = _role_client('AUDITOR', 'strict_auditor')
    assert auditor.get('/api/audit-log/?from=yesterday').status_code == 400
    assert _role_client('NODAL_OFFICER', 'nosy_officer').get('/api/audit-log/').status_code == 403
    assert APIClient().get('/api/audit-log/').status_code in (401, 403)


def test_audit_log_csv_export_is_itself_audited(audited_history):
    auditor = _role_client('AUDITOR', 'csv_auditor')
    res = auditor.get('/api/audit-log/?export=csv&action=REJECT')
    assert res.status_code == 200
    assert res['Content-Type'].startswith('text/csv')
    lines = res.content.decode().strip().splitlines()
    assert lines[0].startswith('timestamp,action,actor_type')
    assert len(lines) == 2 and ',REJECT,' in lines[1]

    log = SubmissionAuditLog.objects.filter(action='EXPORT').latest('timestamp')
    assert log.delta['kind'] == 'audit-log-csv'
    assert log.delta['filters'] == {'action': 'REJECT'}


# -----------------------------------------------------------------------------
# 2.4 Proof provenance, versioning and repository
# -----------------------------------------------------------------------------

@pytest.fixture
def proof_cycle(admin, settings, tmp_path):
    """SRIC uploads a sanction PDF, then a corrected one, for its section."""
    settings.MEDIA_ROOT = str(tmp_path)
    token, c = _portal('sponsored-research', ['sponsored-projects'], 'sric_proofs@iitmandi.ac.in')

    def upload(content, name, note=''):
        f = BytesIO(content)
        f.name = name
        res = c.post(f'/api/portal/{token}/upload/',
                     {'file': f, 'dataItemId': 'sponsored-projects', 'note': note},
                     format='multipart')
        assert res.status_code == 201, res.content
        return res.json()['id']

    first = upload(b'%PDF-1.4 sanction order v1', 'sanction_orders.pdf', 'Original')
    second = upload(b'%PDF-1.4 sanction order v2 corrected', 'sanction_orders.pdf', 'Corrected amounts')
    sub = SectionSubmission.objects.get(section_id='sponsored-research')
    return {'first': first, 'second': second, 'submission': sub}


def test_submission_detail_traces_figures_to_their_proofs(proof_cycle):
    """Spec 2.4: from a figure, the auditor reaches the exact sanction PDF."""
    auditor = _role_client('AUDITOR', 'prov_auditor')
    res = auditor.get(f"/api/submissions/{proof_cycle['submission'].id}/")
    assert res.status_code == 200
    proofs = res.json()['proofs']
    assert [p['id'] for p in proofs] == [proof_cycle['second'], proof_cycle['first']]
    assert 'sponsored-projects' in res.json()['evidenceItemIds']


def test_corrected_uploads_are_versioned_not_overwritten(proof_cycle):
    auditor = _role_client('AUDITOR', 'version_auditor')
    proofs = {p['id']: p for p in auditor.get(
        f"/api/submissions/{proof_cycle['submission'].id}/").json()['proofs']}

    original, corrected = proofs[proof_cycle['first']], proofs[proof_cycle['second']]
    assert (original['version'], original['isLatest']) == (1, False)
    assert (corrected['version'], corrected['isLatest']) == (2, True)
    assert original['versionCount'] == corrected['versionCount'] == 2
    assert original['checksum'] != corrected['checksum'], 'history is kept, not overwritten'


def test_repository_is_searchable_and_keeps_true_version_numbers(proof_cycle):
    auditor = _role_client('AUDITOR', 'repo_auditor')
    hits = auditor.get('/api/proofs/?q=Corrected').json()
    assert hits['count'] == 1
    only = hits['results'][0]
    # Filtering must not renumber: the corrected file is still v2 of 2.
    assert (only['version'], only['versionCount']) == (2, 2)
    assert {'sectionId': 'sponsored-research', 'title': 'Sponsored Research Details'} in only['sections']

    latest = auditor.get('/api/proofs/?latestOnly=1&sectionId=sponsored-research').json()
    assert [r['id'] for r in latest['results']] == [proof_cycle['second']]


def test_proof_download_is_authenticated_and_integrity_checked(proof_cycle):
    url = f"/api/proofs/{proof_cycle['first']}/download/"
    assert APIClient().get(url).status_code in (401, 403)
    assert _role_client('NODAL_OFFICER', 'dl_officer').get(url).status_code == 403

    auditor = _role_client('AUDITOR', 'dl_auditor')
    res = auditor.get(url)
    assert res.status_code == 200
    assert b''.join(res.streaming_content) == b'%PDF-1.4 sanction order v1'
    assert 'attachment' in res['Content-Disposition']

    # A file altered on disk after upload is refused rather than served.
    from apps.data_requests.models import ProofUpload
    proof = ProofUpload.objects.get(id=proof_cycle['first'])
    with open(proof.file.path, 'wb') as fh:
        fh.write(b'%PDF-1.4 tampered')
    assert auditor.get(url).status_code == 409
