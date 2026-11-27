"""
Historical value comparison (spec 2.6).

"Real-time contextual display of historically submitted values alongside new
data entries (e.g. Previous: X, New: Y, Change: Increase/Decrease)."

The baseline for a return is the same unit's *approved* return for the same
section in the most recent earlier cycle - approved only, so the comparison is
grounded in figures DORA has signed off, never in another draft.

NIRF grids are keyed by period ('2025-26', '2024', ...), and consecutive
cycles overlap: cycle 2027 asks for 2025-26, 2024-25 and 2023-24, while 2026
asked for 2024-25, 2023-24 and 2022-23. So each cell is compared on one of two
bases:

  same-period   the previous cycle reported this very period. A difference
                is a *restatement* - the department now gives a different
                figure for a year it already reported - which is exactly the
                kind of discrepancy a reviewer wants to see.
  prior-period  the period is new this cycle (the latest year). It is compared
                with the previous cycle's figure for the year before, which is
                the year-on-year change.

Non-year axes (programmes, fixed rows) match on their own keys. Questionnaire
answers match by question, and records blocks by row count.

The same comparison feeds the discrepancy flagging (discrepancies.py), so the
officer, the reviewer and the flags all see one set of numbers.
"""
import re
from decimal import Decimal, InvalidOperation

from .models import SectionSubmission, SubmissionStatus

_ACADEMIC = re.compile(r'^(\d{4})-(\d{2})$')
_CALENDAR = re.compile(r'^(\d{4})$')


def prior_period(key):
    """'2025-26' -> '2024-25', '2025' -> '2024'; None for a non-period key."""
    key = str(key)
    m = _ACADEMIC.match(key)
    if m:
        start = int(m.group(1)) - 1
        return f'{start}-{(start + 1) % 100:02d}'
    m = _CALENDAR.match(key)
    if m:
        return str(int(m.group(1)) - 1)
    return None


def is_period(key):
    return prior_period(key) is not None


def to_number(value):
    """A float for numeric input (incl. '1,20,000' and ' 42 '), else None."""
    if value is None or isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return float(value)
    text = str(value).strip().replace(',', '').replace('₹', '').strip()
    if not text:
        return None
    try:
        return float(Decimal(text))
    except (InvalidOperation, ValueError):
        return None


def change_between(previous, current):
    """Absolute and percentage change, and its direction, or Nones."""
    p, c = to_number(previous), to_number(current)
    if p is None or c is None:
        return {'change': None, 'changePct': None, 'direction': None}
    delta = c - p
    pct = None if p == 0 else round(delta / abs(p) * 100, 1)
    direction = 'same' if delta == 0 else ('up' if delta > 0 else 'down')
    return {'change': round(delta, 2), 'changePct': pct, 'direction': direction}


def previous_submission(sub):
    """The same unit's latest approved return for this section from an earlier cycle."""
    return (
        SectionSubmission.objects
        .filter(
            org_unit_id=sub.org_unit_id,
            section_id=sub.section_id,
            status=SubmissionStatus.APPROVED,
            not_applicable=False,
            request__cycle_year__lt=sub.request.cycle_year,
        )
        .select_related('request')
        .order_by('-request__cycle_year', '-reviewed_at', '-updated_at')
        .first()
    )


def _cell(previous_value, current_value, basis, period, prev_sub):
    entry = {
        'previous': previous_value,
        'basis': basis,
        'period': period,
        'previousCycle': prev_sub.request.cycle_year,
        **change_between(previous_value, current_value),
    }
    entry['restated'] = (
        basis == 'same-period'
        and current_value not in (None, '')
        and entry['direction'] not in (None, 'same')
    )
    return entry


def _lookup_grid(prev_grid, row_key, col_key):
    """Find the comparable previous cell: same period first, then prior period."""
    prev_row = prev_grid.get(row_key)
    if isinstance(prev_row, dict) and col_key in prev_row and prev_row[col_key] not in (None, ''):
        return prev_row[col_key], 'same-period', col_key if is_period(col_key) else row_key

    # The period is on one of the two axes; shift whichever it is.
    col_prior = prior_period(col_key)
    if col_prior and isinstance(prev_row, dict) and prev_row.get(col_prior) not in (None, ''):
        return prev_row[col_prior], 'prior-period', col_prior
    row_prior = prior_period(row_key)
    if row_prior:
        shifted = prev_grid.get(row_prior)
        if isinstance(shifted, dict) and shifted.get(col_key) not in (None, ''):
            return shifted[col_key], 'prior-period', row_prior
    return None, None, None


def _axes(block):
    """Row and column keys of a grid block, from the resolved schema when available."""
    rows = block.get('resolvedRows') or (block.get('rowAxis') or {}).get('rows') or []
    cols = block.get('resolvedColumns') or (block.get('columnAxis') or {}).get('fields') or []
    return [str(r['id']) for r in rows if 'id' in r], [str(c['id']) for c in cols if 'id' in c]


