import json
import csv
import io
import openpyxl
from datetime import datetime
from django.utils import timezone
from django.shortcuts import get_object_or_404
from django.http import HttpResponse
from rest_framework import status, permissions
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser

from apps.organogram.models import OrgUnit, Programme
from apps.data_requests.models import DataRequest, DataRequestTarget, PortalAccessGrant, ProofUpload, TargetStatus
from apps.data_requests.services import hash_token
from apps.accounts.permissions import IsAdminOrDirector, IsAdminOrDirectorOrAuditorReadOnly

from .models import (
    FormSchema,
    SectionSubmission,
    SubmissionRecord,
    RecordVerification,
    SubmissionAuditLog,
    SubmissionStatus,
    VerificationStatus,
)
from .serializers import (
    FormSchemaSerializer,
    SectionSubmissionSerializer,
    SubmissionRecordSerializer,
    RecordVerificationSerializer,
    SubmissionAuditLogSerializer,
)
from .year_engine import (
    get_year_context,
    resolve_year_series,
    resolve_batch_years,
)
from .validation_engine import (
    validate_block_data,
    evaluate_derive,
)
from .cross_checks import run_cross_checks
from .rollup import compute_category_rollup
from .dcs_export import generate_category_excel

def mask_pii_in_dict(d: dict, pii_fields: set) -> dict:
    """Masks or strips fields that contain personal identifying information."""
    res = {}
    for k, v in d.items():
        if k in pii_fields:
            if v is not None and str(v).strip():
                # Mask string
                s = str(v)
                res[k] = s[0] + '***' if len(s) > 1 else '***'
            else:
                res[k] = v
        else:
            res[k] = v
    return res

# -----------------------------------------------------------------------------
# WP3: Schema Registry & Resolver
# -----------------------------------------------------------------------------

class ActiveFormSchemaView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, framework='nirf'):
        schema_obj = FormSchema.objects.filter(framework__iexact=framework, is_active=True).first()
        if not schema_obj:
            return Response({'error': f"No active schema found for framework '{framework}'"}, status=status.HTTP_404_NOT_FOUND)
        serializer = FormSchemaSerializer(schema_obj)
        return Response(serializer.data)

class ResolvedFormSchemaView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, framework='nirf'):
        schema_obj = FormSchema.objects.filter(framework__iexact=framework, is_active=True).first()
        if not schema_obj:
            return Response({'error': f"No active schema found for framework '{framework}'"}, status=status.HTTP_404_NOT_FOUND)

        try:
            cycle_year = int(request.query_params.get('cycleYear', 2027))
        except (ValueError, TypeError):
            cycle_year = 2027

        category_id = request.query_params.get('category')
        unit_id = request.query_params.get('unitId')

        content = schema_obj.content
        year_ctx = get_year_context(cycle_year)

        # Clone and resolve
        resolved_sections = []
        for sec in content.get('sections', []):
            if category_id and category_id.upper() not in sec.get('usedBy', []):
                continue

            sec_copy = dict(sec)
            sec_copy['blocks'] = []

            for blk in sec.get('blocks', []):
                blk_copy = dict(blk)
                # Resolve help tokens
                if blk_copy.get('help'):
                    for k, v in year_ctx.items():
                        blk_copy['help'] = blk_copy['help'].replace(f"{{{{{k}}}}}", str(v))

                # Resolve columnAxis years
                col_axis = blk_copy.get('columnAxis')
                if col_axis and col_axis.get('type') == 'years':
                    series_cfg = col_axis.get('series', {})
                    resolved_years = resolve_year_series(
                        series_cfg.get('kind', 'academic'),
                        series_cfg.get('count', 3),
                        cycle_year
                    )
                    col_axis['resolvedYears'] = resolved_years

                # Resolve rowAxis years
                row_axis = blk_copy.get('rowAxis')
                if row_axis and row_axis.get('type') == 'years':
                    series_cfg = row_axis.get('series', {})
                    row_axis['resolvedYears'] = resolve_year_series(
                        series_cfg.get('kind', 'academic'),
                        series_cfg.get('count', 3),
                        cycle_year
                    )

                # Resolve rows in fixed rowAxis
                if row_axis and row_axis.get('type') == 'fixed':
                    filtered_rows = []
                    for r in row_axis.get('rows', []):
                        if category_id and r.get('usedBy') and category_id.upper() not in r.get('usedBy', []):
                            continue
                        r_copy = dict(r)
                        if category_id and r_copy.get('labelByCategory') and category_id.upper() in r_copy['labelByCategory']:
                            r_copy['label'] = r_copy['labelByCategory'][category_id.upper()]
                        filtered_rows.append(r_copy)
                    row_axis['rows'] = filtered_rows

                sec_copy['blocks'].append(blk_copy)

            resolved_sections.append(sec_copy)

        # Active programmes if unit_id is provided
        programmes_data = []
        if unit_id:
            progs = Programme.objects.filter(unit_id=unit_id, active=True)
            for p in progs:
                programmes_data.append({
                    'id': p.id,
                    'name': p.name,
                    'nirfLevel': p.nirf_level,
                    'startAcademicYear': p.start_academic_year,
                    'endAcademicYear': p.end_academic_year,
                })

        return Response({
            'schemaVersion': schema_obj.version,
            'framework': schema_obj.framework,
            'cycleYear': cycle_year,
            'yearContext': year_ctx,
            'category': category_id,
            'unitId': unit_id,
            'programmes': programmes_data,
            'sections': resolved_sections,
            'categories': content.get('categories', []),
            'enums': content.get('enums', {}),
        })

