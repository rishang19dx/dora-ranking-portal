"""
Tests for apps.organogram — models, serializers, and API.
"""
import pytest
from django.db import IntegrityError

from apps.organogram.models import (
    NodalOfficer,
    OfficerStatus,
    OrgUnit,
    OrgUnitType,
)
from apps.organogram.serializers import NodalOfficerSerializer, OrgUnitSerializer

# ===========================================================================
# Model tests — OrgUnit
# ===========================================================================

@pytest.mark.django_db
class TestOrgUnitModel:

    def test_orgunit_creation(self):
        unit = OrgUnit.objects.create(
            id='OU-TEST-001',
            name='Test Unit',
            short_name='TU',
            type=OrgUnitType.GOVERNANCE,
            head='Head Person',
            email='test@iitmandi.ac.in',
            description='A test organisational unit',
            data_scopes=[],
        )
        assert unit.id == 'OU-TEST-001'
        assert unit.name == 'Test Unit'
        assert unit.short_name == 'TU'
        assert unit.type == OrgUnitType.GOVERNANCE
        assert unit.parent is None

    def test_orgunit_str_representation(self):
        unit = OrgUnit.objects.create(
            id='OU-STR-001',
            name='Str Unit',
            type=OrgUnitType.EXECUTIVE,
        )
        assert str(unit) == 'Str Unit (OU-STR-001)'

    def test_orgunit_self_referential_parent(self, sample_org_unit, child_org_unit):
        assert child_org_unit.parent == sample_org_unit
        assert child_org_unit in sample_org_unit.children.all()

    def test_orgunit_cascades_children_on_delete(self, sample_org_unit, child_org_unit):
        """Deleting parent sets child parent to NULL (SET_NULL)."""
        child_id = child_org_unit.id
        sample_org_unit.delete()
        child_org_unit.refresh_from_db()
        assert child_org_unit.parent is None
        assert OrgUnit.objects.filter(id=child_id).exists()

    def test_orgunit_ordering_by_id(self):
        OrgUnit.objects.create(id='OU-ZZZ', name='Z Unit', type=OrgUnitType.FUNCTIONAL)
        OrgUnit.objects.create(id='OU-AAA', name='A Unit', type=OrgUnitType.FUNCTIONAL)
        ids = list(OrgUnit.objects.values_list('id', flat=True))
        assert ids == sorted(ids)


# ===========================================================================
# Model tests — NodalOfficer
# ===========================================================================

@pytest.mark.django_db
class TestNodalOfficerModel:

    def test_nodal_officer_creation(self):
        officer = NodalOfficer.objects.create(
            name='John Doe',
            email='john@iitmandi.ac.in',
            designation='Professor',
            phone='9876543210',
        )
        assert officer.name == 'John Doe'
        assert officer.email == 'john@iitmandi.ac.in'
        assert officer.status == OfficerStatus.INVITED  # default
        assert officer.id.startswith('no_')

    def test_nodal_officer_email_unique(self):
        NodalOfficer.objects.create(name='Officer A', email='unique@iitmandi.ac.in')
        with pytest.raises(IntegrityError):
            NodalOfficer.objects.create(name='Officer B', email='unique@iitmandi.ac.in')

    def test_nodal_officer_str_representation(self):
        officer = NodalOfficer.objects.create(
            name='Jane Smith',
            email='jane@iitmandi.ac.in',
        )
        assert str(officer) == 'Jane Smith <jane@iitmandi.ac.in>'

    def test_nodal_officer_assigned_units_m2m(self, sample_org_unit):
        officer = NodalOfficer.objects.create(
            name='M2M Officer',
            email='m2m@iitmandi.ac.in',
        )
        officer.assigned_units.add(sample_org_unit)
        assert sample_org_unit in officer.assigned_units.all()
        assert officer in sample_org_unit.nodal_officers.all()

    def test_nodal_officer_status_choices(self):
        valid_statuses = [s[0] for s in OfficerStatus.choices]
        assert 'INVITED' in valid_statuses
        assert 'ACTIVE' in valid_statuses
        assert 'REVOKED' in valid_statuses


# ===========================================================================
# Serializer tests
# ===========================================================================

