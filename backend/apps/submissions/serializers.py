from rest_framework import serializers
from .models import (
    FormSchema,
    SectionSubmission,
    SubmissionRecord,
    RecordVerification,
    SubmissionAuditLog,
)

class FormSchemaSerializer(serializers.ModelSerializer):
    isActive = serializers.BooleanField(source='is_active')
    createdAt = serializers.DateTimeField(source='created_at', read_only=True)

    class Meta:
        model = FormSchema
        fields = ['id', 'framework', 'version', 'content', 'checksum', 'isActive', 'createdAt']

class SubmissionRecordSerializer(serializers.ModelSerializer):
    submissionId = serializers.CharField(source='submission_id', read_only=True)
    blockId = serializers.CharField(source='block_id')
    rowKey = serializers.CharField(source='row_key')
    unitId = serializers.CharField(source='unit_id', required=False, allow_null=True)
    unitName = serializers.CharField(source='unit.name', read_only=True)
    createdAt = serializers.DateTimeField(source='created_at', read_only=True)
    updatedAt = serializers.DateTimeField(source='updated_at', read_only=True)

    class Meta:
        model = SubmissionRecord
        fields = ['id', 'submissionId', 'blockId', 'rowKey', 'unitId', 'unitName', 'data', 'position', 'createdAt', 'updatedAt']

class RecordVerificationSerializer(serializers.ModelSerializer):
    submissionId = serializers.CharField(source='submission_id', read_only=True)
    unitId = serializers.CharField(source='unit_id')
    unitName = serializers.CharField(source='unit.name', read_only=True)
    unitShortName = serializers.CharField(source='unit.short_name', read_only=True)
    byName = serializers.CharField(source='by.name', read_only=True)

    class Meta:
        model = RecordVerification
        fields = ['id', 'submissionId', 'unitId', 'unitName', 'unitShortName', 'status', 'comment', 'byName', 'at']

class SubmissionAuditLogSerializer(serializers.ModelSerializer):
    submissionId = serializers.CharField(source='submission_id', read_only=True)
    actorType = serializers.CharField(source='actor_type')
    actorId = serializers.CharField(source='actor_id')

    class Meta:
        model = SubmissionAuditLog
        fields = ['id', 'submissionId', 'actorType', 'actorId', 'action', 'delta', 'timestamp']

class SectionSubmissionSerializer(serializers.ModelSerializer):
    requestId = serializers.CharField(source='request_id')
    orgUnitId = serializers.CharField(source='org_unit_id')
    orgUnitName = serializers.CharField(source='org_unit.name', read_only=True)
    orgUnitShortName = serializers.CharField(source='org_unit.short_name', read_only=True)
    sectionId = serializers.CharField(source='section_id')
    schemaVersion = serializers.CharField(source='schema_version')
    notApplicable = serializers.BooleanField(source='not_applicable')
    submittedById = serializers.CharField(source='submitted_by_id', read_only=True, allow_null=True)
    submittedByName = serializers.CharField(source='submitted_by.name', read_only=True, allow_null=True)
    submittedAt = serializers.DateTimeField(source='submitted_at', read_only=True, allow_null=True)
    reviewedBy = serializers.CharField(source='reviewed_by.username', read_only=True, allow_null=True)
    reviewedAt = serializers.DateTimeField(source='reviewed_at', read_only=True, allow_null=True)
    reviewComment = serializers.CharField(source='review_comment', allow_blank=True)
    warningNote = serializers.CharField(source='warning_note', allow_blank=True)
    verifications = RecordVerificationSerializer(many=True, read_only=True)
    recordsCount = serializers.SerializerMethodField()
    createdAt = serializers.DateTimeField(source='created_at', read_only=True)
    updatedAt = serializers.DateTimeField(source='updated_at', read_only=True)

    class Meta:
        model = SectionSubmission
        fields = [
            'id', 'requestId', 'orgUnitId', 'orgUnitName', 'orgUnitShortName',
            'sectionId', 'schemaVersion', 'status', 'notApplicable', 'payload',
            'revision', 'submittedById', 'submittedByName', 'submittedAt',
            'reviewedBy', 'reviewedAt', 'reviewComment', 'warningNote',
            'verifications', 'recordsCount', 'createdAt', 'updatedAt'
        ]

    def get_recordsCount(self, obj):
        return obj.records.count()
