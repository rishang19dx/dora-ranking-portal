"""
Phase 4 records: the controlled pilot, the evidence behind its KPIs, user
acceptance testing, disaster-recovery drills, training and formal sign-offs.

Sign-offs are append-only, like the submission audit log: a go/no-go or UAT
decision is a record of what was decided at a moment, with a snapshot of the
readiness evidence it was based on, and is never edited afterwards.
"""

import uuid

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models


def _id(prefix):
    return f"{prefix}_{uuid.uuid4().hex[:14]}"


def generate_pilot_id():
    return _id('plt')


def generate_flag_review_id():
    return _id('flr')


def generate_drill_id():
    return _id('drl')


def generate_uat_exec_id():
    return _id('uat')


def generate_training_id():
    return _id('trn')


def generate_signoff_id():
    return _id('sgn')


# ---------------------------------------------------------------------------
# Controlled pilot
# ---------------------------------------------------------------------------

class PilotStatus(models.TextChoices):
    PLANNED = 'PLANNED', 'Planned'
    RUNNING = 'RUNNING', 'Running'
    COMPLETED = 'COMPLETED', 'Completed'


class Pilot(models.Model):
    """A closed pilot with a selected subset of departments (proposal 3.3)."""

    id = models.CharField(max_length=64, primary_key=True, default=generate_pilot_id)
    name = models.CharField(max_length=255)
    cycle_year = models.IntegerField()
    status = models.CharField(max_length=16, choices=PilotStatus.choices, default=PilotStatus.PLANNED)
    units = models.ManyToManyField('organogram.OrgUnit', related_name='pilots', blank=True)
    requests = models.ManyToManyField('data_requests.DataRequest', related_name='pilots', blank=True)
    started_at = models.DateTimeField(null=True, blank=True)
    ended_at = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(blank=True, default='')
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.name} ({self.status})"


class FlagVerdict(models.TextChoices):
    PENDING = 'PENDING', 'Pending review'
    AGREE = 'AGREE', 'Reviewer agrees with the system'
    DISAGREE = 'DISAGREE', 'Reviewer disagrees with the system'


class FlagReview(models.Model):
    """
    A reviewer's ground-truth judgement on one automated discrepancy check.

    `system_flagged` is what the system said (check failed = flagged). The
    reviewer's verdict turns that into the confusion matrix the AI-reliability
    KPI is computed from:

        flagged + AGREE      true positive
        flagged + DISAGREE   false positive (a false alarm)
        passed  + AGREE      true negative
        passed  + DISAGREE   false negative (a discrepancy the system missed)
    """

    id = models.CharField(max_length=64, primary_key=True, default=generate_flag_review_id)
    pilot = models.ForeignKey(Pilot, on_delete=models.CASCADE, related_name='flag_reviews')
    request = models.ForeignKey('data_requests.DataRequest', on_delete=models.CASCADE, related_name='flag_reviews')
    check_id = models.CharField(max_length=128)
    severity = models.CharField(max_length=16)  # info | warning | error
    critical = models.BooleanField(default=False)
    system_flagged = models.BooleanField()
    message = models.TextField(blank=True, default='')
    verdict = models.CharField(max_length=16, choices=FlagVerdict.choices, default=FlagVerdict.PENDING)
    comment = models.TextField(blank=True, default='')
    reviewer = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL)
    reviewed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['request_id', 'check_id']
        constraints = [
            models.UniqueConstraint(fields=['pilot', 'request', 'check_id'], name='unique_flag_review_per_check'),
        ]

    def __str__(self):
        return f"{self.check_id} on {self.request_id}: {self.verdict}"


# ---------------------------------------------------------------------------
# Disaster recovery
# ---------------------------------------------------------------------------

class DrillKind(models.TextChoices):
    AUTOMATED = 'AUTOMATED', 'Automated restore test'
    WITNESSED = 'WITNESSED', 'Witnessed drill'


class DisasterRecoveryDrill(models.Model):
    """
    One restore exercise. RPO is how old the restored data was when the
    failure was declared; RTO is how long service took to come back.
    """

    id = models.CharField(max_length=64, primary_key=True, default=generate_drill_id)
    kind = models.CharField(max_length=16, choices=DrillKind.choices, default=DrillKind.AUTOMATED)
    backup_name = models.CharField(max_length=255)
    backup_created_at = models.DateTimeField()
    failure_declared_at = models.DateTimeField()
    restored_at = models.DateTimeField()
    integrity_ok = models.BooleanField(default=False)
    details = models.JSONField(default=dict, blank=True)
    witnessed_by = models.CharField(max_length=255, blank=True, default='')
    notes = models.TextField(blank=True, default='')
    recorded_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-failure_declared_at']

    @property
    def rpo_hours(self) -> float:
        return max((self.failure_declared_at - self.backup_created_at).total_seconds(), 0) / 3600

    @property
    def rto_hours(self) -> float:
        return max((self.restored_at - self.failure_declared_at).total_seconds(), 0) / 3600

    @property
    def meets_targets(self) -> bool:
        return (
            self.integrity_ok
            and self.rpo_hours <= settings.DR_TARGET_RPO_HOURS
            and self.rto_hours <= settings.DR_TARGET_RTO_HOURS
        )

    def __str__(self):
        return f"{self.kind} drill {self.failure_declared_at:%Y-%m-%d} ({'pass' if self.meets_targets else 'fail'})"


