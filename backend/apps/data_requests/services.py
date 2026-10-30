import hashlib
import os
import secrets
from datetime import timedelta
from django.utils import timezone
from django.conf import settings
from .models import (
    DataRequest,
    DataRequestTarget,
    PortalAccessGrant,
    RequestDelivery,
    ProofUpload,
    DeliveryStatus,
    DeliveryKind,
    DataRequestStatus,
    TargetStatus,
)
from apps.organogram.models import OrgUnit, NodalOfficer
from .mailer import send_mail, render_template, DEFAULT_REQUEST_TEMPLATE

def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode('utf-8')).hexdigest()

def generate_portal_token() -> str:
    return secrets.token_urlsafe(32)

def calculate_checksum(file_obj) -> str:
    sha = hashlib.sha256()
    for chunk in file_obj.chunks():
        sha.update(chunk)
    file_obj.seek(0)
    return sha.hexdigest()

def dispatch_data_request(
    title: str,
    framework: str,
    cycle_year: int,
    subject: str,
    message: str,
    deadline,
    sections: list,  # [{'unitId': str, 'dataItemIds': list[str]}]
    created_by: str = 'DORA Admin'
):
    all_data_item_ids = set()
    for s in sections:
        all_data_item_ids.update(s.get('dataItemIds', []))

    # Generate reference e.g. DORA/2026/NIRF/001
    seq = DataRequest.objects.filter(framework=framework, cycle_year=cycle_year).count() + 1
    ref = f"DORA/{cycle_year}/{framework}/{seq:03d}"

    data_request = DataRequest.objects.create(
        reference=ref,
        title=title,
        framework=framework,
        cycle_year=cycle_year,
        subject=subject,
        message=message,
        deadline=deadline,
        data_item_ids=list(all_data_item_ids),
        created_by=created_by,
        status=DataRequestStatus.DISPATCHED
    )

    ttl_days = getattr(settings, 'PORTAL_ACCESS_TTL_DAYS', 45)
    expires_at = timezone.now() + timedelta(days=ttl_days)
    app_base_url = getattr(settings, 'APP_BASE_URL', 'http://localhost:5173')

    deliveries = []
    issued_grants = []

    for s in sections:
        unit_id = s.get('unitId')
        data_item_ids = s.get('dataItemIds', [])
        unit = OrgUnit.objects.filter(id=unit_id).first()
        if not unit:
            continue

        target = DataRequestTarget.objects.create(
            request=data_request,
            org_unit=unit,
            data_item_ids=data_item_ids,
            status=TargetStatus.PENDING
        )

        # Resolve assigned nodal officers
        officers = list(unit.nodal_officers.filter(status__in=['INVITED', 'ACTIVE']))
        
        # Fallback to unit email if no officer is assigned
        if not officers and unit.email:
            fallback_officer, _ = NodalOfficer.objects.get_or_create(
                email=unit.email,
                defaults={
                    'name': unit.head or unit.name,
                    'designation': unit.head,
                    'status': 'INVITED',
                }
            )
            fallback_officer.assigned_units.add(unit)
            officers = [fallback_officer]

        for officer in officers:
            token = generate_portal_token()
            token_digest = hash_token(token)

            grant = PortalAccessGrant.objects.create(
                token_hash=token_digest,
                officer=officer,
                request=data_request,
                org_unit=unit,
                data_item_ids=data_item_ids,
                expires_at=expires_at
            )

            portal_url = f"{app_base_url}/portal/{token}"
            issued_grants.append({
                'grantId': grant.id,
                'officerId': officer.id,
                'email': officer.email,
                'portalUrl': portal_url,
            })

            # Template variables
            unit_label = unit.short_name or unit.name
            deadline_str = str(data_request.deadline)
            if hasattr(data_request.deadline, 'strftime'):
                deadline_str = data_request.deadline.strftime('%d %B %Y')

            vars_dict = {
                'officer': officer.name,
                'email': officer.email,
                'section': unit_label,
                'sectionFullName': unit.name,
                'framework': data_request.framework,
                'cycle': str(data_request.cycle_year),
                'title': data_request.title,
                'reference': data_request.reference,
                'deadline': deadline_str,
                'dataItems': "\n".join([f"  - {item_id}" for item_id in data_item_ids]),
                'portalLink': portal_url,
            }

            rendered_subject = render_template(subject, vars_dict)
            body_template = message or DEFAULT_REQUEST_TEMPLATE
            rendered_body = render_template(body_template, vars_dict)
            if portal_url not in rendered_body:
                rendered_body += f"\n\nRestricted upload portal link:\n{portal_url}"

            mail_res = send_mail(
                to=officer.email,
                subject=rendered_subject,
                body=rendered_body
            )

            delivery_status = (
                DeliveryStatus.SENT if mail_res.get('status') == 'SENT'
                else (DeliveryStatus.FAILED if mail_res.get('status') == 'FAILED' else DeliveryStatus.SIMULATED)
            )

            # Record delivery
            delivery = RequestDelivery.objects.create(
                request=data_request,
                officer=officer,
                org_unit=unit,
                email=officer.email,
                subject=rendered_subject,
                status=delivery_status,
                kind=DeliveryKind.DISPATCH,
                error=mail_res.get('error', '')
            )
            deliveries.append(delivery)

    return data_request, issued_grants
