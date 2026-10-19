from django.contrib import admin
from .models import (
    DataRequest,
    DataRequestTarget,
    PortalAccessGrant,
    ProofUpload,
    RequestDelivery,
)

@admin.register(DataRequest)
class DataRequestAdmin(admin.ModelAdmin):
    list_display = ('reference', 'title', 'framework', 'cycle_year', 'status', 'created_at')
    list_filter = ('framework', 'status', 'cycle_year')
    search_fields = ('reference', 'title', 'subject')

@admin.register(DataRequestTarget)
class DataRequestTargetAdmin(admin.ModelAdmin):
    list_display = ('request', 'org_unit', 'status', 'reminders_sent', 'submitted_at')
    list_filter = ('status',)

@admin.register(PortalAccessGrant)
class PortalAccessGrantAdmin(admin.ModelAdmin):
    list_display = ('id', 'officer', 'request', 'org_unit', 'expires_at', 'use_count', 'revoked_at')
    list_filter = ('revoked_at',)

@admin.register(ProofUpload)
class ProofUploadAdmin(admin.ModelAdmin):
    list_display = ('file_name', 'data_item_id', 'org_unit', 'size', 'checksum', 'uploaded_at')
    search_fields = ('file_name', 'checksum', 'data_item_id')

@admin.register(RequestDelivery)
class RequestDeliveryAdmin(admin.ModelAdmin):
    list_display = ('request', 'officer', 'email', 'status', 'kind', 'sent_at')
    list_filter = ('status', 'kind')