@pytest.mark.django_db
class TestOrgUnitSerializer:

    def test_orgunit_serializer_fields(self, sample_org_unit):
        data = OrgUnitSerializer(sample_org_unit).data
        expected_fields = {'id', 'name', 'shortName', 'type', 'head', 'email', 'description', 'dataScopes', 'parentId'}
        assert expected_fields.issubset(set(data.keys()))

    def test_orgunit_serializer_camelcase_mapping(self, sample_org_unit):
        data = OrgUnitSerializer(sample_org_unit).data
        assert 'shortName' in data
        assert 'dataScopes' in data
        assert 'parentId' in data
        # Snake_case should NOT be present
        assert 'short_name' not in data
        assert 'data_scopes' not in data
        assert 'parent_id' not in data

    def test_orgunit_serializer_parentid(self, child_org_unit, sample_org_unit):
        data = OrgUnitSerializer(child_org_unit).data
        assert data['parentId'] == sample_org_unit.id


@pytest.mark.django_db
class TestNodalOfficerSerializer:

    def test_nodal_officer_serializer_unit_ids(self, sample_officer, sample_org_unit):
        data = NodalOfficerSerializer(sample_officer).data
        assert 'unitIds' in data
        assert isinstance(data['unitIds'], list)
        assert sample_org_unit.id in data['unitIds']


# ===========================================================================
# API tests
# ===========================================================================

@pytest.mark.django_db
class TestOrganogramAPI:

    def test_organogram_overview_returns_200(self, api_client):
        response = api_client.get('/api/organogram/')
        assert response.status_code == 200

    def test_organogram_overview_structure(self, api_client):
        response = api_client.get('/api/organogram/')
        data = response.data
        # Must contain these top-level keys
        assert 'tree' in data
        assert 'units' in data
        assert 'catalogue' in data
        assert 'groups' in data

    def test_nodal_officer_list_returns_200(self, admin_client):
        response = admin_client.get('/api/nodal-officers/')
        assert response.status_code == 200
        assert isinstance(response.data, list)

    def test_create_nodal_officer(self, admin_client, sample_org_unit):
        payload = {
            'name': 'New Officer',
            'email': 'newofficer@iitmandi.ac.in',
            'designation': 'Associate Professor',
            'unitIds': [sample_org_unit.id],
        }
        response = admin_client.post('/api/nodal-officers/', data=payload, format='json')
        assert response.status_code == 201
        assert response.data['email'] == 'newofficer@iitmandi.ac.in'
        assert sample_org_unit.id in response.data['unitIds']

    def test_create_nodal_officer_duplicate_email(self, admin_client, sample_officer):
        payload = {
            'name': 'Another Officer',
            'email': sample_officer.email,  # duplicate
        }
        response = admin_client.post('/api/nodal-officers/', data=payload, format='json')
        assert response.status_code == 400

    def test_get_nodal_officer_detail(self, admin_client, sample_officer):
        response = admin_client.get(f'/api/nodal-officers/{sample_officer.id}/')
        assert response.status_code == 200
        assert response.data['id'] == sample_officer.id

    def test_get_nodal_officer_not_found(self, admin_client):
        response = admin_client.get('/api/nodal-officers/no_nonexistent1234/')
        assert response.status_code == 404

    def test_patch_nodal_officer(self, admin_client, sample_officer):
        response = admin_client.patch(
            f'/api/nodal-officers/{sample_officer.id}/',
            data={'status': 'ACTIVE'},
            format='json',
        )
        assert response.status_code == 200
        assert response.data['status'] == 'ACTIVE'

    def test_delete_nodal_officer(self, admin_client, sample_officer):
        response = admin_client.delete(f'/api/nodal-officers/{sample_officer.id}/')
        assert response.status_code == 204
        # Verify it's gone
        get_response = admin_client.get(f'/api/nodal-officers/{sample_officer.id}/')
        assert get_response.status_code == 404

    def test_officer_access_grants_list(self, admin_client, sample_officer, sample_grant):
        response = admin_client.get(f'/api/nodal-officers/{sample_officer.id}/access/')
        assert response.status_code == 200
        assert isinstance(response.data, list)
        assert len(response.data) >= 1
