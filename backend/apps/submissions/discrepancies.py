"""
Heuristic and AI-assisted discrepancy flagging (spec 2.9).

  "Heuristic and AI-driven analysis comparing current year submissions
   against historical trends to detect statistical anomalies ... e.g. flagging
   a department if their reported research publications drop by 80% compared
   to the previous year ... Severity grading (Critical vs Warning) ...
   The AI layer is an enhancement, never a dependency ... All AI flags must be
   grounded in approved portal data."

Two layers:

1. Rules (always on, deterministic). Every submitted or approved return in a
   request is compared with the unit's approved return from the previous
   cycle (history.py) and checked against the cross-section rules
   (cross_checks.py). Thresholds are settings (DISCREPANCY_*):

     year-on-year drop  >= 80%, or to zero from a positive figure   CRITICAL
     year-on-year rise  >= 300%                                      CRITICAL
     year-on-year move  >= 40%                                       WARNING
     restated period    >= 50% different                             CRITICAL
     restated period    >= 5% different                              WARNING
     restated period    any smaller difference                       INFO
     record count       to zero / moves >= 50%                       CRITICAL / WARNING
     failed cross-check                                              its own severity

2. AI review (optional, on demand). The open flags - and only them - are sent
   to the configured model as aggregated figures with no personal data: no
   records, names or contacts. The model may only *annotate* a flag it was
   given: its own severity view, a short rationale, and a question DORA can
   put to the department. Replies are checked before use:
     * an item naming a flag that was not sent is rejected;
     * an item whose rationale quotes a figure that is not in that flag's
       data is rejected as ungrounded;
     * the rule severity, previous and current values shown are always the
       portal's own; the model's view is displayed alongside, never instead.
   Every call, failed or not, is written to AIRequestLog. If the model is
   unavailable the rule flags stand on their own.

Flags have a review lifecycle - OPEN, DISMISSED (with a note), ESCALATED
(raises a correction request on the return, the maker-checker route back to
the department) and RESOLVED (no longer detected after a resubmission).
"""
import hashlib
import json
import re

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from apps.data_requests.models import DataRequestTarget, TargetStatus

from . import ai_client
from .cross_checks import run_cross_checks
from .history import section_history
from .models import (
    AIRequestLog,
    DiscrepancyFlag,
    FlagSeverity,
    FlagStatus,
    FormSchema,
    SectionSubmission,
    SubmissionAuditLog,
    SubmissionStatus,
)

SCANNED_STATES = (SubmissionStatus.SUBMITTED, SubmissionStatus.APPROVED)
SEVERITY_ORDER = {FlagSeverity.CRITICAL: 0, FlagSeverity.WARNING: 1, FlagSeverity.INFO: 2}


def thresholds():
    g = lambda name, default: float(getattr(settings, name, default))  # noqa: E731
    return {
        'criticalDropPct': g('DISCREPANCY_CRITICAL_DROP_PCT', 80),
        'criticalRisePct': g('DISCREPANCY_CRITICAL_RISE_PCT', 300),
        'warningChangePct': g('DISCREPANCY_WARNING_CHANGE_PCT', 40),
        'restateCriticalPct': g('DISCREPANCY_RESTATE_CRITICAL_PCT', 50),
        'restateWarningPct': g('DISCREPANCY_RESTATE_WARNING_PCT', 5),
        'recordWarningPct': g('DISCREPANCY_RECORD_WARNING_PCT', 50),
    }


# ---------------------------------------------------------------------------
# Labels
# ---------------------------------------------------------------------------