# -----------------------------------------------------------------------------
# WP4: Portal Endpoints (Token-Authenticated)
# -----------------------------------------------------------------------------

def get_portal_grant(token: str) -> PortalAccessGrant:
    digest = hash_token(token)
    grant = get_object_or_404(
        PortalAccessGrant.objects.select_related('request', 'org_unit', 'officer'),
        token_hash=digest
    )
    if not grant.is_valid():
        raise PermissionError("Access grant has expired or was revoked.")
    return grant

def is_section_authorized_for_grant(grant: PortalAccessGrant, section_def: dict) -> bool:
    sec_cat_items = set(section_def.get('catalogueItemIds', []))
    grant_cat_items = set(grant.data_item_ids or [])
    if not (sec_cat_items & grant_cat_items):
        return False

    ownership = section_def.get('ownership', {})
    submit_by = ownership.get('submitBy', 'central')
    if submit_by == 'unit':
        eligible_kinds = ownership.get('eligibleUnitKinds', ['SCHOOL', 'CENTRE'])
        return grant.org_unit.kind in eligible_kinds
    else:
        primary_owner = ownership.get('primaryOwnerUnitId')
        return grant.org_unit.id == primary_owner

class PortalFormsView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, token):
        try:
            grant = get_portal_grant(token)
        except PermissionError as e:
            return Response({'error': str(e)}, status=status.HTTP_403_FORBIDDEN)

        schema_obj = FormSchema.objects.filter(framework='NIRF', is_active=True).first()
        if not schema_obj:
            return Response({'error': 'No active NIRF schema found.'}, status=status.HTTP_404_NOT_FOUND)

        schema = schema_obj.content
        cycle_year = grant.request.cycle_year
        year_ctx = get_year_context(cycle_year)

        authorized_sections = []
        for sec in schema.get('sections', []):
            if is_section_authorized_for_grant(grant, sec):
                authorized_sections.append(sec)

        # Get or create submissions for authorized sections
        submissions_data = []
        programmes = list(grant.org_unit.programmes.filter(active=True))

        for sec in authorized_sections:
            sub, created = SectionSubmission.objects.get_or_create(
                request=grant.request,
                org_unit=grant.org_unit,
                section_id=sec['id'],
                defaults={
                    'schema_version': schema_obj.version,
                    'status': SubmissionStatus.DRAFT,
                    'not_applicable': sec.get('defaultNotApplicable', False) or (
                        any(b.get('rowAxis', {}).get('type') in ('programme', 'programmeBatch') for b in sec.get('blocks', []))
                        and len(programmes) == 0
                    ),
                    'payload': {},
                    'revision': 1,
                }
            )

            # Records for this submission
            records_by_block = {}
            for blk in sec.get('blocks', []):
                if blk['kind'] == 'records':
                    recs = sub.records.filter(block_id=blk['id'])
                    records_by_block[blk['id']] = SubmissionRecordSerializer(recs, many=True).data

            # Attached proofs for this section's catalogue items
            proofs = ProofUpload.objects.filter(
                request=grant.request,
                org_unit=grant.org_unit,
                data_item_id__in=sec.get('catalogueItemIds', [])
            )

            submissions_data.append({
                'section': sec,
                'submission': SectionSubmissionSerializer(sub).data,
                'records': records_by_block,
                'proofUploadsCount': proofs.count(),
                'proofRequired': sec.get('proof', {}).get('required', False),
            })

        target = DataRequestTarget.objects.filter(request=grant.request, org_unit=grant.org_unit).first()

        return Response({
            'officer': {
                'id': grant.officer.id,
                'name': grant.officer.name,
                'email': grant.officer.email,
            },
            'orgUnit': {
                'id': grant.org_unit.id,
                'name': grant.org_unit.name,
                'shortName': grant.org_unit.short_name,
                'kind': grant.org_unit.kind,
            },
            'request': {
                'id': grant.request.id,
                'title': grant.request.title,
                'framework': grant.request.framework,
                'cycleYear': grant.request.cycle_year,
                'deadline': grant.request.deadline,
            },
            'targetStatus': target.status if target else 'PENDING',
            'yearContext': year_ctx,
            'sections': submissions_data,
        })

