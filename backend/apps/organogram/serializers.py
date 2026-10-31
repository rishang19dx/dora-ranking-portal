from rest_framework import serializers
from .models import OrgUnit, NodalOfficer, Programme

class OrgUnitSerializer(serializers.ModelSerializer):
    shortName = serializers.CharField(source='short_name', required=False, allow_null=True)
    dataScopes = serializers.JSONField(source='data_scopes', required=False)
    parentId = serializers.CharField(source='parent_id', required=False, allow_null=True)

    class Meta:
        model = OrgUnit
        fields = [
            'id', 'name', 'shortName', 'kind', 'type', 'head', 'email',
            'description', 'dataScopes', 'parentId'
        ]

class ProgrammeSerializer(serializers.ModelSerializer):
    unitId = serializers.CharField(source='unit_id')
    unitName = serializers.CharField(source='unit.name', read_only=True)
    unitShortName = serializers.CharField(source='unit.short_name', read_only=True)
    nirfLevel = serializers.CharField(source='nirf_level')
    startAcademicYear = serializers.CharField(source='start_academic_year', required=False, allow_null=True)
    endAcademicYear = serializers.CharField(source='end_academic_year', required=False, allow_null=True)
    createdAt = serializers.DateTimeField(source='created_at', read_only=True)
    updatedAt = serializers.DateTimeField(source='updated_at', read_only=True)

    class Meta:
        model = Programme
        fields = [
            'id', 'unitId', 'unitName', 'unitShortName', 'name', 'nirfLevel',
            'active', 'startAcademicYear', 'endAcademicYear', 'createdAt', 'updatedAt'
        ]

class ProgrammeWriteSerializer(serializers.ModelSerializer):
    unitId = serializers.CharField(source='unit_id')
    nirfLevel = serializers.CharField(source='nirf_level')
    startAcademicYear = serializers.CharField(source='start_academic_year', required=False, allow_null=True, allow_blank=True)
    endAcademicYear = serializers.CharField(source='end_academic_year', required=False, allow_null=True, allow_blank=True)

    class Meta:
        model = Programme
        fields = [
            'id', 'unitId', 'name', 'nirfLevel', 'active',
            'startAcademicYear', 'endAcademicYear'
        ]
        extra_kwargs = {
            'id': {'required': False}
        }

class NodalOfficerSerializer(serializers.ModelSerializer):
    unitIds = serializers.SerializerMethodField()
    lastInvitedAt = serializers.DateTimeField(source='last_invited_at', required=False, allow_null=True)
    createdAt = serializers.DateTimeField(source='created_at', read_only=True)
    updatedAt = serializers.DateTimeField(source='updated_at', read_only=True)

    class Meta:
        model = NodalOfficer
        fields = [
            'id', 'name', 'designation', 'email', 'phone', 'notes',
            'status', 'unitIds', 'lastInvitedAt', 'createdAt', 'updatedAt'
        ]

    def get_unitIds(self, obj):
        return list(obj.assigned_units.values_list('id', flat=True))

class NodalOfficerWriteSerializer(serializers.ModelSerializer):
    unitIds = serializers.ListField(child=serializers.CharField(), required=False, write_only=True)

    class Meta:
        model = NodalOfficer
        fields = [
            'id', 'name', 'designation', 'email', 'phone', 'notes',
            'status', 'unitIds'
        ]
        extra_kwargs = {
            'id': {'required': False}
        }

    def create(self, validated_data):
        unit_ids = validated_data.pop('unitIds', [])
        officer = NodalOfficer.objects.create(**validated_data)
        if unit_ids:
            units = OrgUnit.objects.filter(id__in=unit_ids)
            officer.assigned_units.set(units)
        return officer

    def update(self, instance, validated_data):
        unit_ids = validated_data.pop('unitIds', None)
        for attr, val in validated_data.items():
            setattr(instance, attr, val)
        instance.save()
        if unit_ids is not None:
            units = OrgUnit.objects.filter(id__in=unit_ids)
            instance.assigned_units.set(units)
        return instance
