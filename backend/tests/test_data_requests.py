"""
Tests for apps.data_requests — models, services, and API.
"""
import hashlib
from datetime import timedelta
from unittest.mock import MagicMock

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.db import IntegrityError
from django.utils import timezone

from apps.data_requests.models import (
    DataRequestStatus,
    DataRequestTarget,
    DeliveryKind,
    DeliveryStatus,
    PortalAccessGrant,
    ProofUpload,
    TargetStatus,
)
from apps.data_requests.services import (
    calculate_checksum,
    dispatch_data_request,
    generate_portal_token,
    hash_token,
)
from apps.organogram.models import NodalOfficer, OrgUnit, OrgUnitType

# ===========================================================================
# Model tests
# ===========================================================================

@pytest.mark.django_db
class TestDataRequestModel:

    def test_datarequest_default_id_has_prefix(self, sample_data_request):
        assert sample_data_request.id.startswith('req_')

    def test_datarequest_str_representation(self, sample_data_request):
        expected = f'{sample_data_request.reference} - {sample_data_request.title}'
        assert str(sample_data_request) == expected

    def test_datarequesttarget_unique_constraint(self, sample_data_request, sample_org_unit, sample_target):
        """Creating a second target for the same request+orgunit raises IntegrityError."""
        with pytest.raises(IntegrityError):
            DataRequestTarget.objects.create(
                request=sample_data_request,
                org_unit=sample_org_unit,
                data_item_ids=['item_003'],
            )

    def test_portal_access_grant_is_valid_active(self, sample_grant):
        assert sample_grant.is_valid() is True

    def test_portal_access_grant_is_valid_expired(self, sample_officer, sample_data_request, sample_org_unit):
        raw_token = generate_portal_token()
        expired_grant = PortalAccessGrant.objects.create(
            token_hash=hash_token(raw_token),
            officer=sample_officer,
            request=sample_data_request,
            org_unit=sample_org_unit,
            data_item_ids=['item_001'],
            expires_at=timezone.now() - timedelta(days=1),
        )
        assert expired_grant.is_valid() is False

    def test_portal_access_grant_is_valid_revoked(self, sample_officer, sample_data_request, sample_org_unit):
        raw_token = generate_portal_token()
        revoked_grant = PortalAccessGrant.objects.create(
            token_hash=hash_token(raw_token),
            officer=sample_officer,
            request=sample_data_request,
            org_unit=sample_org_unit,
            data_item_ids=['item_001'],
            expires_at=timezone.now() + timedelta(days=10),
            revoked_at=timezone.now(),
        )
        assert revoked_grant.is_valid() is False

    def test_proof_upload_ordering(self, sample_grant, sample_target):
        """ProofUpload is ordered by -uploaded_at (most recent first)."""
        assert ProofUpload._meta.ordering == ['-uploaded_at']

    def test_request_delivery_choices(self):
        valid_statuses = [s[0] for s in DeliveryStatus.choices]
        assert 'SENT' in valid_statuses
        assert 'SIMULATED' in valid_statuses
        assert 'FAILED' in valid_statuses
        valid_kinds = [k[0] for k in DeliveryKind.choices]
        assert 'DISPATCH' in valid_kinds
        assert 'REMINDER' in valid_kinds


# ===========================================================================
# Service tests
# ===========================================================================

class TestServiceFunctions:

    def test_hash_token_deterministic(self):
        token = 'test_token_abc123'
        assert hash_token(token) == hash_token(token)

    def test_hash_token_different_inputs(self):
        assert hash_token('token_a') != hash_token('token_b')

    def test_generate_portal_token_length(self):
        token = generate_portal_token()
        assert isinstance(token, str)
        # secrets.token_urlsafe(32) produces ~43 chars
        assert len(token) >= 32

    def test_calculate_checksum_correctness(self):
        content = b'Hello, DORA World!'
        expected = hashlib.sha256(content).hexdigest()

        # Mock a file-like object with .chunks() and .seek()
        mock_file = MagicMock()
        mock_file.chunks.return_value = [content]
        mock_file.seek = MagicMock()

        result = calculate_checksum(mock_file)
        assert result == expected
        mock_file.seek.assert_called_once_with(0)


