from django.db import models
import uuid

def generate_id(prefix):
    return f"{prefix}_{uuid.uuid4().hex[:14]}"

def generate_req_id():
    return generate_id('req')

def generate_tgt_id():
    return generate_id('tgt')

def generate_grt_id():
    return generate_id('grt')

def generate_upl_id():
    return generate_id('upl')

def generate_del_id():
    return generate_id('del')

def generate_rem_id():
    return generate_id('rem')

class RankingFramework(models.TextChoices):
    NIRF = 'NIRF', 'NIRF'
    QS = 'QS', 'QS'
    THE = 'THE', 'THE'
    NAAC = 'NAAC', 'NAAC'

class DataRequestStatus(models.TextChoices):
    DISPATCHED = 'DISPATCHED', 'Dispatched'
    CLOSED = 'CLOSED', 'Closed'

class TargetStatus(models.TextChoices):
    PENDING = 'PENDING', 'Pending'
    PARTIAL = 'PARTIAL', 'Partial'
    SUBMITTED = 'SUBMITTED', 'Submitted'

class DeliveryStatus(models.TextChoices):
    SENT = 'SENT', 'Sent'
    SIMULATED = 'SIMULATED', 'Simulated'
    FAILED = 'FAILED', 'Failed'

class DeliveryKind(models.TextChoices):
    DISPATCH = 'DISPATCH', 'Dispatch'
    REMINDER = 'REMINDER', 'Reminder'

class DataRequest(models.Model):
    id = models.CharField(max_length=64, primary_key=True, default=generate_req_id)
    reference = models.CharField(max_length=64, unique=True)
    title = models.CharField(max_length=255)
    framework = models.CharField(max_length=32, choices=RankingFramework.choices)
    cycle_year = models.IntegerField()
    categories = models.JSONField(default=list, blank=True, null=True)
    subject = models.CharField(max_length=255)
    message = models.TextField()
    deadline = models.DateTimeField()
    data_item_ids = models.JSONField(default=list)
    status = models.CharField(
        max_length=32,
        choices=DataRequestStatus.choices,
        default=DataRequestStatus.DISPATCHED
    )
    created_by = models.CharField(max_length=255, default='DORA Admin')
    created_at = models.DateTimeField(auto_now_add=True)
    dispatched_at = models.DateTimeField(auto_now_add=True)
    # Deadline-driven reminders (spec 2.5); the admin can pause them per request.
    auto_remind = models.BooleanField(default=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.reference} - {self.title}"

class DataRequestTarget(models.Model):
    id = models.CharField(max_length=64, primary_key=True, default=generate_tgt_id)
    request = models.ForeignKey(DataRequest, on_delete=models.CASCADE, related_name='targets')
    org_unit = models.ForeignKey('organogram.OrgUnit', on_delete=models.CASCADE, related_name='data_request_targets')
    data_item_ids = models.JSONField(default=list)
    status = models.CharField(
        max_length=32,
        choices=TargetStatus.choices,
        default=TargetStatus.PENDING
    )
    reminders_sent = models.IntegerField(default=0)
    last_reminder_at = models.DateTimeField(blank=True, null=True)
    submitted_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        unique_together = ('request', 'org_unit')

    def __str__(self):
        return f"{self.request.reference} -> {self.org_unit.name} ({self.status})"

