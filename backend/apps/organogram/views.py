import json
import csv
import io
import openpyxl
from pathlib import Path
from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.views import APIView
from django.shortcuts import get_object_or_404
from django.conf import settings
from django.utils import timezone
from .models import OrgUnit, NodalOfficer, OfficerStatus, Programme
from .serializers import (
    OrgUnitSerializer,
    NodalOfficerSerializer,
    NodalOfficerWriteSerializer,
    ProgrammeSerializer,
    ProgrammeWriteSerializer,
)
from apps.accounts.permissions import IsAdminOrDirector, IsAdminOrDirectorOrAuditorReadOnly
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

class OrgUnitContactView(APIView):
    """
    Maintains a unit's contact details.

    The mailboxes shipped in the organogram fixture are placeholders standing
    in until the institute's real addresses are known, so they have to be
    changeable from the admin UI rather than only by re-seeding. Updating the
    mailbox also moves the unit's seeded nodal officer to the new address, so
    the next data request reaches the right inbox.
    """
    permission_classes = [IsAdminOrDirector]

    def patch(self, request, pk):
        unit = get_object_or_404(OrgUnit, pk=pk)

        if 'email' not in request.data and 'head' not in request.data:
            return Response(
                {'error': "Provide 'email' and/or 'head'."},
                status=status.HTTP_400_BAD_REQUEST
            )

        updated_fields = []

        if 'head' in request.data:
            unit.head = (request.data.get('head') or '').strip() or None
            updated_fields.append('head')

        moved_officer = None
        if 'email' in request.data:
            serializer = OrgUnitSerializer(unit, data={'email': request.data.get('email')}, partial=True)
            if not serializer.is_valid():
                return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

            new_email = (serializer.validated_data.get('email') or '').strip() or None
            previous_email = (unit.email or '').strip() or None
            unit.email = new_email
            updated_fields.append('email')

            if new_email and new_email != previous_email:
                # Keep the unit's seeded representative pointed at the mailbox,
                # unless some other officer already owns that address.
                clash = NodalOfficer.objects.filter(email=new_email).first()
                if clash is None:
                    officer = NodalOfficer.objects.filter(id=f'seed-{unit.id}').first()
                    if officer is None and previous_email:
                        officer = NodalOfficer.objects.filter(email=previous_email).first()
                    if officer is not None:
                        officer.email = new_email
                        officer.save(update_fields=['email'])
                        officer.assigned_units.add(unit)
                        moved_officer = officer.id
                else:
                    clash.assigned_units.add(unit)
                    moved_officer = clash.id

        if updated_fields:
            unit.save(update_fields=updated_fields)

        return Response({
            'unit': OrgUnitSerializer(unit).data,
            'officerUpdated': moved_officer,
        })

