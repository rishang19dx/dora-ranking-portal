import re

from django.db import models

# Published NIRF tables stay file-cached (store.py). Other ranking systems
# publish no machine-readable feed, so their results are entered by DORA here.


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
