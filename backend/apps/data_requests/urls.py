from django.urls import path
from .views import (
    DataRequestListCreateView,
    DataRequestDetailView,
    DataRequestActionsView,
    PortalGrantContextView,
    PortalUploadView,
)

urlpatterns = [
    path('data-requests/', DataRequestListCreateView.as_view(), name='data_requests_list_create'),
    path('data-requests/<str:pk>/', DataRequestDetailView.as_view(), name='data_request_detail'),
    path('data-requests/<str:pk>/actions/', DataRequestActionsView.as_view(), name='data_request_actions'),
    path('portal/<str:token>/', PortalGrantContextView.as_view(), name='portal_grant_context'),
    path('portal/<str:token>/upload/', PortalUploadView.as_view(), name='portal_upload'),
]
