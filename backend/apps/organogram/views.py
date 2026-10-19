import json
from pathlib import Path
from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.views import APIView
from django.shortcuts import get_object_or_404
from .models import OrgUnit, NodalOfficer
from .serializers import OrgUnitSerializer, NodalOfficerSerializer, NodalOfficerWriteSerializer

FIXTURES_DIR = Path(__file__).resolve().parent / 'fixtures'

def load_fixture(filename):
    filepath = FIXTURES_DIR / filename
    if filepath.exists():
        with open(filepath, 'r', encoding='utf-8') as f:
            return json.load(f)
    return None

class OrganogramOverviewView(APIView):
    def get(self, request):
        units = OrgUnit.objects.all()
        units_serializer = OrgUnitSerializer(units, many=True)
        tree = load_fixture('organogram_tree.json')
        catalogue = load_fixture('data_catalogue.json') or []
        groups = load_fixture('parameter_groups.json') or {}

        return Response({
            'tree': tree,
            'units': units_serializer.data,
            'catalogue': catalogue,
            'groups': groups,
        })

class NodalOfficerListCreateView(APIView):
    def get(self, request):
        officers = NodalOfficer.objects.prefetch_related('assigned_units').all()
        serializer = NodalOfficerSerializer(officers, many=True)
        return Response(serializer.data)

    def post(self, request):
        serializer = NodalOfficerWriteSerializer(data=request.data)
        if serializer.is_valid():
            officer = serializer.save()
            return Response(NodalOfficerSerializer(officer).data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class NodalOfficerDetailView(APIView):
    def get(self, request, pk):
        officer = get_object_or_404(NodalOfficer.objects.prefetch_related('assigned_units'), pk=pk)
        return Response(NodalOfficerSerializer(officer).data)

    def put(self, request, pk):
        officer = get_object_or_404(NodalOfficer, pk=pk)
        serializer = NodalOfficerWriteSerializer(officer, data=request.data)
        if serializer.is_valid():
            updated = serializer.save()
            return Response(NodalOfficerSerializer(updated).data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def patch(self, request, pk):
        officer = get_object_or_404(NodalOfficer, pk=pk)
        serializer = NodalOfficerWriteSerializer(officer, data=request.data, partial=True)
        if serializer.is_valid():
            updated = serializer.save()
            return Response(NodalOfficerSerializer(updated).data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, pk):
        officer = get_object_or_404(NodalOfficer, pk=pk)
        officer.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

class NodalOfficerAccessView(APIView):
    def get(self, request, pk):
        from apps.data_requests.models import PortalAccessGrant
        from apps.data_requests.serializers import PortalAccessGrantSerializer
        officer = get_object_or_404(NodalOfficer, pk=pk)
        grants = PortalAccessGrant.objects.filter(officer=officer, revoked_at__isnull=True)
        return Response(PortalAccessGrantSerializer(grants, many=True).data)
