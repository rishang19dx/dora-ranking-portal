from django.urls import path
from .views import (
    RootRankingWelcomeView,
    GetRankingsView,
    GetSecondGenIITsView,
    GetRankingByRankView,
    TrendsAnalyticsView,
    ParameterTrendsView,
    GapAnalysisView,
    TriggerScraperUpdateView,
)

urlpatterns = [
    path('', RootRankingWelcomeView.as_view(), name='ranking_root'),
    path('api/v1/rankings/trends/', TrendsAnalyticsView.as_view(), name='rankings_trends'),
    path('api/v1/rankings/parameters/trends/', ParameterTrendsView.as_view(), name='rankings_parameter_trends'),
    path('api/v1/rankings/parameters/trends', ParameterTrendsView.as_view()),
    path('api/v1/rankings/gap-analysis/', GapAnalysisView.as_view(), name='rankings_gap_analysis'),
    path('api/v1/rankings/gap-analysis', GapAnalysisView.as_view()),
    path('api/v1/rankings/<str:year>/<str:category>/', GetRankingsView.as_view(), name='get_rankings'),
    path('api/v1/rankings/<str:year>/<str:category>/2nd-gen-iits/', GetSecondGenIITsView.as_view(), name='get_second_gen_iits'),
    path('api/v1/rankings/<str:year>/<str:category>/<str:rank>/', GetRankingByRankView.as_view(), name='get_ranking_by_rank'),
    path('api/v1/scraper/update/', TriggerScraperUpdateView.as_view(), name='trigger_scraper_update'),
]
