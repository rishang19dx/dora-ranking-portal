import pytest
from io import BytesIO
from django.urls import reverse
from rest_framework.test import APIClient
from django.contrib.auth import get_user_model
from apps.organogram.models import OrgUnit, NodalOfficer
from apps.data_requests.models import DataRequest, DataRequestTarget, PortalAccessGrant, ProofUpload

User = get_user_model()

@pytest.fixture
def api_client():
    return APIClient()

@pytest.fixture
def admin_user(db):
    return User.objects.create_user(
        username='testadmin',
        email='testadmin@iitmandi.ac.in',
        password='password123',
        role='ADMIN',
        first_name='Test',
        last_name='Admin'
    )

@pytest.fixture
def seeded_db(db):
    from django.core.management import call_command
    call_command('seed_organogram')

@pytest.mark.django_db
def test_jwt_auth_flow(api_client, admin_user):
    # Obtain token
    res = api_client.post('/api/auth/token/', {
        'username': 'testadmin',
        'password': 'password123'
    })
    assert res.status_code == 200
    assert 'access' in res.data
    assert 'refresh' in res.data
    assert res.data['user']['role'] == 'ADMIN'

    # Retrieve current user
    token = res.data['access']
    api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')
    me_res = api_client.get('/api/auth/me/')
    assert me_res.status_code == 200
    assert me_res.data['email'] == 'testadmin@iitmandi.ac.in'

@pytest.mark.django_db
def test_organogram_and_officers(api_client, seeded_db):
    # Get organogram tree
    res = api_client.get('/api/organogram/')
    assert res.status_code == 200
    assert 'tree' in res.data
    assert len(res.data['units']) >= 50
    assert len(res.data['catalogue']) == 28

    # Get nodal officers
    officers_res = api_client.get('/api/nodal-officers/')
    assert officers_res.status_code == 200
    assert len(officers_res.data) > 0

    # Create new officer
    create_res = api_client.post('/api/nodal-officers/', {
        'name': 'Dr. Test Officer',
        'email': 'testofficer@iitmandi.ac.in',
        'designation': 'Assistant Professor',
        'unitIds': ['scee']
    })
    assert create_res.status_code == 201
    assert create_res.data['name'] == 'Dr. Test Officer'
    assert 'scee' in create_res.data['unitIds']

@pytest.mark.django_db
def test_data_request_dispatch_and_portal_upload(api_client, seeded_db):
    # Dispatch a new request
    payload = {
        'title': 'NIRF 2026 Data Collection',
        'framework': 'NIRF',
        'cycleYear': 2026,
        'subject': 'NIRF 2026 Metrics and Evidences',
        'message': 'Please upload your department ranking proofs.',
        'deadline': '2026-11-30T23:59:59Z',
        'sections': [
            {'unitId': 'scee', 'dataItemIds': ['student-intake', 'faculty-roster']}
        ]
    }
    dispatch_res = api_client.post('/api/data-requests/', payload, format='json')
    assert dispatch_res.status_code == 201
    assert 'issuedGrants' in dispatch_res.data
    assert len(dispatch_res.data['issuedGrants']) > 0

    grant_info = dispatch_res.data['issuedGrants'][0]
    portal_url = grant_info['portalUrl']
    token = portal_url.split('/portal/')[1]

    # Verify portal grant access link
    portal_res = api_client.get(f'/api/portal/{token}/')
    assert portal_res.status_code == 200
    assert portal_res.data['request']['framework'] == 'NIRF'
    assert 'student-intake' in portal_res.data['allowedDataItems']

    # Upload test file to portal
    file_content = b"student_id,name,branch\n1,Alice,CSE\n2,Bob,EE"
    test_file = BytesIO(file_content)
    test_file.name = "student_intake_2026.csv"

    upload_res = api_client.post(
        f'/api/portal/{token}/upload/',
        {'file': test_file, 'dataItemId': 'student-intake', 'note': 'Intake sheet'},
        format='multipart'
    )
    assert upload_res.status_code == 201
    assert upload_res.data['fileName'] == 'student_intake_2026.csv'
    assert upload_res.data['checksum'] is not None

    # Verify target status updated to PARTIAL
    req_id = dispatch_res.data['id']
    detail_res = api_client.get(f'/api/data-requests/{req_id}/')
    assert detail_res.status_code == 200
    target = detail_res.data['targets'][0]
    assert target['status'] == 'PARTIAL'

@pytest.mark.django_db
def test_rankings_api(api_client):
    # Overall 2025 rankings
    res = api_client.get('/api/v1/rankings/2025/overall/')
    assert res.status_code == 200
    assert res.data['count'] > 0
    assert len(res.data['data']) > 0

    # 2nd gen IITs
    second_gen_res = api_client.get('/api/v1/rankings/2025/overall/2nd-gen-iits/')
    assert second_gen_res.status_code == 200
    names = [inst['name'] for inst in second_gen_res.data['data']]
    assert "Indian Institute of Technology Mandi" in names
