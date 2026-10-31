from rest_framework import permissions

class IsAdminOrDirector(permissions.BasePermission):
    """
    Allows access only to authenticated users with ADMIN or DIRECTOR role.
    """
    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        return (
            getattr(request.user, 'role', None) in ['ADMIN', 'DIRECTOR'] or
            request.user.is_staff or
            request.user.is_superuser
        )

class IsAdminOrDirectorOrAuditorReadOnly(permissions.BasePermission):
    """
    Allows read-only access to AUDITOR role, write access to ADMIN and DIRECTOR.
    """
    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        role = getattr(request.user, 'role', None)
        if request.method in permissions.SAFE_METHODS:
            return role in ['ADMIN', 'DIRECTOR', 'AUDITOR'] or request.user.is_staff or request.user.is_superuser
        return role in ['ADMIN', 'DIRECTOR'] or request.user.is_staff or request.user.is_superuser

