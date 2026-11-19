from django.apps import AppConfig


class GoLiveConfig(AppConfig):
    """Phase 4: controlled pilot, KPIs, UAT, DR drills, training and sign-off."""

    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.golive'
    label = 'golive'
    verbose_name = 'Go-Live Readiness'