def _section_labels(schema, section_id, cycle_year, unit):
    """Human labels for a section's blocks, rows, columns and questions."""
    from .views import resolve_section_schema  # local import: views imports this module

    sec = next((s for s in (schema or {}).get('sections', []) if s['id'] == section_id), None)
    if sec is None:
        return {'title': section_id, 'blocks': {}}
    resolved = resolve_section_schema(sec, cycle_year, unit=unit, enums=schema.get('enums', {}))
    blocks = {}
    for b in resolved.get('blocks', []):
        rows = b.get('resolvedRows') or (b.get('rowAxis') or {}).get('rows') or []
        cols = b.get('resolvedColumns') or (b.get('columnAxis') or {}).get('fields') or []
        blocks[b['id']] = {
            'title': b.get('title') or b['id'],
            'rows': {str(r.get('id')): r.get('label') or str(r.get('id')) for r in rows},
            'cols': {str(c.get('id')): c.get('label') or str(c.get('id')) for c in cols},
            'questions': {q['id']: q.get('label') or q['id'] for q in b.get('questions', [])},
        }
    return {'title': resolved.get('title') or section_id, 'blocks': blocks, 'resolved': resolved}


def _field_label(labels, block_id, row_key=None, col_key=None, question=False):
    block = labels['blocks'].get(block_id, {})
    parts = [block.get('title', block_id)]
    if question:
        parts.append(block.get('questions', {}).get(col_key, col_key))
    else:
        if row_key is not None:
            parts.append(block.get('rows', {}).get(str(row_key), str(row_key)))
        if col_key is not None:
            parts.append(block.get('cols', {}).get(str(col_key), str(col_key)))
    return ' › '.join(str(p) for p in parts if p)


def _fmt(value):
    if value is None:
        return ''
    if isinstance(value, float) and value.is_integer():
        value = int(value)
    return str(value)[:128]


# ---------------------------------------------------------------------------
# Rules
# ---------------------------------------------------------------------------

def _grade_change(cell, t):
    """Severity and wording for one compared cell, or None if unremarkable."""
    pct = cell.get('changePct')
    prev = cell.get('previous')
    try:
        prev_num = float(str(prev).replace(',', ''))
    except (TypeError, ValueError):
        prev_num = None
    direction = cell.get('direction')
    period = cell.get('period')
    if direction in (None, 'same'):
        return None

    if cell.get('basis') == 'same-period':
        size = abs(pct) if pct is not None else None
        if size is not None and size >= t['restateCriticalPct']:
            sev = FlagSeverity.CRITICAL
        elif size is None or size >= t['restateWarningPct']:
            sev = FlagSeverity.WARNING
        else:
            sev = FlagSeverity.INFO
        extent = f'{size:.1f}%' if size is not None else 'from zero'
        return sev, 'RESTATEMENT', (
            f'Restated: {period or "this period"} was reported as {_fmt(prev)} in NIRF '
            f'{cell["previousCycle"]}; it is now {extent} {"higher" if direction == "up" else "lower"}.'
        )

    if prev_num and prev_num > 0 and cell.get('change') is not None and prev_num + cell['change'] == 0:
        return FlagSeverity.CRITICAL, 'YOY_CHANGE', (
            f'Dropped to zero from {_fmt(prev)} in {period} (NIRF {cell["previousCycle"]}).'
        )
    if pct is None:
        return None
    if pct <= -t['criticalDropPct'] or pct >= t['criticalRisePct']:
        sev = FlagSeverity.CRITICAL
    elif abs(pct) >= t['warningChangePct']:
        sev = FlagSeverity.WARNING
    else:
        return None
    return sev, 'YOY_CHANGE', (
        f'{"Up" if pct > 0 else "Down"} {abs(pct):.1f}% on {period} ({_fmt(prev)} in NIRF {cell["previousCycle"]}).'
    )


