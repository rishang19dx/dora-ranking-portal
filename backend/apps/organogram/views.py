import json
from pathlib import Path
from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.views import APIView
from django.shortcuts import get_object_or_404
from django.conf import settings
from .models import OrgUnit, NodalOfficer
from .serializers import OrgUnitSerializer, NodalOfficerSerializer, NodalOfficerWriteSerializer
from apps.data_requests.mailer import send_mail, render_template, INVITE_TEMPLATE

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

    def post(self, request, pk):
        from django.utils import timezone
        from apps.data_requests.models import PortalAccessGrant
        from apps.organogram.models import OfficerStatus
        officer = get_object_or_404(NodalOfficer, pk=pk)
        action = request.data.get('action', 'INVITE').upper()

        if action == 'REVOKE':
            revoked = PortalAccessGrant.objects.filter(officer=officer, revoked_at__isnull=True).update(revoked_at=timezone.now())
            officer.status = OfficerStatus.REVOKED
            officer.save()
            return Response({
                'officer': NodalOfficerSerializer(officer).data,
                'message': f'Portal access revoked. {revoked} active link{"s" if revoked != 1 else ""} invalidated.'
            })

        if action == 'RESTORE':
            officer.status = OfficerStatus.ACTIVE
            officer.save()
            return Response({
                'officer': NodalOfficerSerializer(officer).data,
                'message': 'Officer restored. Issue a fresh request to provision new upload links.'
            })

        if action == 'INVITE':
            officer.last_invited_at = timezone.now()
            if officer.status == OfficerStatus.REVOKED:
                officer.status = OfficerStatus.INVITED
            officer.save()

            app_base_url = getattr(settings, 'APP_BASE_URL', 'http://localhost:5173')
            sections_str = ", ".join([u.short_name or u.name for u in officer.assigned_units.all()]) or "assigned sections"
            vars_dict = {
                'officer': officer.name,
                'sections': sections_str,
                'portal': app_base_url,
                'from': getattr(settings, 'MAIL_FROM', 'DORA Office <dora@iitmandi.ac.in>'),
            }
            subject = f"Nodal Officer access - IIT Mandi Ranking Portal"
            body = render_template(INVITE_TEMPLATE, vars_dict)
            mail_res = send_mail(to=officer.email, subject=subject, body=body)

            return Response({
                'officer': NodalOfficerSerializer(officer).data,
                'delivery': mail_res,
                'message': f'Invitation {"written to local outbox" if mail_res.get("status") == "SIMULATED" else "sent"} for {officer.email}.'
            })

        return Response({'error': f'Unknown action: {action}'}, status=status.HTTP_400_BAD_REQUEST)
