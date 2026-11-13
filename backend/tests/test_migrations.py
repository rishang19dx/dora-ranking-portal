"""
Tests for Django migrations — consistency and schema checks.
"""
import pytest
from django.db import connection

# ===========================================================================
# Migration consistency tests
# ===========================================================================

@pytest.mark.django_db
class TestMigrationConsistency:

    def test_migrations_are_consistent(self):
        """
        Confirm no pending migrations exist using MigrationExecutor.
        An empty migration plan means all migrations have been applied.
        """
        from django.db.migrations.executor import MigrationExecutor

        executor = MigrationExecutor(connection)
        plan = executor.migration_plan(executor.loader.graph.leaf_nodes())
        assert plan == [], (
            f"There are {len(plan)} unapplied migrations: "
            + ", ".join(str(m) for m, _ in plan)
        )

    def test_no_pending_migrations(self):
        """
        Uses MigrationLoader directly to verify all migrations are applied.
        """
        from django.db.migrations.loader import MigrationLoader

        loader = MigrationLoader(connection)
        # applied is the set of (app_label, migration_name) tuples that have been applied
        applied = loader.applied_migrations
        # disk_migrations is all migrations found on disk
        disk = set(loader.disk_migrations.keys())
        unapplied = disk - set(applied.keys())
        # Squashed migrations from replaced migrations should be ignored
        # Filter out squashed migrations
        real_unapplied = {
            m for m in unapplied
            if not loader.disk_migrations[m].replaces
        }
        assert real_unapplied == set(), (
            f"Unapplied migrations: {real_unapplied}"
        )


# ===========================================================================
# Schema / table existence tests
# ===========================================================================

@pytest.mark.django_db
class TestTableExistence:

    def _get_table_names(self):
        with connection.cursor() as cursor:
            return connection.introspection.table_names(cursor)

    def test_accounts_migration_creates_user_table(self):
        tables = self._get_table_names()
        assert 'accounts_user' in tables, (
            f"Expected 'accounts_user' table. Found tables: {tables}"
        )

    def test_organogram_migration_creates_orgunit_table(self):
        tables = self._get_table_names()
        assert 'organogram_orgunit' in tables, (
            f"Expected 'organogram_orgunit' table. Found tables: {tables}"
        )

    def test_data_requests_migration_creates_tables(self):
        tables = self._get_table_names()
        expected_tables = [
            'data_requests_datarequest',
            'data_requests_datarequesttarget',
            'data_requests_portalaccessgrant',
            'data_requests_proofupload',
            'data_requests_requestdelivery',
        ]
        for table in expected_tables:
            assert table in tables, (
                f"Expected table '{table}' not found. Available: {tables}"
            )


# ===========================================================================
# Field-level schema tests
# ===========================================================================

@pytest.mark.django_db
class TestFieldSchemas:

    def test_orgunit_id_is_string_pk(self):
        """OrgUnit PK should be a CharField (varchar), not BigAutoField."""
        from apps.organogram.models import OrgUnit
        pk_field = OrgUnit._meta.pk
        assert pk_field.get_internal_type() == 'CharField', (
            f"Expected CharField PK, got {pk_field.get_internal_type()}"
        )

    def test_user_model_has_role_field(self):
        """User model must have a 'role' CharField."""
        from django.contrib.auth import get_user_model
        User = get_user_model()
        field = User._meta.get_field('role')
        assert field.get_internal_type() == 'CharField'

    def test_nodal_officer_email_has_unique_constraint(self):
        """NodalOfficer.email must have unique=True."""
        from apps.organogram.models import NodalOfficer
        email_field = NodalOfficer._meta.get_field('email')
        assert email_field.unique is True

    def test_datarequest_has_unique_reference_constraint(self):
        """DataRequest.reference must have unique=True."""
        from apps.data_requests.models import DataRequest
        ref_field = DataRequest._meta.get_field('reference')
        assert ref_field.unique is True

    def test_portal_access_grant_token_hash_unique(self):
        """PortalAccessGrant.token_hash must have unique=True."""
        from apps.data_requests.models import PortalAccessGrant
        field = PortalAccessGrant._meta.get_field('token_hash')
        assert field.unique is True

    def test_datarequesttarget_unique_together_constraint(self):
        """DataRequestTarget.unique_together must be ('request', 'org_unit')."""
        from apps.data_requests.models import DataRequestTarget
        unique_together = DataRequestTarget._meta.unique_together
        # unique_together is a tuple of tuples
        assert ('request', 'org_unit') in unique_together

    def test_nodal_officer_id_starts_with_prefix(self):
        """NodalOfficer PK default generator produces 'no_' prefix IDs."""
        from apps.organogram.models import generate_officer_id
        officer_id = generate_officer_id()
        assert officer_id.startswith('no_')
        assert len(officer_id) == 15  # 'no_' + 12 hex chars