def rule_flags_for_submission(sub, schema, t=None):
    """Candidate flags for one return, as plain dicts (not yet saved)."""
    t = t or thresholds()
    labels = _section_labels(schema, sub.section_id, sub.request.cycle_year, sub.org_unit)
    history = section_history(sub, resolved_section=labels.get('resolved'))
    if not history:
        return []

    out = []
    base = {'submission': sub, 'org_unit': sub.org_unit, 'section_id': sub.section_id}

    def add(kind, sev, message, path, label, prev, cur, pct, details):
        key = ':'.join(str(p) for p in (kind, sub.section_id, sub.org_unit_id,
                                         path.get('blockId'), path.get('rowKey'), path.get('colKey')))
        out.append({**base, 'key': key, 'kind': kind, 'severity': sev, 'message': message, 'path': path,
                    'label': label, 'previous_value': _fmt(prev), 'current_value': _fmt(cur),
                    'change_pct': pct, 'details': details})

    for block_id, rows in history['cells'].items():
        for row_key, cols in rows.items():
            for col_key, cell in cols.items():
                cur = (sub.payload.get(block_id) or {}).get(row_key, {}).get(col_key)
                graded = _grade_change(cell, t)
                if graded is None:
                    continue
                sev, kind, message = graded
                add(kind, sev, message, {'blockId': block_id, 'rowKey': row_key, 'colKey': col_key},
                    _field_label(labels, block_id, row_key, col_key), cell['previous'], cur,
                    cell.get('changePct'), {'basis': cell['basis'], 'period': cell['period'],
                                            'previousCycle': cell['previousCycle']})

    for block_id, qs in history['questions'].items():
        for q_id, cell in qs.items():
            graded = _grade_change({**cell, 'basis': 'prior-period', 'period': 'last cycle'}, t)
            if graded is None:
                continue
            sev, kind, message = graded
            add(kind, sev, message, {'blockId': block_id, 'rowKey': None, 'colKey': q_id},
                _field_label(labels, block_id, col_key=q_id, question=True), cell['previous'],
                (sub.payload.get(block_id) or {}).get(q_id), cell.get('changePct'),
                {'basis': 'question', 'previousCycle': cell['previousCycle']})

    for block_id, rec in history['records'].items():
        pct = rec.get('changePct')
        current = rec['previous'] + (rec.get('change') or 0)
        if rec['previous'] > 0 and current == 0:
            sev = FlagSeverity.CRITICAL
        elif pct is not None and abs(pct) >= t['recordWarningPct']:
            sev = FlagSeverity.WARNING
        else:
            continue
        add('RECORD_COUNT', sev,
            f'{int(current)} row(s) listed against {rec["previous"]} in the NIRF {rec["previousCycle"]} approved return.',
            {'blockId': block_id, 'rowKey': None, 'colKey': None},
            labels['blocks'].get(block_id, {}).get('title', block_id), rec['previous'], int(current), pct,
            {'previousCycle': rec['previousCycle']})
    return out


def cross_check_flags(data_req):
    sev_map = {'critical': FlagSeverity.CRITICAL, 'error': FlagSeverity.CRITICAL, 'warning': FlagSeverity.WARNING}
    out = []
    for check in run_cross_checks(data_req.id, data_req.cycle_year):
        if check.get('passed', True):
            continue
        out.append({
            'submission': None, 'org_unit': None, 'section_id': '',
            'key': f"CROSS_CHECK:{check['id']}", 'kind': 'CROSS_CHECK',
            'severity': sev_map.get(str(check.get('severity')).lower(), FlagSeverity.INFO),
            'message': check.get('message', check['id']), 'path': {'checkId': check['id']},
            'label': f"Cross-check: {check['id']}", 'previous_value': '', 'current_value': '',
            'change_pct': None, 'details': {'check': check},
        })
    return out


# ---------------------------------------------------------------------------
# Scan
# ---------------------------------------------------------------------------

