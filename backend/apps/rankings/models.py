"""
Ranking results stored in the database.

Published NIRF tables stay file-cached (store.py). Two kinds of non-NIRF
results are kept here:

* ExternalRankingResult - DORA-entered QS/THE/MDRA positions plotted on the
  public portal (Phase 3).
* RankingRecord / RankingAuditLog - the evidence-backed, maker-checker
  manual ranking workflow with its own immutable audit trail.
"""
import re
import uuid

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models



class RankingSystem(models.TextChoices):
    QS_WORLD = 'QS_WORLD', 'QS World University Rankings'
    QS_ASIA = 'QS_ASIA', 'QS Asia University Rankings'
    THE_WORLD = 'THE_WORLD', 'THE World University Rankings'
    THE_ASIA = 'THE_ASIA', 'THE Asia University Rankings'
    THE_IMPACT = 'THE_IMPACT', 'THE Impact Rankings'
    THE_EMERGING = 'THE_EMERGING', 'THE Young University Rankings'
    MDRA = 'MDRA', 'India Today-MDRA'
    OTHER = 'OTHER', 'Other'


_BAND = re.compile(r'^\s*=?\s*(\d+)\s*(?:[-–—]|to)\s*(\d+)\s*$', re.IGNORECASE)
_PLUS = re.compile(r'^\s*(\d+)\s*\+\s*$')
_SINGLE = re.compile(r'^\s*(?:joint\s*|=)?\s*(\d+)\s*$', re.IGNORECASE)


def parse_rank(text):
    """
    "26" -> (26, 26); "=451" -> (451, 451); "801-1000" -> (801, 1000);
    "1001+" -> (1001, None). Raises ValueError for anything else.
    """
    text = (text or '').strip()
    for pattern in (_BAND, _PLUS, _SINGLE):
        m = pattern.match(text)
        if not m:
            continue
        low = int(m.group(1))
        high = int(m.group(2)) if pattern is _BAND else (None if pattern is _PLUS else low)
        if high is not None and high < low:
            raise ValueError('A rank band must run from the better rank to the worse one.')
        return low, high
    raise ValueError("Enter a rank like '26', '=451', '801-1000' or '1001+'.")


class ExternalRankingResult(models.Model):
    """IIT Mandi's published position in a non-NIRF ranking, for one edition."""

    system = models.CharField(max_length=32, choices=RankingSystem.choices)
    system_label = models.CharField(max_length=128, blank=True, default='',
                                    help_text='Name shown for an OTHER system.')
    year = models.IntegerField(help_text='The edition year as the ranking publishes it.')
    rank_text = models.CharField(max_length=32, help_text="As published: '26', '=451', '801-1000', '1001+'.")
    rank_low = models.IntegerField()
    rank_high = models.IntegerField(null=True, blank=True)
    score = models.FloatField(null=True, blank=True)
    source_url = models.URLField(blank=True, default='')
    notes = models.TextField(blank=True, default='')
    published = models.BooleanField(default=True, help_text='Shown on the public portal.')
    is_demo = models.BooleanField(default=False, help_text='Illustrative data from seed_demo_rankings.')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['system', 'year']
        constraints = [
            models.UniqueConstraint(fields=['system', 'system_label', 'year'], name='uniq_external_rank_edition'),
        ]

    @property
    def label(self):
        return self.system_label if self.system == RankingSystem.OTHER and self.system_label else self.get_system_display()

    @property
    def plot_rank(self):
        """One number for the trend line: the band midpoint, or the floor of an open band."""
        if self.rank_high is None:
            return float(self.rank_low)
        return (self.rank_low + self.rank_high) / 2

    def save(self, *args, **kwargs):
        self.rank_low, self.rank_high = parse_rank(self.rank_text)
        super().save(*args, **kwargs)



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
