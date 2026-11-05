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
    RequestDelivery,
    DataRequestStatus,
    TargetStatus,
    DeliveryStatus,
    DeliveryKind,
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
        framework = data.get('framework', 'NIRF')
        try:
            cycle_year = int(data.get('cycleYear', timezone.now().year))
        except (ValueError, TypeError):
            cycle_year = timezone.now().year
        subject = data.get('subject')
        message = data.get('message')
        deadline = data.get('deadline')
        sections = data.get('sections', [])

        # If sections is not provided, build from unitIds and dataItemIds
        if not sections and 'unitIds' in data:
            from apps.organogram.models import OrgUnit
            unit_ids = data.get('unitIds', [])
            data_item_ids = data.get('dataItemIds', [])
            sections = []
            for uid in unit_ids:
                unit = OrgUnit.objects.filter(id=uid).first()
                if unit and unit.data_scopes:
                    owned = [item for item in data_item_ids if item in unit.data_scopes]
                    items = owned if owned else data_item_ids
                else:
                    items = data_item_ids
                sections.append({'unitId': uid, 'dataItemIds': items})

        if not title:
            return Response({'error': 'Request title is required.'}, status=status.HTTP_400_BAD_REQUEST)
        if not subject:
            return Response({'error': 'Email subject is required.'}, status=status.HTTP_400_BAD_REQUEST)
        if not message:
            return Response({'error': 'Email message is required.'}, status=status.HTTP_400_BAD_REQUEST)
        if not deadline:
            return Response({'error': 'Submission deadline is required.'}, status=status.HTTP_400_BAD_REQUEST)
        if not sections:
            return Response({'error': 'Please select at least one organogram section.'}, status=status.HTTP_400_BAD_REQUEST)

        # Normalize deadline date string to ISO format if without time
        if isinstance(deadline, str) and 'T' not in deadline:
            deadline = f"{deadline}T23:59:59Z"

        data_req, issued_grants = dispatch_data_request(
            title=title,
            framework=framework,
            cycle_year=cycle_year,
            subject=subject,
            message=message,
            deadline=deadline,
            sections=sections,
            created_by=request.user.username if request.user.is_authenticated else 'DORA Admin',
            categories=data.get('categories', []),
        )

        from .mailer import transport_name
        req_serialized = DataRequestSerializer(data_req).data
        res_data = dict(req_serialized)
        res_data['issuedGrants'] = issued_grants
        res_data['request'] = req_serialized
        res_data['transport'] = transport_name()
        res_data['sent'] = data_req.deliveries.filter(status=DeliveryStatus.SENT).count()
        res_data['simulated'] = data_req.deliveries.filter(status=DeliveryStatus.SIMULATED).count()
        res_data['failed'] = data_req.deliveries.filter(status=DeliveryStatus.FAILED).count()
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
        from django.conf import settings
        from datetime import timedelta
        from .services import generate_portal_token, hash_token
        from apps.organogram.models import NodalOfficer, OrgUnit

        data_req = get_object_or_404(DataRequest, pk=pk)
        action = str(request.data.get('action', '')).upper()

        if action == 'CLOSE':
            data_req.status = DataRequestStatus.CLOSED
            data_req.save()
            data_req.grants.filter(revoked_at__isnull=True).update(revoked_at=timezone.now())
            return Response({'status': 'closed', 'message': 'Request closed and grants revoked.'})

        elif action == 'REOPEN':
            data_req.status = DataRequestStatus.DISPATCHED
            data_req.save()
            return Response({'status': 'dispatched', 'message': 'Request reopened.'})

        elif action == 'REMIND':
            unit_ids = request.data.get('unitIds', [])
            targets = data_req.targets.all()
            if unit_ids:
                targets = targets.filter(org_unit_id__in=unit_ids)
            else:
                targets = targets.filter(status__in=[TargetStatus.PENDING, TargetStatus.PARTIAL])

            from .mailer import send_mail, render_template, DEFAULT_REMINDER_TEMPLATE
            app_base_url = getattr(settings, 'APP_BASE_URL', 'http://localhost:5173')
            reminded_count = 0

            for target in targets:
                target.reminders_sent += 1
                target.last_reminder_at = timezone.now()
                target.save()

                unit = target.org_unit
                unit_label = unit.short_name or unit.name
                officers = list(unit.nodal_officers.filter(status__in=['INVITED', 'ACTIVE']))
                if not officers and unit.email:
                    fallback_officer = NodalOfficer.objects.filter(email=unit.email).first()
                    if fallback_officer:
                        officers = [fallback_officer]

                for officer in officers:
                    token = generate_portal_token()
                    token_digest = hash_token(token)
                    ttl_days = getattr(settings, 'PORTAL_ACCESS_TTL_DAYS', 45)
                    expires_at = timezone.now() + timedelta(days=ttl_days)
                    grant = PortalAccessGrant.objects.create(
                        token_hash=token_digest,
                        officer=officer,
                        request=data_req,
                        org_unit=unit,
                        data_item_ids=target.data_item_ids,
                        expires_at=expires_at
                    )
                    portal_url = f"{app_base_url}/portal/{token}"
                    vars_dict = {
                        'officer': officer.name,
                        'email': officer.email,
                        'section': unit_label,
                        'sectionFullName': unit.name,
                        'framework': data_req.framework,
                        'cycle': str(data_req.cycle_year),
                        'title': data_req.title,
                        'reference': data_req.reference,
                        'deadline': str(data_req.deadline).split('T')[0],
                        'dataItems': "\n".join([f"  - {item_id}" for item_id in target.data_item_ids]),
                        'portalLink': portal_url,
                    }
                    subject = f"Reminder: {data_req.reference} - {data_req.title}"
                    body = render_template(DEFAULT_REMINDER_TEMPLATE, vars_dict)
                    mail_res = send_mail(to=officer.email, subject=subject, body=body)
                    delivery_status = (
                        DeliveryStatus.SENT if mail_res.get('status') == 'SENT'
                        else (DeliveryStatus.FAILED if mail_res.get('status') == 'FAILED' else DeliveryStatus.SIMULATED)
                    )
                    RequestDelivery.objects.create(
                        request=data_req,
                        officer=officer,
                        org_unit=unit,
                        email=officer.email,
                        subject=subject,
                        status=delivery_status,
                        kind=DeliveryKind.REMINDER,
                        error=mail_res.get('error', '')
                    )
                    reminded_count += 1

            return Response({'status': 'reminded', 'message': f'{reminded_count} reminder message(s) dispatched.'})

        elif action == 'REISSUE':
            unit_id = request.data.get('unitId')
            officer_id = request.data.get('officerId')
            unit = OrgUnit.objects.filter(id=unit_id).first()
            officer = NodalOfficer.objects.filter(id=officer_id).first()
            if not unit or not officer:
                return Response({'error': 'Unit and officer are required to reissue an upload link.'}, status=status.HTTP_400_BAD_REQUEST)

            PortalAccessGrant.objects.filter(
                request=data_req,
                org_unit=unit,
                officer=officer,
                revoked_at__isnull=True
            ).update(revoked_at=timezone.now())

            token = generate_portal_token()
            token_digest = hash_token(token)
            ttl_days = getattr(settings, 'PORTAL_ACCESS_TTL_DAYS', 45)
            expires_at = timezone.now() + timedelta(days=ttl_days)
            target = data_req.targets.filter(org_unit=unit).first()
            data_item_ids = target.data_item_ids if target else data_req.data_item_ids

            grant = PortalAccessGrant.objects.create(
                token_hash=token_digest,
                officer=officer,
                request=data_req,
                org_unit=unit,
                data_item_ids=data_item_ids,
                expires_at=expires_at
            )

            app_base_url = getattr(settings, 'APP_BASE_URL', 'http://localhost:5173')
            portal_url = f"{app_base_url}/portal/{token}"
            return Response({
                'status': 'reissued',
                'url': portal_url,
                'message': 'Fresh upload link provisioned.'
            })

        elif action == 'SET_TARGET_STATUS':
            unit_id = request.data.get('unitId')
            target_status = request.data.get('status', 'SUBMITTED').upper()
            target = data_req.targets.filter(org_unit_id=unit_id).first()
            if not target:
                return Response({'error': 'Target section not found.'}, status=status.HTTP_404_NOT_FOUND)
            target.status = target_status
            if target_status == 'SUBMITTED':
                target.submitted_at = timezone.now()
            target.save()
            return Response({'status': 'updated', 'message': f'Section status updated to {target_status}.'})

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