class OrgUnitCoverageView(APIView):
    """
    Lists the units that cannot currently be sent a data request.

    A unit is only reachable if it has a mailbox and at least one nodal officer
    assigned to it, so this is what the admin needs to clear before a cycle is
    dispatched.
    """
    permission_classes = [IsAdminOrDirectorOrAuditorReadOnly]

    def get(self, request):
        units = OrgUnit.objects.prefetch_related('nodal_officers').all()

        def describe(unit):
            officers = list(unit.nodal_officers.all())
            return {
                'id': unit.id,
                'name': unit.name,
                'shortName': unit.short_name,
                'kind': unit.kind,
                'type': unit.type,
                'email': unit.email or None,
                'hasMailbox': bool((unit.email or '').strip()),
                'officerCount': len(officers),
                'reachable': bool((unit.email or '').strip()) and bool(officers),
            }

        rows = [describe(u) for u in units]
        academic = [r for r in rows if r['kind'] in ('SCHOOL', 'CENTRE')]

        return Response({
            'units': rows,
            'summary': {
                'totalUnits': len(rows),
                'reachableUnits': sum(1 for r in rows if r['reachable']),
                'academicUnits': len(academic),
                'reachableAcademicUnits': sum(1 for r in academic if r['reachable']),
                'unreachableAcademicUnits': [r['id'] for r in academic if not r['reachable']],
                'unitsWithoutMailbox': [r['id'] for r in rows if not r['hasMailbox']],
            },
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
        # PortalAccessGrant is imported here to avoid a cross-app import cycle;
        # timezone and OfficerStatus are already imported at module level.
        from apps.data_requests.models import PortalAccessGrant
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
            subject = "Nodal Officer access - IIT Mandi Ranking Portal"
            body = render_template(INVITE_TEMPLATE, vars_dict)
            mail_res = send_mail(to=officer.email, subject=subject, body=body)

            return Response({
                'officer': NodalOfficerSerializer(officer).data,
                'delivery': mail_res,
                'message': f'Invitation {"written to local outbox" if mail_res.get("status") == "SIMULATED" else "sent"} for {officer.email}.'
            })

        return Response({'error': f'Unknown action: {action}'}, status=status.HTTP_400_BAD_REQUEST)

class ProgrammeListCreateView(APIView):
    permission_classes = [IsAdminOrDirectorOrAuditorReadOnly]

    def get(self, request):
        qs = Programme.objects.select_related('unit').all()
        unit_id = request.query_params.get('unitId')
        if unit_id:
            qs = qs.filter(unit_id=unit_id)
        nirf_level = request.query_params.get('nirfLevel')
        if nirf_level:
            qs = qs.filter(nirf_level=nirf_level)
        active = request.query_params.get('active')
        if active is not None:
            qs = qs.filter(active=active.lower() in ['true', '1', 'yes'])
        serializer = ProgrammeSerializer(qs, many=True)
        return Response(serializer.data)

    def post(self, request):
        serializer = ProgrammeWriteSerializer(data=request.data)
        if serializer.is_valid():
            prog = serializer.save()
            return Response(ProgrammeSerializer(prog).data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class ProgrammeDetailView(APIView):
    permission_classes = [IsAdminOrDirectorOrAuditorReadOnly]

    def get(self, request, pk):
        prog = get_object_or_404(Programme.objects.select_related('unit'), pk=pk)
        return Response(ProgrammeSerializer(prog).data)

    def put(self, request, pk):
        prog = get_object_or_404(Programme, pk=pk)
        serializer = ProgrammeWriteSerializer(prog, data=request.data, partial=True)
        if serializer.is_valid():
            updated = serializer.save()
            return Response(ProgrammeSerializer(updated).data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, pk):
        prog = get_object_or_404(Programme, pk=pk)
        prog.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

class ProgrammeImportView(APIView):
    permission_classes = [IsAdminOrDirector]

    def post(self, request):
        file_obj = request.FILES.get('file')
        if not file_obj:
            return Response({'error': 'No file provided.'}, status=status.HTTP_400_BAD_REQUEST)

        filename = file_obj.name.lower()
        rows = []
        if filename.endswith('.csv'):
            try:
                decoded = file_obj.read().decode('utf-8-sig')
                reader = csv.DictReader(io.StringIO(decoded))
                rows = list(reader)
            except Exception as e:
                return Response({'error': f'Failed to parse CSV: {str(e)}'}, status=status.HTTP_400_BAD_REQUEST)
        elif filename.endswith(('.xlsx', '.xlsm')):
            try:
                wb = openpyxl.load_workbook(file_obj, data_only=True)
                ws = wb.active
                iter_rows = ws.iter_rows(values_only=True)
                headers = [str(h).strip() if h is not None else '' for h in next(iter_rows, [])]
                for r in iter_rows:
                    if any(r):
                        row_dict = {headers[i]: r[i] for i in range(min(len(headers), len(r)))}
                        rows.append(row_dict)
            except Exception as e:
                return Response({'error': f'Failed to parse Excel: {str(e)}'}, status=status.HTTP_400_BAD_REQUEST)
        else:
            return Response({'error': 'Unsupported file format. Please upload .csv or .xlsx'}, status=status.HTTP_400_BAD_REQUEST)

        alias_map = {
            'unit': 'unitId', 'unitid': 'unitId', 'school': 'unitId', 'centre': 'unitId', 'department': 'unitId',
            'name': 'name', 'program': 'name', 'programme': 'name', 'programmename': 'name', 'programname': 'name',
            'level': 'nirfLevel', 'nirflevel': 'nirfLevel', 'degree': 'nirfLevel',
            'active': 'active', 'status': 'active', 'isactive': 'active',
            'startacademicyear': 'startAcademicYear', 'startyear': 'startAcademicYear', 'startay': 'startAcademicYear',
            'endacademicyear': 'endAcademicYear', 'endyear': 'endAcademicYear', 'enday': 'endAcademicYear',
        }

        created_count = 0
        updated_count = 0
        errors = []

        for idx, row in enumerate(rows, start=1):
            normalized = {}
            for k, v in row.items():
                clean_k = str(k).strip().lower().replace(' ', '').replace('_', '')
                if clean_k in alias_map:
                    normalized[alias_map[clean_k]] = str(v).strip() if v is not None else None

            unit_id = normalized.get('unitId')
            name = normalized.get('name')
            nirf_level = normalized.get('nirfLevel')

            if not unit_id or not name or not nirf_level:
                errors.append({'row': idx, 'error': 'Missing required fields (unitId, name, nirfLevel)'})
                continue

            unit = OrgUnit.objects.filter(id=unit_id).first()
            if not unit:
                errors.append({'row': idx, 'error': f"Unknown unitId '{unit_id}'"})
                continue

            active_val = normalized.get('active')
            if active_val is not None:
                active_bool = str(active_val).lower() in ['true', '1', 'yes', 'active']
            else:
                active_bool = True

            prog, created = Programme.objects.update_or_create(
                unit=unit,
                name=name,
                defaults={
                    'nirf_level': nirf_level,
                    'active': active_bool,
                    'start_academic_year': normalized.get('startAcademicYear'),
                    'end_academic_year': normalized.get('endAcademicYear'),
                }
            )
            if created:
                created_count += 1
            else:
                updated_count += 1

        return Response({
            'created': created_count,
            'updated': updated_count,
            'errors': errors,
            'totalProcessed': len(rows),
        })
