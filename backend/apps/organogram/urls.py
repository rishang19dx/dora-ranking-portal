from django.urls import path
from .views import (
    OrganogramOverviewView,
    NodalOfficerListCreateView,
    NodalOfficerDetailView,
    NodalOfficerAccessView,
)

urlpatterns = [
    path('organogram/', OrganogramOverviewView.as_view(), name='organogram_overview'),
    path('nodal-officers/', NodalOfficerListCreateView.as_view(), name='nodal_officers_list_create'),
    path('nodal-officers/<str:pk>/', NodalOfficerDetailView.as_view(), name='nodal_officer_detail'),
    path('nodal-officers/<str:pk>/access/', NodalOfficerAccessView.as_view(), name='nodal_officer_access'),
]