class PortalFormSaveView(APIView):
    permission_classes = [permissions.AllowAny]

    def put(self, request, token, section_id):
        try:
            grant = get_portal_grant(token)
        except PermissionError as e:
            return Response({'error': str(e)}, status=status.HTTP_403_FORBIDDEN)

        sub = get_object_or_404(
            SectionSubmission,
            request=grant.request,
            org_unit=grant.org_unit,
            section_id=section_id
        )

        if sub.status not in (SubmissionStatus.DRAFT, SubmissionStatus.CORRECTION_REQUESTED):
            return Response(
                {'error': f"Editing not permitted when submission is '{sub.status}'."},
                status=status.HTTP_400_BAD_REQUEST
            )

        client_rev = request.data.get('revision')
        if client_rev is not None and client_rev != sub.revision:
            return Response(
                {'error': f"Conflict: Form has been modified concurrently (server rev {sub.revision}, client rev {client_rev}). Please reload."},
                status=status.HTTP_409_CONFLICT
            )

        payload = request.data.get('payload', sub.payload)
        not_applicable = request.data.get('notApplicable', sub.not_applicable)

        sub.payload = payload
        sub.not_applicable = not_applicable
        sub.revision += 1
        sub.save()

        # Audit log (PII-free)
        SubmissionAuditLog.objects.create(
            submission=sub,
            actor_type='OFFICER',
            actor_id=grant.officer.id,
            action='UPDATE',
            delta={
                'revision': sub.revision,
                'notApplicable': sub.not_applicable,
                'blockKeys': list(payload.keys()) if isinstance(payload, dict) else [],
            }
        )

        # Update target status to PARTIAL if PENDING
        target = DataRequestTarget.objects.filter(request=grant.request, org_unit=grant.org_unit).first()
        if target and target.status == TargetStatus.PENDING:
            target.status = TargetStatus.PARTIAL
            target.save(update_fields=['status'])

        return Response(SectionSubmissionSerializer(sub).data)

