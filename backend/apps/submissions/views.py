import json
import csv
import io
import copy
import hashlib
import openpyxl
from django.db.models import Q
from django.utils.dateparse import parse_date
from datetime import datetime
from django.utils import timezone
from django.shortcuts import get_object_or_404
from django.http import HttpResponse
from rest_framework import status, permissions
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser

from apps.organogram.models import NodalOfficer, OrgUnit, Programme
from apps.data_requests.models import DataRequest, DataRequestTarget, PortalAccessGrant, ProofUpload, TargetStatus
from apps.data_requests.services import hash_token
from .history import section_history, notable_changes, unit_history
from .discrepancies import scan_quietly
from apps.accounts.permissions import (
    IsAdmin, IsAdminOrAuditorReadOnly, IsAdminOrOversightReadOnly, effective_role, has_oversight,
)

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
    apply_block_derives,
    check_field_value,
    normalize_import_value,
)
from .cross_checks import run_cross_checks
from .analytics import compute_department_analytics, compute_department_contributions
from .briefing import generate_briefing_pdf
from .audit import diff_payload, diff_record, schema_pii_fields
from .provenance import annotate_versions, proofs_for_submission, sections_for_item
from .xlsx_templates import build_records_template
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

def resolve_section_schema(sec: dict, cycle_year: int, unit=None, category_id=None, enums=None) -> dict:
    """
    Fully resolves a section definition for a given cycle year, optional unit, and category.
    Populates resolvedColumns, resolvedRows on grid blocks, resolves enum options on
    questionnaire and records blocks, and substitutes template tokens in labels and help texts.
    """
    sec_copy = copy.deepcopy(sec)
    year_ctx = get_year_context(cycle_year)

    def sub_tokens(text: str) -> str:
        if not text or not isinstance(text, str):
            return text
        for k, v in year_ctx.items():
            text = text.replace(f"{{{{{k}}}}}", str(v))
        return text

    if sec_copy.get('title'):
        sec_copy['title'] = sub_tokens(sec_copy['title'])
    if sec_copy.get('dcsHeading'):
        sec_copy['dcsHeading'] = sub_tokens(sec_copy['dcsHeading'])

    resolved_blocks = []
    for blk in sec_copy.get('blocks', []):
        if blk.get('title'):
            blk['title'] = sub_tokens(blk['title'])
        if blk.get('help'):
            blk['help'] = sub_tokens(blk['help'])

        kind = blk.get('kind')

        if kind == 'grid':
            col_axis = blk.get('columnAxis', {})
            col_type = col_axis.get('type')
            resolved_cols = []

            if col_type == 'fields':
                for f in col_axis.get('fields', []):
                    f_copy = copy.deepcopy(f)
                    if f_copy.get('label'):
                        f_copy['label'] = sub_tokens(f_copy['label'])
                    if f_copy.get('help'):
                        f_copy['help'] = sub_tokens(f_copy['help'])
                    if enums and f_copy.get('enum') and f_copy['enum'] in enums:
                        enum_def = enums[f_copy['enum']]
                        f_copy['options'] = enum_def.get('options', [])
                    resolved_cols.append(f_copy)
            elif col_type == 'years':
                series_cfg = col_axis.get('series', {})
                kind_series = series_cfg.get('kind', 'academic')
                count = series_cfg.get('count', 3)
                resolved_years = resolve_year_series(kind_series, count, cycle_year)
                col_axis['resolvedYears'] = resolved_years
                cell_cfg = col_axis.get('cell', {})
                for yr in resolved_years:
                    resolved_cols.append({
                        'id': str(yr),
                        'label': str(yr),
                        'type': cell_cfg.get('type', 'integer'),
                        'min': cell_cfg.get('min'),
                        'max': cell_cfg.get('max'),
                        'required': cell_cfg.get('required', False),
                    })
            blk['resolvedColumns'] = resolved_cols

            row_axis = blk.get('rowAxis', {})
            row_type = row_axis.get('type')
            resolved_rows = []

            if row_type == 'fixed':
                for r in row_axis.get('rows', []):
                    if category_id and r.get('usedBy'):
                        used_by_upper = [u.upper() for u in r.get('usedBy', [])]
                        if category_id.upper() not in used_by_upper:
                            continue
                    r_copy = copy.deepcopy(r)
                    if category_id and r_copy.get('labelByCategory'):
                        cat_upper = category_id.upper()
                        if cat_upper in r_copy['labelByCategory']:
                            r_copy['label'] = r_copy['labelByCategory'][cat_upper]
                    if r_copy.get('label'):
                        r_copy['label'] = sub_tokens(r_copy['label'])
                    resolved_rows.append(r_copy)
                row_axis['rows'] = resolved_rows

            elif row_type == 'years':
                series_cfg = row_axis.get('series', {})
                kind_series = series_cfg.get('kind', 'academic')
                count = series_cfg.get('count', 3)
                resolved_years = resolve_year_series(kind_series, count, cycle_year)
                row_axis['resolvedYears'] = resolved_years
                for yr in resolved_years:
                    resolved_rows.append({
                        'id': str(yr),
                        'label': str(yr),
                    })

            elif row_type == 'programme':
                programmes = []
                if unit:
                    if hasattr(unit, 'programmes'):
                        programmes = list(unit.programmes.filter(active=True))
                if programmes:
                    for p in programmes:
                        lvl = getattr(p, 'nirf_level', None) or getattr(p, 'level', None)
                        code = getattr(p, 'code', None)
                        label = f"{p.name} ({code})" if code else p.name
                        resolved_rows.append({
                            'id': str(p.id),
                            'label': label,
                            'code': code or '',
                            'level': lvl or '',
                        })
                else:
                    resolved_rows = [
                        {'id': 'UG4', 'label': 'UG [4 Years Program(s)]', 'level': 'UG4'},
                        {'id': 'UG5', 'label': 'UG [5 Years Program(s)]', 'level': 'UG5'},
                        {'id': 'PG2', 'label': 'PG [2 Years Program(s)]', 'level': 'PG2'},
                        {'id': 'DOC', 'label': 'Ph.D / Doctoral Program(s)', 'level': 'DOC'},
                    ]

            elif row_type == 'programmeBatch':
                series_cfg = row_axis.get('batchSeries', {})
                kind_series = series_cfg.get('kind', 'academic')
                count = series_cfg.get('count', 3)
                level = row_axis.get('level', 'UG4')
                resolved_years = resolve_year_series(kind_series, count, cycle_year)
                for yr in resolved_years:
                    batch_info = resolve_batch_years(str(yr), level)
                    entry_yr = batch_info.get('entryAcademicYear')
                    lat_yr = batch_info.get('lateralAcademicYear')
                    sub_parts = []
                    if entry_yr:
                        sub_parts.append(f"First year intake: {entry_yr}")
                    if lat_yr:
                        sub_parts.append(f"Lateral: {lat_yr}")
                    sub_label = f"({', '.join(sub_parts)})" if sub_parts else ""
                    resolved_rows.append({
                        'id': str(yr),
                        'label': str(yr),
                        'subLabel': sub_label,
                        'batchInfo': batch_info,
                        'level': level,
                    })

            elif row_type == 'levelBatch':
                levels = row_axis.get('levels', ['UG4', 'PG2'])
                level_names = {
                    'UG4': 'UG [4 Years Program(s)]',
                    'UG5': 'UG [5 Years Program(s)]',
                    'PG2': 'PG [2 Years Program(s)]',
                    'PG3': 'PG [3 Years Program(s)]',
                    'DOC': 'Ph.D / Doctoral Program(s)',
                }
                series_cfg = row_axis.get('batchSeries', {})
                kind_series = series_cfg.get('kind', 'academic')
                count = series_cfg.get('count', 3)
                resolved_years = resolve_year_series(kind_series, count, cycle_year)
                for lvl in levels:
                    lvl_label = level_names.get(lvl, lvl)
                    for yr in resolved_years:
                        batch_info = resolve_batch_years(str(yr), lvl)
                        resolved_rows.append({
                            'id': f"{lvl}_{yr}",
                            'label': f"{lvl_label} - {yr}",
                            'level': lvl,
                            'year': str(yr),
                            'batchInfo': batch_info,
                        })

            blk['resolvedRows'] = resolved_rows

        elif kind == 'questionnaire':
            for q in blk.get('questions', []):
                if q.get('label'):
                    q['label'] = sub_tokens(q['label'])
                if q.get('help'):
                    q['help'] = sub_tokens(q['help'])
                if enums and q.get('enum') and q['enum'] in enums:
                    enum_def = enums[q['enum']]
                    if 'options' not in q or not q['options']:
                        q['options'] = enum_def.get('options', [])
                    if 'allowOther' in enum_def and 'allowOther' not in q:
                        q['allowOther'] = enum_def.get('allowOther', False)

        elif kind == 'records':
            for f in blk.get('fields', []):
                if f.get('label'):
                    f['label'] = sub_tokens(f['label'])
                if f.get('help'):
                    f['help'] = sub_tokens(f['help'])
                if enums and f.get('enum') and f['enum'] in enums:
                    enum_def = enums[f['enum']]
                    if 'options' not in f or not f['options']:
                        f['options'] = enum_def.get('options', [])
                    if 'allowOther' in enum_def and 'allowOther' not in f:
                        f['allowOther'] = enum_def.get('allowOther', False)

        resolved_blocks.append(blk)

    sec_copy['blocks'] = resolved_blocks
    return sec_copy

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
        unit_obj = OrgUnit.objects.filter(id=unit_id).first() if unit_id else None

        content = schema_obj.content
        year_ctx = get_year_context(cycle_year)
        enums = content.get('enums', {})

        # Resolve all sections
        resolved_sections = []
        for sec in content.get('sections', []):
            if category_id and category_id.upper() not in sec.get('usedBy', []):
                continue
            resolved_sec = resolve_section_schema(
                sec,
                cycle_year,
                unit=unit_obj,
                category_id=category_id,
                enums=enums
            )
            resolved_sections.append(resolved_sec)

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
            'enums': enums,
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
    reason = grant.invalid_reason()
    if reason:
        raise PermissionError(reason)
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
                resolved_sec = resolve_section_schema(
                    sec,
                    cycle_year,
                    unit=grant.org_unit,
                    enums=schema.get('enums', {})
                )
                authorized_sections.append(resolved_sec)

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
                    records_by_block[blk['id']] = portal_records(sub, blk['id'])

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
                # Previously approved figures for this unit and section (2.6).
                'history': section_history(sub, current_records=records_by_block, resolved_section=sec),
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