@transaction.atomic
def scan_request(data_req):
    """
    Re-run the rules over a request and reconcile the stored flags:
      * new findings are opened;
      * a reviewed flag whose figure has since changed is reopened;
      * open or escalated flags that are no longer detected are resolved.
    """
    schema_obj = FormSchema.objects.filter(framework='NIRF', is_active=True).first()
    schema = schema_obj.content if schema_obj else {}
    t = thresholds()

    candidates = []
    subs = (SectionSubmission.objects
            .filter(request=data_req, status__in=SCANNED_STATES, not_applicable=False)
            .select_related('request', 'org_unit'))
    for sub in subs:
        candidates.extend(rule_flags_for_submission(sub, schema, t))
    candidates.extend(cross_check_flags(data_req))

    existing = {f.key: f for f in DiscrepancyFlag.objects.filter(request=data_req)}
    now = timezone.now()
    seen, opened, reopened = set(), 0, 0
    for c in candidates:
        seen.add(c['key'])
        flag = existing.get(c['key'])
        if flag is None:
            DiscrepancyFlag.objects.create(request=data_req, **c)
            opened += 1
            continue
        figure_changed = flag.current_value != c['current_value'] or flag.message != c['message']
        for field in ('submission', 'org_unit', 'section_id', 'kind', 'severity', 'message', 'path',
                      'label', 'previous_value', 'current_value', 'change_pct', 'details'):
            setattr(flag, field, c[field])
        if figure_changed and flag.status != FlagStatus.OPEN:
            flag.status = FlagStatus.OPEN
            flag.resolution_note = ''
            flag.resolved_by = None
            flag.resolved_at = None
            reopened += 1
        if figure_changed:
            # An AI note about the old figure no longer applies.
            flag.ai_severity = flag.ai_rationale = flag.ai_question = ''
            flag.ai_log = None
        flag.save()

    resolved = 0
    for key, flag in existing.items():
        if key not in seen and flag.status in (FlagStatus.OPEN, FlagStatus.ESCALATED):
            flag.status = FlagStatus.RESOLVED
            flag.resolution_note = 'No longer detected: the figure was corrected or its baseline changed.'
            flag.resolved_at = now
            flag.save(update_fields=['status', 'resolution_note', 'resolved_at', 'last_seen'])
            resolved += 1

    return {'scannedAt': now.isoformat(), 'candidates': len(candidates),
            'opened': opened, 'reopened': reopened, 'resolved': resolved, 'thresholds': t}


def scan_quietly(data_req):
    """Scan after a submission without ever failing the submission itself."""
    try:
        return scan_request(data_req)
    except Exception:  # noqa: BLE001 - flagging is advisory
        import logging
        logging.getLogger(__name__).exception('Discrepancy scan failed for %s', data_req.pk)
        return None


# ---------------------------------------------------------------------------
# AI review
# ---------------------------------------------------------------------------

SYSTEM_PROMPT = """You review figures an Indian institute (IIT Mandi) is about to submit to the NIRF ranking.
Each item is a discrepancy already found by deterministic rules: a figure that moved sharply against the
department's previously approved figure, a year that was restated, or a failed cross-check.

For each item, judge how likely it is to be a data-entry or reporting error rather than a genuine change,
and help the DORA office decide what to ask the department.

Rules you must follow:
- Use only the data in the items. Do not invent figures, policies, NIRF rules or external facts.
- Do not repeat or compute any number that is not present in that item.
- Only review items you were given, referring to them by their exact "id".
- severity is one of CRITICAL, WARNING, INFO (your assessment; the rule severity is shown separately).
- rationale: at most two short sentences. question: one short question to put to the department.

Reply with JSON only, exactly in this form:
{"reviews": [{"id": "...", "severity": "CRITICAL|WARNING|INFO", "rationale": "...", "question": "..."}]}"""

_NUM = re.compile(r'\d[\d,]*(?:\.\d+)?')