class PortalFormSubmitView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request, token, section_id):
        try:
            grant = get_portal_grant(token)
        except PermissionError as e:
            return Response({'error': str(e)}, status=status.HTTP_403_FORBIDDEN)

        sub = get_object_or_404(
            SectionSubmission,
            request=grant.request,
            org_unit=grant.org_unit,
            section_id=section_id
        )

        if sub.status not in (SubmissionStatus.DRAFT, SubmissionStatus.CORRECTION_REQUESTED):
            return Response(
                {'error': f"Submission not allowed when status is '{sub.status}'."},
                status=status.HTTP_400_BAD_REQUEST
            )

        schema_obj = FormSchema.objects.filter(framework='NIRF', is_active=True).first()
        schema = schema_obj.content
        sec_def = next((s for s in schema.get('sections', []) if s['id'] == section_id), None)
        if not sec_def:
            return Response({'error': 'Section definition not found.'}, status=status.HTTP_404_NOT_FOUND)

        warning_note = request.data.get('warningNote', '').strip()

        # If not applicable, validate trivially
        all_errors = []
        all_warnings = []

        if not sub.not_applicable:
            for blk in sec_def.get('blocks', []):
                b_id = blk['id']
                if blk['kind'] == 'records':
                    b_data = [r.data for r in sub.records.filter(block_id=b_id)]
                else:
                    b_data = sub.payload.get(b_id, [] if blk['kind'] == 'grid' else {})

                errs, warns = validate_block_data(blk, b_data, {'submittingUnitId': grant.org_unit.id})
                all_errors.extend(errs)
                all_warnings.extend(warns)

        if all_errors:
            return Response({
                'error': 'Validation errors prevent submission.',
                'validationErrors': all_errors,
                'validationWarnings': all_warnings
            }, status=status.HTTP_400_BAD_REQUEST)

        if all_warnings and not warning_note:
            return Response({
                'error': 'Warnings require an explanatory note before submitting.',
                'validationWarnings': all_warnings,
                'warningNoteRequired': True
            }, status=status.HTTP_400_BAD_REQUEST)

        sub.status = SubmissionStatus.SUBMITTED
        sub.submitted_by = grant.officer
        sub.submitted_at = timezone.now()
        sub.warning_note = warning_note
        sub.revision += 1
        sub.save()

        # Audit log (PII-free)
        SubmissionAuditLog.objects.create(
            submission=sub,
            actor_type='OFFICER',
            actor_id=grant.officer.id,
            action='SUBMIT',
            delta={
                'status': 'SUBMITTED',
                'hasWarningNote': bool(warning_note),
                'notApplicable': sub.not_applicable,
            }
        )

        # Roll-up check on DataRequestTarget
        target = DataRequestTarget.objects.filter(request=grant.request, org_unit=grant.org_unit).first()
        if target:
            # Check all authorized sections for this unit
            all_auth_secs = [
                s for s in schema.get('sections', [])
                if is_section_authorized_for_grant(grant, s)
            ]
            unit_subs = SectionSubmission.objects.filter(request=grant.request, org_unit=grant.org_unit)
            unit_sub_map = {s.section_id: s for s in unit_subs}

            all_sections_ready = True
            for s_def in all_auth_secs:
                s_id = s_def['id']
                us = unit_sub_map.get(s_id)
                if not us or us.status not in (SubmissionStatus.SUBMITTED, SubmissionStatus.APPROVED):
                    if not (us and us.not_applicable):
                        all_sections_ready = False
                        break

                # Proof required check
                if s_def.get('proof', {}).get('required') and not (us and us.not_applicable):
                    has_proof = ProofUpload.objects.filter(
                        request=grant.request,
                        org_unit=grant.org_unit,
                        data_item_id__in=s_def.get('catalogueItemIds', [])
                    ).exists()
                    if not has_proof:
                        all_sections_ready = False
                        break

            if all_sections_ready:
                target.status = TargetStatus.SUBMITTED
                target.submitted_at = timezone.now()
            else:
                target.status = TargetStatus.PARTIAL
            target.save()

        return Response(SectionSubmissionSerializer(sub).data)

