"""
Automated boardroom briefing generator.

One call produces the PDF deck DORA takes into Director and Senate reviews:
where the institute stands in NIRF, which parameters are costing the most
score against peer IITs, and how far the current collection cycle has got.

Ranking figures come from the cached NIRF datasets; cycle figures come from
recorded submissions. Nothing is estimated - sections with no data say so.
"""

import io
from datetime import datetime
from typing import Any, Dict, List, Optional

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    KeepTogether,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

from apps.rankings.analytics import (
    PARAMETER_LABELS,
    PARAMETER_ORDER,
    PARAMETRIC_CATEGORIES,
    compute_gap_analysis,
    compute_own_history_gap,
    compute_parameter_trends,
    project_scenarios,
)

from .analytics import compute_department_analytics, compute_department_contributions
from .cross_checks import run_cross_checks

NAVY = colors.HexColor('#003366')
SAGE = colors.HexColor('#5A7359')
SAFFRON = colors.HexColor('#F58220')
SLATE = colors.HexColor('#475569')
LIGHT = colors.HexColor('#F1F5F9')
BORDER = colors.HexColor('#CBD5E1')

TREND_WINDOW = 5  # most recent published cycles in the trend tables


def _styles():
    ss = getSampleStyleSheet()
    return {
        'title': ParagraphStyle(
            'DoraTitle', parent=ss['Title'], fontName='Helvetica-Bold',
            fontSize=22, leading=26, textColor=NAVY, spaceAfter=4,
        ),
        'subtitle': ParagraphStyle(
            'DoraSubtitle', parent=ss['Normal'], fontName='Helvetica',
            fontSize=10.5, leading=14, textColor=SLATE, alignment=TA_CENTER,
        ),
        'h2': ParagraphStyle(
            'DoraH2', parent=ss['Heading2'], fontName='Helvetica-Bold',
            fontSize=13, leading=16, textColor=NAVY, spaceBefore=10, spaceAfter=6,
        ),
        'h3': ParagraphStyle(
            'DoraH3', parent=ss['Heading3'], fontName='Helvetica-Bold',
            fontSize=10.5, leading=13, textColor=SAGE, spaceBefore=6, spaceAfter=4,
        ),
        'body': ParagraphStyle(
            'DoraBody', parent=ss['Normal'], fontName='Helvetica',
            fontSize=9, leading=12.5, textColor=colors.HexColor('#1E293B'),
        ),
        'note': ParagraphStyle(
            'DoraNote', parent=ss['Normal'], fontName='Helvetica-Oblique',
            fontSize=8, leading=11, textColor=SLATE,
        ),
        'cell': ParagraphStyle(
            'DoraCell', parent=ss['Normal'], fontName='Helvetica',
            fontSize=8, leading=10.5,
        ),
    }


def _table(data: List[List[Any]], col_widths=None, highlight_rows=None) -> Table:
    t = Table(data, colWidths=col_widths, repeatRows=1, hAlign='LEFT')
    style = [
        ('BACKGROUND', (0, 0), (-1, 0), NAVY),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 8),
        ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
        ('GRID', (0, 0), (-1, -1), 0.4, BORDER),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('ALIGN', (1, 1), (-1, -1), 'CENTER'),
        ('TOPPADDING', (0, 0), (-1, -1), 3.5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3.5),
        ('LEFTPADDING', (0, 0), (-1, -1), 5),
        ('RIGHTPADDING', (0, 0), (-1, -1), 5),
    ]
    for idx in range(1, len(data)):
        if idx % 2 == 0:
            style.append(('BACKGROUND', (0, idx), (-1, idx), LIGHT))
    for idx in (highlight_rows or []):
        style.append(('BACKGROUND', (0, idx), (-1, idx), colors.HexColor('#FEF3C7')))
        style.append(('FONTNAME', (0, idx), (-1, idx), 'Helvetica-Bold'))
    t.setStyle(TableStyle(style))
    return t


