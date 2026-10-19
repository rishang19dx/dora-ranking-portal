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

    def is_valid(self):
        from django.utils import timezone
        if self.revoked_at:
            return False
        return self.expires_at > timezone.now()

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