# -----------------------------------------------------------------------------
# WP5: Records Import & Verification
# -----------------------------------------------------------------------------

class PortalRecordsImportView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request, token, section_id):
        try:
            grant = get_portal_grant(token)
        except PermissionError as e:
            return Response({'error': str(e)}, status=status.HTTP_403_FORBIDDEN)

        sub = get_object_or_404(
            SectionSubmission,
            request=grant.request,
            org_unit=grant.org_unit,
            section_id=section_id
        )

        if sub.status not in (SubmissionStatus.DRAFT, SubmissionStatus.CORRECTION_REQUESTED):
            return Response(
                {'error': f"Records import not allowed when status is '{sub.status}'."},
                status=status.HTTP_400_BAD_REQUEST
            )

        file_obj = request.FILES.get('file')
        if not file_obj:
            return Response({'error': 'No file uploaded.'}, status=status.HTTP_400_BAD_REQUEST)

        block_id = request.data.get('blockId')
        schema_obj = FormSchema.objects.filter(framework='NIRF', is_active=True).first()
        sec_def = next((s for s in schema_obj.content.get('sections', []) if s['id'] == section_id), None)
        if not sec_def:
            return Response({'error': 'Section not found.'}, status=status.HTTP_404_NOT_FOUND)

        records_blocks = [b for b in sec_def.get('blocks', []) if b['kind'] == 'records']
        if not records_blocks:
            return Response({'error': 'Section has no records blocks.'}, status=status.HTTP_400_BAD_REQUEST)

        target_block = next((b for b in records_blocks if b['id'] == block_id), records_blocks[0])
        b_id = target_block['id']
        row_key_field = target_block.get('rowKey') or target_block.get('fields', [])[0]['id']

        # Parse file
        filename = file_obj.name.lower()
        rows = []
        if filename.endswith('.csv'):
            try:
                decoded = file_obj.read().decode('utf-8-sig')
                reader = csv.DictReader(io.StringIO(decoded))
                rows = list(reader)
            except Exception as e:
                return Response({'error': f"CSV parsing error: {str(e)}"}, status=status.HTTP_400_BAD_REQUEST)
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
                return Response({'error': f"Excel parsing error: {str(e)}"}, status=status.HTTP_400_BAD_REQUEST)
        else:
            return Response({'error': 'Unsupported file format. Please upload .csv or .xlsx'}, status=status.HTTP_400_BAD_REQUEST)

        # Field matching
        field_defs = target_block.get('fields', [])
        alias_map = {}
        for f in field_defs:
            fid = f['id']
            alias_map[fid.lower()] = fid
            alias_map[f.get('label', '').lower().replace(' ', '')] = fid

        created_count = 0
        updated_count = 0
        errors = []

        for idx, r in enumerate(rows, start=1):
            normalized = {}
            for k, v in r.items():
                clean_k = str(k).strip().lower().replace(' ', '').replace('_', '')
                if clean_k in alias_map:
                    target_id = alias_map[clean_k]
                    normalized[target_id] = v

            row_key_val = normalized.get(row_key_field)
            if not row_key_val:
                errors.append({'row': idx, 'error': f"Missing unique key '{row_key_field}'."})
                continue

            # Check unit assignment for faculty or records with unitId
            unit_val = normalized.get('unitId')
            unit_obj = None
            if unit_val:
                unit_obj = OrgUnit.objects.filter(id=unit_val).first()

            rec, created = SubmissionRecord.objects.update_or_create(
                submission=sub,
                block_id=b_id,
                row_key=str(row_key_val),
                defaults={
                    'unit': unit_obj or grant.org_unit,
                    'data': normalized,
                    'position': idx,
                }
            )
            if created:
                created_count += 1
            else:
                updated_count += 1

        # Audit log (PII-free)
        SubmissionAuditLog.objects.create(
            submission=sub,
            actor_type='OFFICER',
            actor_id=grant.officer.id,
            action='IMPORT',
            delta={
                'blockId': b_id,
                'createdCount': created_count,
                'updatedCount': updated_count,
                'errorCount': len(errors),
            }
        )

        return Response({
            'created': created_count,
            'updated': updated_count,
            'errors': errors,
            'totalProcessed': len(rows),
        })

