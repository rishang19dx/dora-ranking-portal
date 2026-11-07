"""
Tests for apps.accounts — models and authentication API.
"""
import jwt
import pytest
from django.contrib.auth import get_user_model
from django.db import IntegrityError

from apps.accounts.models import UserRole

User = get_user_model()


# ===========================================================================
# Model tests
# ===========================================================================

@pytest.mark.django_db
class TestUserModel:

    def test_user_creation_with_defaults(self):
        user = User.objects.create_user(
            username='testuser',
            email='testuser@example.com',
            password='SomePass123!',
        )
        assert user.role == UserRole.NODAL_OFFICER
        assert user.is_active is True
        assert user.phone is None

    def test_user_str_representation(self):
        user = User.objects.create_user(
            username='struser',
            email='struser@example.com',
            password='SomePass123!',
            role=UserRole.ADMIN,
        )
        assert str(user) == 'struser (Admin)'

    def test_user_username_is_unique(self):
        User.objects.create_user(
            username='duplicate_username',
            email='user1@example.com',
            password='Pass123!',
        )
        with pytest.raises(IntegrityError):
            User.objects.create_user(
                username='duplicate_username',
                email='user2@example.com',
                password='Pass456!',
            )

    def test_create_superuser(self):
        su = User.objects.create_superuser(
            username='superadmin',
            email='superadmin@example.com',
            password='SuperPass123!',
        )
        assert su.is_staff is True
        assert su.is_superuser is True

    def test_user_role_choices(self):
        valid_roles = [r[0] for r in UserRole.choices]
        assert 'ADMIN' in valid_roles
        assert 'NODAL_OFFICER' in valid_roles
        assert 'DIRECTOR' in valid_roles
        assert 'AUDITOR' in valid_roles
        assert len(valid_roles) == 4

    def test_user_has_no_password_in_plaintext(self):
        user = User.objects.create_user(
            username='hashuser',
            email='hashuser@example.com',
            password='PlainPassword!',
        )
        assert user.password != 'PlainPassword!'
        assert user.check_password('PlainPassword!') is True


# ===========================================================================
# Auth API tests
# ===========================================================================

@pytest.mark.django_db
class TestAuthAPI:

    def test_login_success(self, api_client, db_user):
        response = api_client.post(
            '/api/auth/token/',
            data={'username': 'nodal_officer', 'password': 'TestPass123!'},
            format='json',
        )
        assert response.status_code == 200
        data = response.data
        assert 'access' in data
        assert 'refresh' in data
        assert 'user' in data

    def test_login_wrong_password(self, api_client, db_user):
        response = api_client.post(
            '/api/auth/token/',
            data={'username': 'nodal_officer', 'password': 'WrongPassword!'},
            format='json',
        )
        assert response.status_code == 401

    def test_login_missing_fields(self, api_client, db_user):
        response = api_client.post(
            '/api/auth/token/',
            data={'username': 'nodal_officer'},
            format='json',
        )
        assert response.status_code == 400

    def test_login_nonexistent_email(self, api_client):
        response = api_client.post(
            '/api/auth/token/',
            data={'username': 'nobody', 'password': 'Pass123!'},
            format='json',
        )
        assert response.status_code == 401

    def test_get_current_user_authenticated(self, auth_client, db_user):
        response = auth_client.get('/api/auth/me/')
        assert response.status_code == 200
        data = response.data
        assert data['username'] == 'nodal_officer'
        assert data['email'] == 'nodal@iitmandi.ac.in'
        assert data['role'] == UserRole.NODAL_OFFICER

    def test_get_current_user_unauthenticated(self, api_client):
        response = api_client.get('/api/auth/me/')
        assert response.status_code == 401

    def test_token_refresh(self, api_client, db_user):
        # Get initial tokens
        login_response = api_client.post(
            '/api/auth/token/',
            data={'username': 'nodal_officer', 'password': 'TestPass123!'},
            format='json',
        )
        assert login_response.status_code == 200
        refresh_token = login_response.data['refresh']

        # Refresh
        response = api_client.post(
            '/api/auth/token/refresh/',
            data={'refresh': refresh_token},
            format='json',
        )
        assert response.status_code == 200
        assert 'access' in response.data

    def test_login_response_includes_role_in_token_claims(self, api_client, db_user):

        response = api_client.post(
            '/api/auth/token/',
            data={'username': 'nodal_officer', 'password': 'TestPass123!'},
            format='json',
        )
        assert response.status_code == 200
        access_token = response.data['access']

        # Decode without verification to inspect claims
        claims = jwt.decode(
            access_token,
            options={'verify_signature': False},
            algorithms=['HS256'],
        )
        assert 'role' in claims
        assert claims['role'] == UserRole.NODAL_OFFICER
