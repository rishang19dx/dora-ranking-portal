"""
Validation and derive engine for NIRF DCS form schemas.
Enforces type constraints, field requirements, custom validation rules, and computed fields.
"""

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
        for q in questions:
            qid = q['id']
            val = data_dict.get(qid)
            if q.get('required') and (val is None or val == ''):
                errors.append({
                    'blockId': block_def['id'],
                    'field': qid,
                    'message': f"'{q['label']}' is required."
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
            rows_data = list(block_data.values())
        elif isinstance(block_data, list):
            rows_data = block_data
        else:
            rows_data = []

        col_axis = block_def.get('columnAxis', {})
        fields = block_def.get('resolvedColumns') or col_axis.get('fields', [])
        rules = block_def.get('validations', [])

        for idx, row in enumerate(rows_data):
            if isinstance(row, dict):
                for f in fields:
                    if f.get('required') and not f.get('derive'):
                        val = row.get(f['id'])
                        if val is None or val == '':
                            errors.append({
                                'blockId': block_def['id'],
                                'row': idx,
                                'field': f['id'],
                                'message': f"Field '{f.get('label', f['id'])}' is required."
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
