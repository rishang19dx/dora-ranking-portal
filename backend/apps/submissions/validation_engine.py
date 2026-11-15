"""
Validation and derive engine for NIRF DCS form schemas.
Enforces type constraints, field requirements, custom validation rules, and computed fields.
"""

import re as _re
from datetime import datetime, date

def amount_in_words_inr(number) -> str:
    if number is None or number == '':
        return ''
    try:
        n = int(round(float(number)))
    except (ValueError, TypeError):
        return ''
    if n == 0:
        return 'Zero'
    if n < 0:
        return 'Minus ' + amount_in_words_inr(-n)

    ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
            'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
            'Seventeen', 'Eighteen', 'Nineteen']
    tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']

    def two_digits(num):
        if num < 20:
            return ones[num]
        return tens[num // 10] + ((' ' + ones[num % 10]) if num % 10 != 0 else '')

    def three_digits(num):
        h = num // 100
        rem = num % 100
        res = ''
        if h > 0:
            res += ones[h] + ' Hundred'
        if rem > 0:
            res += (' ' if res else '') + two_digits(rem)
        return res

    parts = []
    # Crores: >= 10,000,000
    crores = n // 10000000
    n %= 10000000
    if crores > 0:
        parts.append(amount_in_words_inr(crores) + ' Crore')

    # Lakhs: >= 100,000
    lakhs = n // 100000
    n %= 100000
    if lakhs > 0:
        parts.append(two_digits(lakhs) + ' Lakh')

    # Thousands: >= 1,000
    thousands = n // 1000
    n %= 1000
    if thousands > 0:
        parts.append(two_digits(thousands) + ' Thousand')

    # Remaining hundreds / tens / ones
    if n > 0:
        parts.append(three_digits(n))

    return ' '.join(parts).strip()

def evaluate_derive(field_def: dict, row_data: dict, row_idx: int = 1, context: dict = None) -> any:
    derive_cfg = field_def.get('derive')
    if not derive_cfg:
        return row_data.get(field_def['id'])

    fn = derive_cfg.get('fn')
    if fn == 'sum':
        fields_to_sum = derive_cfg.get('of', [])
        total = 0
        for f in fields_to_sum:
            val = row_data.get(f)
            if val is not None and val != '':
                try:
                    total += float(val)
                except (ValueError, TypeError):
                    pass
        # If all fields integer, return int
        return int(total) if total.is_integer() else round(total, 3)

    elif fn == 'amountInWordsInr':
        target_f = derive_cfg.get('of')
        return amount_in_words_inr(row_data.get(target_f))

    elif fn == 'rowNumber':
        return row_idx

    elif fn == 'submittingUnit':
        return (context or {}).get('submittingUnitId', '')

    elif fn == 'lookup':
        lookup_table = (context or {}).get('lookups', {})
        sec = derive_cfg.get('section')
        blk = derive_cfg.get('block')
        row_key = derive_cfg.get('row')
        col_key = derive_cfg.get('col')
        # Substitute variables e.g. $programme, $entryAcademicYear
        if row_key and row_key.startswith('$'):
            row_key = row_data.get(row_key[1:])
        if col_key and col_key.startswith('$'):
            col_key = row_data.get(col_key[1:])
        return lookup_table.get(f"{sec}:{blk}:{row_key}:{col_key}")

    return row_data.get(field_def['id'])

def parse_number(val):
    if val is None or val == '':
        return 0.0
    try:
        return float(val)
    except (ValueError, TypeError):
        return 0.0

def parse_date(val):
    if not val:
        return None
    if isinstance(val, (datetime, date)):
        return val
    try:
        return datetime.fromisoformat(str(val).replace('Z', '+00:00')).date()
    except Exception:
        try:
            return datetime.strptime(str(val)[:10], '%Y-%m-%d').date()
        except Exception:
            return None

NUMERIC_TYPES = {'integer', 'decimal', 'currencyInr', 'percent'}
OTHER_SENTINEL = 'OTHER'

def _is_blank(value) -> bool:
    return value is None or (isinstance(value, str) and value.strip() == '')

def _option_values(field_def: dict, enums: dict = None) -> list:
    options = field_def.get('options')
    if not options and enums and field_def.get('enum') in (enums or {}):
        options = enums[field_def['enum']].get('options', [])
    return [o.get('value') if isinstance(o, dict) else o for o in (options or [])]

def _allows_other(field_def: dict, enums: dict = None) -> bool:
    if 'allowOther' in field_def:
        return bool(field_def['allowOther'])
    if enums and field_def.get('enum') in (enums or {}):
        return bool(enums[field_def['enum']].get('allowOther'))
    return False

def check_field_value(field_def: dict, value, enums: dict = None):
    """
    Deterministic type and bounds check for one entered value (spec 2.8).

    Returns an error message, or None when the value is acceptable. Blank
    values pass here - whether a value is *required* is checked separately -
    and derived values are never checked, since the officer did not type them.

    This is the server's authoritative check: the form renderer constrains
    inputs too, but anything reaching the API (a scripted client, a stale tab,
    a spreadsheet import) must be held to the same rules.
    """
    if field_def.get('derive') or _is_blank(value):
        return None

    label = field_def.get('label') or field_def.get('id') or 'Value'
    ftype = field_def.get('type') or 'text'

    if ftype in NUMERIC_TYPES:
        if isinstance(value, bool):
            return f"'{label}' must be a number."
        try:
            number = float(str(value).replace(',', '').strip())
        except (TypeError, ValueError):
            return f"'{label}' must be a number."
        if number != number or number in (float('inf'), float('-inf')):
            return f"'{label}' must be a finite number."

        if ftype == 'integer' and not number.is_integer():
            return f"'{label}' must be a whole number."

        minimum = field_def.get('min')
        maximum = field_def.get('max')
        if ftype == 'percent':
            minimum = 0 if minimum is None else minimum
            maximum = 100 if maximum is None else maximum
        if ftype == 'currencyInr' and minimum is None:
            minimum = 0

        if minimum is not None and number < minimum:
            if minimum == 0:
                return f"'{label}' cannot be negative."
            return f"'{label}' must be at least {minimum}."
        if maximum is not None and number > maximum:
            if ftype == 'percent':
                return f"'{label}' cannot exceed {maximum}%."
            return f"'{label}' must be at most {maximum}."
        return None

    if ftype == 'boolean':
        if isinstance(value, bool):
            return None
        if str(value).strip().lower() in ('true', 'false', 'yes', 'no', '1', '0'):
            return None
        return f"'{label}' must be Yes or No."

    if ftype == 'enum':
        allowed = _option_values(field_def, enums)
        if not allowed:
            return None
        if value in allowed:
            return None
        if _allows_other(field_def, enums) and value == OTHER_SENTINEL:
            return None
        return f"'{label}' has an unrecognised option: {value!r}."

    if ftype == 'multiEnum':
        if not isinstance(value, list):
            return f"'{label}' must be a list of options."
        allowed = _option_values(field_def, enums)
        if not allowed:
            return None
        other_ok = _allows_other(field_def, enums)
        bad = [v for v in value if v not in allowed and not (other_ok and v == OTHER_SENTINEL)]
        if bad:
            return f"'{label}' has unrecognised option(s): {', '.join(map(str, bad))}."
        return None

    if ftype == 'year':
        text = str(value).strip()
        if not (text.isdigit() and len(text) == 4 and 1900 <= int(text) <= 2100):
            return f"'{label}' must be a four-digit year."
        return None

    if ftype == 'date':
        if parse_date(value) is None:
            return f"'{label}' must be a valid date."
        return None

    if ftype in ('text', 'longText'):
        max_len = field_def.get('maxLength')
        if max_len is not None and len(str(value)) > max_len:
            return f"'{label}' must be at most {max_len} characters."
        return None

    return None


# Abbreviations that recur in departmental spreadsheets. Expanded token-wise
# before matching, so "Asst. Prof." and "Assistant Professor" land on the same
# canonical option (spec 2.7: normalising variations in designation).
_TOKEN_EXPANSIONS = {
    'asst': 'assistant',
    'assoc': 'associate',
    'prof': 'professor',
    'profs': 'professor',
    'f': 'female',
    'm': 'male',
}

def _slug(text) -> str:
    raw = _re.sub(r'[^a-z0-9]+', ' ', str(text).lower().replace('.', ' ')).split()
    return '_'.join(_TOKEN_EXPANSIONS.get(tok, tok) for tok in raw)

def normalize_import_value(field_def: dict, raw, enums: dict = None):
    """
    Coerce one spreadsheet cell to the schema's canonical representation.

    Spreadsheets carry human text ("Professor", "Yes", "1,20,000"); the form
    stores canonical values ("professor", True, 120000). Without this step an
    imported record and a typed one disagree on the same fact.

    Returns (value, other_text). `other_text` is set only when an enum allows
    'Other' and the cell matched no option. A value that cannot be coerced is
    returned unchanged so the validator can flag it against the row.
    """
    if isinstance(raw, str):
        raw = raw.strip()
    if raw is None or raw == '':
        return None, None

    ftype = field_def.get('type') or 'text'

    if ftype in NUMERIC_TYPES:
        if isinstance(raw, bool):
            return raw, None
        if isinstance(raw, (int, float)):
            number = float(raw)
        else:
            try:
                number = float(str(raw).replace(',', '').replace('Rs.', '').replace('₹', '').strip())
            except ValueError:
                return raw, None
        if ftype == 'integer' and number.is_integer():
            return int(number), None
        return number, None

    if ftype == 'boolean':
        if isinstance(raw, bool):
            return raw, None
        text = str(raw).strip().lower()
        if text in ('true', 'yes', 'y', '1'):
            return True, None
        if text in ('false', 'no', 'n', '0'):
            return False, None
        return raw, None

    if ftype == 'enum':
        options = field_def.get('options')
        if not options and enums and field_def.get('enum') in enums:
            options = enums[field_def['enum']].get('options', [])
        options = options or []
        target = _slug(raw)
        for opt in options:
            value = opt.get('value') if isinstance(opt, dict) else opt
            label = opt.get('label', value) if isinstance(opt, dict) else opt
            if raw == value or target in (_slug(value), _slug(label)):
                return value, None
        if _allows_other(field_def, enums):
            return OTHER_SENTINEL, str(raw)
        return raw, None

    if ftype == 'multiEnum':
        parts = raw if isinstance(raw, list) else _re.split(r'[;,|]', str(raw))
        single = dict(field_def, type='enum')
        out, others = [], []
        for part in parts:
            value, other = normalize_import_value(single, part, enums)
            if value is not None:
                out.append(value)
            if other:
                others.append(other)
        return out, ('; '.join(others) or None)

    if ftype == 'date':
        if isinstance(raw, (datetime, date)):
            return (raw.date() if isinstance(raw, datetime) else raw).isoformat(), None
        parsed = parse_date(raw)
        if parsed is None:
            for fmt in ('%d-%m-%Y', '%d/%m/%Y', '%d.%m.%Y'):
                try:
                    parsed = datetime.strptime(str(raw), fmt).date()
                    break
                except ValueError:
                    continue
        return (parsed.isoformat() if parsed else raw), None

    if ftype == 'year':
        if isinstance(raw, float) and raw.is_integer():
            return int(raw), None
        text = str(raw).strip()
        return (int(text) if text.isdigit() else raw), None

    return (str(raw) if not isinstance(raw, str) else raw), None

def validate_rule(rule_cfg: dict, row_data: dict) -> bool:
    """
    Evaluates a single validation rule. Returns True if valid, False if violated.
    """
    op = rule_cfg.get('op')
    if op == 'sumEquals':
        target_field = rule_cfg.get('target')
        parts = rule_cfg.get('parts', [])
        target_val = parse_number(row_data.get(target_field))
        parts_sum = sum(parse_number(row_data.get(p)) for p in parts)
        tolerance_pct = rule_cfg.get('tolerancePct', 0)
        if tolerance_pct > 0 and target_val > 0:
            diff_pct = abs(target_val - parts_sum) / target_val * 100.0
            return diff_pct <= tolerance_pct
        return round(target_val, 2) == round(parts_sum, 2)

    elif op == 'lte':
        left = parse_number(row_data.get(rule_cfg.get('left')))
        right = parse_number(row_data.get(rule_cfg.get('right')))
        return left <= right

    elif op == 'lteSum':
        left_parts = rule_cfg.get('leftParts', [])
        right_parts = rule_cfg.get('rightParts', [])
        left_sum = sum(parse_number(row_data.get(p)) for p in left_parts)
        right_sum = sum(parse_number(row_data.get(p)) for p in right_parts)
        return left_sum <= right_sum

    elif op == 'requiredIf':
        field = rule_cfg.get('field')
        when_cfg = rule_cfg.get('when', {})
        when_field = when_cfg.get('field')
        when_eq = when_cfg.get('eq')
        actual_when_val = row_data.get(when_field)
        if actual_when_val == when_eq:
            val = row_data.get(field)
            return val is not None and str(val).strip() != ''
        return True

    elif op == 'dateOrder':
        start_val = parse_date(row_data.get(rule_cfg.get('start')))
        end_val = parse_date(rule_cfg.get('end') and row_data.get(rule_cfg.get('end')))
        if start_val and end_val:
            return start_val <= end_val
        return True

    return True

def validate_block_data(block_def: dict, block_data: any, context: dict = None) -> tuple[list, list]:
    """
    Validates a block's data against the schema definition.
    Returns (errors, warnings) where each item is a dict with details.
    """
    errors = []
    warnings = []
    kind = block_def.get('kind')

    if kind == 'questionnaire':
        data_dict = block_data if isinstance(block_data, dict) else {}
        questions = block_def.get('questions', [])
        enums = (context or {}).get('enums')
        for q in questions:
            qid = q['id']
            val = data_dict.get(qid)
            if q.get('required') and (val is None or val == ''):
                errors.append({
                    'blockId': block_def['id'],
                    'field': qid,
                    'message': f"'{q['label']}' is required."
                })
                continue
            problem = check_field_value(q, val, enums)
            if problem:
                errors.append({'blockId': block_def['id'], 'field': qid, 'message': problem})
            elif val == OTHER_SENTINEL and _allows_other(q, enums) and _is_blank(data_dict.get(f'{qid}_other')):
                errors.append({
                    'blockId': block_def['id'],
                    'field': f'{qid}_other',
                    'message': f"Specify the 'Other' option for '{q['label']}'.",
                })
        for v in block_def.get('validations', []):
            if not validate_rule(v['rule'], data_dict):
                item = {
                    'blockId': block_def['id'],
                    'validationId': v['id'],
                    'message': v.get('message', 'Validation rule failed.')
                }
                if v.get('severity') == 'error':
                    errors.append(item)
                else:
                    warnings.append(item)

    elif kind == 'grid':
        if isinstance(block_data, dict):
            keyed_rows = [(k, v) for k, v in block_data.items()]
        elif isinstance(block_data, list):
            keyed_rows = [(_row_id(r, idx), r) for idx, r in enumerate(block_data)]
        else:
            keyed_rows = []
        rows_data = [r for _, r in keyed_rows]

        col_axis = block_def.get('columnAxis', {})
        fields = block_def.get('resolvedColumns') or col_axis.get('fields', [])
        rules = block_def.get('validations', [])
        enums = (context or {}).get('enums')

        # Fixed rows may override the shared cell type (a words row is text)
        # or be derived entirely; both change what a cell may legally hold.
        row_defs = {
            str(r.get('id')): r
            for r in (block_def.get('rowAxis', {}) or {}).get('rows', []) or []
            if isinstance(r, dict)
        }

        for idx, (row_key, row) in enumerate(keyed_rows):
            if isinstance(row, dict):
                row_def = row_defs.get(str(row_key), {})
                row_label = row_def.get('label') or row_key
                for f in fields:
                    val = row.get(f['id'])
                    if f.get('required') and not f.get('derive'):
                        if val is None or val == '':
                            errors.append({
                                'blockId': block_def['id'],
                                'row': row_key,
                                'field': f['id'],
                                'message': f"Field '{f.get('label', f['id'])}' is required."
                            })
                            continue

                    effective = dict(f)
                    if row_def.get('derive'):
                        effective['derive'] = row_def['derive']
                    if row_def.get('type'):
                        effective['type'] = row_def['type']
                        for bound in ('min', 'max'):
                            effective.pop(bound, None)
                            if bound in row_def:
                                effective[bound] = row_def[bound]
                    # Name the cell the way the officer sees it: row, then column.
                    if col_axis.get('type') == 'years':
                        effective['label'] = f"{row_label} ({f.get('label', f['id'])})"
                    problem = check_field_value(effective, val, enums)
                    if problem:
                        errors.append({
                            'blockId': block_def['id'],
                            'row': row_key,
                            'field': f['id'],
                            'message': problem,
                        })

            # Check row-level validation rules
            for v in rules:
                rule_cfg = v['rule']
                if rule_cfg.get('axis') == 'row':
                    continue  # Column vs column across rows handled separately if needed
                if not validate_rule(rule_cfg, row):
                    item = {
                        'blockId': block_def['id'],
                        'row': idx,
                        'validationId': v['id'],
                        'message': v.get('message', 'Validation failed.')
                    }
                    if v.get('severity') == 'error':
                        errors.append(item)
                    else:
                        warnings.append(item)

    elif kind == 'records':
        records = block_data if isinstance(block_data, list) else []
        fields = block_def.get('fields', [])
        rules = block_def.get('validations', [])
        min_rows = block_def.get('minRows', 0)

        if len(records) < min_rows and not block_def.get('allowEmpty'):
            errors.append({
                'blockId': block_def['id'],
                'message': f"At least {min_rows} row(s) required in {block_def.get('title')}."
            })

        enums = (context or {}).get('enums')
        for idx, row in enumerate(records):
            for f in fields:
                fid = f['id']
                val = row.get(fid)
                if f.get('required') and (val is None or str(val).strip() == ''):
                    errors.append({
                        'blockId': block_def['id'],
                        'row': idx,
                        'field': fid,
                        'message': f"Field '{f['label']}' is required on row {idx + 1}."
                    })
                    continue
                problem = check_field_value(f, val, enums)
                if problem:
                    errors.append({
                        'blockId': block_def['id'],
                        'row': idx,
                        'field': fid,
                        'message': f"{problem} (row {idx + 1})",
                    })

            for v in rules:
                if not validate_rule(v['rule'], row):
                    item = {
                        'blockId': block_def['id'],
                        'row': idx,
                        'validationId': v['id'],
                        'message': v.get('message', 'Validation failed.')
                    }
                    if v.get('severity') == 'error':
                        errors.append(item)
                    else:
                        warnings.append(item)

    return errors, warnings


def _row_id(row, fallback=None):
    for key in ('id', 'rowId', 'programmeId', 'programme', 'nirfLevel'):
        if isinstance(row, dict) and row.get(key):
            return row[key]
    return fallback

def _grid_rows_as_map(block_data):
    """
    Normalise a grid payload to (ordered_keys, {key: row_dict}).

    Payloads arrive either keyed by row id or as a list of row objects,
    depending on which client wrote them, so both shapes are accepted.
    """
    if isinstance(block_data, dict):
        keys = list(block_data.keys())
        return keys, {k: (dict(v) if isinstance(v, dict) else {}) for k, v in block_data.items()}
    if isinstance(block_data, list):
        keys = []
        out = {}
        for idx, row in enumerate(block_data):
            if not isinstance(row, dict):
                continue
            key = _row_id(row, f'row{idx}')
            keys.append(key)
            out[key] = dict(row)
        return keys, out
    return [], {}

def apply_block_derives(block_def: dict, block_data, context: dict = None):
    """
    Compute every derived value a block declares and write it into the data.

    The schema expresses derives in three shapes and each needs its own
    traversal, which is why this cannot simply call evaluate_derive once:

      * grid with field columns  - the derive sits on a column and reads
        sibling columns of the same row (e.g. Total = Male + Female).
      * grid with year columns   - the derive sits on a fixed row and reads
        the same year of a sibling row (e.g. Amount Received in Words).
      * records                  - the derive sits on a field of each record
        (e.g. the serial number, the submitting unit).

    Returns the data in the same shape it was given.
    """
    context = context or {}
    kind = block_def.get('kind')

    if kind == 'records':
        if not isinstance(block_data, list):
            return block_data
        derived_fields = [f for f in block_def.get('fields', []) if f.get('derive')]
        if not derived_fields:
            return block_data
        out = []
        for idx, rec in enumerate(block_data):
            if not isinstance(rec, dict):
                out.append(rec)
                continue
            row = dict(rec)
            for f in derived_fields:
                row[f['id']] = evaluate_derive(f, row, idx + 1, context)
            out.append(row)
        return out

    if kind != 'grid':
        return block_data

    col_axis = block_def.get('columnAxis', {})
    col_type = col_axis.get('type')
    was_list = isinstance(block_data, list)
    keys, rows = _grid_rows_as_map(block_data)

    if col_type == 'fields':
        derived_cols = [f for f in col_axis.get('fields', []) if f.get('derive')]
        if not derived_cols:
            return block_data
        for key in keys:
            row = rows[key]
            for f in derived_cols:
                row[f['id']] = evaluate_derive(f, row, keys.index(key) + 1, context)

    elif col_type == 'years':
        row_axis = block_def.get('rowAxis', {})
        if row_axis.get('type') != 'fixed':
            return block_data
        derived_rows = [r for r in row_axis.get('rows', []) if r.get('derive')]
        if not derived_rows:
            return block_data

        # Year columns the resolver produced, else the raw year keys present.
        year_cols = [c['id'] for c in (block_def.get('resolvedColumns') or [])]
        if not year_cols:
            seen = []
            for row in rows.values():
                for k in row:
                    if k not in seen and str(k).strip().lstrip('-').replace('-', '').isdigit():
                        seen.append(k)
            year_cols = seen

        for r_def in derived_rows:
            target_key = r_def['id']
            source_key = r_def['derive'].get('of')
            source_row = rows.get(source_key, {})
            target_row = rows.get(target_key, {})
            for year in year_cols:
                # Reuse the single-field engine by presenting the sibling
                # row's value for this year as the field it names.
                target_row[year] = evaluate_derive(
                    {'id': target_key, 'derive': r_def['derive']},
                    {source_key: source_row.get(year)},
                    1,
                    context,
                )
            rows[target_key] = target_row
            if target_key not in keys:
                keys.append(target_key)
    else:
        return block_data

    if was_list:
        out = []
        for key in keys:
            row = dict(rows[key])
            row.setdefault('id', key)
            out.append(row)
        return out
    return {k: rows[k] for k in keys}
