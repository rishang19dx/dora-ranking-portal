"""
Change capture for the submission audit trail (spec 2.11).

The spec requires every edit to be recorded "including the old value, new
value, actor, and timestamp". Actor and timestamp come from the audit row
itself; this module produces the old/new pairs.

Two constraints shape it:

* PII stays out. The project's standing rule is that personal fields (faculty
  names, emails, employee IDs...) are never written to audit deltas. A change
  to such a field is still recorded - the auditor can see *that* it changed -
  but both values are redacted. PII fields are read from the schema's `pii`
  flags rather than a hand-kept list, so new PII fields are covered by default.
* Deltas stay bounded. A bulk import can touch thousands of cells; the first
  MAX_CHANGES are kept verbatim and the total is always recorded.
"""

from typing import Any, Dict, Iterable, List, Optional, Set

MAX_CHANGES = 200
REDACTED = '[redacted]'


def schema_pii_fields(section_def: Optional[dict]) -> Set[str]:
    """Every field id the section's schema flags as personal data."""
    pii: Set[str] = set()
    for block in (section_def or {}).get('blocks', []) or []:
        candidates: Iterable[dict] = (
            (block.get('fields') or [])
            + ((block.get('columnAxis') or {}).get('fields') or [])
            + (block.get('questions') or [])
        )
        for f in candidates:
            if isinstance(f, dict) and f.get('pii'):
                pii.add(f['id'])
    return pii


def _same(a: Any, b: Any) -> bool:
    if a == b:
        return True
    # "12" from one client and 12 from another are the same fact.
    blank = (None, '')
    if a in blank and b in blank:
        return True
    try:
        return float(a) == float(b)
    except (TypeError, ValueError):
        return False


def _record(change: Dict[str, Any], field: str, old: Any, new: Any, pii: Set[str]) -> Dict[str, Any]:
    if field in pii:
        change.update({'field': field, 'old': REDACTED, 'new': REDACTED, 'pii': True})
    else:
        change.update({'field': field, 'old': old, 'new': new})
    return change


def diff_record(old: Optional[dict], new: Optional[dict], pii: Set[str]) -> List[Dict[str, Any]]:
    """Field-level changes between two flat dicts (one record or one grid row)."""
    old = old or {}
    new = new or {}
    changes = []
    for field in sorted(set(old) | set(new)):
        if not _same(old.get(field), new.get(field)):
            changes.append(_record({}, field, old.get(field), new.get(field), pii))
    return changes


def _as_rows(block: Any) -> Dict[str, dict]:
    """A grid block keyed by row id, whichever shape it arrived in."""
    if isinstance(block, dict):
        if block and all(isinstance(v, dict) for v in block.values()):
            return {str(k): v for k, v in block.items()}
        return {'': block}  # questionnaire: one flat answer set
    if isinstance(block, list):
        out = {}
        for idx, row in enumerate(block):
            if isinstance(row, dict):
                key = row.get('id') or row.get('programmeId') or row.get('programme') or f'row{idx}'
                out[str(key)] = row
        return out
    return {}


def diff_payload(old_payload: Optional[dict], new_payload: Optional[dict], pii: Set[str]) -> Dict[str, Any]:
    """
    Cell-level changes across a whole section payload.

    Returns {'changes': [...], 'changeCount': n, 'truncated': bool}, each change
    carrying block, row, field, old and new.
    """
    old_payload = old_payload if isinstance(old_payload, dict) else {}
    new_payload = new_payload if isinstance(new_payload, dict) else {}

    changes: List[Dict[str, Any]] = []
    total = 0
    for block_id in sorted(set(old_payload) | set(new_payload)):
        old_rows = _as_rows(old_payload.get(block_id))
        new_rows = _as_rows(new_payload.get(block_id))
        for row_key in sorted(set(old_rows) | set(new_rows)):
            for change in diff_record(old_rows.get(row_key), new_rows.get(row_key), pii):
                total += 1
                if len(changes) < MAX_CHANGES:
                    change = {'block': block_id, 'row': row_key or None, **change}
                    changes.append(change)

    return {'changes': changes, 'changeCount': total, 'truncated': total > len(changes)}