def _inr(value) -> str:
    """Rupee amount in Indian numbering, for prose lines in the briefing."""
    try:
        amount = float(value)
    except (TypeError, ValueError):
        return '-'
    if amount >= 1_00_00_000:
        return f"Rs. {amount / 1_00_00_000:.2f} Cr"
    if amount >= 1_00_000:
        return f"Rs. {amount / 1_00_000:.2f} L"
    return f"Rs. {amount:,.0f}"

def _fmt(val, dash='-', digits=2):
    if val is None:
        return dash
    if isinstance(val, float):
        return f"{val:.{digits}f}"
    return str(val)


def generate_briefing_pdf(
    cycle_year: int,
    load_ranking_data,
    canonical_name,
    peer_names: List[str],
    request_id: Optional[str] = None,
    category_id: Optional[str] = None,
    ranking_year: Optional[int] = None,
) -> io.BytesIO:
    from apps.rankings.store import latest_year, trend_window

    trend_years = trend_window(('Engineering', 'Overall', 'Innovation'), TREND_WINDOW)
    if ranking_year is None:
        ranking_year = latest_year('Engineering')
    if ranking_year is None:
        raise ValueError('No ranking data has been fetched yet.')

    st = _styles()
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=landscape(A4),
        leftMargin=14 * mm, rightMargin=14 * mm,
        topMargin=13 * mm, bottomMargin=13 * mm,
        title=f"DORA Boardroom Briefing - NIRF {cycle_year}",
        author="Office of the Dean of Resources & Alumni Affairs, IIT Mandi",
    )

    story: List[Any] = []

    # ---------------- Cover ----------------
    story.append(Spacer(1, 30 * mm))
    story.append(Paragraph("Indian Institute of Technology Mandi", st['title']))
    story.append(Paragraph(
        "Office of the Dean of Resources &amp; Alumni Affairs (DORA)", st['subtitle']))
    story.append(Spacer(1, 8 * mm))
    story.append(Paragraph(
        f"<b>Boardroom Briefing: NIRF {cycle_year} Cycle</b>", st['subtitle']))
    story.append(Paragraph(
        f"Ranking benchmark year {ranking_year} &nbsp;|&nbsp; "
        f"Generated {datetime.now().strftime('%d %B %Y, %H:%M')}", st['subtitle']))
    story.append(Spacer(1, 6 * mm))
    story.append(Paragraph(
        "Prepared automatically from verified portal submissions and published "
        "NIRF results. Figures marked '-' had no data available at generation time.",
        st['note']))
    story.append(PageBreak())

    # ---------------- 1. Standing & historical trend ----------------
    story.append(Paragraph("1. Current Standing and Historical Trend", st['h2']))

    standing_rows = [['Category', 'Rank ' + str(ranking_year), 'Score', 'Best rank (5 yr)',
                      'Net rank movement', 'Trend']]
    trends_cache: Dict[str, Dict[str, Any]] = {}
    for cat in ['Engineering', 'Overall', 'Innovation']:
        tr = compute_parameter_trends(load_ranking_data, cat, trend_years)
        trends_cache[cat] = tr
        series = tr['series']
        if not series:
            standing_rows.append([cat, '-', '-', '-', '-', 'no data'])
            continue
        latest = series[-1]
        ranks = [e['rank'] for e in series if isinstance(e['rank'], (int, float))]
        best = min(ranks) if ranks else None
        first_rank = next((e['rank'] for e in series if isinstance(e['rank'], (int, float))), None)
        net = (first_rank - latest['rank']) if (
            isinstance(first_rank, (int, float)) and isinstance(latest['rank'], (int, float))
        ) else None
        arrow = '-' if net is None else ('improved' if net > 0 else ('declined' if net < 0 else 'flat'))
        standing_rows.append([
            cat,
            _fmt(latest['rank'], digits=0),
            _fmt(latest['score']),
            _fmt(best, digits=0),
            ('+' if (net or 0) > 0 else '') + _fmt(net, digits=0),
            arrow,
        ])
    story.append(_table(standing_rows, col_widths=[48 * mm, 28 * mm, 26 * mm, 32 * mm, 34 * mm, 28 * mm]))
    story.append(Spacer(1, 4 * mm))

    # Parameter history for the parametric categories.
    for cat in PARAMETRIC_CATEGORIES:
        tr = trends_cache.get(cat) or compute_parameter_trends(load_ranking_data, cat, trend_years)
        series = [e for e in tr['series'] if e['hasParameters']]
        if not series:
            continue
        story.append(Paragraph(
            f"Parameter history - {cat} (each sub-score out of 100; weight in brackets)", st['h3']))
        header = ['Parameter (weight)'] + [str(e['year']) for e in series] + ['Net']
        rows = [header]
        for key in PARAMETER_ORDER:
            vals = [e['parameters'][key]['value'] for e in series]
            net = (vals[-1] - vals[0]) if (vals and vals[0] is not None and vals[-1] is not None) else None
            rows.append(
                [f"{PARAMETER_LABELS[key]} ({int(tr['weights'][key] * 100)}%)"]
                + [_fmt(v) for v in vals]
                + [('+' if (net or 0) > 0 else '') + _fmt(net)]
            )
        rows.append(
            ['Total score'] + [_fmt(e['score']) for e in series] + ['']
        )
        width = [62 * mm] + [22 * mm] * len(series) + [20 * mm]
        story.append(_table(rows, col_widths=width, highlight_rows=[len(rows) - 1]))
        story.append(Spacer(1, 3 * mm))

    story.append(PageBreak())

    # ---------------- 2. Peer gap analysis ----------------
    story.append(Paragraph(
        f"2. Peer Gap Analysis - 2nd Generation IITs ({ranking_year})", st['h2']))
    story.append(Paragraph(
        "'Weighted upside' is the number of points the overall score would gain by "
        "matching the best peer on that parameter. It is the gap multiplied by the "
        "parameter's NIRF weight, so the rows are directly comparable.", st['body']))
    story.append(Spacer(1, 3 * mm))

    for cat in PARAMETRIC_CATEGORIES:
        gap = compute_gap_analysis(load_ranking_data, canonical_name, peer_names, cat, ranking_year)
        story.append(Paragraph(f"{cat} category", st['h3']))
        if not gap['available']:
            story.append(Paragraph(gap.get('reason', 'Not available.'), st['note']))
            story.append(Spacer(1, 3 * mm))
            continue

        rows = [['Parameter', 'Weight', 'IIT Mandi', 'Peer best', 'Best peer',
                 'Peer median', 'Gap to best', 'Weighted upside', 'Percentile']]
        for p in gap['parameters']:
            peer_short = (p['peerBestInstitute'] or '-').replace(
                'Indian Institute of Technology ', 'IIT ')
            rows.append([
                p['label'],
                f"{int(p['weight'] * 100)}%",
                _fmt(p['own']),
                _fmt(p['peerBest']),
                peer_short,
                _fmt(p['peerMedian']),
                _fmt(p['gapToBest']),
                _fmt(p['weightedUpsideToBest']),
                _fmt(p['percentileAmongPeers'], digits=0) + ('' if p['percentileAmongPeers'] is None else '%'),
            ])
        rows.append(['Total addressable upside', '', '', '', '', '', '',
                     _fmt(gap['totalWeightedUpside']), ''])
        story.append(_table(
            rows,
            col_widths=[52 * mm, 16 * mm, 20 * mm, 19 * mm, 27 * mm, 21 * mm, 21 * mm, 26 * mm, 20 * mm],
            highlight_rows=[len(rows) - 1],
        ))
        story.append(Spacer(1, 2 * mm))

        if gap['priorities']:
            top = gap['priorities'][:3]
            bullets = '<br/>'.join(
                f"&bull; <b>{p['label']}</b>: {_fmt(p['gapToBest'])} points behind "
                f"{(p['peerBestInstitute'] or '').replace('Indian Institute of Technology ', 'IIT ')}, "
                f"worth {_fmt(p['weightedUpsideToBest'])} points on the total score."
                for p in top
            )
            story.append(Paragraph(f"<b>Priority areas ({cat}):</b><br/>{bullets}", st['body']))
        else:
            story.append(Paragraph(
                f"IIT Mandi leads the peer set on every parameter in {cat}.", st['body']))
        story.append(Spacer(1, 4 * mm))

    # Peer standings table.
    gap_eng = compute_gap_analysis(
        load_ranking_data, canonical_name, peer_names, 'Engineering', ranking_year)
    if gap_eng.get('peers'):
        story.append(Paragraph(f"Peer standings - Engineering {ranking_year}", st['h3']))
        rows = [['Institute', 'Rank', 'Score'] + [PARAMETER_LABELS[k].split(',')[0].split(' &')[0][:12]
                                                   for k in PARAMETER_ORDER]]
        hl = []
        for i, p in enumerate(gap_eng['peers'], start=1):
            if p['isTarget']:
                hl.append(i)
            rows.append(
                [p['institute'].replace('Indian Institute of Technology ', 'IIT '),
                 _fmt(p['rank'], digits=0), _fmt(p['score'])]
                + [_fmt(p['parameters'].get(k)) for k in PARAMETER_ORDER]
            )
        story.append(_table(
            rows,
            col_widths=[54 * mm, 18 * mm, 20 * mm] + [26 * mm] * len(PARAMETER_ORDER),
            highlight_rows=hl,
        ))

    story.append(PageBreak())

    # ---------------- 3. Cycle collection status ----------------
    story.append(Paragraph(
        f"3. NIRF {cycle_year} Data Collection Status", st['h2']))

    dept = compute_department_analytics(cycle_year, request_id=request_id, category_id=category_id)
    inst = dept['institute']

    kpi = [
        ['Eligible schools / centres', 'Unit-owned sections', 'Expected unit submissions',
         'Received', 'Approved', 'Awaiting review', 'In correction', 'Completion'],
        [
            str(inst['eligibleUnits']),
            str(inst['unitOwnedSections']),
            str(inst['expectedUnitSubmissions']),
            str(inst['totalSubmissions']),
            str(inst['approved']),
            str(inst['awaitingReview']),
            str(inst['inCorrection']),
            f"{inst['overallCompletionPct']}%",
        ],
    ]
    story.append(_table(kpi, col_widths=[36 * mm] * 8))
    story.append(Spacer(1, 2 * mm))
    turn = inst['avgReviewTurnaroundHours']
    story.append(Paragraph(
        f"Average maker-checker review turnaround: "
        f"{('%.1f hours' % turn) if turn is not None else 'no reviewed submissions yet'}. "
        f"Units fully complete: {inst['unitsFullyComplete']} of {inst['eligibleUnits']}. "
        f"Units not started: {inst['unitsNotStarted']}.",
        st['body']))
    story.append(Spacer(1, 4 * mm))

    academic = [d for d in dept['departments'] if d['isAcademicUnit']]
    if academic:
        story.append(Paragraph("Department-wise contribution and performance", st['h3']))
        rows = [['School / Centre', 'Sections done', 'Approved', 'Awaiting', 'Correction',
                 'Records', 'First-pass', 'Completion']]
        for d in sorted(academic, key=lambda x: -x['completionPct']):
            rows.append([
                Paragraph(d['shortName'] or d['unitName'], st['cell']),
                f"{d['sectionsTouched']}/{d['expectedSections']}",
                str(d['approved']),
                str(d['submittedAwaitingReview']),
                str(d['correctionRequested']),
                str(d['recordsContributed']),
                f"{d['firstPassApprovalPct']}%",
                f"{d['completionPct']}%",
            ])
        story.append(_table(
            rows, col_widths=[74 * mm, 26 * mm, 22 * mm, 22 * mm, 24 * mm, 22 * mm, 24 * mm, 26 * mm]))
    else:
        story.append(Paragraph(
            "No departmental submissions recorded for this cycle yet.", st['note']))

    story.append(Spacer(1, 4 * mm))

    stuck = [s for s in dept['sections'] if s['completionPct'] < 100.0][:10]
    if stuck:
        story.append(Paragraph("Sections holding up the cycle (lowest completion first)", st['h3']))
        rows = [['Section', 'Submitted by', 'Expected', 'Received', 'Settled',
                 'Awaiting', 'In correction', 'Completion']]
        for s in stuck:
            rows.append([
                Paragraph(s['title'], st['cell']),
                s['submitBy'],
                str(s['expected']),
                str(s['received']),
                str(s['settled']),
                str(s['awaitingReview']),
                str(s['inCorrection']),
                f"{s['completionPct']}%",
            ])
        story.append(_table(
            rows, col_widths=[86 * mm, 24 * mm, 22 * mm, 22 * mm, 20 * mm, 22 * mm, 26 * mm, 24 * mm]))

    # ---------------- 4. Department contribution ----------------
    contrib = compute_department_contributions(cycle_year, request_id=request_id)
    contrib_rows = [d for d in contrib['departments'] if d['researchFundingInr'] or d['graduated']]
    if contrib_rows:
        story.append(PageBreak())
        story.append(Paragraph("4. Department Contribution to the Institutional Score", st['h2']))
        story.append(Paragraph(
            "Read from the submitted values, not submission status: sponsored research "
            "received in the latest financial year, graduating-cohort outcomes, and "
            "Ph.D completions.", st['body']))
        story.append(Spacer(1, 3 * mm))

        rows = [['School / Centre', 'Research funding', 'Share', 'Projects',
                 'Graduated', 'Placed', 'Placement rate', 'Ph.D out']]
        for d in contrib_rows:
            rows.append([
                Paragraph(d['shortName'] or d['unitName'], st['cell']),
                _inr(d['researchFundingInr']),
                f"{d['fundingSharePct']}%" if d['fundingSharePct'] is not None else '-',
                str(d['researchProjects']),
                str(int(d['graduated'])),
                str(int(d['placed'])),
                f"{d['placementRatePct']}%" if d['placementRatePct'] is not None else '-',
                str(int(d['phdGraduated'])),
            ])
        story.append(_table(
            rows,
            col_widths=[62 * mm, 38 * mm, 18 * mm, 20 * mm, 24 * mm, 20 * mm, 28 * mm, 20 * mm]))
        story.append(Spacer(1, 3 * mm))

        leaders = contrib['leaders']
        bullet_lines = []
        for key, caption, fmt in (
            ('mostResearchFunding', 'Most research funding', _inr),
            ('highestPlacementRate', 'Highest placement rate', lambda v: f"{v}%"),
            ('mostPhdGraduated', 'Most Ph.D completions', lambda v: f"{int(v)}"),
        ):
            led = leaders.get(key)
            # A "leader" on a metric nobody reported anything for is noise, not
            # a finding, so a zero value is left out.
            if led and (led.get('value') or 0) > 0:
                bullet_lines.append(
                    f"&bull; <b>{caption}:</b> {led['shortName'] or led['unitName']} "
                    f"({fmt(led['value'])})"
                )
        if bullet_lines:
            story.append(Paragraph('<br/>'.join(bullet_lines), st['body']))

    # ---------------- 5. Discrepancies ----------------
    story.append(PageBreak())
    story.append(Paragraph("5. Discrepancies Caught by the System", st['h2']))
    checks = run_cross_checks(request_id, cycle_year) if request_id else []
    flagged = [c for c in checks if not c.get('passed')]

    if not request_id:
        story.append(Paragraph(
            "Cross-checks run against a specific data request. Generate this briefing "
            "with a request selected to include them.", st['note']))
    elif not flagged:
        story.append(Paragraph(
            f"All {len(checks)} cross-check(s) passed; no discrepancies outstanding.",
            st['body']))
    else:
        rows = [['Severity', 'Check', 'Finding']]
        for c in flagged:
            rows.append([
                str(c.get('severity', '')).upper(),
                c.get('id', ''),
                Paragraph(c.get('message', ''), st['cell']),
            ])
        story.append(_table(rows, col_widths=[24 * mm, 54 * mm, 180 * mm]))
        story.append(Spacer(1, 2 * mm))
        story.append(Paragraph(
            f"{len(flagged)} of {len(checks)} cross-check(s) require attention before export.",
            st['body']))

    # Year-on-year anomalies and restatements still being worked (spec 2.9).
    if request_id:
        from .models import DiscrepancyFlag
        live = list(
            DiscrepancyFlag.objects
            .filter(request_id=request_id, status__in=['OPEN', 'ESCALATED'])
            .exclude(kind='CROSS_CHECK')
            .select_related('org_unit')
        )
        live.sort(key=lambda f: ({'CRITICAL': 0, 'WARNING': 1}.get(f.severity, 2), f.label))
        story.append(Spacer(1, 3 * mm))
        if live:
            rows = [['Severity', 'Unit', 'Figure', 'Finding', 'Status']]
            for f in live[:25]:
                rows.append([
                    f.severity,
                    (f.org_unit.short_name or f.org_unit.name) if f.org_unit else '-',
                    Paragraph(f.label, st['cell']),
                    Paragraph(f.message, st['cell']),
                    'With department' if f.status == 'ESCALATED' else 'Open',
                ])
            story.append(_table(rows, col_widths=[22 * mm, 30 * mm, 80 * mm, 104 * mm, 26 * mm]))
            critical = sum(1 for f in live if f.severity == 'CRITICAL')
            story.append(Spacer(1, 2 * mm))
            story.append(Paragraph(
                f"{len(live)} historical-trend flag(s) outstanding ({critical} critical)"
                + ("; the first 25 are listed." if len(live) > 25 else '.'),
                st['body']))
        else:
            story.append(Paragraph(
                'No outstanding year-on-year or restatement flags against previously approved figures.',
                st['body']))

    # ---------------- 6. Scenario projections ----------------
    story.append(Paragraph("6. Projected Ranking Outcomes", st['h2']))
    story.append(Paragraph(
        "<b>Scenario-based estimates only.</b> Each figure below is the arithmetic "
        "result of closing a stated gap at current NIRF weights. It is not a "
        "forecast: NIRF renormalises each cycle and the peer cohort moves.",
        st['body']))
    story.append(Spacer(1, 3 * mm))

    for cat in PARAMETRIC_CATEGORIES:
        peer_gap = compute_gap_analysis(
            load_ranking_data, canonical_name, peer_names, cat, ranking_year)
        own_gap = compute_own_history_gap(
            load_ranking_data, cat, ranking_year, trend_years)
        proj = project_scenarios(
            peer_gap, own_gap, load_ranking_data(ranking_year, cat.lower()) or [])

        story.append(Paragraph(f"{cat} category", st['h3']))
        if not proj.get('available'):
            story.append(Paragraph(proj.get('reason') or 'Not available.', st['note']))
            continue

        rows = [['Scenario', 'Score change', 'Projected score',
                 f'Would have ranked ({ranking_year})']]
        rows.append(['Current position', '-', _fmt(proj['baseScore']),
                     _fmt(peer_gap.get('targetRank'), digits=0)])
        for s in proj['scenarios']:
            rows.append([
                Paragraph(s['label'], st['cell']),
                f"+{_fmt(s['scoreDelta'])}",
                _fmt(s['projectedScore']),
                f"#{s['wouldHaveRanked']}" if s['wouldHaveRanked'] else '-',
            ])
        story.append(_table(rows, col_widths=[120 * mm, 30 * mm, 34 * mm, 48 * mm],
                            highlight_rows=[1]))
        story.append(Spacer(1, 3 * mm))

    story.append(Spacer(1, 6 * mm))
    story.append(Paragraph(
        "Generated by the DORA Automated Ranking Portal. Ranking figures are the "
        "published NIRF results cached in the portal; cycle figures are drawn from "
        "the maker-checker submission record and its immutable audit trail. "
        "Projected outcomes are scenario-based estimates, not forecasts.",
        st['note']))

    doc.build(story)
    buf.seek(0)
    return buf
