import os
from django.utils import timezone
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser
from django.shortcuts import get_object_or_404

from .models import (
    DataRequest,
    DataRequestTarget,
    PortalAccessGrant,
    ProofUpload,
    DataRequestStatus,
    TargetStatus,
)
from .serializers import (
    DataRequestSerializer,
    ProofUploadSerializer,
    PortalAccessGrantSerializer,
)
from .services import (
    hash_token,
    dispatch_data_request,
    calculate_checksum,
)
from apps.organogram.serializers import OrgUnitSerializer, NodalOfficerSerializer

ALLOWED_EXTENSIONS = {'.pdf', '.xlsx', '.csv', '.docx'}
MAX_UPLOAD_SIZE = 25 * 1024 * 1024  # 25 MB

class DataRequestListCreateView(APIView):
    def get(self, request):
        requests = DataRequest.objects.prefetch_related('targets', 'uploads', 'deliveries').all()
        serializer = DataRequestSerializer(requests, many=True)
        return Response(serializer.data)

    def post(self, request):
        data = request.data
        title = data.get('title')
        framework = data.get('framework')
        cycle_year = int(data.get('cycleYear', timezone.now().year))
        subject = data.get('subject')
        message = data.get('message')
        deadline = data.get('deadline')
        sections = data.get('sections', [])

        if not all([title, framework, cycle_year, subject, message, deadline, sections]):
            return Response(
                {'error': 'Missing required fields in request payload.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        data_req, issued_grants = dispatch_data_request(
            title=title,
            framework=framework,
            cycle_year=cycle_year,
            subject=subject,
            message=message,
            deadline=deadline,
            sections=sections,
            created_by=request.user.username if request.user.is_authenticated else 'DORA Admin'
        )

        res_data = DataRequestSerializer(data_req).data
        res_data['issuedGrants'] = issued_grants
        return Response(res_data, status=status.HTTP_201_CREATED)

class DataRequestDetailView(APIView):
    def get(self, request, pk):
        data_req = get_object_or_404(
            DataRequest.objects.prefetch_related('targets__org_unit', 'uploads', 'deliveries'),
            pk=pk
        )
        return Response(DataRequestSerializer(data_req).data)

class DataRequestActionsView(APIView):
    def post(self, request, pk):
        data_req = get_object_or_404(DataRequest, pk=pk)
        action = request.data.get('action')

        if action == 'close':
            data_req.status = DataRequestStatus.CLOSED
            data_req.save()
            # Revoke all outstanding grants for this request
            data_req.grants.filter(revoked_at__isnull=True).update(revoked_at=timezone.now())
            return Response({'status': 'closed', 'message': 'Request closed and grants revoked.'})

        elif action == 'remind':
            # Send reminder, update target reminders_sent count
            for target in data_req.targets.filter(status__in=[TargetStatus.PENDING, TargetStatus.PARTIAL]):
                target.reminders_sent += 1
                target.last_reminder_at = timezone.now()
                target.save()
            return Response({'status': 'reminded', 'message': 'Reminders logged successfully.'})

        return Response({'error': f'Unsupported action: {action}'}, status=status.HTTP_400_BAD_REQUEST)

class PortalGrantContextView(APIView):
    def get(self, request, token):
        digest = hash_token(token)
        grant = PortalAccessGrant.objects.select_related('officer', 'request', 'org_unit').filter(token_hash=digest).first()

        if not grant:
            return Response({'error': 'Invalid access link.'}, status=status.HTTP_404_NOT_FOUND)

        if not grant.is_valid():
            return Response(
                {'error': 'This access link has expired or been revoked.'},
                status=status.HTTP_403_FORBIDDEN
            )

        uploads = ProofUpload.objects.filter(grant=grant)

        return Response({
            'grant': PortalAccessGrantSerializer(grant).data,
            'request': {
                'id': grant.request.id,
                'reference': grant.request.reference,
                'title': grant.request.title,
                'framework': grant.request.framework,
                'cycleYear': grant.request.cycle_year,
                'deadline': grant.request.deadline,
                'subject': grant.request.subject,
                'message': grant.request.message,
            },
            'orgUnit': OrgUnitSerializer(grant.org_unit).data,
            'officer': NodalOfficerSerializer(grant.officer).data,
            'allowedDataItems': grant.data_item_ids,
            'uploads': ProofUploadSerializer(uploads, many=True).data,
        })

class PortalUploadView(APIView):
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request, token):
        digest = hash_token(token)
        grant = PortalAccessGrant.objects.select_related('officer', 'request', 'org_unit').filter(token_hash=digest).first()

        if not grant or not grant.is_valid():
            return Response({'error': 'Invalid or expired upload grant.'}, status=status.HTTP_403_FORBIDDEN)

        file_obj = request.FILES.get('file')
        data_item_id = request.data.get('dataItemId')
        note = request.data.get('note', '')

        if not file_obj or not data_item_id:
            return Response({'error': 'File and dataItemId are required.'}, status=status.HTTP_400_BAD_REQUEST)

        # Validate data item scope
        if data_item_id not in grant.data_item_ids:
            return Response(
                {'error': f'Data item {data_item_id} is not within the authorized scope for this link.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Validate size
        if file_obj.size > MAX_UPLOAD_SIZE:
            return Response({'error': 'File exceeds maximum allowed size of 25 MB.'}, status=status.HTTP_400_BAD_REQUEST)

        # Validate extension
        ext = os.path.splitext(file_obj.name)[1].lower()
        if ext not in ALLOWED_EXTENSIONS:
            return Response(
                {'error': f'File format {ext} is not allowed. Allowed: {", ".join(sorted(ALLOWED_EXTENSIONS))}'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Calculate checksum
        checksum = calculate_checksum(file_obj)

        # Save upload
        upload = ProofUpload.objects.create(
            request=grant.request,
            grant=grant,
            officer=grant.officer,
            org_unit=grant.org_unit,
            data_item_id=data_item_id,
            file=file_obj,
            file_name=file_obj.name,
            stored_name=os.path.basename(file_obj.name),
            size=file_obj.size,
            content_type=file_obj.content_type or 'application/octet-stream',
            checksum=checksum,
            note=note,
        )

        # Update grant usage
        grant.last_used_at = timezone.now()
        grant.use_count += 1
        grant.save()

        # Update target status (PENDING -> PARTIAL or SUBMITTED)
        target = DataRequestTarget.objects.filter(request=grant.request, org_unit=grant.org_unit).first()
        if target:
            uploaded_item_ids = set(
                ProofUpload.objects.filter(request=grant.request, org_unit=grant.org_unit)
                .values_list('data_item_id', flat=True)
            )
            requested_item_ids = set(target.data_item_ids)
            if requested_item_ids.issubset(uploaded_item_ids):
                target.status = TargetStatus.SUBMITTED
                target.submitted_at = timezone.now()
            else:
                target.status = TargetStatus.PARTIAL
            target.save()

        return Response(ProofUploadSerializer(upload).data, status=status.HTTP_201_CREATED)
