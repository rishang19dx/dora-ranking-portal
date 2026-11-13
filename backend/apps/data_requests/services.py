import hashlib
import os
import secrets
from datetime import timedelta
from django.db import transaction
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

def eligible_officers_for_unit(unit):
    """
    The officers a link may be issued to for a unit.

    Officers whose access has been revoked are excluded, including on the
    unit-mailbox fallback path - otherwise closing someone's access could be
    undone by the next dispatch or reminder.
    """
    from apps.organogram.models import OfficerStatus

    officers = list(
        unit.nodal_officers.filter(
            status__in=[OfficerStatus.INVITED, OfficerStatus.ACTIVE]
        )
    )
    if officers:
        return officers

    mailbox = (unit.email or '').strip()
    if not mailbox:
        return []

    existing = NodalOfficer.objects.filter(email=mailbox).first()
    if existing is not None:
        if existing.status == OfficerStatus.REVOKED:
            return []
        existing.assigned_units.add(unit)
        return [existing]

    fallback = NodalOfficer.objects.create(
        email=mailbox,
        name=unit.head or unit.name,
        designation=unit.head,
        status=OfficerStatus.INVITED,
    )
    fallback.assigned_units.add(unit)
    return [fallback]

def revoke_grants(data_request, org_unit=None, officer=None):
    """Revokes the live grants matching the given scope. Returns the count."""
    qs = PortalAccessGrant.objects.filter(request=data_request, revoked_at__isnull=True)
    if org_unit is not None:
        qs = qs.filter(org_unit=org_unit)
    if officer is not None:
        qs = qs.filter(officer=officer)
    return qs.update(revoked_at=timezone.now())

def issue_grant(data_request, unit, officer, data_item_ids, rotate=True):
    """
    Mints one single-purpose upload link.

    Only the SHA-256 digest of the token is stored, so the raw token exists
    only in the return value and the message built from it. When `rotate` is
    set (the default) any link this officer already holds for this unit is
    revoked first, so a superseded URL cannot be replayed.
    """
    from django.conf import settings

    if rotate:
        revoke_grants(data_request, org_unit=unit, officer=officer)

    ttl_days = getattr(settings, 'PORTAL_ACCESS_TTL_DAYS', 45)
    token = generate_portal_token()
    grant = PortalAccessGrant.objects.create(
        token_hash=hash_token(token),
        officer=officer,
        request=data_request,
        org_unit=unit,
        data_item_ids=list(data_item_ids or []),
        expires_at=timezone.now() + timedelta(days=ttl_days),
    )
    app_base_url = getattr(settings, 'APP_BASE_URL', 'http://localhost:5173')
    return grant, token, f"{app_base_url}/portal/{token}"

@transaction.atomic
def dispatch_data_request(
    title: str,
    framework: str,
    cycle_year: int,
    subject: str,
    message: str,
    deadline,
    sections: list,  # [{'unitId': str, 'dataItemIds': list[str]}]
    created_by: str = 'DORA Admin',
    categories: list = None,
):
    # The composer can list the same unit more than once (a section selected
    # under two NIRF categories). A target is unique per request+unit, so the
    # requested items are merged per unit before anything is written.
    merged_sections = {}
    for s in sections or []:
        unit_id = s.get('unitId')
        if not unit_id:
            continue
        bucket = merged_sections.setdefault(unit_id, [])
        for item in s.get('dataItemIds', []) or []:
            if item not in bucket:
                bucket.append(item)
    sections = [
        {'unitId': unit_id, 'dataItemIds': items}
        for unit_id, items in merged_sections.items()
    ]

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
        categories=categories or [],
        subject=subject,
        message=message,
        deadline=deadline,
        data_item_ids=list(all_data_item_ids),
        created_by=created_by,
        status=DataRequestStatus.DISPATCHED
    )

    deliveries = []
    issued_grants = []

    for s in sections:
        unit_id = s.get('unitId')
        data_item_ids = s.get('dataItemIds', [])
        unit = OrgUnit.objects.filter(id=unit_id).first()
        if not unit:
            continue

        DataRequestTarget.objects.create(
            request=data_request,
            org_unit=unit,
            data_item_ids=data_item_ids,
            status=TargetStatus.PENDING
        )

        # Resolve the officers a link may be issued to, falling back to the
        # unit mailbox when nobody is assigned yet.
        officers = eligible_officers_for_unit(unit)

        for officer in officers:
            grant, token, portal_url = issue_grant(
                data_request, unit, officer, data_item_ids
            )
            issued_grants.append({
                'grantId': grant.id,
                'officerId': officer.id,
                'unitId': unit.id,
                'orgUnitId': unit.id,
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