def _allowed_numbers(item):
    """Every numeric token a grounded rationale may quote for this item."""
    allowed = set()

    def add(value):
        if value in (None, ''):
            return
        for token in _NUM.findall(str(value)):
            raw = token.replace(',', '')
            allowed.add(raw)
            try:
                f = abs(float(raw))
            except ValueError:
                continue
            allowed.update({str(f), f'{f:.1f}', f'{f:.0f}', f'{f:.2f}'})
            if f.is_integer():
                allowed.add(str(int(f)))

    for k in ('previous', 'current', 'changePct', 'period', 'previousCycle', 'cycleYear', 'field', 'message'):
        add(item.get(k))
    return allowed


def _ungrounded_numbers(text, allowed):
    """Figures of three or more digits quoted in `text` that the item does not contain."""
    bad = []
    for token in _NUM.findall(text or ''):
        raw = token.replace(',', '')
        digits = re.sub(r'\D', '', raw)
        if len(digits) < 3:
            continue
        variants = {raw}
        try:
            f = abs(float(raw))
            variants |= {str(f), f'{f:.1f}', f'{f:.0f}'}
        except ValueError:
            pass
        if not variants & allowed:
            bad.append(token)
    return bad


def build_ai_items(flags):
    items = []
    for f in flags:
        items.append({
            'id': f.id,
            'kind': f.kind,
            'unit': (f.org_unit.short_name or f.org_unit.name) if f.org_unit else 'Institute-wide',
            'section': f.section_id,
            'field': f.label,
            'period': (f.details or {}).get('period'),
            'previousCycle': (f.details or {}).get('previousCycle'),
            'previous': f.previous_value,
            'current': f.current_value,
            'changePct': f.change_pct,
            'ruleSeverity': f.severity,
            'message': f.message,
        })
    return items


def ai_review(data_req, user=None, limit=None):
    """
    Ask the configured model to annotate the request's open flags.
    Returns a report; never raises for provider problems.
    """
    cfg = ai_client.get_config()
    if cfg is None:
        return {'configured': False, **ai_client.status()}

    limit = limit or int(getattr(settings, 'AI_MAX_FLAGS', 60))
    flags = sorted(
        DiscrepancyFlag.objects.filter(request=data_req, status=FlagStatus.OPEN).select_related('org_unit'),
        key=lambda f: (SEVERITY_ORDER.get(f.severity, 9), f.label),
    )[:limit]
    if not flags:
        return {'configured': True, **cfg.public(), 'sent': 0, 'annotated': 0, 'rejected': 0,
                'message': 'No open flags to review.'}

    items = build_ai_items(flags)
    payload = {'context': {'framework': data_req.framework, 'cycleYear': data_req.cycle_year}, 'items': items}
    user_text = json.dumps(payload, ensure_ascii=False, default=str)
    log = AIRequestLog(
        provider=cfg.provider, model=cfg.model, request=data_req,
        triggered_by=user if getattr(user, 'is_authenticated', False) else None,
        prompt={'system': SYSTEM_PROMPT, 'user': payload},
        prompt_sha256=hashlib.sha256((SYSTEM_PROMPT + '\n' + user_text).encode()).hexdigest(),
        flags_sent=len(items),
    )

    try:
        text, latency = ai_client.complete(cfg, SYSTEM_PROMPT, user_text)
        log.latency_ms = latency
        log.response_text = text[:20000]
        reply = ai_client.parse_json(text)
    except ai_client.AIError as exc:
        log.status = 'ERROR'
        log.error = str(exc)[:2000]
        log.save()
        return {'configured': True, **cfg.public(), 'sent': len(items), 'annotated': 0, 'rejected': 0,
                'error': str(exc), 'logId': log.id,
                'message': 'AI review unavailable; the rule-based flags are unaffected.'}

    by_id = {f.id: f for f in flags}
    item_by_id = {i['id']: i for i in items}
    annotated, rejected, reasons = [], 0, []
    reviews = reply.get('reviews') if isinstance(reply.get('reviews'), list) else []
    for r in reviews:
        if not isinstance(r, dict):
            rejected += 1
            continue
        flag = by_id.get(str(r.get('id')))
        severity = str(r.get('severity', '')).upper()
        rationale = str(r.get('rationale') or '').strip()[:600]
        question = str(r.get('question') or '').strip()[:400]
        if flag is None:
            rejected += 1
            reasons.append(f"unknown id {r.get('id')!r}")
            continue
        if severity not in FlagSeverity.values or not rationale:
            rejected += 1
            reasons.append(f'{flag.id}: missing severity or rationale')
            continue
        bad = _ungrounded_numbers(rationale + ' ' + question, _allowed_numbers(item_by_id[flag.id]))
        if bad:
            rejected += 1
            reasons.append(f'{flag.id}: ungrounded figure(s) {", ".join(bad)}')
            continue
        flag.ai_severity, flag.ai_rationale, flag.ai_question, flag.ai_log = severity, rationale, question, log
        annotated.append(flag)

    log.status = 'OK' if annotated or not reviews else 'INVALID'
    log.flags_annotated = len(annotated)
    log.items_rejected = rejected
    if reasons:
        log.error = '; '.join(reasons)[:2000]
    log.save()
    for flag in annotated:
        flag.save(update_fields=['ai_severity', 'ai_rationale', 'ai_question', 'ai_log', 'last_seen'])

    return {'configured': True, **cfg.public(), 'sent': len(items), 'annotated': len(annotated),
            'rejected': rejected, 'logId': log.id,
            'message': f'{len(annotated)} flag(s) annotated by {cfg.model}; {rejected} reply item(s) rejected.'}


