"""
Shared pytest fixtures for the DORA Ranking Portal test suite.
"""
import json
from datetime import timedelta
from unittest.mock import patch

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.models import User, UserRole
from apps.data_requests.models import (
    DataRequest,
    DataRequestStatus,
    DataRequestTarget,
    PortalAccessGrant,
    TargetStatus,
)
from apps.data_requests.services import generate_portal_token, hash_token
from apps.organogram.models import NodalOfficer, OfficerStatus, OrgUnit, OrgUnitType

# ---------------------------------------------------------------------------
# User fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def db_user(db):
    """A regular NODAL_OFFICER user."""
    user = User.objects.create_user(
        username='nodal_officer',
        email='nodal@iitmandi.ac.in',
        password='TestPass123!',
        role=UserRole.NODAL_OFFICER,
    )
    return user


@pytest.fixture
def admin_user(db):
    """An ADMIN user."""
    user = User.objects.create_user(
        username='admin_user',
        email='admin@iitmandi.ac.in',
        password='AdminPass123!',
        role=UserRole.ADMIN,
    )
    return user


# ---------------------------------------------------------------------------
# API client fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def api_client():
    """Unauthenticated DRF APIClient."""
    return APIClient()


@pytest.fixture
def auth_client(db_user):
    """DRF APIClient authenticated as db_user using a real JWT token."""
    client = APIClient()
    response = client.post(
        '/api/auth/token/',
        data={'username': 'nodal_officer', 'password': 'TestPass123!'},
        format='json',
    )
    assert response.status_code == 200, (
        f"Failed to obtain token for db_user: {response.data}"
    )
    token = response.data['access']
    client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')
    return client


@pytest.fixture
def admin_client(admin_user):
    """DRF APIClient authenticated as admin_user using a real JWT token."""
    client = APIClient()
    response = client.post(
        '/api/auth/token/',
        data={'username': 'admin_user', 'password': 'AdminPass123!'},
        format='json',
    )
    assert response.status_code == 200, (
        f"Failed to obtain token for admin_user: {response.data}"
    )
    token = response.data['access']
    client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')
    return client


# ---------------------------------------------------------------------------
# Organogram fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def sample_org_unit(db):
    """A top-level OrgUnit with GOVERNANCE type."""
    return OrgUnit.objects.create(
        id='OU-SENATE',
        name='Institute Senate',
        short_name='Senate',
        type=OrgUnitType.GOVERNANCE,
        head='Director',
        email='senate@iitmandi.ac.in',
        description='Governing body of IIT Mandi',
        data_scopes=[],
    )


@pytest.fixture
def child_org_unit(db, sample_org_unit):
    """A child OrgUnit under sample_org_unit."""
    return OrgUnit.objects.create(
        id='OU-ACADEMIC',
        name='Academic Affairs',
        short_name='AcadAffairs',
        type=OrgUnitType.ACADEMIC,
        head='Dean Academics',
        email='academics@iitmandi.ac.in',
        data_scopes=[],
        parent=sample_org_unit,
    )


@pytest.fixture
def sample_officer(db, sample_org_unit):
    """A NodalOfficer assigned to sample_org_unit, status ACTIVE."""
    officer = NodalOfficer.objects.create(
        name='Ramesh Kumar',
        designation='Nodal Officer',
        email='ramesh@iitmandi.ac.in',
        phone='9876543210',
        status=OfficerStatus.ACTIVE,
    )
    officer.assigned_units.add(sample_org_unit)
    return officer


# ---------------------------------------------------------------------------
# Data request fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def sample_data_request(db):
    """A DataRequest in DISPATCHED status."""
    return DataRequest.objects.create(
        reference='DORA/2024/NIRF/001',
        title='NIRF 2024 Data Collection',
        framework='NIRF',
        cycle_year=2024,
        subject='NIRF 2024 Data Request',
        message='Please submit the required data items by the deadline.',
        deadline=timezone.now() + timedelta(days=30),
        data_item_ids=['item_001', 'item_002'],
        status=DataRequestStatus.DISPATCHED,
        created_by='admin',
    )


@pytest.fixture
def sample_target(db, sample_data_request, sample_org_unit):
    """A DataRequestTarget linking sample_data_request to sample_org_unit."""
    return DataRequestTarget.objects.create(
        request=sample_data_request,
        org_unit=sample_org_unit,
        data_item_ids=['item_001', 'item_002'],
        status=TargetStatus.PENDING,
    )


@pytest.fixture
def sample_grant(db, sample_officer, sample_data_request, sample_org_unit):
    """
    A PortalAccessGrant with a real raw token.

    Attributes:
        .raw_token  — the URL-safe token to use in portal URLs
    """
    raw_token = generate_portal_token()
    token_hash = hash_token(raw_token)
    grant = PortalAccessGrant.objects.create(
        token_hash=token_hash,
        officer=sample_officer,
        request=sample_data_request,
        org_unit=sample_org_unit,
        data_item_ids=['item_001', 'item_002'],
        expires_at=timezone.now() + timedelta(days=45),
    )
    # Attach raw token so tests can build portal URLs
    grant.raw_token = raw_token
    return grant


# ---------------------------------------------------------------------------
# Rankings fixture — patches DATA_DIR with temp JSON files
# ---------------------------------------------------------------------------

@pytest.fixture
def ranking_data_files(tmp_path):
    """
    Creates minimal NIRF JSON ranking data files in a temp directory and
    patches DATA_DIR in both scraper and views modules so lru_cache reads
    from the temp path. Clears lru_cache before and after.
    """
    from apps.rankings.views import load_ranking_data

    # Sample data
    overall_data = [
        {"institute_id": "IR-O-U-0456", "name": "Indian Institute of Technology Madras",
         "city": "Chennai", "state": "Tamil Nadu", "score": 86.42, "rank": 1},
        {"institute_id": "IR-O-U-0184", "name": "Indian Institute of Technology Mandi",
         "city": "Mandi", "state": "Himachal Pradesh", "score": 55.0, "rank": 43},
    ]
    engineering_data = [
        {"institute_id": "IR-E-U-0456", "name": "Indian Institute of Technology Madras",
         "city": "Chennai", "state": "Tamil Nadu", "score": 88.0, "rank": 1},
        {"institute_id": "IR-E-U-0184", "name": "Indian Institute of Technology Mandi",
         "city": "Mandi", "state": "Himachal Pradesh", "score": 52.0, "rank": 35},
    ]
    innovation_data = [
        {"institute_id": "ARI-U-0456", "name": "Indian Institute of Technology Madras",
         "city": "Chennai", "state": "Tamil Nadu", "score": 85.5, "rank": 1},
        {"institute_id": "ARI-U-0184", "name": "Indian Institute of Technology Mandi",
         "city": "Mandi", "state": "Himachal Pradesh", "score": 71.0, "rank": 11},
    ]

    years = [2021, 2022, 2023, 2024, 2025]
    categories_data = {
        'overall': overall_data,
        'engineering': engineering_data,
        'innovation': innovation_data,
    }

    for year in years:
        for cat, data in categories_data.items():
            file_path = tmp_path / f"nirf_{year}_{cat}.json"
            with open(file_path, 'w', encoding='utf-8') as f:
                json.dump(data, f)

    load_ranking_data.cache_clear()

    with patch('apps.rankings.views.DATA_DIR', str(tmp_path)), \
         patch('apps.rankings.scraper.DATA_DIR', str(tmp_path)):
        yield tmp_path

    load_ranking_data.cache_clear()
