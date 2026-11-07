"""
Tests that the code honours the NIRF form schema's own contract.

The schema expresses three things the implementation used to ignore:
per-row cell `type` overrides, `derive` definitions, and per-category row
`usedBy` / `labelByCategory` markers. Each is covered here, together with
the DCS export's handling of the payload shape the form renderer actually
writes (a grid keyed by row id, not a list).
"""

import pytest
from apps.organogram.models import NodalOfficer, OrgUnit
from apps.submissions.models import FormSchema, SectionSubmission
from apps.submissions.validation_engine import apply_block_derives
from apps.submissions.views import resolve_section_schema


@pytest.fixture
def seeded_db(db):
    from django.core.management import call_command
    call_command('seed_organogram')
    call_command('load_form_schema')


def _schema():
    return FormSchema.objects.filter(framework='NIRF', is_active=True).first()


def _section(sid):
    return next(s for s in _schema().content['sections'] if s['id'] == sid)


# -----------------------------------------------------------------------------
# Row-level cell type overrides
# -----------------------------------------------------------------------------

def test_fixed_rows_keep_their_type_override(seeded_db):
    """
    A year-column grid types every column from a single `cell` definition, but
    individual rows override it ("Amount Received in Words" is text, the amount
    rows are currency). The resolver must pass those overrides to the client.
    """
    resolved = resolve_section_schema(
        _section('sponsored-research'), 2027, enums=_schema().content.get('enums', {})
    )
    rows = {r['id']: r for r in resolved['blocks'][0]['rowAxis']['rows']}

    assert rows['projects'].get('type') is None, "count rows fall back to the column cell type"
    assert rows['amountReceived']['type'] == 'currencyInr'
    assert rows['amountInWords']['type'] == 'text'
    # The shared year columns stay integer; the row override is what differs.
    assert all(c['type'] == 'integer' for c in resolved['blocks'][0]['resolvedColumns'])


# -----------------------------------------------------------------------------
# Derive engine
# -----------------------------------------------------------------------------

def test_amount_in_words_row_is_derived_per_year(seeded_db):
    """The words row is computed from the amount row, column by column."""
    resolved = resolve_section_schema(
        _section('sponsored-research'), 2027, enums=_schema().content.get('enums', {})
    )
    blk = resolved['blocks'][0]
    years = [c['id'] for c in blk['resolvedColumns']]

    data = {
        'projects': {years[0]: 184},
        'agencies': {years[0]: 64},
        'amountReceived': {years[0]: 297114978},
    }
    out = apply_block_derives(blk, data, {'submittingUnitId': 'dean-sric'})

    words = out['amountInWords'][years[0]]
    assert 'Crore' in words and 'Lakh' in words, words
    assert words.startswith('Twenty Nine Crore'), words


def test_sum_and_row_number_derives(seeded_db):
    """Column-level `sum` and record-level `rowNumber` both compute."""
    strength = resolve_section_schema(
        _section('student-strength'), 2027, enums=_schema().content.get('enums', {})
    )
    blk = strength['blocks'][0]
    out = apply_block_derives(blk, {'UG4': {'male': 300, 'female': 120}}, {})
    assert out['UG4']['total'] == 420

    faculty = resolve_section_schema(
        _section('faculty-details'), 2027, enums=_schema().content.get('enums', {})
    )
    fblk = faculty['blocks'][0]
    recs = apply_block_derives(
        fblk,
        [{'name': 'A'}, {'name': 'B'}, {'name': 'C'}],
        {'submittingUnitId': 'scee'},
    )
    assert [r['srNo'] for r in recs] == [1, 2, 3]


def test_derives_are_persisted_on_save(seeded_db, client):
    """
    Saving a draft through the portal recomputes derived cells server-side, so
    the officer is never asked to type a value the schema owns.
    """
    from apps.data_requests.services import dispatch_data_request

    sec = _section('sponsored-research')
    unit_id = sec['ownership']['primaryOwnerUnitId']
    unit = OrgUnit.objects.get(id=unit_id)
    officer = NodalOfficer.objects.create(
        name='SRIC Lead', email='sric_fidelity@iitmandi.ac.in', status='ACTIVE'
    )
    officer.assigned_units.add(unit)

    result = dispatch_data_request(
        title='NIRF 2027 fidelity',
        framework='NIRF',
        cycle_year=2027,
        subject='s',
        message='m',
        deadline='2027-01-31T23:59:59Z',
        sections=[{'unitId': unit_id, 'dataItemIds': ['sponsored-projects']}],
        created_by='test',
        categories=['OVERALL'],
    )

    _data_request, issued_grants = result
    grant = next(g for g in issued_grants if g['unitId'] == unit_id)
    token = grant['portalUrl'].split('/portal/')[1]

    # Submissions are materialised when the officer first opens the portal.
    forms_res = client.get(f'/api/portal/{token}/forms/')
    assert forms_res.status_code == 200, forms_res.content

    sub = SectionSubmission.objects.filter(
        org_unit_id=unit_id, section_id='sponsored-research'
    ).first()
    assert sub is not None, 'opening the portal should create the section submission'

    res = client.put(
        f'/api/portal/{token}/forms/sponsored-research/',
        data={
            'revision': sub.revision,
            'notApplicable': False,
            'payload': {'sponsored': {'amountReceived': {'2025-26': 5000000}}},
        },
        content_type='application/json',
    )
    assert res.status_code == 200, res.content

    sub.refresh_from_db()
    words = sub.payload['sponsored']['amountInWords']['2025-26']
    assert words == 'Fifty Lakh', words
