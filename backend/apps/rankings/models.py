# In addition to the fast file-based cached endpoints matching custom_api_nirf,
# models can be added here if database storage is desired later.
import uuid
from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models


def ranking_id():
    return f"rank_{uuid.uuid4().hex[:14]}"


def ranking_audit_id():
    return f"rank_aud_{uuid.uuid4().hex[:14]}"


class RankingRecordStatus(models.TextChoices):
    DRAFT = 'DRAFT', 'Draft'
    PENDING_REVIEW = 'PENDING_REVIEW', 'Pending review'
    VERIFIED = 'VERIFIED', 'Verified'
    PUBLISHED = 'PUBLISHED', 'Published'
    REJECTED = 'REJECTED', 'Rejected'


class RankingRecord(models.Model):
    """A manually entered, evidence-backed institutional ranking result."""
    id = models.CharField(max_length=64, primary_key=True, default=ranking_id)
    agency = models.CharField(max_length=64)  # NIRF, QS, THE, INDIA_TODAY_MDRA, or another agency
    category = models.CharField(max_length=255)
    year = models.PositiveIntegerField()
    rank = models.CharField(max_length=64)
    source_url = models.URLField(blank=True)
    evidence = models.FileField(upload_to='ranking-proofs/%Y/%m/', blank=True, null=True)
    remarks = models.TextField(blank=True)
    status = models.CharField(max_length=32, choices=RankingRecordStatus.choices, default=RankingRecordStatus.DRAFT)
    submitted_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name='ranking_submissions')
    reviewed_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name='reviewed_ranking_records')
    published_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name='published_ranking_records')
    submitted_at = models.DateTimeField(null=True, blank=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)
    published_at = models.DateTimeField(null=True, blank=True)
    review_comment = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-year', 'agency', 'category']


class RankingAuditLog(models.Model):
    id = models.CharField(max_length=64, primary_key=True, default=ranking_audit_id)
    ranking = models.ForeignKey(RankingRecord, on_delete=models.CASCADE, related_name='audit_logs')
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL)
    action = models.CharField(max_length=64)
    delta = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def save(self, *args, **kwargs):
        if self.pk and RankingAuditLog.objects.filter(pk=self.pk).exists():
            raise ValidationError('Ranking audit entries are immutable.')
        return super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise ValidationError('Ranking audit entries cannot be deleted.')
