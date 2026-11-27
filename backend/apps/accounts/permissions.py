"""
Role-based access control (proposal spec 2.18).

    Admin/Staff (Data Officer)  full access: dispatch requests, review and
                                approve submissions, correct, export.
    Department Nodal Officer    their own department only.
    Leadership / Director       read-only: dashboards, analytics, reports.
    Auditor                     read-only: proofs, audit log, submission trails.

Every write in the portal is therefore Admin-only, and Director and Auditor
are strictly read-only. A Django superuser counts as Admin (the account
`createsuperuser` makes defaults to the NODAL_OFFICER role, which would
otherwise lock the operator out of their own install). `is_staff` on its own
does not elevate: it only opens the Django admin site, and the portal role is
what decides portal access.

The permission classes are named for who may read; writes are always Admin.
"""
from rest_framework import permissions

ADMIN = 'ADMIN'
DIRECTOR = 'DIRECTOR'
AUDITOR = 'AUDITOR'
NODAL_OFFICER = 'NODAL_OFFICER'

LEADERSHIP_ROLES = (ADMIN, DIRECTOR)
OVERSIGHT_ROLES = (ADMIN, DIRECTOR, AUDITOR)


def effective_role(user):
    """The portal role used for every access decision, or None if anonymous."""
    if not user or not getattr(user, 'is_authenticated', False):
        return None
    if getattr(user, 'is_superuser', False):
        return ADMIN
    return getattr(user, 'role', None)


def is_admin(user):
    return effective_role(user) == ADMIN


def has_oversight(user):
    """Admin, Director or Auditor: sees the whole institute, read-only unless Admin."""
    return effective_role(user) in OVERSIGHT_ROLES


class _RoleGate(permissions.BasePermission):
    read_roles = ()
    write_roles = (ADMIN,)
    message = 'Your role does not permit this action.'

    def has_permission(self, request, view):
        role = effective_role(request.user)
        if role is None:
            return False
        if request.method in permissions.SAFE_METHODS:
            return role in self.read_roles
        return role in self.write_roles


class IsAdmin(_RoleGate):
    """Admin only, for reads and writes alike."""
    read_roles = (ADMIN,)


class IsAdminOrLeadershipReadOnly(_RoleGate):
    """Admin writes; Director may read (executive dashboards and reports)."""
    read_roles = LEADERSHIP_ROLES


class IsAdminOrOversightReadOnly(_RoleGate):
    """Admin writes; Director and Auditor may read (trails, proofs, audit log)."""
    read_roles = OVERSIGHT_ROLES



class IsAdminOrAuditorReadOnly(_RoleGate):
    """Admin writes; Auditor may read (raw AI prompts and responses)."""
    read_roles = (ADMIN, AUDITOR)
