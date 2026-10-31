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
        rows_data = block_data if isinstance(block_data, list) else []
        col_axis = block_def.get('columnAxis', {})
        fields = col_axis.get('fields', [])
        rules = block_def.get('validations', [])

        for idx, row in enumerate(rows_data):
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

