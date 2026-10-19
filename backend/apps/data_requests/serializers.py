from rest_framework import serializers
from .models import (
    DataRequest,
    DataRequestTarget,
    PortalAccessGrant,
    ProofUpload,
    RequestDelivery,
)
from apps.organogram.serializers import OrgUnitSerializer, NodalOfficerSerializer

class DataRequestTargetSerializer(serializers.ModelSerializer):
    orgUnit = OrgUnitSerializer(source='org_unit', read_only=True)
    orgUnitId = serializers.CharField(source='org_unit_id')
    dataItemIds = serializers.JSONField(source='data_item_ids')
    remindersSent = serializers.IntegerField(source='reminders_sent')
    lastReminderAt = serializers.DateTimeField(source='last_reminder_at', allow_null=True)
    submittedAt = serializers.DateTimeField(source='submitted_at', allow_null=True)

    class Meta:
        model = DataRequestTarget
        fields = [
            'id', 'orgUnit', 'orgUnitId', 'dataItemIds', 'status',
            'remindersSent', 'lastReminderAt', 'submittedAt'
        ]

class ProofUploadSerializer(serializers.ModelSerializer):
    requestId = serializers.CharField(source='request_id')
    grantId = serializers.CharField(source='grant_id')
    officerId = serializers.CharField(source='officer_id')
    orgUnitId = serializers.CharField(source='org_unit_id')
    dataItemId = serializers.CharField(source='data_item_id')
    fileName = serializers.CharField(source='file_name')
    storedName = serializers.CharField(source='stored_name')
    contentType = serializers.CharField(source='content_type')
    uploadedAt = serializers.DateTimeField(source='uploaded_at')

    class Meta:
        model = ProofUpload
        fields = [
            'id', 'requestId', 'grantId', 'officerId', 'orgUnitId',
            'dataItemId', 'fileName', 'storedName', 'size', 'contentType',
            'checksum', 'note', 'uploadedAt'
        ]

class RequestDeliverySerializer(serializers.ModelSerializer):
    requestId = serializers.CharField(source='request_id')
    officerId = serializers.CharField(source='officer_id')
    orgUnitId = serializers.CharField(source='org_unit_id')
    sentAt = serializers.DateTimeField(source='sent_at')

    class Meta:
        model = RequestDelivery
        fields = [
            'id', 'requestId', 'officerId', 'orgUnitId', 'email',
            'subject', 'status', 'kind', 'error', 'sentAt'
        ]

class PortalAccessGrantSerializer(serializers.ModelSerializer):
    officerId = serializers.CharField(source='officer_id')
    requestId = serializers.CharField(source='request_id')
    orgUnitId = serializers.CharField(source='org_unit_id')
    dataItemIds = serializers.JSONField(source='data_item_ids')
    expiresAt = serializers.DateTimeField(source='expires_at')
    revokedAt = serializers.DateTimeField(source='revoked_at', allow_null=True)
    lastUsedAt = serializers.DateTimeField(source='last_used_at', allow_null=True)
    useCount = serializers.IntegerField(source='use_count')
    createdAt = serializers.DateTimeField(source='created_at')

    class Meta:
        model = PortalAccessGrant
        fields = [
            'id', 'officerId', 'requestId', 'orgUnitId', 'dataItemIds',
            'expiresAt', 'revokedAt', 'lastUsedAt', 'useCount', 'createdAt'
        ]

class DataRequestSerializer(serializers.ModelSerializer):
    cycleYear = serializers.IntegerField(source='cycle_year')
    dataItemIds = serializers.JSONField(source='data_item_ids')
    createdBy = serializers.CharField(source='created_by')
    createdAt = serializers.DateTimeField(source='created_at')
    dispatchedAt = serializers.DateTimeField(source='dispatched_at')
    targets = DataRequestTargetSerializer(many=True, read_only=True)
    uploads = ProofUploadSerializer(many=True, read_only=True)
    deliveries = RequestDeliverySerializer(many=True, read_only=True)

    class Meta:
        model = DataRequest
        fields = [
            'id', 'reference', 'title', 'framework', 'cycleYear',
            'subject', 'message', 'deadline', 'dataItemIds', 'status',
            'createdBy', 'createdAt', 'dispatchedAt', 'targets', 'uploads', 'deliveries'
        ]
