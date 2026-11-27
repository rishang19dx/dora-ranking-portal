"""
Tests for the audited manual multi-agency ranking workflow (`RankingRecord` and `RankingAuditLog`).
"""
import pytest
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient

from apps.rankings.models import RankingAuditLog, RankingRecord, RankingRecordStatus

User = get_user_model()


def _client_for(role, username):
    user = User.objects.create_user(
        username=username,
        email=f'{username}@iitmandi.ac.in',
        password='RankingPass!23',
        role=role,
    )
    client = APIClient()
    client.force_authenticate(user=user)
    return client, user


@pytest.mark.django_db
class TestRankingRecordWorkflow:

    def test_manual_ranking_maker_verify_publish_lifecycle(self, tmp_path, settings):
        settings.MEDIA_ROOT = str(tmp_path)
        officer_client, officer = _client_for('NODAL_OFFICER', 'rank_officer')
        auditor_client, _ = _client_for('AUDITOR', 'rank_auditor')
        admin_client, _ = _client_for('ADMIN', 'rank_admin')
        anon_client = APIClient()

        proof = SimpleUploadedFile('qs_proof.pdf', b'%PDF-1.4 qs letter', content_type='application/pdf')
        created = officer_client.post(
            '/api/ranking-records/',
            {
                'agency': 'QS',
                'category': 'World University Rankings',
                'year': 2026,
                'rank': '601-650',
                'source_url': 'https://www.topuniversities.com/',
                'remarks': 'Verified institutional release',
                'evidence': proof,
            },
            format='multipart',
        )
        assert created.status_code == 201
        rec_id = created.data['id']
        assert created.data['status'] == RankingRecordStatus.DRAFT

        # Anonymous visitors cannot see drafts.
        assert anon_client.get('/api/ranking-records/').json() == []

        # Officer submits for verification.
        submitted = officer_client.post(f'/api/ranking-records/{rec_id}/actions/submit/', {}, format='json')
        assert submitted.status_code == 200
        assert submitted.data['status'] == RankingRecordStatus.PENDING_REVIEW

        # Nodal officer cannot verify or publish their own record.
        assert officer_client.post(f'/api/ranking-records/{rec_id}/actions/verify/', {}, format='json').status_code == 403
        assert officer_client.post(f'/api/ranking-records/{rec_id}/actions/publish/', {}, format='json').status_code == 403

        # Auditor verifies the pending record.
        verified = auditor_client.post(
            f'/api/ranking-records/{rec_id}/actions/verify/',
            {'comment': 'Matches QS release letter'},
            format='json',
        )
        assert verified.status_code == 200
        assert verified.data['status'] == RankingRecordStatus.VERIFIED

        # Admin publishes and then unpublishes.
        published = admin_client.post(f'/api/ranking-records/{rec_id}/actions/publish/', {}, format='json')
        assert published.status_code == 200
        assert published.data['status'] == RankingRecordStatus.PUBLISHED

        # Public sees published record with internal evidence & actor fields stripped.
        public_rows = anon_client.get('/api/ranking-records/').json()
        assert len(public_rows) == 1
        assert public_rows[0]['rank'] == '601-650'
        for hidden in ('evidence', 'evidence_url', 'submitted_by', 'submitted_by_name', 'reviewed_by'):
            assert hidden not in public_rows[0]

        unpublished = admin_client.post(f'/api/ranking-records/{rec_id}/actions/unpublish/', {}, format='json')
        assert unpublished.status_code == 200
        assert unpublished.data['status'] == RankingRecordStatus.VERIFIED

        # Audit trail captures every transition and is accessible to oversight only.
        assert officer_client.get(f'/api/ranking-records/{rec_id}/audit/').status_code == 403
        audit_res = auditor_client.get(f'/api/ranking-records/{rec_id}/audit/')
        assert audit_res.status_code == 200
        actions = {entry['action'] for entry in audit_res.json()}
        assert {'CREATE', 'SUBMIT', 'VERIFY', 'PUBLISH', 'UNPUBLISH'} <= actions

    def test_reject_and_resubmit_flow_and_scoping(self):
        officer_client, _ = _client_for('NODAL_OFFICER', 'rank_maker')
        other_client, _ = _client_for('NODAL_OFFICER', 'rank_other')
        auditor_client, _ = _client_for('AUDITOR', 'rank_checker')

        created = officer_client.post(
            '/api/ranking-records/',
            {'agency': 'THE', 'category': 'Asia', 'year': 2026, 'rank': '201-250'},
            format='json',
        )
        rec_id = created.data['id']
        assert other_client.get(f'/api/ranking-records/{rec_id}/').status_code == 403
        assert other_client.patch(f'/api/ranking-records/{rec_id}/', {'rank': '1'}, format='json').status_code == 403

        officer_client.post(f'/api/ranking-records/{rec_id}/actions/submit/', {}, format='json')
        rejected = auditor_client.post(
            f'/api/ranking-records/{rec_id}/actions/reject/',
            {'comment': 'Attach official PDF proof'},
            format='json',
        )
        assert rejected.status_code == 200
        assert rejected.data['status'] == RankingRecordStatus.REJECTED

        patched = officer_client.patch(f'/api/ranking-records/{rec_id}/', {'rank': '180'}, format='json')
        assert patched.status_code == 200 and patched.data['rank'] == '180'

    def test_ranking_audit_log_is_immutable(self):
        rec = RankingRecord.objects.create(agency='MDRA', category='Engineering', year=2026, rank='15')
        log = RankingAuditLog.objects.create(ranking=rec, action='CREATE', delta={'status': 'DRAFT'})
        log.action = 'TAMPERED'
        with pytest.raises(ValidationError):
            log.save()
        with pytest.raises(ValidationError):
            log.delete()
