from django.urls import path
from .views import (
    ActiveFormSchemaView,
    ResolvedFormSchemaView,
    PortalFormsView,
    PortalFormSaveView,
    PortalFormSubmitView,
    PortalRecordsImportView,
    PortalRecordConfirmView,
    AdminSubmissionsListView,
    AdminSubmissionDetailView,
    AdminSubmissionActionView,
    NirfRollupView,
    NirfExportView,
)

urlpatterns = [
    # Schema Registry
    path('form-schemas/<str:framework>/', ActiveFormSchemaView.as_view(), name='active_form_schema'),
    path('form-schemas/<str:framework>', ActiveFormSchemaView.as_view()),
    path('form-schemas/<str:framework>/resolved/', ResolvedFormSchemaView.as_view(), name='resolved_form_schema'),
    path('form-schemas/<str:framework>/resolved', ResolvedFormSchemaView.as_view()),

    # Portal Form Endpoints (Token-Auth)
    path('portal/<str:token>/forms/', PortalFormsView.as_view(), name='portal_forms'),
    path('portal/<str:token>/forms', PortalFormsView.as_view()),
    path('portal/<str:token>/forms/<str:section_id>/', PortalFormSaveView.as_view(), name='portal_form_save'),
    path('portal/<str:token>/forms/<str:section_id>', PortalFormSaveView.as_view()),
    path('portal/<str:token>/forms/<str:section_id>/submit/', PortalFormSubmitView.as_view(), name='portal_form_submit'),
    path('portal/<str:token>/forms/<str:section_id>/submit', PortalFormSubmitView.as_view()),
    path('portal/<str:token>/forms/<str:section_id>/records/import/', PortalRecordsImportView.as_view(), name='portal_records_import'),
    path('portal/<str:token>/forms/<str:section_id>/records/import', PortalRecordsImportView.as_view()),
    path('portal/<str:token>/forms/<str:section_id>/records/confirm/', PortalRecordConfirmView.as_view(), name='portal_records_confirm'),
    path('portal/<str:token>/forms/<str:section_id>/records/confirm', PortalRecordConfirmView.as_view()),

    # Admin Submissions Review
    path('submissions/', AdminSubmissionsListView.as_view(), name='admin_submissions_list'),
    path('submissions', AdminSubmissionsListView.as_view()),
    path('submissions/<str:pk>/', AdminSubmissionDetailView.as_view(), name='admin_submission_detail'),
    path('submissions/<str:pk>', AdminSubmissionDetailView.as_view()),
    path('submissions/<str:pk>/actions/', AdminSubmissionActionView.as_view(), name='admin_submission_action'),
    path('submissions/<str:pk>/actions', AdminSubmissionActionView.as_view()),

    # Category Rollup & Export
    path('nirf/cycles/<str:year>/rollup/', NirfRollupView.as_view(), name='nirf_rollup'),
    path('nirf/cycles/<str:year>/rollup', NirfRollupView.as_view()),
    path('nirf/cycles/<str:year>/export/', NirfExportView.as_view(), name='nirf_export'),
    path('nirf/cycles/<str:year>/export', NirfExportView.as_view()),
]