# ---------------------------------------------------------------------------
# User acceptance testing
# ---------------------------------------------------------------------------

class UatPriority(models.TextChoices):
    CRITICAL = 'CRITICAL', 'Critical'
    HIGH = 'HIGH', 'High'
    NORMAL = 'NORMAL', 'Normal'


class UatScenario(models.Model):
    code = models.CharField(max_length=32, primary_key=True)
    title = models.CharField(max_length=255)
    area = models.CharField(max_length=64)
    role = models.CharField(max_length=32)
    priority = models.CharField(max_length=16, choices=UatPriority.choices, default=UatPriority.NORMAL)
    steps = models.JSONField(default=list)
    expected = models.TextField()
    order = models.IntegerField(default=0)
    active = models.BooleanField(default=True)

    class Meta:
        ordering = ['order', 'code']

    def __str__(self):
        return f"{self.code} {self.title}"


class UatStatus(models.TextChoices):
    PASS = 'PASS', 'Pass'
    FAIL = 'FAIL', 'Fail'
    BLOCKED = 'BLOCKED', 'Blocked'


class UatExecution(models.Model):
    id = models.CharField(max_length=64, primary_key=True, default=generate_uat_exec_id)
    scenario = models.ForeignKey(UatScenario, on_delete=models.CASCADE, related_name='executions')
    status = models.CharField(max_length=16, choices=UatStatus.choices)
    tester_name = models.CharField(max_length=255)
    tester = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL)
    notes = models.TextField(blank=True, default='')
    defect_ref = models.CharField(max_length=255, blank=True, default='')
    executed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-executed_at']


# ---------------------------------------------------------------------------
# Training
# ---------------------------------------------------------------------------

class TrainingAudience(models.TextChoices):
    NODAL_OFFICER = 'NODAL_OFFICER', 'Nodal officers'
    ADMIN = 'ADMIN', 'DORA staff (admin)'
    LEADERSHIP = 'LEADERSHIP', 'Leadership'
    AUDITOR = 'AUDITOR', 'Auditors'
    IT_OPERATIONS = 'IT_OPERATIONS', 'IT Services (operations)'


class TrainingSession(models.Model):
    id = models.CharField(max_length=64, primary_key=True, default=generate_training_id)
    title = models.CharField(max_length=255)
    audience = models.CharField(max_length=32, choices=TrainingAudience.choices)
    held_on = models.DateField()
    trainer = models.CharField(max_length=255)
    attendees = models.PositiveIntegerField(default=0)
    units = models.ManyToManyField('organogram.OrgUnit', related_name='training_sessions', blank=True)
    materials = models.CharField(max_length=500, blank=True, default='')
    notes = models.TextField(blank=True, default='')
    recorded_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-held_on']


# ---------------------------------------------------------------------------
# Sign-offs
# ---------------------------------------------------------------------------

class SignOffKind(models.TextChoices):
    UAT = 'UAT', 'UAT sign-off'
    GO_NO_GO = 'GO_NO_GO', 'Go / no-go decision'
    HANDOVER = 'HANDOVER', 'Handover acceptance'


class SignOffDecision(models.TextChoices):
    APPROVE = 'APPROVE', 'Approve / Go'
    REJECT = 'REJECT', 'Reject / No-go'


class SignOff(models.Model):
    id = models.CharField(max_length=64, primary_key=True, default=generate_signoff_id)
    kind = models.CharField(max_length=16, choices=SignOffKind.choices)
    decision = models.CharField(max_length=16, choices=SignOffDecision.choices)
    pilot = models.ForeignKey(Pilot, null=True, blank=True, on_delete=models.SET_NULL, related_name='signoffs')
    signatory_name = models.CharField(max_length=255)
    designation = models.CharField(max_length=255)
    comment = models.TextField(blank=True, default='')
    readiness_snapshot = models.JSONField(default=dict)
    signed_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def save(self, *args, **kwargs):
        if self.pk and SignOff.objects.filter(pk=self.pk).exists():
            raise ValidationError('Sign-offs are immutable; record a new one instead.')
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise ValidationError('Sign-offs are append-only and cannot be deleted.')

    def __str__(self):
        return f"{self.kind} {self.decision} by {self.signatory_name}"
