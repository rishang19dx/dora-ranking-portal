from django.urls import path
from .views import (
    OrganogramOverviewView,
    OrgUnitContactView,
    OrgUnitCoverageView,
    NodalOfficerListCreateView,
    NodalOfficerDetailView,
    NodalOfficerAccessView,
    ProgrammeListCreateView,
    ProgrammeDetailView,
    ProgrammeImportView,
)

urlpatterns = [
    path('organogram/', OrganogramOverviewView.as_view(), name='organogram_overview'),
    path('organogram', OrganogramOverviewView.as_view()),
    path('organogram/coverage/', OrgUnitCoverageView.as_view(), name='organogram_coverage'),
    path('organogram/coverage', OrgUnitCoverageView.as_view()),
    path('organogram/units/<str:pk>/contact/', OrgUnitContactView.as_view(), name='org_unit_contact'),
    path('organogram/units/<str:pk>/contact', OrgUnitContactView.as_view()),
    path('nodal-officers/', NodalOfficerListCreateView.as_view(), name='nodal_officers_list_create'),
    path('nodal-officers', NodalOfficerListCreateView.as_view()),
    path('nodal-officers/<str:pk>/', NodalOfficerDetailView.as_view(), name='nodal_officer_detail'),
    path('nodal-officers/<str:pk>', NodalOfficerDetailView.as_view()),
    path('nodal-officers/<str:pk>/access/', NodalOfficerAccessView.as_view(), name='nodal_officer_access'),
    path('nodal-officers/<str:pk>/access', NodalOfficerAccessView.as_view()),
    path('programmes/', ProgrammeListCreateView.as_view(), name='programmes_list_create'),
    path('programmes', ProgrammeListCreateView.as_view()),
    path('programmes/import/', ProgrammeImportView.as_view(), name='programmes_import'),
    path('programmes/import', ProgrammeImportView.as_view()),
    path('programmes/<str:pk>/', ProgrammeDetailView.as_view(), name='programme_detail'),
    path('programmes/<str:pk>', ProgrammeDetailView.as_view()),
]