@pytest.mark.django_db
class TestDispatchDataRequest:

    def test_dispatch_data_request_creates_datarequest(self, sample_org_unit, sample_officer):
        deadline = timezone.now() + timedelta(days=20)
        sections = [
            {'unitId': sample_org_unit.id, 'dataItemIds': ['item_A', 'item_B']}
        ]
        data_request, _ = dispatch_data_request(
            title='Test Dispatch',
            framework='NIRF',
            cycle_year=2025,
            subject='Test Subject',
            message='Test message body.',
            deadline=deadline,
            sections=sections,
            created_by='admin',
        )
        assert data_request is not None
        assert data_request.title == 'Test Dispatch'
        assert data_request.framework == 'NIRF'
        assert data_request.cycle_year == 2025

    def test_dispatch_data_request_creates_targets(self, sample_org_unit, sample_officer):
        deadline = timezone.now() + timedelta(days=20)
        sections = [
            {'unitId': sample_org_unit.id, 'dataItemIds': ['item_A', 'item_B']}
        ]
        data_request, _ = dispatch_data_request(
            title='Target Test',
            framework='NIRF',
            cycle_year=2025,
            subject='Subject',
            message='Message.',
            deadline=deadline,
            sections=sections,
        )
        targets = DataRequestTarget.objects.filter(request=data_request)
        assert targets.count() == 1
        target = targets.first()
        assert target.org_unit == sample_org_unit
        assert set(target.data_item_ids) == {'item_A', 'item_B'}

    def test_dispatch_data_request_creates_grants(self, sample_org_unit, sample_officer):
        deadline = timezone.now() + timedelta(days=20)
        sections = [
            {'unitId': sample_org_unit.id, 'dataItemIds': ['item_A']}
        ]
        data_request, issued_grants = dispatch_data_request(
            title='Grant Test',
            framework='NIRF',
            cycle_year=2025,
            subject='Subject',
            message='Message.',
            deadline=deadline,
            sections=sections,
        )
        grants = PortalAccessGrant.objects.filter(request=data_request)
        assert grants.count() >= 1
        # issued_grants should list at least one grant
        assert len(issued_grants) >= 1
        assert 'grantId' in issued_grants[0]

    def test_dispatch_data_request_reference_format(self, sample_org_unit, sample_officer):
        deadline = timezone.now() + timedelta(days=20)
        sections = [{'unitId': sample_org_unit.id, 'dataItemIds': ['item_A']}]
        data_request, _ = dispatch_data_request(
            title='Ref Test',
            framework='QS',
            cycle_year=2025,
            subject='Subject',
            message='Message.',
            deadline=deadline,
            sections=sections,
        )
        # Reference must match DORA/{year}/{framework}/{seq:03d}
        import re
        assert re.match(r'DORA/\d+/[A-Z]+/\d{3}', data_request.reference)
        assert '2025' in data_request.reference
        assert 'QS' in data_request.reference

    def test_dispatch_data_request_fallback_officer_when_no_officer(self):
        """When unit has email but no officer, a fallback NodalOfficer is auto-created."""
        unit = OrgUnit.objects.create(
            id='OU-FALLBACK',
            name='Fallback Unit',
            type=OrgUnitType.ADMINISTRATIVE,
            head='Unit Head',
            email='fallback_unit@iitmandi.ac.in',
        )
        deadline = timezone.now() + timedelta(days=20)
        sections = [{'unitId': unit.id, 'dataItemIds': ['item_X']}]
        data_request, issued_grants = dispatch_data_request(
            title='Fallback Test',
            framework='NIRF',
            cycle_year=2025,
            subject='Subj',
            message='Msg.',
            deadline=deadline,
            sections=sections,
        )
        # A fallback officer should have been created with the unit email
        assert NodalOfficer.objects.filter(email='fallback_unit@iitmandi.ac.in').exists()
        assert len(issued_grants) >= 1


# ===========================================================================
# API tests — DataRequest
# ===========================================================================

