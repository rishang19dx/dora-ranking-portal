"""
Year engine implementing the NIRF cycle year model.
All year columns are relative to the latest completed academic year (LAY) of the cycle.
"""

def latest_academic_year_start(cycle_year: int) -> int:
    return cycle_year - 2

def latest_financial_year_start(cycle_year: int) -> int:
    return cycle_year - 2

def latest_calendar_year(cycle_year: int) -> int:
    return cycle_year - 2

def next_academic_year_start(cycle_year: int) -> int:
    return cycle_year - 1

def academic_year_label(start_year: int) -> str:
    end_suffix = (start_year + 1) % 100
    return f"{start_year}-{end_suffix:02d}"

def financial_year_label(start_year: int) -> str:
    return academic_year_label(start_year)

def resolve_year_series(kind: str, count: int, cycle_year: int) -> list:
    """
    Returns resolved list of year labels or integers, newest first.
    kind: 'academic' | 'financial' | 'calendar'
    """
    if count <= 0:
        return []

    if kind in ('academic', 'financial'):
        base_start = latest_academic_year_start(cycle_year)
        return [academic_year_label(base_start - i) for i in range(count)]
    elif kind == 'calendar':
        base_year = latest_calendar_year(cycle_year)
        return [base_year - i for i in range(count)]
    else:
        raise ValueError(f"Unknown series kind: {kind}")

def get_year_context(cycle_year: int) -> dict:
    """
    Returns template variables for help texts and column headers.
    """
    lay_start = latest_academic_year_start(cycle_year)
    nay_start = next_academic_year_start(cycle_year)
    return {
        'cycleYear': str(cycle_year),
        'latestAcademicYear': academic_year_label(lay_start),
        'latestFinancialYear': financial_year_label(lay_start),
        'latestCalendarYear': str(latest_calendar_year(cycle_year)),
        'nextAcademicYear': academic_year_label(nay_start),
    }

def resolve_batch_years(graduating_ay_label: str, level: str) -> dict:
    """
    Computes entry and lateral-entry academic years given the graduating academic year label.
    e.g. '2022-23' -> start_year 2022
    UG4: entry = grad - 3, lateral = grad - 2
    PG2: entry = grad - 1, lateral = None
    """
    try:
        grad_start = int(graduating_ay_label.split('-')[0])
    except (ValueError, IndexError):
        raise ValueError(f"Invalid academic year label: {graduating_ay_label}")

    if level == 'UG4':
        return {
            'graduationAcademicYear': graduating_ay_label,
            'entryAcademicYear': academic_year_label(grad_start - 3),
            'lateralAcademicYear': academic_year_label(grad_start - 2),
        }
    elif level == 'PG2':
        return {
            'graduationAcademicYear': graduating_ay_label,
            'entryAcademicYear': academic_year_label(grad_start - 1),
            'lateralAcademicYear': None,
        }
    else:
        return {
            'graduationAcademicYear': graduating_ay_label,
            'entryAcademicYear': None,
            'lateralAcademicYear': None,
        }

