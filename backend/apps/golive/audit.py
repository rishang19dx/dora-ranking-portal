"""Platform-level entries in the immutable audit trail (no submission attached)."""

from apps.submissions.models import SubmissionAuditLog


def record(action: str, *, user=None, delta: dict | None = None) -> SubmissionAuditLog:
    if user is not None and getattr(user, 'is_authenticated', False):
        actor_type, actor_id = 'ADMIN', str(user.id)
    else:
        actor_type, actor_id = 'SYSTEM', 'system'
    return SubmissionAuditLog.objects.create(
        submission=None,
        actor_type=actor_type,
        actor_id=actor_id,
        action=action,
        delta=delta or {},
    )
