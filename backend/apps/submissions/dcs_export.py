"""
Generates DCS-style Excel workbooks matching IIT Mandi's NIRF submitted PDFs.
Uses openpyxl to build clean tabular reports with section headings, proper formatting, and field filtering.
"""

import io
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter
from .rollup import compute_category_rollup
from .year_engine import get_year_context, resolve_year_series

def generate_category_excel(
    category_id: str,
    cycle_year: int,
    request_id: str = None,
    allow_partial: bool = True
) -> io.BytesIO:
    rollup = compute_category_rollup(category_id, cycle_year, request_id, allow_partial)

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = rollup.get('categoryTitle', category_id)[:31]

    # Styles
    title_font = Font(name='Calibri', size=16, bold=True, color='1E293B')
    subtitle_font = Font(name='Calibri', size=11, italic=True, color='64748B')
    section_font = Font(name='Calibri', size=13, bold=True, color='0F172A')
    block_font = Font(name='Calibri', size=11, bold=True, color='334155')
    header_font = Font(name='Calibri', size=10, bold=True, color='FFFFFF')
    regular_font = Font(name='Calibri', size=10, color='1E293B')

    header_fill = PatternFill(start_color='2563EB', end_color='2563EB', fill_type='solid')
    sub_header_fill = PatternFill(start_color='3B82F6', end_color='3B82F6', fill_type='solid')
    zebra_fill = PatternFill(start_color='F8FAFC', end_color='F8FAFC', fill_type='solid')
    section_fill = PatternFill(start_color='E2E8F0', end_color='E2E8F0', fill_type='solid')

    thin_border = Border(
        left=Side(style='thin', color='CBD5E1'),
        right=Side(style='thin', color='CBD5E1'),
        top=Side(style='thin', color='CBD5E1'),
        bottom=Side(style='thin', color='CBD5E1')
    )

    current_row = 1

    # Main Title
    ws.cell(row=current_row, column=1, value="Indian Institute of Technology Mandi").font = title_font
    current_row += 1
    dcs_title = rollup.get('dcsTitle') or f"Data Capturing System: {rollup.get('categoryTitle')}"
    ws.cell(row=current_row, column=1, value=f"{dcs_title} (Cycle {cycle_year})").font = subtitle_font
    current_row += 2

    sections_data = rollup.get('sections', {})

    # Iterate sections in export order
    cat_def_order = []
    from .models import FormSchema
    sch_obj = FormSchema.objects.filter(framework='NIRF', is_active=True).first()
    if sch_obj:
        for c in sch_obj.content.get('categories', []):
            if c['id'] == category_id:
                cat_def_order = c.get('exportOrder', [])
                break

    rendered_sections = set()

    for item in cat_def_order:
        sec_id = item.split('/')[0]
        sub_block_id = item.split('/')[1] if '/' in item else None

        if sec_id in rendered_sections and not sub_block_id:
            continue

        sec_info = sections_data.get(sec_id)
        if not sec_info:
            continue

        sec_def = sec_info.get('definition', {})
        if sec_def.get('exportToNirf') is False:
            continue

        if sec_id not in rendered_sections:
            # Section Heading banner
            heading_cell = ws.cell(row=current_row, column=1, value=sec_def.get('dcsHeading', sec_def.get('title')))
            heading_cell.font = section_font
            heading_cell.fill = section_fill
            ws.merge_cells(start_row=current_row, start_column=1, end_row=current_row, end_column=10)
            current_row += 2
            rendered_sections.add(sec_id)

        blocks = sec_def.get('blocks', [])
        blocks_data = sec_info.get('blocks', {})

        for blk in blocks:
            b_id = blk['id']
            if sub_block_id and b_id != sub_block_id:
                continue

            b_kind = blk.get('kind')
            ws.cell(row=current_row, column=1, value=blk.get('title', b_id)).font = block_font
            current_row += 1

            if b_kind == 'grid':
                # Render Grid Table
                col_axis = blk.get('columnAxis', {})
                col_type = col_axis.get('type')

                headers = ['Program / Detail']
                if col_type == 'years':
                    series_cfg = col_axis.get('series', {})
                    year_labels = resolve_year_series(
                        series_cfg.get('kind', 'academic'),
                        series_cfg.get('count', 3),
                        cycle_year
                    )
                    headers.extend([str(y) for y in year_labels])
                elif col_type == 'fields':
                    fields = col_axis.get('fields', [])
                    headers.extend([f.get('label') for f in fields])

                for col_idx, h in enumerate(headers, start=1):
                    cell = ws.cell(row=current_row, column=col_idx, value=h)
                    cell.font = header_font
                    cell.fill = header_fill
                    cell.alignment = Alignment(horizontal='center', vertical='center', wrap_text=True)
                    cell.border = thin_border
                current_row += 1

                rows_data = blocks_data.get(b_id, [])
                for r_idx, r in enumerate(rows_data):
                    fill = zebra_fill if r_idx % 2 == 1 else None
                    label_val = r.get('label') or r.get('name') or r.get('id') or f"Row {r_idx + 1}"
                    c1 = ws.cell(row=current_row, column=1, value=str(label_val))
                    c1.font = regular_font
                    c1.border = thin_border
                    if fill:
                        c1.fill = fill

                    col_offset = 2
                    if col_type == 'years':
                        for y in year_labels:
                            val = r.get(str(y))
                            cell = ws.cell(row=current_row, column=col_offset, value=val if val is not None else 0)
                            cell.font = regular_font
                            cell.alignment = Alignment(horizontal='right')
                            cell.border = thin_border
                            if fill:
                                cell.fill = fill
                            col_offset += 1
                    elif col_type == 'fields':
                        for f in fields:
                            val = r.get(f['id'])
                            cell = ws.cell(row=current_row, column=col_offset, value=val if val is not None else 0)
                            cell.font = regular_font
                            cell.alignment = Alignment(horizontal='right' if f.get('type') in ('integer', 'decimal', 'currencyInr') else 'left')
                            cell.border = thin_border
                            if fill:
                                cell.fill = fill
                            col_offset += 1
                    current_row += 1

                current_row += 1

            elif b_kind == 'records':
                # Render Records Table
                rec_fields = [f for f in blk.get('fields', []) if not f.get('internal')]
                headers = [f['label'] for f in rec_fields]

                for col_idx, h in enumerate(headers, start=1):
                    cell = ws.cell(row=current_row, column=col_idx, value=h)
                    cell.font = header_font
                    cell.fill = sub_header_fill
                    cell.alignment = Alignment(horizontal='center', vertical='center', wrap_text=True)
                    cell.border = thin_border
                current_row += 1

                recs = blocks_data.get(b_id, [])
                for r_idx, rec in enumerate(recs):
                    fill = zebra_fill if r_idx % 2 == 1 else None
                    for c_idx, f in enumerate(rec_fields, start=1):
                        val = rec.get(f['id'])
                        cell = ws.cell(row=current_row, column=c_idx, value=str(val) if val is not None else '')
                        cell.font = regular_font
                        cell.border = thin_border
                        if fill:
                            cell.fill = fill
                    current_row += 1

                if not recs:
                    ws.cell(row=current_row, column=1, value="No records reported.").font = subtitle_font
                    current_row += 1

                current_row += 1

            elif b_kind == 'questionnaire':
                # Render Questionnaire
                ws.cell(row=current_row, column=1, value="Question").font = header_font
                ws.cell(row=current_row, column=1).fill = header_fill
                ws.cell(row=current_row, column=2, value="Response").font = header_font
                ws.cell(row=current_row, column=2).fill = header_fill
                current_row += 1

                q_data = blocks_data.get(b_id, {})
                for q in blk.get('questions', []):
                    ans = q_data.get(q['id'])
                    if isinstance(ans, bool):
                        display_ans = "Yes" if ans else "No"
                    elif isinstance(ans, list):
                        display_ans = ", ".join(str(x) for x in ans)
                    else:
                        display_ans = str(ans) if ans is not None else "Not answered"

                    c1 = ws.cell(row=current_row, column=1, value=q.get('label'))
                    c1.font = regular_font
                    c1.border = thin_border
                    c2 = ws.cell(row=current_row, column=2, value=display_ans)
                    c2.font = regular_font
                    c2.border = thin_border
                    current_row += 1

                current_row += 1

    # Auto-adjust column widths
    for col in ws.columns:
        max_len = max(len(str(cell.value or '')) for cell in col[:50])
        col_letter = get_column_letter(col[0].column)
        ws.column_dimensions[col_letter].width = min(max(max_len + 3, 12), 50)

    output = io.BytesIO()
    wb.save(output)
    output.seek(0)
    return output

