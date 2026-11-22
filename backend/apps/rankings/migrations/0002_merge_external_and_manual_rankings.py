"""
Joins the two independent rankings migration roots: Phase 3's
ExternalRankingResult (public QS/THE/MDRA results) and the audited manual
RankingRecord workflow. Both create unrelated tables, so no operations are
needed; this only gives the app a single leaf. Both original files keep their
names so databases that already applied either one stay consistent.
"""

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('rankings', '0001_external_ranking_results'),
        ('rankings', '0001_initial'),
    ]

    operations = []