# ---------------------------------------------------------------------------
# Review actions
# ---------------------------------------------------------------------------

class FlagActionError(Exception):
    def __init__(self, message, status=400):
        super().__init__(message)
        self.status = status


@transaction.atomic
def escalate(flag, user, note=''):
    """
    Route a flag back to the department as a correction request (spec 2.10).
    Only a return awaiting review can be sent back; an approved one must be
    reopened on the review screen first, which is itself audited.
    """
    sub = flag.submission
    if sub is None:
        raise FlagActionError('Institute-wide cross-check flags are not tied to one return; dismiss or fix at source.')
    comment = (note or '').strip() or f'Please check {flag.label}: {flag.message}'
    if sub.status == SubmissionStatus.SUBMITTED:
        from_status = sub.status
        sub.status = SubmissionStatus.CORRECTION_REQUESTED
        sub.review_comment = comment
        sub.reviewed_by = user
        sub.reviewed_at = timezone.now()
        sub.save()
        target = DataRequestTarget.objects.filter(request=sub.request, org_unit=sub.org_unit).first()
        if target:
            target.status = TargetStatus.PARTIAL
            target.save(update_fields=['status'])
        SubmissionAuditLog.objects.create(
            submission=sub, actor_type='ADMIN', actor_id=str(user.id), action='REQUEST_CORRECTION',
            delta={'comment': comment, 'fromStatus': from_status, 'toStatus': sub.status,
                   'revision': sub.revision, 'discrepancyFlag': flag.id},
        )
    elif sub.status != SubmissionStatus.CORRECTION_REQUESTED:
        raise FlagActionError(
            f"The return is '{sub.status}'. Reopen it from the review screen before raising a correction.", 409,
        )
    flag.status = FlagStatus.ESCALATED
    flag.resolution_note = comment
    flag.resolved_by = user
    flag.resolved_at = timezone.now()
    flag.save()
    return flag


def dismiss(flag, user, note):
    note = (note or '').strip()
    if not note:
        raise FlagActionError('Say why the figure is acceptable; the note is kept for the auditor.')
    flag.status = FlagStatus.DISMISSED
    flag.resolution_note = note
    flag.resolved_by = user
    flag.resolved_at = timezone.now()
    flag.save()
    return flag


def reopen(flag):
    flag.status = FlagStatus.OPEN
    flag.resolution_note = ''
    flag.resolved_by = None
    flag.resolved_at = None
    flag.save()
    return flag