class PortalRecordConfirmView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request, token, section_id):
        try:
            grant = get_portal_grant(token)
        except PermissionError as e:
            return Response({'error': str(e)}, status=status.HTTP_403_FORBIDDEN)

        # Faculty records verification
        sub = SectionSubmission.objects.filter(
            request=grant.request,
            section_id='faculty-details'
        ).first()

        if not sub:
            return Response({'error': 'Faculty details submission not found.'}, status=status.HTTP_404_NOT_FOUND)

        action_status = request.data.get('status', 'CONFIRMED')
        comment = request.data.get('comment', '')

        verif, _ = RecordVerification.objects.update_or_create(
            submission=sub,
            unit=grant.org_unit,
            defaults={
                'status': action_status,
                'comment': comment,
                'by': grant.officer,
            }
        )

        SubmissionAuditLog.objects.create(
            submission=sub,
            actor_type='OFFICER',
            actor_id=grant.officer.id,
            action='VERIFY',
            delta={
                'unitId': grant.org_unit.id,
                'status': action_status,
                'hasComment': bool(comment)
            }
        )

        return Response(RecordVerificationSerializer(verif).data)

# -----------------------------------------------------------------------------
# WP4 & WP7: Admin Review, Cross-Checks, Rollup & Export
# -----------------------------------------------------------------------------

class AdminSubmissionsListView(APIView):
    permission_classes = [IsAdminOrDirectorOrAuditorReadOnly]

    def get(self, request):
        qs = SectionSubmission.objects.select_related('request', 'org_unit', 'submitted_by').all()
        req_id = request.query_params.get('requestId')
        if req_id:
            qs = qs.filter(request_id=req_id)
        unit_id = request.query_params.get('unitId')
        if unit_id:
            qs = qs.filter(org_unit_id=unit_id)
        status_filter = request.query_params.get('status')
        if status_filter:
            qs = qs.filter(status=status_filter)
        sec_id = request.query_params.get('sectionId')
        if sec_id:
            qs = qs.filter(section_id=sec_id)

        serializer = SectionSubmissionSerializer(qs, many=True)
        return Response(serializer.data)

class AdminSubmissionDetailView(APIView):
    permission_classes = [IsAdminOrDirectorOrAuditorReadOnly]

    def get(self, request, pk):
        sub = get_object_or_404(
            SectionSubmission.objects.select_related('request', 'org_unit', 'submitted_by'),
            pk=pk
        )
        data = SectionSubmissionSerializer(sub).data

        # Records
        pii_fields = {'name', 'gender', 'employeeId', 'email', 'alumniName', 'coordinator', 'coordinatorContact'}
        is_elevated = getattr(request.user, 'role', '') in ('ADMIN', 'DIRECTOR') or request.user.is_superuser

        recs = []
        for r in sub.records.all():
            r_data = dict(r.data)
            if not is_elevated:
                r_data = mask_pii_in_dict(r_data, pii_fields)
            recs.append({
                'id': r.id,
                'blockId': r.block_id,
                'rowKey': r.row_key if is_elevated else '***',
                'unitId': r.unit_id,
                'data': r_data,
                'position': r.position
            })
        data['records'] = recs

        # Audit logs (PII-free)
        data['auditLogs'] = SubmissionAuditLogSerializer(sub.audit_logs.all(), many=True).data

        # Cross checks
        data['crossChecks'] = run_cross_checks(sub.request_id, sub.request.cycle_year)

        return Response(data)

