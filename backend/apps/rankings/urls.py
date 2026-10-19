from django.urls import path
from .views import (
    RootRankingWelcomeView,
    GetRankingsView,
    GetSecondGenIITsView,
    GetRankingByRankView,
    TriggerScraperUpdateView,
)

urlpatterns = [
    path('', RootRankingWelcomeView.as_view(), name='ranking_root'),
    path('api/v1/rankings/<str:year>/<str:category>/', GetRankingsView.as_view(), name='get_rankings'),
    path('api/v1/rankings/<str:year>/<str:category>/2nd-gen-iits/', GetSecondGenIITsView.as_view(), name='get_second_gen_iits'),
    path('api/v1/rankings/<str:year>/<str:category>/<str:rank>/', GetRankingByRankView.as_view(), name='get_ranking_by_rank'),
    path('api/v1/scraper/update/', TriggerScraperUpdateView.as_view(), name='trigger_scraper_update'),
]