@pytest.mark.django_db
class TestDataRequestAPI:

    def test_list_data_requests_returns_200(self, api_client):
        response = api_client.get('/api/data-requests/')
        assert response.status_code == 200
        assert isinstance(response.data, list)

    def test_create_data_request_valid(self, api_client, sample_org_unit, sample_officer):
        deadline = (timezone.now() + timedelta(days=30)).isoformat()
        payload = {
            'title': 'API Created Request',
            'framework': 'NIRF',
            'cycleYear': 2025,
            'subject': 'Test Subject',
            'message': 'Test Message',
            'deadline': deadline,
            'sections': [
                {'unitId': sample_org_unit.id, 'dataItemIds': ['api_item_001']}
            ],
        }
        response = api_client.post('/api/data-requests/', data=payload, format='json')
        assert response.status_code == 201
        assert response.data['title'] == 'API Created Request'
        assert 'issuedGrants' in response.data

    def test_create_data_request_missing_fields(self, api_client):
        payload = {
            'framework': 'NIRF',
            # missing 'title' and other required fields
        }
        response = api_client.post('/api/data-requests/', data=payload, format='json')
        assert response.status_code == 400

    def test_get_data_request_detail(self, api_client, sample_data_request):
        response = api_client.get(f'/api/data-requests/{sample_data_request.id}/')
        assert response.status_code == 200
        assert response.data['id'] == sample_data_request.id

    def test_get_data_request_not_found(self, api_client):
        response = api_client.get('/api/data-requests/req_doesnotexist/')
        assert response.status_code == 404

    def test_data_request_action_close(self, api_client, sample_data_request):
        response = api_client.post(
            f'/api/data-requests/{sample_data_request.id}/actions/',
            data={'action': 'close'},
            format='json',
        )
        assert response.status_code == 200
        assert response.data['status'] == 'closed'

        sample_data_request.refresh_from_db()
        assert sample_data_request.status == DataRequestStatus.CLOSED

    def test_data_request_action_remind(self, api_client, sample_data_request, sample_target):
        initial_reminders = sample_target.reminders_sent
        response = api_client.post(
            f'/api/data-requests/{sample_data_request.id}/actions/',
            data={'action': 'remind'},
            format='json',
        )
        assert response.status_code == 200
        assert response.data['status'] == 'reminded'

        sample_target.refresh_from_db()
        assert sample_target.reminders_sent == initial_reminders + 1

    def test_data_request_action_invalid(self, api_client, sample_data_request):
        response = api_client.post(
            f'/api/data-requests/{sample_data_request.id}/actions/',
            data={'action': 'launch_missiles'},
            format='json',
        )
        assert response.status_code == 400


# ===========================================================================
# API tests — Portal grant context
# ===========================================================================

@pytest.mark.django_db
class TestPortalAPI:

    def test_portal_grant_context_valid_token(self, api_client, sample_grant):
        response = api_client.get(f'/api/portal/{sample_grant.raw_token}/')
        assert response.status_code == 200
        data = response.data
        assert 'grant' in data
        assert 'request' in data
        assert 'orgUnit' in data
        assert 'officer' in data
        assert 'allowedDataItems' in data
        assert 'uploads' in data

    def test_portal_grant_context_invalid_token(self, api_client):
        response = api_client.get('/api/portal/totally_invalid_fake_token_xyz/')
        assert response.status_code == 404

    def test_portal_grant_context_expired_grant(
        self, api_client, sample_officer, sample_data_request, sample_org_unit
    ):
        from apps.data_requests.services import generate_portal_token, hash_token
        raw_token = generate_portal_token()
        PortalAccessGrant.objects.create(
            token_hash=hash_token(raw_token),
            officer=sample_officer,
            request=sample_data_request,
            org_unit=sample_org_unit,
            data_item_ids=['item_001'],
            expires_at=timezone.now() - timedelta(hours=1),
        )
        response = api_client.get(f'/api/portal/{raw_token}/')
        assert response.status_code == 403

    def test_portal_grant_context_revoked_grant(
        self, api_client, sample_officer, sample_data_request, sample_org_unit
    ):
        from apps.data_requests.services import generate_portal_token, hash_token
        raw_token = generate_portal_token()
        PortalAccessGrant.objects.create(
            token_hash=hash_token(raw_token),
            officer=sample_officer,
            request=sample_data_request,
            org_unit=sample_org_unit,
            data_item_ids=['item_001'],
            expires_at=timezone.now() + timedelta(days=10),
            revoked_at=timezone.now(),
        )
        response = api_client.get(f'/api/portal/{raw_token}/')
        assert response.status_code == 403


# ===========================================================================
# Upload tests
# ===========================================================================

