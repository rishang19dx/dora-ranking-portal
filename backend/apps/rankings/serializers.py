from rest_framework import serializers
from .models import RankingRecord, RankingAuditLog


class RankingRecordSerializer(serializers.ModelSerializer):
    evidence_url = serializers.FileField(source='evidence', read_only=True)
    submitted_by_name = serializers.CharField(source='submitted_by.username', read_only=True)
    reviewed_by_name = serializers.CharField(source='reviewed_by.username', read_only=True)

    class Meta:
        model = RankingRecord
        fields = ['id', 'agency', 'category', 'year', 'rank', 'source_url', 'evidence', 'evidence_url',
                  'remarks', 'status', 'submitted_by', 'submitted_by_name', 'reviewed_by',
                  'reviewed_by_name', 'submitted_at', 'reviewed_at', 'published_at', 'review_comment',
                  'created_at', 'updated_at']
        read_only_fields = ['id', 'status', 'submitted_by', 'reviewed_by', 'submitted_at',
                            'reviewed_at', 'published_at', 'review_comment']


class RankingAuditLogSerializer(serializers.ModelSerializer):
    actor_name = serializers.CharField(source='actor.username', read_only=True)

    class Meta:
        model = RankingAuditLog
        fields = ['id', 'action', 'delta', 'created_at', 'actor_name']