def record_key(block_def: dict, data: dict) -> str:
    """
    Identity of one record within its block.

    Only a block that declares a `rowKey` (e.g. faculty by employee ID) has a
    natural key. For every other block the first field is *not* unique - IIT
    Mandi's 2026 Innovation submission lists 82 grants from DST alone - so the
    key is a digest of the record's content: distinct records stay distinct,
    and only an exact duplicate shares a key (spec 2.7 deduplication).
    """
    declared = block_def.get('rowKey')
    if declared:
        return str(data.get(declared) or '')
    material = {
        k: v for k, v in sorted(data.items())
        if not str(k).startswith('_') and v not in (None, '', [])
    }
    digest = hashlib.sha256(json.dumps(material, sort_keys=True, default=str).encode('utf-8'))
    return f"h:{digest.hexdigest()[:24]}"

def portal_records(sub, block_id: str) -> list:
    """
    Records as the portal form exchanges them: flat field values plus `_id`.

    The form edits fields at the top level of each row; nesting them under
    `data` (the storage shape) is what made imported rows render blank.
    """
    return [
        {**(rec.data or {}), '_id': rec.id}
        for rec in sub.records.filter(block_id=block_id).order_by('position', 'created_at')
    ]

def _record_unit(data: dict, fallback):
    unit_id = (data or {}).get('unitId')
    if unit_id:
        found = OrgUnit.objects.filter(id=unit_id).first()
        if found:
            return found
    return fallback

def replace_block_records(sub, block_def: dict, rows: list, enums: dict, fallback_unit, pii: set) -> list:
    """
    Make a block's stored records match `rows` exactly (the form is the source
    of truth for its own list). Rows carrying an `_id` update that record,
    rows without one are created, and stored records absent from `rows` are
    deleted. Returns audit entries with redacted old/new values.

    Values are normalised to canonical form but not rejected: a draft may be
    incomplete, and the full validation runs at submit time.
    """
    fields = {f['id']: f for f in block_def.get('fields', [])}
    existing = {rec.id: rec for rec in sub.records.filter(block_id=block_def['id'])}
    key_field = block_def.get('rowKey')
    kept, entries = set(), []

    for position, row in enumerate(rows or [], start=1):
        if not isinstance(row, dict):
            continue
        data = {}
        for fid, raw in row.items():
            if str(fid).startswith('_'):
                continue
            if fid in fields:
                value, other = normalize_import_value(fields[fid], raw, enums)
                data[fid] = value
                if other:
                    data[f'{fid}_other'] = other
            else:
                data[fid] = raw  # e.g. `<id>_other` companions
        rid = row.get('_id')
        record = existing.get(rid) if rid else None
        key = record_key(block_def, data)
        label = '[redacted]' if key_field in pii else (data.get(key_field) if key_field else None)

        if record is not None:
            before = dict(record.data or {})
            record.data = data
            record.position = position
            record.row_key = key
            record.unit = _record_unit(data, fallback_unit)
            record.save(update_fields=['data', 'position', 'row_key', 'unit', 'updated_at'])
            kept.add(record.id)
            changes = diff_record(before, data, pii)
            if changes:
                entries.append({'rowKey': label, 'created': False, 'changes': changes})
        else:
            record = SubmissionRecord.objects.create(
                submission=sub, block_id=block_def['id'], row_key=key,
                unit=_record_unit(data, fallback_unit), data=data, position=position,
            )
            kept.add(record.id)
            entries.append({'rowKey': label, 'created': True, 'changes': diff_record(None, data, pii)})

    for rid, record in existing.items():
        if rid not in kept:
            entries.append({
                'rowKey': '[redacted]' if key_field in pii else (
                    (record.data or {}).get(key_field) if key_field else None),
                'removed': True,
                'changes': diff_record(record.data, None, pii),
            })
            record.delete()
    return entries

def build_derive_context(submission, unit_id):
    """
    Context the derive engine needs: the submitting unit, plus the values a
    cross-section lookup can reach.

    Only `sanctioned-intake` is referenced by a lookup today (placement rows
    pull the intake recorded for the programme's entry year), so that is what
    gets indexed. The key shape matches evaluate_derive's lookup contract:
    "<section>:<block>:<row>:<col>".
    """
    lookups = {}
    intake_sub = SectionSubmission.objects.filter(
        request=submission.request,
        org_unit_id=unit_id,
        section_id='sanctioned-intake',
    ).first()

    if intake_sub and isinstance(intake_sub.payload, dict):
        intake_block = intake_sub.payload.get('intake')
        rows = {}
        if isinstance(intake_block, dict):
            rows = intake_block
        elif isinstance(intake_block, list):
            for idx, row in enumerate(intake_block):
                if isinstance(row, dict):
                    key = (
                        row.get('id') or row.get('programmeId')
                        or row.get('programme') or f'row{idx}'
                    )
                    rows[key] = row
        for row_key, row_val in rows.items():
            if not isinstance(row_val, dict):
                continue
            for col_key, cell in row_val.items():
                if col_key in ('id', 'programmeId', 'programme', 'label', 'name'):
                    continue
                lookups[f'sanctioned-intake:intake:{row_key}:{col_key}'] = cell

    return {'submittingUnitId': unit_id, 'lookups': lookups}