def compare_payloads(current_payload, current_records, prev_sub, resolved_section=None):
    """
    The per-cell comparison of a return against a previous approved one.

    With the resolved section schema, every cell of the current form is
    covered, including ones not typed yet - which is what lets the portal show
    "Previous: X" beside an empty input. Without it, the keys present in the
    two payloads are used.
    """
    cells, questions, records = {}, {}, {}
    current_payload = current_payload or {}
    prev_payload = prev_sub.payload or {}

    if resolved_section is not None:
        grid_axes = {
            b['id']: _axes(b) for b in resolved_section.get('blocks', []) if b.get('kind') == 'grid'
        }
        question_ids = {
            b['id']: [q['id'] for q in b.get('questions', [])]
            for b in resolved_section.get('blocks', []) if b.get('kind') == 'questionnaire'
        }
    else:
        grid_axes, question_ids = {}, {}
        for block_id in set(current_payload) | set(prev_payload):
            cur_block = current_payload.get(block_id) or {}
            prev_block = prev_payload.get(block_id) or {}
            if not isinstance(prev_block, dict):
                continue
            if any(isinstance(v, dict) for v in list(prev_block.values()) + list(cur_block.values())):
                rows = list(cur_block) or list(prev_block)
                cols = sorted({c for r in cur_block.values() if isinstance(r, dict) for c in r})
                grid_axes[block_id] = (rows, cols)
            else:
                question_ids[block_id] = list(prev_block)

    for block_id, (row_keys, col_keys) in grid_axes.items():
        prev_block = prev_payload.get(block_id)
        if not isinstance(prev_block, dict):
            continue
        cur_block = current_payload.get(block_id) or {}
        out = {}
        for row_key in row_keys:
            cur_row = cur_block.get(row_key) if isinstance(cur_block.get(row_key), dict) else {}
            for col_key in col_keys:
                prev_val, basis, period = _lookup_grid(prev_block, row_key, col_key)
                if basis is None:
                    continue
                out.setdefault(row_key, {})[col_key] = _cell(
                    prev_val, cur_row.get(col_key), basis, period, prev_sub
                )
        if out:
            cells[block_id] = out

    for block_id, q_ids in question_ids.items():
        prev_block = prev_payload.get(block_id)
        if not isinstance(prev_block, dict):
            continue
        cur_block = current_payload.get(block_id) or {}
        out = {}
        for q_id in q_ids:
            prev_val = prev_block.get(q_id)
            if prev_val in (None, '', []):
                continue
            out[q_id] = _cell(prev_val, cur_block.get(q_id), 'same-period', None, prev_sub)
        if out:
            questions[block_id] = out

    prev_records = {}
    for rec in prev_sub.records.all():
        prev_records[rec.block_id] = prev_records.get(rec.block_id, 0) + 1
    for block_id, prev_count in prev_records.items():
        current_count = len((current_records or {}).get(block_id) or [])
        records[block_id] = {
            'previous': prev_count,
            'previousCycle': prev_sub.request.cycle_year,
            **change_between(prev_count, current_count),
        }

    return {'cells': cells, 'questions': questions, 'records': records}


def section_history(sub, current_records=None, resolved_section=None):
    """
    What the portal and the review screen render next to each input. None if
    there is no approved earlier return to compare with.
    """
    prev = previous_submission(sub)
    if prev is None:
        return None
    if current_records is None:
        current_records = {}
        for rec in sub.records.all():
            current_records.setdefault(rec.block_id, []).append(rec.data)
    comparison = compare_payloads(sub.payload or {}, current_records, prev, resolved_section)
    return {
        'previousCycle': prev.request.cycle_year,
        'previousReference': prev.request.reference,
        'previousSubmissionId': prev.id,
        'approvedAt': prev.reviewed_at,
        **comparison,
    }


def notable_changes(history, threshold_pct=25.0):
    """
    Flattened list of the cells a reviewer should look at: restatements of an
    already-reported period, and year-on-year moves beyond `threshold_pct`.
    """
    if not history:
        return []
    out = []
    for block_id, rows in history.get('cells', {}).items():
        for row_key, cols in rows.items():
            for col_key, cell in cols.items():
                big = cell['changePct'] is not None and abs(cell['changePct']) >= threshold_pct
                if cell['restated'] or (cell['basis'] == 'prior-period' and big):
                    out.append({'blockId': block_id, 'rowKey': row_key, 'colKey': col_key, **cell})
    for block_id, qs in history.get('questions', {}).items():
        for q_id, cell in qs.items():
            if cell['changePct'] is not None and abs(cell['changePct']) >= threshold_pct:
                out.append({'blockId': block_id, 'rowKey': None, 'colKey': q_id, **cell})
    return out


def unit_history(unit_id, section_id, before_cycle=None, cycles=3):
    """
    The last `cycles` approved returns for one unit and section, oldest first:
    "easy backend querying of at least the previous three years" (2.6).
    """
    qs = (
        SectionSubmission.objects
        .filter(org_unit_id=unit_id, section_id=section_id, status=SubmissionStatus.APPROVED)
        .select_related('request')
        .order_by('-request__cycle_year', '-reviewed_at')
    )
    if before_cycle is not None:
        qs = qs.filter(request__cycle_year__lt=before_cycle)
    seen, rows = set(), []
    for sub in qs:
        year = sub.request.cycle_year
        if year in seen:
            continue
        seen.add(year)
        rows.append({
            'cycleYear': year,
            'reference': sub.request.reference,
            'submissionId': sub.id,
            'notApplicable': sub.not_applicable,
            'approvedAt': sub.reviewed_at,
            'payload': sub.payload or {},
            'recordCounts': _record_counts(sub),
        })
        if len(rows) >= cycles:
            break
    return list(reversed(rows))


def _record_counts(sub):
    counts = {}
    for rec in sub.records.all():
        counts[rec.block_id] = counts.get(rec.block_id, 0) + 1
    return counts
