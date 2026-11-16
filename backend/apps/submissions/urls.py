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
    DepartmentAnalyticsView,
    BoardroomBriefingView,
    AuditLogView,
    ProofRepositoryView,
    ProofDownloadView,
    RecordsTemplateView,
    SubmissionHistoryView,
    DiscrepancyListView,
    DiscrepancyScanView,
    DiscrepancyActionView,
    AIRequestLogView,
)

urlpatterns = [
    # Schema Registry
    path('form-schemas/<str:framework>/', ActiveFormSchemaView.as_view(), name='active_form_schema'),
    path('form-schemas/<str:framework>', ActiveFormSchemaView.as_view()),
    path('form-schemas/<str:framework>/resolved/', ResolvedFormSchemaView.as_view(), name='resolved_form_schema'),
    path('form-schemas/<str:framework>/resolved', ResolvedFormSchemaView.as_view()),
    path('form-schemas/<str:framework>/sections/<str:section_id>/template/', RecordsTemplateView.as_view(), name='records_template'),
    path('form-schemas/<str:framework>/sections/<str:section_id>/template', RecordsTemplateView.as_view()),

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

    # Proof repository and authenticated download (spec 2.4)
    path('proofs/', ProofRepositoryView.as_view(), name='proof_repository'),
    path('proofs', ProofRepositoryView.as_view()),
    path('proofs/<str:pk>/download/', ProofDownloadView.as_view(), name='proof_download'),
    path('proofs/<str:pk>/download', ProofDownloadView.as_view()),

    # Audit trail (auditor interface, spec 2.11)
    path('audit-log/', AuditLogView.as_view(), name='audit_log'),
    path('audit-log', AuditLogView.as_view()),

    # Historical approved values (spec 2.6)
    path('nirf/history/', SubmissionHistoryView.as_view(), name='nirf_history'),
    path('nirf/history', SubmissionHistoryView.as_view()),

    # Discrepancy flagging and AI audit log (spec 2.9, 9)
    path('nirf/discrepancies/', DiscrepancyListView.as_view(), name='discrepancies'),
    path('nirf/discrepancies', DiscrepancyListView.as_view()),
    path('nirf/discrepancies/scan/', DiscrepancyScanView.as_view(), name='discrepancies_scan'),
    path('nirf/discrepancies/scan', DiscrepancyScanView.as_view()),
    path('nirf/discrepancies/<str:pk>/', DiscrepancyActionView.as_view(), name='discrepancy_action'),
    path('nirf/discrepancies/<str:pk>', DiscrepancyActionView.as_view()),
    path('ai/requests/', AIRequestLogView.as_view(), name='ai_requests'),
    path('ai/requests', AIRequestLogView.as_view()),

    # Category Rollup & Export
    path('nirf/cycles/<str:year>/rollup/', NirfRollupView.as_view(), name='nirf_rollup'),
    path('nirf/cycles/<str:year>/rollup', NirfRollupView.as_view()),
    path('nirf/cycles/<str:year>/department-analytics/', DepartmentAnalyticsView.as_view(), name='nirf_department_analytics'),
    path('nirf/cycles/<str:year>/department-analytics', DepartmentAnalyticsView.as_view()),
    path('nirf/cycles/<str:year>/briefing/', BoardroomBriefingView.as_view(), name='nirf_briefing'),
    path('nirf/cycles/<str:year>/briefing', BoardroomBriefingView.as_view()),
    path('nirf/cycles/<str:year>/export/', NirfExportView.as_view(), name='nirf_export'),
    path('nirf/cycles/<str:year>/export', NirfExportView.as_view()),
]

