import uuid
from django.db import models
from django.conf import settings
from django.core.exceptions import ValidationError

def generate_id(prefix):
    return f"{prefix}_{uuid.uuid4().hex[:14]}"

def generate_sch_id():
    return generate_id('sch')

def generate_sub_id():
    return generate_id('sub')

def generate_rec_id():
    return generate_id('rec')

def generate_ver_id():
    return generate_id('ver')

def generate_aud_id():
    return generate_id('aud')

class FormSchema(models.Model):
    id = models.CharField(max_length=64, primary_key=True, default=generate_sch_id)
    framework = models.CharField(max_length=64, default='NIRF')
    version = models.CharField(max_length=32)
    content = models.JSONField()
    checksum = models.CharField(max_length=64)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.framework} v{self.version} ({'active' if self.is_active else 'inactive'})"

class SubmissionStatus(models.TextChoices):
    DRAFT = 'DRAFT', 'Draft'
    SUBMITTED = 'SUBMITTED', 'Submitted'
    CORRECTION_REQUESTED = 'CORRECTION_REQUESTED', 'Correction Requested'
    APPROVED = 'APPROVED', 'Approved'

class SectionSubmission(models.Model):
    id = models.CharField(max_length=64, primary_key=True, default=generate_sub_id)
    request = models.ForeignKey(
        'data_requests.DataRequest',
        on_delete=models.CASCADE,
        related_name='section_submissions'
    )
    org_unit = models.ForeignKey(
        'organogram.OrgUnit',
        on_delete=models.CASCADE,
        related_name='section_submissions'
    )
    section_id = models.CharField(max_length=128)
    schema_version = models.CharField(max_length=32)
    status = models.CharField(
        max_length=32,
        choices=SubmissionStatus.choices,
        default=SubmissionStatus.DRAFT
    )
    not_applicable = models.BooleanField(default=False)
    payload = models.JSONField(default=dict, blank=True)
    revision = models.IntegerField(default=1)
    submitted_by = models.ForeignKey(
        'organogram.NodalOfficer',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='submitted_forms'
    )
    submitted_at = models.DateTimeField(null=True, blank=True)
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='reviewed_forms'
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    review_comment = models.TextField(blank=True, default='')
    warning_note = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['request', 'org_unit', 'section_id']
        constraints = [
            models.UniqueConstraint(
                fields=['request', 'org_unit', 'section_id'],
                name='unique_section_submission_per_request_unit'
            )
        ]

    def __str__(self):
        return f"{self.section_id} - {self.org_unit_id} ({self.status})"

class SubmissionRecord(models.Model):
    id = models.CharField(max_length=64, primary_key=True, default=generate_rec_id)
    submission = models.ForeignKey(
        SectionSubmission,
        on_delete=models.CASCADE,
        related_name='records'
    )
    block_id = models.CharField(max_length=128)
    row_key = models.CharField(max_length=255)
    unit = models.ForeignKey(
        'organogram.OrgUnit',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='submission_records'
    )
    data = models.JSONField(default=dict)
    position = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['submission', 'block_id', 'position']

    def __str__(self):
        return f"{self.block_id}:{self.row_key} ({self.submission_id})"

class VerificationStatus(models.TextChoices):
    PENDING = 'PENDING', 'Pending'
    CONFIRMED = 'CONFIRMED', 'Confirmed'
    DISPUTED = 'DISPUTED', 'Disputed'

class RecordVerification(models.Model):
    id = models.CharField(max_length=64, primary_key=True, default=generate_ver_id)
    submission = models.ForeignKey(
        SectionSubmission,
        on_delete=models.CASCADE,
        related_name='verifications'
    )
    unit = models.ForeignKey(
        'organogram.OrgUnit',
        on_delete=models.CASCADE,
        related_name='record_verifications'
    )
    status = models.CharField(
        max_length=32,
        choices=VerificationStatus.choices,
        default=VerificationStatus.PENDING
    )
    comment = models.TextField(blank=True, default='')
    by = models.ForeignKey(
        'organogram.NodalOfficer',
        null=True,
        blank=True,
        on_delete=models.SET_NULL
    )
    at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['submission', 'unit'],
                name='unique_verification_per_submission_unit'
            )
        ]

    def __str__(self):
        return f"Verification {self.unit_id} for {self.submission_id}: {self.status}"

class SubmissionAuditLog(models.Model):
    id = models.CharField(max_length=64, primary_key=True, default=generate_aud_id)
    submission = models.ForeignKey(
        SectionSubmission,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='audit_logs'
    )
    actor_type = models.CharField(max_length=32)  # 'OFFICER', 'ADMIN', 'SYSTEM'
    actor_id = models.CharField(max_length=128)
    action = models.CharField(max_length=64)  # 'CREATE', 'UPDATE', 'SUBMIT', 'APPROVE', 'REQUEST_CORRECTION', 'REOPEN', 'IMPORT', 'VERIFY'
    delta = models.JSONField(default=dict)
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-timestamp']

    def save(self, *args, **kwargs):
        if self.pk and SubmissionAuditLog.objects.filter(pk=self.pk).exists():
            raise ValidationError("SubmissionAuditLog entries are immutable and cannot be updated.")
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise ValidationError("SubmissionAuditLog entries are append-only and cannot be deleted.")

    def __str__(self):
        return f"[{self.timestamp}] {self.actor_type}:{self.actor_id} -> {self.action}"