@pytest.mark.django_db
class TestPortalUploadAPI:

    def test_upload_file_invalid_extension(self, api_client, sample_grant, tmp_path, settings):
        settings.MEDIA_ROOT = str(tmp_path)
        exe_file = SimpleUploadedFile(
            'malware.exe',
            b'MZ fake exe content',
            content_type='application/octet-stream',
        )
        response = api_client.post(
            f'/api/portal/{sample_grant.raw_token}/upload/',
            data={'file': exe_file, 'dataItemId': 'item_001'},
            format='multipart',
        )
        assert response.status_code == 400
        assert 'not allowed' in response.data.get('error', '').lower()

    def test_upload_file_exceeds_size_limit(self, api_client, sample_grant, tmp_path, settings):
        settings.MEDIA_ROOT = str(tmp_path)
        # Create a mock file > 25 MB
        large_content = b'X' * (26 * 1024 * 1024)
        large_file = SimpleUploadedFile(
            'large.pdf',
            large_content,
            content_type='application/pdf',
        )
        response = api_client.post(
            f'/api/portal/{sample_grant.raw_token}/upload/',
            data={'file': large_file, 'dataItemId': 'item_001'},
            format='multipart',
        )
        assert response.status_code == 400
        assert '25 MB' in response.data.get('error', '')

    def test_upload_file_out_of_scope_item(self, api_client, sample_grant, tmp_path, settings):
        settings.MEDIA_ROOT = str(tmp_path)
        pdf_file = SimpleUploadedFile(
            'scope_test.pdf',
            b'%PDF-1.4 fake content',
            content_type='application/pdf',
        )
        response = api_client.post(
            f'/api/portal/{sample_grant.raw_token}/upload/',
            data={'file': pdf_file, 'dataItemId': 'OUT_OF_SCOPE_ITEM'},
            format='multipart',
        )
        assert response.status_code == 400
        assert 'OUT_OF_SCOPE_ITEM' in response.data.get('error', '') or \
               'authorized scope' in response.data.get('error', '').lower()

    def test_upload_valid_pdf(self, api_client, sample_grant, sample_target, tmp_path, settings):
        settings.MEDIA_ROOT = str(tmp_path)
        pdf_content = b'%PDF-1.4 1 0 obj << /Type /Catalog >> endobj'
        pdf_file = SimpleUploadedFile(
            'valid_proof.pdf',
            pdf_content,
            content_type='application/pdf',
        )
        response = api_client.post(
            f'/api/portal/{sample_grant.raw_token}/upload/',
            data={'file': pdf_file, 'dataItemId': 'item_001'},
            format='multipart',
        )
        assert response.status_code == 201
        # Verify ProofUpload created
        assert ProofUpload.objects.filter(
            grant=sample_grant,
            data_item_id='item_001'
        ).exists()

    def test_upload_updates_target_to_partial(
        self, api_client, sample_grant, sample_target, tmp_path, settings
    ):
        """After uploading 1 of 2 required items, target becomes PARTIAL."""
        settings.MEDIA_ROOT = str(tmp_path)
        # sample_target has data_item_ids=['item_001', 'item_002']
        pdf_file = SimpleUploadedFile(
            'partial.pdf',
            b'%PDF-1.4 partial content',
            content_type='application/pdf',
        )
        response = api_client.post(
            f'/api/portal/{sample_grant.raw_token}/upload/',
            data={'file': pdf_file, 'dataItemId': 'item_001'},
            format='multipart',
        )
        assert response.status_code == 201
        sample_target.refresh_from_db()
        assert sample_target.status == TargetStatus.PARTIAL

    def test_upload_updates_target_to_submitted(
        self, api_client, sample_grant, sample_target, tmp_path, settings
    ):
        """After uploading all required items, target becomes SUBMITTED."""
        settings.MEDIA_ROOT = str(tmp_path)
        # Upload item_001
        pdf1 = SimpleUploadedFile('proof1.pdf', b'%PDF-1.4 content1', content_type='application/pdf')
        r1 = api_client.post(
            f'/api/portal/{sample_grant.raw_token}/upload/',
            data={'file': pdf1, 'dataItemId': 'item_001'},
            format='multipart',
        )
        assert r1.status_code == 201

        # Upload item_002
        pdf2 = SimpleUploadedFile('proof2.pdf', b'%PDF-1.4 content2', content_type='application/pdf')
        r2 = api_client.post(
            f'/api/portal/{sample_grant.raw_token}/upload/',
            data={'file': pdf2, 'dataItemId': 'item_002'},
            format='multipart',
        )
        assert r2.status_code == 201

        sample_target.refresh_from_db()
        assert sample_target.status == TargetStatus.SUBMITTED