class AdminSubmissionActionView(APIView):
    permission_classes = [IsAdminOrDirector]

    def post(self, request, pk):
        sub = get_object_or_404(SectionSubmission, pk=pk)
        action = request.data.get('action')
        comment = request.data.get('comment', '').strip()

        if action == 'approve':
            # Check faculty-unit-confirmation if section is faculty-details
            if sub.section_id == 'faculty-details':
                unit_ids = set(sub.records.filter(block_id='faculty').values_list('unit_id', flat=True))
                unit_ids.discard(None)
                if unit_ids:
                    confirmed = set(RecordVerification.objects.filter(
                        submission=sub,
                        unit_id__in=unit_ids,
                        status=VerificationStatus.CONFIRMED
                    ).values_list('unit_id', flat=True))
                    unconfirmed = unit_ids - confirmed
                    if unconfirmed:
                        return Response({
                            'error': f"Cannot approve faculty details: Confirmation pending from units: {', '.join(sorted(unconfirmed))}."
                        }, status=status.HTTP_400_BAD_REQUEST)

            sub.status = SubmissionStatus.APPROVED
            sub.reviewed_by = request.user
            sub.reviewed_at = timezone.now()
            sub.review_comment = comment
            sub.save()

            SubmissionAuditLog.objects.create(
                submission=sub,
                actor_type='ADMIN',
                actor_id=str(request.user.id),
                action='APPROVE',
                delta={'comment': comment}
            )

        elif action == 'requestCorrection':
            if not comment:
                return Response({'error': 'Comment is required when requesting corrections.'}, status=status.HTTP_400_BAD_REQUEST)

            sub.status = SubmissionStatus.CORRECTION_REQUESTED
            sub.review_comment = comment
            sub.save()

            target = DataRequestTarget.objects.filter(request=sub.request, org_unit=sub.org_unit).first()
            if target:
                target.status = TargetStatus.PARTIAL
                target.save(update_fields=['status'])

            SubmissionAuditLog.objects.create(
                submission=sub,
                actor_type='ADMIN',
                actor_id=str(request.user.id),
                action='REQUEST_CORRECTION',
                delta={'comment': comment}
            )

        elif action == 'reopen':
            sub.status = SubmissionStatus.DRAFT
            sub.review_comment = comment
            sub.save()

            SubmissionAuditLog.objects.create(
                submission=sub,
                actor_type='ADMIN',
                actor_id=str(request.user.id),
                action='REOPEN',
                delta={'comment': comment}
            )

        else:
            return Response({'error': f"Unknown action: '{action}'"}, status=status.HTTP_400_BAD_REQUEST)

        return Response(SectionSubmissionSerializer(sub).data)

class NirfRollupView(APIView):
    permission_classes = [IsAdminOrDirectorOrAuditorReadOnly]

    def get(self, request, year):
        category = request.query_params.get('category', 'OVERALL').upper()
        allow_partial = request.query_params.get('allowPartial', '0') in ('1', 'true', 'yes')
        request_id = request.query_params.get('requestId')

        try:
            rollup_res = compute_category_rollup(category, int(year), request_id, allow_partial)
            return Response(rollup_res)
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

class NirfExportView(APIView):
    permission_classes = [IsAdminOrDirectorOrAuditorReadOnly]

    def get(self, request, year):
        category = request.query_params.get('category', 'OVERALL').upper()
        allow_partial = request.query_params.get('allowPartial', '1') in ('1', 'true', 'yes')
        request_id = request.query_params.get('requestId')

        try:
            excel_buffer = generate_category_excel(category, int(year), request_id, allow_partial)
            filename = f"NIRF_{year}_{category}_DCS_IIT_Mandi.xlsx"
            response = HttpResponse(
                excel_buffer.getvalue(),
                content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            )
            response['Content-Disposition'] = f'attachment; filename="{filename}"'
            return response
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