class PortalAccessGrant(models.Model):
    id = models.CharField(max_length=64, primary_key=True, default=generate_grt_id)
    token_hash = models.CharField(max_length=64, unique=True)
    officer = models.ForeignKey('organogram.NodalOfficer', on_delete=models.CASCADE, related_name='grants')
    request = models.ForeignKey(DataRequest, on_delete=models.CASCADE, related_name='grants')
    org_unit = models.ForeignKey('organogram.OrgUnit', on_delete=models.CASCADE, related_name='grants')
    data_item_ids = models.JSONField(default=list)
    expires_at = models.DateTimeField()
    revoked_at = models.DateTimeField(blank=True, null=True)
    last_used_at = models.DateTimeField(blank=True, null=True)
    use_count = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    def invalid_reason(self):
        """
        Why this grant cannot be used right now, or None if it can.

        A link is only as trustworthy as the standing of everything behind it,
        so expiry and explicit revocation are not the whole test: the request
        may have been closed, the officer's access withdrawn, or the officer
        may no longer represent the unit the link is scoped to.
        """
        from django.utils import timezone

        if self.revoked_at:
            return 'Access grant was revoked.'
        if self.expires_at <= timezone.now():
            return 'Access grant has expired.'
        if self.request.status == DataRequestStatus.CLOSED:
            return 'The data request has been closed.'

        from apps.organogram.models import OfficerStatus
        if self.officer.status == OfficerStatus.REVOKED:
            return 'The nodal officer\'s access has been revoked.'
        if not self.officer.assigned_units.filter(pk=self.org_unit_id).exists():
            return 'The nodal officer no longer represents this section.'
        return None

    def is_valid(self):
        return self.invalid_reason() is None

class ProofUpload(models.Model):
    id = models.CharField(max_length=64, primary_key=True, default=generate_upl_id)
    request = models.ForeignKey(DataRequest, on_delete=models.CASCADE, related_name='uploads')
    grant = models.ForeignKey(PortalAccessGrant, on_delete=models.CASCADE, related_name='uploads')
    officer = models.ForeignKey('organogram.NodalOfficer', on_delete=models.CASCADE, related_name='uploads')
    org_unit = models.ForeignKey('organogram.OrgUnit', on_delete=models.CASCADE, related_name='uploads')
    data_item_id = models.CharField(max_length=128)
    file = models.FileField(upload_to='proofs/%Y/%m/')
    file_name = models.CharField(max_length=255)
    stored_name = models.CharField(max_length=255)
    size = models.BigIntegerField()
    content_type = models.CharField(max_length=128)
    checksum = models.CharField(max_length=64)  # SHA-256
    note = models.TextField(blank=True, null=True)
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-uploaded_at']

class RequestDelivery(models.Model):
    id = models.CharField(max_length=64, primary_key=True, default=generate_del_id)
    request = models.ForeignKey(DataRequest, on_delete=models.CASCADE, related_name='deliveries')
    officer = models.ForeignKey('organogram.NodalOfficer', on_delete=models.CASCADE, related_name='deliveries')
    org_unit = models.ForeignKey('organogram.OrgUnit', on_delete=models.CASCADE, related_name='deliveries')
    email = models.EmailField()
    subject = models.CharField(max_length=255)
    status = models.CharField(max_length=32, choices=DeliveryStatus.choices)
    kind = models.CharField(max_length=32, choices=DeliveryKind.choices, default=DeliveryKind.DISPATCH)
    error = models.TextField(blank=True, null=True)
    sent_at = models.DateTimeField(auto_now_add=True)


class ReminderOutcome(models.TextChoices):
    SENT = 'SENT', 'Sent'
    SKIPPED = 'SKIPPED', 'Skipped'


class ScheduledReminder(models.Model):
    """
    One automated reminder milestone for one section of a request.

    A milestone is a point on the request's deadline schedule ("T-7" = seven
    days before, "OVERDUE-1" = first chase after the deadline). The unique
    constraint is what makes the scheduler idempotent: however often it runs,
    a section is reminded at most once per milestone.
    """
    id = models.CharField(max_length=64, primary_key=True, default=generate_rem_id)
    request = models.ForeignKey(DataRequest, on_delete=models.CASCADE, related_name='scheduled_reminders')
    target = models.ForeignKey(DataRequestTarget, on_delete=models.CASCADE, related_name='scheduled_reminders')
    milestone = models.CharField(max_length=32)
    due_at = models.DateTimeField()
    outcome = models.CharField(max_length=16, choices=ReminderOutcome.choices)
    detail = models.TextField(blank=True, default='')
    deliveries = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        constraints = [
            models.UniqueConstraint(fields=['target', 'milestone'], name='uniq_reminder_milestone_per_target'),
        ]

    def __str__(self):
        return f"{self.request.reference} {self.target.org_unit_id} {self.milestone} {self.outcome}"