def generate_flg_id():
    return generate_id('flg')


def generate_ail_id():
    return generate_id('ail')


class FlagSeverity(models.TextChoices):
    CRITICAL = 'CRITICAL', 'Critical'
    WARNING = 'WARNING', 'Warning'
    INFO = 'INFO', 'Info'


class FlagStatus(models.TextChoices):
    OPEN = 'OPEN', 'Open'
    DISMISSED = 'DISMISSED', 'Dismissed'
    ESCALATED = 'ESCALATED', 'Escalated to correction request'
    RESOLVED = 'RESOLVED', 'Resolved'


class AIRequestLog(models.Model):
    """
    Every call made to an external AI model (spec 9: "All AI requests must be
    logged for auditability"). The prompt is stored as sent - it carries only
    aggregated, PII-free figures - so an auditor can see exactly what left the
    portal and what came back.
    """
    id = models.CharField(max_length=64, primary_key=True, default=generate_ail_id)
    created_at = models.DateTimeField(auto_now_add=True)
    provider = models.CharField(max_length=32)
    model = models.CharField(max_length=128)
    purpose = models.CharField(max_length=64, default='discrepancy-review')
    request = models.ForeignKey(
        'data_requests.DataRequest', null=True, blank=True, on_delete=models.SET_NULL, related_name='ai_requests'
    )
    triggered_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name='ai_requests'
    )
    prompt = models.JSONField(default=dict)
    prompt_sha256 = models.CharField(max_length=64)
    response_text = models.TextField(blank=True, default='')
    status = models.CharField(max_length=16)  # OK / ERROR / INVALID
    error = models.TextField(blank=True, default='')
    latency_ms = models.IntegerField(default=0)
    flags_sent = models.IntegerField(default=0)
    flags_annotated = models.IntegerField(default=0)
    items_rejected = models.IntegerField(default=0)

    class Meta:
        ordering = ['-created_at']


class DiscrepancyFlag(models.Model):
    """
    A figure that warrants a second look before it goes to NIRF (spec 2.9).

    Raised by deterministic rules, always: year-on-year moves, restated
    periods, record-count swings and failed cross-checks. The optional AI
    review only annotates a flag (its own severity view, a rationale and a
    question to put to the department); it never creates numbers, and the
    figures shown are always the portal's own.
    """
    id = models.CharField(max_length=64, primary_key=True, default=generate_flg_id)
    key = models.CharField(max_length=255)
    request = models.ForeignKey('data_requests.DataRequest', on_delete=models.CASCADE, related_name='discrepancy_flags')
    submission = models.ForeignKey(
        SectionSubmission, null=True, blank=True, on_delete=models.CASCADE, related_name='discrepancy_flags'
    )
    org_unit = models.ForeignKey(
        'organogram.OrgUnit', null=True, blank=True, on_delete=models.SET_NULL, related_name='discrepancy_flags'
    )
    section_id = models.CharField(max_length=128, blank=True, default='')
    kind = models.CharField(max_length=32)  # YOY_CHANGE / RESTATEMENT / RECORD_COUNT / CROSS_CHECK
    path = models.JSONField(default=dict, blank=True)
    label = models.CharField(max_length=512, blank=True, default='')
    severity = models.CharField(max_length=16, choices=FlagSeverity.choices)
    message = models.TextField()
    previous_value = models.CharField(max_length=128, blank=True, default='')
    current_value = models.CharField(max_length=128, blank=True, default='')
    change_pct = models.FloatField(null=True, blank=True)
    details = models.JSONField(default=dict, blank=True)

    ai_severity = models.CharField(max_length=16, blank=True, default='')
    ai_rationale = models.TextField(blank=True, default='')
    ai_question = models.TextField(blank=True, default='')
    ai_log = models.ForeignKey(AIRequestLog, null=True, blank=True, on_delete=models.SET_NULL, related_name='flags')

    status = models.CharField(max_length=16, choices=FlagStatus.choices, default=FlagStatus.OPEN)
    resolution_note = models.TextField(blank=True, default='')
    resolved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name='resolved_flags'
    )
    resolved_at = models.DateTimeField(null=True, blank=True)
    first_seen = models.DateTimeField(auto_now_add=True)
    last_seen = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['status', 'severity', '-last_seen']
        constraints = [
            models.UniqueConstraint(fields=['request', 'key'], name='uniq_flag_key_per_request'),
        ]
