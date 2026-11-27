from django.urls import path

from . import views

# Each route is registered with and without the trailing slash, matching the
# convention used by the other apps.
_routes = [
    ('health/', views.HealthView, 'health'),
    ('golive/readiness/', views.ReadinessView, 'golive_readiness'),
    ('golive/pilots/', views.PilotListView, 'golive_pilots'),
    ('golive/pilots/<str:pk>/', views.PilotDetailView, 'golive_pilot_detail'),
    ('golive/pilots/<str:pk>/flag-reviews/', views.PilotFlagReviewsView, 'golive_pilot_flag_reviews'),
    ('golive/flag-reviews/<str:pk>/', views.FlagReviewDetailView, 'golive_flag_review_detail'),
    ('golive/uat/scenarios/', views.UatScenarioListView, 'golive_uat_scenarios'),
    ('golive/uat/scenarios/<str:code>/executions/', views.UatExecutionCreateView, 'golive_uat_execution'),
    ('golive/dr-drills/', views.DrillListView, 'golive_dr_drills'),
    ('golive/backups/', views.BackupListView, 'golive_backups'),
    ('golive/training/', views.TrainingListView, 'golive_training'),
    ('golive/signoffs/', views.SignOffListView, 'golive_signoffs'),
]

urlpatterns = []
for route, view, name in _routes:
    urlpatterns.append(path(route, view.as_view(), name=name))
    urlpatterns.append(path(route.rstrip('/'), view.as_view()))