def apply_section_derives(resolved_sec, submission, unit_id):
    """
    Recompute every derived value for a submission and persist it.

    Derived cells are schema-owned, not officer-owned, so they are refreshed
    on every save and again at submit time rather than trusted from the
    client. Returns True when anything changed.
    """
    context = build_derive_context(submission, unit_id)
    changed = False

    payload = submission.payload if isinstance(submission.payload, dict) else {}
    for blk in resolved_sec.get('blocks', []):
        b_id = blk['id']

        if blk.get('kind') == 'records':
            for rec in submission.records.filter(block_id=b_id):
                updated = apply_block_derives(blk, [rec.data], context)
                if updated and updated[0] != rec.data:
                    rec.data = updated[0]
                    rec.save(update_fields=['data'])
                    changed = True
            continue

        if b_id not in payload:
            continue
        updated = apply_block_derives(blk, payload[b_id], context)
        if updated != payload[b_id]:
            payload[b_id] = updated
            changed = True

    if changed:
        submission.payload = payload
    return changed

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

        # Snapshot before anything is overwritten, for the audit diff.
        previous_payload = copy.deepcopy(sub.payload) if isinstance(sub.payload, dict) else {}
        previous_not_applicable = sub.not_applicable
        audit_schema = FormSchema.objects.filter(framework='NIRF', is_active=True).first()
        audit_sec_def = next(
            (sd for sd in (audit_schema.content.get('sections', []) if audit_schema else [])
             if sd['id'] == section_id),
            None,
        )

        sub.payload = payload
        sub.not_applicable = not_applicable

        # Records typed into the form are persisted here; before, only a
        # spreadsheet import ever reached the server and typed rows were lost.
        record_entries = {}
        incoming_records = request.data.get('records')
        if isinstance(incoming_records, dict) and audit_sec_def:
            enums_for_records = audit_schema.content.get('enums', {}) if audit_schema else {}
            pii = schema_pii_fields(audit_sec_def)
            for blk in audit_sec_def.get('blocks', []):
                if blk.get('kind') != 'records' or blk['id'] not in incoming_records:
                    continue
                rows = incoming_records.get(blk['id'])
                if not isinstance(rows, list):
                    continue
                entries = replace_block_records(sub, blk, rows, enums_for_records, grant.org_unit, pii)
                if entries:
                    record_entries[blk['id']] = entries[:200]

        # Refresh schema-derived cells (totals, amounts in words, serial
        # numbers) so the officer sees them on reload instead of blanks.
        schema_obj = FormSchema.objects.filter(framework='NIRF', is_active=True).first()
        if schema_obj and not not_applicable:
            sec_def = next(
                (s for s in schema_obj.content.get('sections', []) if s['id'] == section_id),
                None
            )
            if sec_def:
                resolved_sec = resolve_section_schema(
                    sec_def,
                    grant.request.cycle_year,
                    unit=grant.org_unit,
                    enums=schema_obj.content.get('enums', {})
                )
                apply_section_derives(resolved_sec, sub, grant.org_unit_id)

        sub.revision += 1
        sub.save()

        # Audit log: old and new value of every changed cell (spec 2.11), with
        # personal fields redacted per the schema's pii flags.
        SubmissionAuditLog.objects.create(
            submission=sub,
            actor_type='OFFICER',
            actor_id=grant.officer.id,
            action='UPDATE',
            delta={
                'revision': sub.revision,
                'notApplicable': sub.not_applicable,
                'notApplicableChanged': previous_not_applicable != sub.not_applicable,
                'blockKeys': list(payload.keys()) if isinstance(payload, dict) else [],
                **diff_payload(previous_payload, sub.payload, schema_pii_fields(audit_sec_def)),
                'records': record_entries,
            }
        )

        # Update target status to PARTIAL if PENDING
        target = DataRequestTarget.objects.filter(request=grant.request, org_unit=grant.org_unit).first()
        if target and target.status == TargetStatus.PENDING:
            target.status = TargetStatus.PARTIAL
            target.save(update_fields=['status'])

        data = SectionSubmissionSerializer(sub).data
        # Hand back the stored records so newly created rows get their `_id`.
        data['records'] = {
            blk['id']: portal_records(sub, blk['id'])
            for blk in (audit_sec_def or {}).get('blocks', [])
            if blk.get('kind') == 'records'
        }
        return Response(data)

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
            resolved_sec = resolve_section_schema(
                sec_def,
                grant.request.cycle_year,
                unit=grant.org_unit,
                enums=schema.get('enums', {})
            )
            # Derived cells are recomputed before validation so that rules
            # referencing them (and the DCS export) see current values.
            if apply_section_derives(resolved_sec, sub, grant.org_unit_id):
                sub.save(update_fields=['payload'])

            for blk in resolved_sec.get('blocks', []):
                b_id = blk['id']
                if blk['kind'] == 'records':
                    b_data = [r.data for r in sub.records.filter(block_id=b_id)]
                else:
                    b_data = sub.payload.get(b_id, {} if blk['kind'] == 'grid' else {})

                errs, warns = validate_block_data(
                    blk, b_data,
                    {'submittingUnitId': grant.org_unit.id, 'enums': schema.get('enums', {})},
                )
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

        # Re-check the cycle for discrepancies now this return is in (2.9).
        # Advisory only: a failed scan never fails the submission.
        scan_quietly(grant.request)

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
        # Only a declared rowKey is a natural key (merge by it); every other
        # block is a list the sheet replaces, de-duplicated by content.
        row_key_field = target_block.get('rowKey')
        mode = (request.data.get('mode') or ('merge' if row_key_field else 'replace')).lower()
        if mode not in ('merge', 'replace', 'append'):
            return Response({'error': "mode must be 'merge', 'replace' or 'append'."},
                            status=status.HTTP_400_BAD_REQUEST)

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
        enums = schema_obj.content.get('enums', {})
        field_defs = target_block.get('fields', [])
        fields_by_id = {f['id']: f for f in field_defs}
        alias_map = {}
        for f in field_defs:
            fid = f['id']
            alias_map[fid.lower()] = fid
            alias_map[f.get('label', '').lower().replace(' ', '').replace('_', '')] = fid

        def canonical_header(header):
            return alias_map.get(str(header).strip().lower().replace(' ', '').replace('_', ''))

        # Spec 2.8: a sheet missing a mandatory column is rejected outright,
        # rather than producing a record set with that field silently blank.
        headers = set()
        for r in rows:
            headers.update(h for h in (canonical_header(k) for k in r.keys()) if h)
        required_ids = [
            f['id'] for f in field_defs
            if f.get('required') and not f.get('derive') and f['id'] != 'unitId'
        ]
        missing_columns = [fid for fid in required_ids if fid not in headers]
        if rows and missing_columns:
            return Response({
                'error': 'The sheet is missing mandatory column(s).',
                'missingColumns': [
                    {'field': fid, 'label': fields_by_id[fid].get('label', fid)}
                    for fid in missing_columns
                ],
            }, status=status.HTTP_400_BAD_REQUEST)

        pii = schema_pii_fields(sec_def)
        created_count = 0
        updated_count = 0
        skipped_empty = 0
        duplicates_skipped = 0
        errors = []
        record_changes = []
        accepted = []
        seen_keys = set()

        for idx, r in enumerate(rows, start=1):
            # Spreadsheet row numbers, counting the header row.
            sheet_row = idx + 1
            if not any(v not in (None, '') and str(v).strip() for v in r.values()):
                skipped_empty += 1
                continue

            normalized = {}
            for k, v in r.items():
                target_id = canonical_header(k)
                if not target_id:
                    continue
                value, other_text = normalize_import_value(fields_by_id[target_id], v, enums)
                normalized[target_id] = value
                if other_text:
                    normalized[f'{target_id}_other'] = other_text

            if row_key_field:
                row_key_val = normalized.get(row_key_field)
                if row_key_val in (None, ''):
                    errors.append({'row': sheet_row, 'field': row_key_field,
                                   'error': f"Missing unique key '{row_key_field}'."})
                    continue

            # Spec 2.8: corrupted or out-of-range cells are flagged against the
            # sheet row and the row is not written, so bad data never lands.
            row_errors = []
            for fid, f in fields_by_id.items():
                if f.get('derive'):
                    continue
                val = normalized.get(fid)
                if f.get('required') and fid != 'unitId' and (val is None or str(val).strip() == ''):
                    row_errors.append({'row': sheet_row, 'field': fid,
                                       'error': f"'{f.get('label', fid)}' is required."})
                    continue
                problem = check_field_value(f, val, enums)
                if problem:
                    row_errors.append({'row': sheet_row, 'field': fid, 'error': problem})
            if row_errors:
                errors.extend(row_errors)
                continue

            unit_val = normalized.get('unitId')
            if unit_val and not OrgUnit.objects.filter(id=unit_val).exists():
                errors.append({'row': sheet_row, 'field': 'unitId',
                               'error': f"Unknown school / centre '{unit_val}'."})
                continue

            key = record_key(target_block, normalized)
            if key in seen_keys:
                # The same record twice in one sheet: keep one (spec 2.7).
                duplicates_skipped += 1
                continue
            seen_keys.add(key)
            accepted.append((idx, key, normalized))

        existing_by_key = {}
        for rec in SubmissionRecord.objects.filter(submission=sub, block_id=b_id):
            existing_by_key.setdefault(rec.row_key, rec)

        removed_count = 0
        if mode == 'replace':
            if not accepted and any(True for _ in rows):
                # Never let a sheet with no usable rows wipe the stored list.
                return Response({
                    'error': 'No valid rows found; the existing records were left unchanged.',
                    'errors': errors,
                    'skippedEmptyRows': skipped_empty,
                }, status=status.HTTP_400_BAD_REQUEST)
            incoming_keys = {key for _, key, _ in accepted}
            for key, rec in list(existing_by_key.items()):
                if key not in incoming_keys:
                    record_changes.append({
                        'rowKey': '[redacted]' if row_key_field in pii else (
                            (rec.data or {}).get(row_key_field) if row_key_field else None),
                        'removed': True,
                        'changes': diff_record(rec.data, None, pii),
                    })
                    rec.delete()
                    removed_count += 1
                    existing_by_key.pop(key)

        for idx, key, normalized in accepted:
            existing = existing_by_key.get(key)
            previous_data = dict(existing.data) if existing and isinstance(existing.data, dict) else None
            unit_obj = _record_unit(normalized, grant.org_unit)
            if existing is not None:
                existing.data = normalized
                existing.position = idx
                existing.unit = unit_obj
                existing.save(update_fields=['data', 'position', 'unit', 'updated_at'])
                created = False
                updated_count += 1
            else:
                existing = SubmissionRecord.objects.create(
                    submission=sub, block_id=b_id, row_key=key,
                    unit=unit_obj, data=normalized, position=idx,
                )
                existing_by_key[key] = existing
                created = True
                created_count += 1

            # Row keys are often personal (employee IDs), so redact them too.
            label = None
            if row_key_field:
                label = '[redacted]' if row_key_field in pii else str(normalized.get(row_key_field))
            changes = diff_record(previous_data, normalized, pii)
            if changes and len(record_changes) < 200:
                record_changes.append({'rowKey': label, 'created': created, 'changes': changes})

        SubmissionAuditLog.objects.create(
            submission=sub,
            actor_type='OFFICER',
            actor_id=grant.officer.id,
            action='IMPORT',
            delta={
                'blockId': b_id,
                'mode': mode,
                'createdCount': created_count,
                'updatedCount': updated_count,
                'removedCount': removed_count,
                'duplicatesSkipped': duplicates_skipped,
                'errorCount': len(errors),
                'skippedEmptyRows': skipped_empty,
                'records': record_changes,
            }
        )

        return Response({
            'mode': mode,
            'created': created_count,
            'updated': updated_count,
            'removed': removed_count,
            'importedCount': created_count + updated_count,
            'duplicatesSkipped': duplicates_skipped,
            'errors': errors,
            'skippedEmptyRows': skipped_empty,
            'totalProcessed': len(rows),
            # The block's full list after import, in the form's flat shape.
            'records': portal_records(sub, b_id),
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
    permission_classes = [IsAdminOrOversightReadOnly]

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
    permission_classes = [IsAdminOrOversightReadOnly]

    def get(self, request, pk):
        sub = get_object_or_404(
            SectionSubmission.objects.select_related('request', 'org_unit', 'submitted_by'),
            pk=pk
        )
        data = SectionSubmissionSerializer(sub).data

        # Records
        pii_fields = {'name', 'gender', 'employeeId', 'email', 'alumniName', 'coordinator', 'coordinatorContact'}
        is_elevated = effective_role(request.user) in ('ADMIN', 'DIRECTOR')

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

        # Provenance: the proofs this submission's figures rest on (spec 2.4).
        prov_schema = FormSchema.objects.filter(framework='NIRF', is_active=True).first()
        prov_sec = next(
            (sd for sd in (prov_schema.content.get('sections', []) if prov_schema else [])
             if sd['id'] == sub.section_id),
            None,
        )
        data['proofs'] = proofs_for_submission(sub, prov_sec)
        data['evidenceItemIds'] = (prov_sec or {}).get('catalogueItemIds', [])

        # Cross checks
        data['crossChecks'] = run_cross_checks(sub.request_id, sub.request.cycle_year)

        # Previous approved cycle, side by side (spec 2.6): the reviewer sees
        # the same "Previous / New / Change" the officer saw while typing.
        resolved = resolve_section_schema(
            prov_sec, sub.request.cycle_year, unit=sub.org_unit,
            enums=prov_schema.content.get('enums', {}) if prov_schema else {},
        ) if prov_sec else None
        history = section_history(sub, resolved_section=resolved)
        data['history'] = history
        data['notableChanges'] = notable_changes(history)

        return Response(data)

class AdminSubmissionActionView(APIView):
    """
    The checker's half of maker-checker (spec 2.10).

    Each decision is only legal from specific states, so a checker cannot, for
    example, approve a draft the maker never submitted. Every decision is
    written to the audit trail with the state it moved the submission from and
    to (spec 2.11).

    - `approve`            SUBMITTED -> APPROVED. Data is final only here.
    - `reject`             SUBMITTED -> CORRECTION_REQUESTED. The checker's
                           explicit "Reject" on a submission; reason required.
    - `requestCorrection`  SUBMITTED -> CORRECTION_REQUESTED. Raising a
                           correction request against a flagged error.
    - `reopen`             APPROVED / CORRECTION_REQUESTED -> DRAFT. An
                           audited override to unlock a settled submission.
    """
    permission_classes = [IsAdmin]

    TRANSITIONS = {
        'approve': ({SubmissionStatus.SUBMITTED}, SubmissionStatus.APPROVED, 'APPROVE', False),
        'reject': ({SubmissionStatus.SUBMITTED}, SubmissionStatus.CORRECTION_REQUESTED, 'REJECT', True),
        'requestCorrection': (
            {SubmissionStatus.SUBMITTED}, SubmissionStatus.CORRECTION_REQUESTED, 'REQUEST_CORRECTION', True,
        ),
        'reopen': (
            {SubmissionStatus.APPROVED, SubmissionStatus.CORRECTION_REQUESTED},
            SubmissionStatus.DRAFT, 'REOPEN', False,
        ),
    }

    def post(self, request, pk):
        sub = get_object_or_404(SectionSubmission, pk=pk)
        action = request.data.get('action')
        comment = (request.data.get('comment') or '').strip()

        if action not in self.TRANSITIONS:
            return Response({'error': f"Unknown action: '{action}'"}, status=status.HTTP_400_BAD_REQUEST)

        allowed_from, to_status, audit_action, needs_comment = self.TRANSITIONS[action]
        from_status = sub.status

        if from_status not in allowed_from:
            return Response({
                'error': (
                    f"Cannot {action} a submission that is '{from_status}'. "
                    f"Allowed from: {', '.join(sorted(allowed_from))}."
                ),
            }, status=status.HTTP_409_CONFLICT)

        if needs_comment and not comment:
            reason = 'rejecting' if action == 'reject' else 'requesting corrections'
            return Response({'error': f'A comment is required when {reason}.'},
                            status=status.HTTP_400_BAD_REQUEST)

        if action == 'approve' and sub.section_id == 'faculty-details':
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

        sub.status = to_status
        sub.review_comment = comment
        if action in ('approve', 'reject', 'requestCorrection'):
            sub.reviewed_by = request.user
            sub.reviewed_at = timezone.now()
        sub.save()

        if to_status == SubmissionStatus.CORRECTION_REQUESTED:
            target = DataRequestTarget.objects.filter(request=sub.request, org_unit=sub.org_unit).first()
            if target:
                target.status = TargetStatus.PARTIAL
                target.save(update_fields=['status'])

        SubmissionAuditLog.objects.create(
            submission=sub,
            actor_type='ADMIN',
            actor_id=str(request.user.id),
            action=audit_action,
            delta={
                'comment': comment,
                'fromStatus': from_status,
                'toStatus': to_status,
                'revision': sub.revision,
            }
        )

        return Response(SectionSubmissionSerializer(sub).data)

class NirfRollupView(APIView):
    permission_classes = [IsAdminOrOversightReadOnly]

    def get(self, request, year):
        category = request.query_params.get('category', 'OVERALL').upper()
        allow_partial = request.query_params.get('allowPartial', '0') in ('1', 'true', 'yes')
        request_id = request.query_params.get('requestId')

        try:
            rollup_res = compute_category_rollup(category, int(year), request_id, allow_partial)
            return Response(rollup_res)
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


def resolve_visible_units(user, requested_unit_id=None):
    """
    Which departments this user may see analytics for (spec 2.16 / 2.18).

    Admin, Director and Auditor see the whole institute. A nodal officer sees
    only the units they are assigned to - spec 2.18 is explicit that they
    "cannot view other departments' raw data" - and is matched to their roster
    entry by institutional email.

    Returns (unit_ids or None for all, error_response or None).
    """
    if has_oversight(user):
        return ([requested_unit_id] if requested_unit_id else None), None

    officer = NodalOfficer.objects.filter(email__iexact=(user.email or '')).first()
    own_units = list(officer.assigned_units.values_list('id', flat=True)) if officer else []

    if not own_units:
        return None, Response(
            {'error': 'No department is assigned to this account.'},
            status=status.HTTP_403_FORBIDDEN,
        )

    if requested_unit_id:
        if requested_unit_id not in own_units:
            return None, Response(
                {'error': 'You may only view analytics for your own department.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        return [requested_unit_id], None

    return own_units, None

BENCHMARK_MIN_OTHERS = 3

def department_benchmark(cycle_year, request_id, own_units, performance_rows):
    """
    Institute medians a department head can measure their unit against (2.16).

    Only medians are exposed and no unit is named, so no other department's
    data is shown (2.18). Below BENCHMARK_MIN_OTHERS reporting peers even a
    median would let a head back out a peer's figure, so it is withheld.
    """
    from statistics import median

    full = compute_department_contributions(cycle_year, request_id=request_id)
    others = [d for d in full['departments'] if d['unitId'] not in own_units]
    if len(others) < BENCHMARK_MIN_OTHERS:
        return {
            'withheld': True,
            'reason': (
                f'Fewer than {BENCHMARK_MIN_OTHERS} other units have approved returns; '
                'a benchmark would reveal their figures.'
            ),
        }

    def med(values):
        values = [v for v in values if v is not None]
        return round(median(values), 2) if values else None

    academic = [d for d in performance_rows if d.get('isAcademicUnit')]
    return {
        'withheld': False,
        'unitsCompared': len(full['departments']),
        'medianResearchFundingInr': med([d['researchFundingInr'] for d in full['departments']]),
        'medianPlacementRatePct': med([d['placementRatePct'] for d in full['departments']]),
        'medianOutcomeRatePct': med([d['outcomeRatePct'] for d in full['departments']]),
        'medianPhdGraduated': med([d['phdGraduated'] for d in full['departments']]),
        'medianCompletionPct': med([d['completionPct'] for d in academic]),
        'medianFirstPassApprovalPct': med([d['firstPassApprovalPct'] for d in academic if d['approved']]),
    }

class DepartmentAnalyticsView(APIView):
    """
    Department-wise contribution and performance analytics (spec 2.16).

    Returns both halves: `contribution` is what each department put into the
    institutional score (research money, placement outcomes, Ph.D completions),
    and `performance` is how it handled the collection cycle itself.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, year):
        try:
            cycle_year = int(year)
        except (TypeError, ValueError):
            return Response({'error': 'Invalid cycle year.'}, status=status.HTTP_400_BAD_REQUEST)

        request_id = request.query_params.get('requestId')
        category_id = request.query_params.get('category')
        unit_ids, denied = resolve_visible_units(
            request.user, request.query_params.get('unitId')
        )
        if denied is not None:
            return denied

        contribution = compute_department_contributions(
            cycle_year, request_id=request_id, unit_ids=unit_ids
        )
        performance = compute_department_analytics(
            cycle_year, request_id=request_id, category_id=category_id
        )

        benchmark = None
        if unit_ids is not None:
            allowed = set(unit_ids)
            institute_performance = performance
            performance = dict(performance)
            performance['departments'] = [
                d for d in institute_performance['departments'] if d['unitId'] in allowed
            ]
            # Institute-wide rollups and league tables are not this user's to see.
            performance.pop('leaderboard', None)
            contribution.pop('leaders', None)
            benchmark = department_benchmark(
                cycle_year, request_id, allowed, institute_performance['departments']
            )

        return Response({
            'cycleYear': cycle_year,
            'scopedToUnits': unit_ids,
            'contribution': contribution,
            'performance': performance,
            'benchmark': benchmark,
        })

class BoardroomBriefingView(APIView):
    """
    One-click boardroom-ready PDF briefing (spec 2.17).

    Carries the cycle's submission statistics, the discrepancies cross-checks
    flagged, and scenario-based score projections.
    """
    permission_classes = [IsAdminOrOversightReadOnly]

    def get(self, request, year):
        from apps.rankings.views import load_ranking_data
        from apps.rankings.scraper import TARGET_IITS, canonical_iit_name

        try:
            cycle_year = int(year)
        except (TypeError, ValueError):
            return Response({'error': 'Invalid cycle year.'}, status=status.HTTP_400_BAD_REQUEST)

        raw_year = request.query_params.get('rankingYear')
        try:
            # Default: the newest published NIRF cycle on disk.
            ranking_year = int(raw_year) if raw_year not in (None, '') else None
        except (TypeError, ValueError):
            return Response({'error': 'Invalid rankingYear.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            pdf = generate_briefing_pdf(
                cycle_year=cycle_year,
                load_ranking_data=load_ranking_data,
                canonical_name=canonical_iit_name,
                peer_names=TARGET_IITS,
                request_id=request.query_params.get('requestId'),
                category_id=request.query_params.get('category'),
                ranking_year=ranking_year,
            )
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

        filename = f"DORA_Boardroom_Briefing_NIRF_{cycle_year}.pdf"
        audit_export(
            request, 'boardroom-briefing', pdf.getvalue(),
            cycleYear=cycle_year, rankingYear=ranking_year or 'latest',
            requestId=request.query_params.get('requestId'), filename=filename,
        )
        response = HttpResponse(pdf.getvalue(), content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        return response


def audit_export(request, kind: str, payload: bytes, **details):
    """
    Records an export in the audit trail (spec 2.11 lists export alongside
    create/edit/approve/reject). The SHA-256 of the exact bytes handed out is
    kept, so a file that later turns up can be matched to who generated it.
    """
    SubmissionAuditLog.objects.create(
        submission=None,
        actor_type='ADMIN',
        actor_id=str(getattr(request.user, 'id', '') or ''),
        action='EXPORT',
        delta={
            'kind': kind,
            'sha256': hashlib.sha256(payload).hexdigest(),
            'bytes': len(payload),
            **details,
        },
    )


class AuditLogView(APIView):
    """
    The auditor's interface onto the audit trail (spec 2.11, 2.18).

    Read-only for Admin, Director and Auditor. Supports filtering by action,
    actor, section, unit, request, cycle and date range, free-text search
    across the recorded changes, and CSV export of the filtered set
    (`?export=csv`).
    """
    permission_classes = [IsAdminOrOversightReadOnly]
    MAX_PAGE_SIZE = 200
    CSV_LIMIT = 20000

    def _filtered(self, params):
        from django.db.models import TextField
        from django.db.models.functions import Cast

        qs = SubmissionAuditLog.objects.select_related(
            'submission', 'submission__org_unit', 'submission__request'
        )

        def csv_param(name):
            raw = params.get(name)
            return [v.strip() for v in raw.split(',') if v.strip()] if raw else []

        if csv_param('action'):
            qs = qs.filter(action__in=[a.upper() for a in csv_param('action')])
        if params.get('actorType'):
            qs = qs.filter(actor_type=params['actorType'].upper())
        if params.get('actorId'):
            qs = qs.filter(actor_id=params['actorId'])
        if params.get('submissionId'):
            qs = qs.filter(submission_id=params['submissionId'])
        if params.get('sectionId'):
            qs = qs.filter(submission__section_id=params['sectionId'])
        if params.get('unitId'):
            qs = qs.filter(submission__org_unit_id=params['unitId'])
        if params.get('requestId'):
            qs = qs.filter(submission__request_id=params['requestId'])
        if params.get('cycleYear'):
            try:
                qs = qs.filter(submission__request__cycle_year=int(params['cycleYear']))
            except (TypeError, ValueError):
                raise ValueError("'cycleYear' must be a year.")

        for bound, lookup in (('from', 'timestamp__date__gte'), ('to', 'timestamp__date__lte')):
            raw = params.get(bound)
            if raw:
                parsed = parse_date(raw)
                if parsed is None:
                    raise ValueError(f"'{bound}' must be a date (YYYY-MM-DD).")
                qs = qs.filter(**{lookup: parsed})

        q = (params.get('q') or '').strip()
        if q:
            qs = qs.annotate(delta_text=Cast('delta', TextField())).filter(
                Q(delta_text__icontains=q)
                | Q(action__icontains=q)
                | Q(actor_id__icontains=q)
                | Q(submission__section_id__icontains=q)
                | Q(submission__org_unit__name__icontains=q)
            )
        return qs.order_by('-timestamp')

    @staticmethod
    def _actor_names(logs):
        from django.contrib.auth import get_user_model
        officer_ids = {log.actor_id for log in logs if log.actor_type == 'OFFICER'}
        user_ids = {log.actor_id for log in logs if log.actor_type == 'ADMIN' and str(log.actor_id).isdigit()}
        names = {
            ('OFFICER', o.id): o.name
            for o in NodalOfficer.objects.filter(id__in=officer_ids)
        }
        for u in get_user_model().objects.filter(id__in=user_ids):
            names[('ADMIN', str(u.id))] = u.get_full_name() or u.username
        return names

    @staticmethod
    def _row(log, names):
        sub = log.submission
        delta = log.delta or {}
        return {
            'id': log.id,
            'timestamp': log.timestamp.isoformat(),
            'action': log.action,
            'actorType': log.actor_type,
            'actorId': log.actor_id,
            'actorName': names.get((log.actor_type, str(log.actor_id))),
            'submissionId': sub.id if sub else None,
            'sectionId': sub.section_id if sub else None,
            'unitId': sub.org_unit_id if sub else None,
            'unitName': sub.org_unit.name if sub else None,
            'requestId': sub.request_id if sub else None,
            'requestReference': sub.request.reference if sub else None,
            'cycleYear': sub.request.cycle_year if sub else delta.get('cycleYear'),
            'changeCount': delta.get('changeCount', len(delta.get('changes', []) or [])),
            'delta': delta,
        }

    def get(self, request):
        try:
            qs = self._filtered(request.query_params)
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

        # `export`, not `format`: DRF reserves ?format= for renderer selection
        # and answers an unknown value with a 404.
        if request.query_params.get('export') == 'csv':
            return self._csv(request, qs)

        try:
            page = max(int(request.query_params.get('page', 1)), 1)
            page_size = min(max(int(request.query_params.get('pageSize', 50)), 1), self.MAX_PAGE_SIZE)
        except (TypeError, ValueError):
            return Response({'error': 'page and pageSize must be integers.'},
                            status=status.HTTP_400_BAD_REQUEST)

        total = qs.count()
        logs = list(qs[(page - 1) * page_size: page * page_size])
        names = self._actor_names(logs)
        return Response({
            'count': total,
            'page': page,
            'pageSize': page_size,
            'results': [self._row(log, names) for log in logs],
            'actions': sorted(
                SubmissionAuditLog.objects.values_list('action', flat=True).distinct()
            ),
        })

    def _csv(self, request, qs):
        logs = list(qs[: self.CSV_LIMIT])
        names = self._actor_names(logs)
        buffer = io.StringIO()
        writer = csv.writer(buffer)
        writer.writerow([
            'timestamp', 'action', 'actor_type', 'actor_id', 'actor_name',
            'request', 'cycle_year', 'section', 'unit', 'submission_id',
            'change_count', 'comment', 'from_status', 'to_status', 'changes_json',
        ])
        for log in logs:
            row = self._row(log, names)
            delta = row['delta']
            writer.writerow([
                row['timestamp'], row['action'], row['actorType'], row['actorId'],
                row['actorName'] or '', row['requestReference'] or '', row['cycleYear'] or '',
                row['sectionId'] or '', row['unitName'] or '', row['submissionId'] or '',
                row['changeCount'], delta.get('comment', ''), delta.get('fromStatus', ''),
                delta.get('toStatus', ''), json.dumps(delta.get('changes') or delta.get('records') or [], default=str),
            ])
        payload = buffer.getvalue().encode('utf-8')

        # Exporting the audit trail is itself an auditable export.
        audit_export(request, 'audit-log-csv', payload, rows=len(logs),
                     filters={k: v for k, v in request.query_params.items() if k != 'export'})

        response = HttpResponse(payload, content_type='text/csv; charset=utf-8')
        stamp = timezone.now().strftime('%Y%m%d_%H%M')
        response['Content-Disposition'] = f'attachment; filename="DORA_Audit_Log_{stamp}.csv"'
        return response


class ProofRepositoryView(APIView):
    """
    The centralised, searchable proof repository (spec 2.4).

    Every proof ever uploaded, with its version within its evidence slot and
    the schema sections it supports. Read-only for Admin, Director and
    Auditor (spec 2.18: the auditor has read access to raw proofs).
    """
    permission_classes = [IsAdminOrOversightReadOnly]
    MAX_PAGE_SIZE = 200

    def get(self, request):
        params = request.query_params
        qs = ProofUpload.objects.select_related('request', 'org_unit', 'officer')

        if params.get('requestId'):
            qs = qs.filter(request_id=params['requestId'])
        if params.get('unitId'):
            qs = qs.filter(org_unit_id=params['unitId'])
        if params.get('dataItemId'):
            qs = qs.filter(data_item_id=params['dataItemId'])
        if params.get('cycleYear'):
            try:
                qs = qs.filter(request__cycle_year=int(params['cycleYear']))
            except (TypeError, ValueError):
                return Response({'error': "'cycleYear' must be a year."},
                                status=status.HTTP_400_BAD_REQUEST)

        schema_obj = FormSchema.objects.filter(framework='NIRF', is_active=True).first()
        schema = schema_obj.content if schema_obj else {}
        if params.get('sectionId'):
            sec = next((sd for sd in schema.get('sections', []) if sd['id'] == params['sectionId']), None)
            qs = qs.filter(data_item_id__in=(sec or {}).get('catalogueItemIds') or ['__none__'])

        q = (params.get('q') or '').strip()
        if q:
            qs = qs.filter(
                Q(file_name__icontains=q) | Q(note__icontains=q) | Q(data_item_id__icontains=q)
                | Q(org_unit__name__icontains=q) | Q(request__reference__icontains=q)
                | Q(checksum__iexact=q)
            )

        # Versions are computed over each whole evidence slot, so a filtered
        # view still reports "v2 of 3" rather than renumbering what it shows.
        slot_keys = set(qs.values_list('request_id', 'org_unit_id', 'data_item_id'))
        slot_filter = Q(pk__in=[])
        for req_id, unit_id, item_id in slot_keys:
            slot_filter |= Q(request_id=req_id, org_unit_id=unit_id, data_item_id=item_id)
        versioned = {
            row['id']: row
            for row in annotate_versions(
                ProofUpload.objects.filter(slot_filter).select_related('request', 'org_unit', 'officer')
            )
        }
        visible_ids = list(qs.order_by('-uploaded_at').values_list('id', flat=True))
        rows = [versioned[i] for i in visible_ids if i in versioned]
        if params.get('latestOnly') in ('1', 'true', 'yes'):
            rows = [r for r in rows if r['isLatest']]
        for row in rows:
            row['sections'] = sections_for_item(schema, row['dataItemId'])

        try:
            page = max(int(params.get('page', 1)), 1)
            page_size = min(max(int(params.get('pageSize', 50)), 1), self.MAX_PAGE_SIZE)
        except (TypeError, ValueError):
            return Response({'error': 'page and pageSize must be integers.'},
                            status=status.HTTP_400_BAD_REQUEST)

        return Response({
            'count': len(rows),
            'page': page,
            'pageSize': page_size,
            'results': rows[(page - 1) * page_size: page * page_size],
        })

class ProofDownloadView(APIView):
    """
    Authenticated proof download.

    Proof files live under MEDIA_ROOT, which Django serves only in DEBUG - so
    in development they were reachable by anyone holding the path, and in
    production not at all. This serves them to Admin, Director and Auditor
    only, and re-verifies the stored SHA-256 so a tampered file is refused.
    """
    permission_classes = [IsAdminOrOversightReadOnly]

    def get(self, request, pk):
        from django.http import FileResponse
        proof = get_object_or_404(ProofUpload, pk=pk)
        try:
            handle = proof.file.open('rb')
        except (FileNotFoundError, ValueError):
            return Response({'error': 'The stored file is missing.'}, status=status.HTTP_410_GONE)

        digest = hashlib.sha256()
        for chunk in iter(lambda: handle.read(1024 * 1024), b''):
            digest.update(chunk)
        if proof.checksum and digest.hexdigest() != proof.checksum:
            handle.close()
            return Response({'error': 'Integrity check failed: the stored file does not match its checksum.'},
                            status=status.HTTP_409_CONFLICT)
        handle.seek(0)

        return FileResponse(
            handle,
            as_attachment=True,
            filename=proof.file_name,
            content_type=proof.content_type or 'application/octet-stream',
        )


class RecordsTemplateView(APIView):
    """
    Downloads the standardised Excel template for a records block (spec 2.3).

    Contains no institutional data - only the schema's columns, dropdowns and
    instructions - so it is open, like the schema endpoints themselves.
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request, framework, section_id):
        schema_obj = FormSchema.objects.filter(framework=framework.upper(), is_active=True).first()
        if not schema_obj:
            return Response({'error': f"No active schema for '{framework}'."}, status=status.HTTP_404_NOT_FOUND)
        sec_def = next((sd for sd in schema_obj.content.get('sections', []) if sd['id'] == section_id), None)
        if not sec_def:
            return Response({'error': 'Section not found.'}, status=status.HTTP_404_NOT_FOUND)

        record_blocks = [b for b in sec_def.get('blocks', []) if b.get('kind') == 'records']
        if not record_blocks:
            return Response({'error': 'This section is entered through the web form; it has no spreadsheet template.'},
                            status=status.HTTP_404_NOT_FOUND)
        block_id = request.query_params.get('blockId')
        block = next((b for b in record_blocks if b['id'] == block_id), None) if block_id else record_blocks[0]
        if block is None:
            return Response({'error': f"No records block '{block_id}' in this section.",
                             'blocks': [b['id'] for b in record_blocks]}, status=status.HTTP_404_NOT_FOUND)

        buf = build_records_template(sec_def, block, schema_obj.content.get('enums', {}))
        filename = f"NIRF_{section_id}_{block['id']}_template.xlsx"
        response = HttpResponse(
            buf.getvalue(),
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        )
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        return response

class NirfExportView(APIView):
    permission_classes = [IsAdminOrOversightReadOnly]

    def get(self, request, year):
        category = request.query_params.get('category', 'OVERALL').upper()
        allow_partial = request.query_params.get('allowPartial', '1') in ('1', 'true', 'yes')
        request_id = request.query_params.get('requestId')

        try:
            excel_buffer = generate_category_excel(category, int(year), request_id, allow_partial)
            filename = f"NIRF_{year}_{category}_DCS_IIT_Mandi.xlsx"
            audit_export(
                request, 'dcs-excel', excel_buffer.getvalue(),
                category=category, cycleYear=int(year), requestId=request_id,
                allowPartial=allow_partial, filename=filename,
            )
            response = HttpResponse(
                excel_buffer.getvalue(),
                content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            )
            response['Content-Disposition'] = f'attachment; filename="{filename}"'
            return response
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


class SubmissionHistoryView(APIView):
    """
    Approved returns of one unit and section across past cycles (spec 2.6:
    "storage and easy backend querying of at least the previous three years").

    GET /api/nirf/history/?unitId=scee&sectionId=sanctioned-intake[&cycles=3][&before=2027]

    Raw departmental figures, so oversight roles only; a nodal officer sees
    their own history beside the form through their upload link instead.
    """
    permission_classes = [IsAdminOrOversightReadOnly]

    def get(self, request):
        unit_id = request.query_params.get('unitId')
        section_id = request.query_params.get('sectionId')
        if not unit_id or not section_id:
            return Response({'error': 'unitId and sectionId are required.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            cycles = max(1, min(10, int(request.query_params.get('cycles', 3))))
            before = request.query_params.get('before')
            before = int(before) if before else None
        except (TypeError, ValueError):
            return Response({'error': 'cycles and before must be integers.'}, status=status.HTTP_400_BAD_REQUEST)
        return Response({
            'unitId': unit_id,
            'sectionId': section_id,
            'cycles': unit_history(unit_id, section_id, before_cycle=before, cycles=cycles),
        })


# -----------------------------------------------------------------------------
# Discrepancy flagging (spec 2.9)
# -----------------------------------------------------------------------------

def serialize_flag(f):
    return {
        'id': f.id,
        'requestId': f.request_id,
        'submissionId': f.submission_id,
        'submissionStatus': f.submission.status if f.submission_id else None,
        'unitId': f.org_unit_id,
        'unitName': (f.org_unit.short_name or f.org_unit.name) if f.org_unit_id else None,
        'sectionId': f.section_id,
        'kind': f.kind,
        'label': f.label,
        'severity': f.severity,
        'message': f.message,
        'previous': f.previous_value,
        'current': f.current_value,
        'changePct': f.change_pct,
        'details': f.details,
        'ai': {
            'severity': f.ai_severity,
            'rationale': f.ai_rationale,
            'question': f.ai_question,
            'model': f.ai_log.model if f.ai_log_id else None,
            'logId': f.ai_log_id,
        } if f.ai_rationale else None,
        'status': f.status,
        'resolutionNote': f.resolution_note,
        'resolvedBy': f.resolved_by.username if f.resolved_by_id else None,
        'resolvedAt': f.resolved_at,
        'firstSeen': f.first_seen,
        'lastSeen': f.last_seen,
    }


class DiscrepancyListView(APIView):
    """
    GET  /api/nirf/discrepancies/?requestId=&status=&severity=   flags for a request (oversight)
    """
    permission_classes = [IsAdminOrOversightReadOnly]

    def get(self, request):
        from apps.data_requests.models import DataRequest as DR
        from . import ai_client
        from .discrepancies import SEVERITY_ORDER, thresholds
        from .models import DiscrepancyFlag

        request_id = request.query_params.get('requestId')
        if not request_id:
            latest = DR.objects.order_by('-cycle_year', '-created_at').first()
            request_id = latest.id if latest else None
        flags = (DiscrepancyFlag.objects.filter(request_id=request_id)
                 .select_related('org_unit', 'submission', 'resolved_by', 'ai_log'))
        st = request.query_params.get('status')
        if st:
            flags = flags.filter(status=st.upper())
        sev = request.query_params.get('severity')
        if sev:
            flags = flags.filter(severity=sev.upper())
        flags = sorted(flags, key=lambda f: (f.status != 'OPEN', SEVERITY_ORDER.get(f.severity, 9), f.label))

        all_flags = DiscrepancyFlag.objects.filter(request_id=request_id)
        summary = {
            'open': all_flags.filter(status='OPEN').count(),
            'openCritical': all_flags.filter(status='OPEN', severity='CRITICAL').count(),
            'openWarning': all_flags.filter(status='OPEN', severity='WARNING').count(),
            'escalated': all_flags.filter(status='ESCALATED').count(),
            'dismissed': all_flags.filter(status='DISMISSED').count(),
            'resolved': all_flags.filter(status='RESOLVED').count(),
        }
        return Response({
            'requestId': request_id,
            'requests': [
                {'id': r.id, 'reference': r.reference, 'title': r.title, 'cycleYear': r.cycle_year}
                for r in DR.objects.order_by('-cycle_year', '-created_at')[:50]
            ],
            'summary': summary,
            'thresholds': thresholds(),
            'ai': ai_client.status(),
            'flags': [serialize_flag(f) for f in flags],
        })


class DiscrepancyScanView(APIView):
    """
    POST /api/nirf/discrepancies/scan/  {"requestId": "...", "useAi": false}   (Admin)

    Re-runs the rules; with useAi and a configured provider, the open flags
    are then sent for AI review.
    """
    permission_classes = [IsAdmin]

    def post(self, request):
        from apps.data_requests.models import DataRequest as DR
        from .discrepancies import ai_review, scan_request

        data_req = get_object_or_404(DR, pk=request.data.get('requestId'))
        report = {'scan': scan_request(data_req)}
        if str(request.data.get('useAi', '')).lower() in ('1', 'true', 'yes'):
            report['ai'] = ai_review(data_req, user=request.user)
        return Response(report)


class DiscrepancyActionView(APIView):
    """
    POST /api/nirf/discrepancies/<id>/  {"action": "dismiss"|"escalate"|"reopen", "note": "..."}   (Admin)
    """
    permission_classes = [IsAdmin]

    def post(self, request, pk):
        from .discrepancies import FlagActionError, dismiss, escalate, reopen
        from .models import DiscrepancyFlag

        flag = get_object_or_404(DiscrepancyFlag.objects.select_related('submission', 'org_unit'), pk=pk)
        action = str(request.data.get('action', '')).lower()
        note = request.data.get('note', '')
        try:
            if action == 'dismiss':
                dismiss(flag, request.user, note)
            elif action == 'escalate':
                escalate(flag, request.user, note)
            elif action == 'reopen':
                reopen(flag)
            else:
                return Response({'error': f"Unknown action '{action}'."}, status=status.HTTP_400_BAD_REQUEST)
        except FlagActionError as exc:
            return Response({'error': str(exc)}, status=exc.status)
        flag.refresh_from_db()
        return Response(serialize_flag(flag))


class AIRequestLogView(APIView):
    """
    GET /api/ai/requests/   every AI call, newest first (spec 9 auditability).
    Admin and Auditor; Director has no need for the raw prompts.
    """
    permission_classes = [IsAdminOrAuditorReadOnly]

    def get(self, request):
        from .models import AIRequestLog
        logs = AIRequestLog.objects.select_related('request', 'triggered_by')[:100]
        return Response([
            {
                'id': log.id,
                'createdAt': log.created_at,
                'provider': log.provider,
                'model': log.model,
                'purpose': log.purpose,
                'requestReference': log.request.reference if log.request_id else None,
                'triggeredBy': log.triggered_by.username if log.triggered_by_id else None,
                'status': log.status,
                'error': log.error,
                'latencyMs': log.latency_ms,
                'flagsSent': log.flags_sent,
                'flagsAnnotated': log.flags_annotated,
                'itemsRejected': log.items_rejected,
                'promptSha256': log.prompt_sha256,
                'prompt': log.prompt,
                'response': log.response_text,
            }
            for log in logs
        ])
