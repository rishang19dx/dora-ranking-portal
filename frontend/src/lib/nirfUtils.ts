/**
 * NIRF Form engine utilities for client-side rendering, Indian numbering,
 * live derive calculation, and validation mirroring backend rules.
 */

import {
  resolveYearSeries,
  resolveBatchYears,
} from './yearEngine';

export function parseNumber(val: any): number {
  if (val === null || val === undefined || val === '') return 0;
  const num = typeof val === 'number' ? val : parseFloat(String(val).replace(/,/g, ''));
  return isNaN(num) ? 0 : num;
}

export function formatIndianCurrency(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '';
  const numStr = String(value).replace(/,/g, '');
  if (isNaN(Number(numStr))) return String(value);

  const parts = numStr.split('.');
  let integerPart = parts[0];
  const decimalPart = parts.length > 1 ? '.' + parts[1] : '';

  const isNegative = integerPart.startsWith('-');
  if (isNegative) {
    integerPart = integerPart.substring(1);
  }

  // Indian grouping: last 3 digits, then pairs of 2
  if (integerPart.length > 3) {
    const lastThree = integerPart.substring(integerPart.length - 3);
    const remaining = integerPart.substring(0, integerPart.length - 3);
    const withCommas = remaining.replace(/\B(?=(\d{2})+(?!\d))/g, ',');
    return (isNegative ? '-' : '') + withCommas + ',' + lastThree + decimalPart;
  } else {
    return (isNegative ? '-' : '') + integerPart + decimalPart;
  }
}

export function amountInWordsInr(number: number | string | null | undefined): string {
  if (number === null || number === undefined || number === '') return '';
  const n = Math.round(parseNumber(number));
  if (n === 0) return 'Zero';
  if (n < 0) return 'Minus ' + amountInWordsInr(-n);

  const ones = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
    'Seventeen', 'Eighteen', 'Nineteen'
  ];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function twoDigits(num: number): string {
    if (num < 20) return ones[num];
    return tens[Math.floor(num / 10)] + (num % 10 !== 0 ? ' ' + ones[num % 10] : '');
  }

  function threeDigits(num: number): string {
    const h = Math.floor(num / 100);
    const rem = num % 100;
    let res = '';
    if (h > 0) res += ones[h] + ' Hundred';
    if (rem > 0) res += (res ? ' ' : '') + twoDigits(rem);
    return res;
  }

  let remN = n;
  const parts: string[] = [];

  // Crores: >= 10,000,000
  const crores = Math.floor(remN / 10000000);
  remN %= 10000000;
  if (crores > 0) {
    parts.push(amountInWordsInr(crores) + ' Crore');
  }

  // Lakhs: >= 100,000
  const lakhs = Math.floor(remN / 100000);
  remN %= 100000;
  if (lakhs > 0) {
    parts.push(twoDigits(lakhs) + ' Lakh');
  }

  // Thousands: >= 1,000
  const thousands = Math.floor(remN / 1000);
  remN %= 1000;
  if (thousands > 0) {
    parts.push(twoDigits(thousands) + ' Thousand');
  }

  // Remaining hundreds / tens / ones
  if (remN > 0) {
    parts.push(threeDigits(remN));
  }

  return parts.join(' ').trim();
}

export function evaluateDerive(
  fieldDef: any,
  rowData: Record<string, any>,
  rowIdx: number = 1,
  context?: { submittingUnitId?: string; lookups?: Record<string, any> }
): any {
  const deriveCfg = fieldDef?.derive;
  if (!deriveCfg) return rowData?.[fieldDef.id];

  const fn = deriveCfg.fn;
  if (fn === 'sum') {
    const fieldsToSum = deriveCfg.of || [];
    let total = 0;
    for (const f of fieldsToSum) {
      total += parseNumber(rowData?.[f]);
    }
    return Number.isInteger(total) ? total : Math.round(total * 1000) / 1000;
  } else if (fn === 'amountInWordsInr') {
    const targetF = deriveCfg.of;
    return amountInWordsInr(rowData?.[targetF]);
  } else if (fn === 'rowNumber') {
    return rowIdx;
  } else if (fn === 'submittingUnit') {
    return context?.submittingUnitId || '';
  } else if (fn === 'lookup') {
    const lookups = context?.lookups || {};
    const sec = deriveCfg.section;
    const blk = deriveCfg.block;
    let rowKey = deriveCfg.row;
    let colKey = deriveCfg.col;
    if (rowKey?.startsWith('$')) rowKey = rowData?.[rowKey.slice(1)];
    if (colKey?.startsWith('$')) colKey = rowData?.[colKey.slice(1)];
    return lookups[`${sec}:${blk}:${rowKey}:${colKey}`] ?? '';
  }

  return rowData?.[fieldDef.id];
}

export function validateRule(ruleCfg: any, rowData: Record<string, any>): boolean {
  if (!ruleCfg) return true;
  const op = ruleCfg.op;

  if (op === 'sumEquals') {
    const targetField = ruleCfg.target;
    const parts = ruleCfg.parts || [];
    const targetVal = parseNumber(rowData?.[targetField]);
    let partsSum = 0;
    for (const p of parts) {
      partsSum += parseNumber(rowData?.[p]);
    }
    const tolerancePct = ruleCfg.tolerancePct || 0;
    if (tolerancePct > 0 && targetVal > 0) {
      const diffPct = (Math.abs(targetVal - partsSum) / targetVal) * 100;
      return diffPct <= tolerancePct;
    }
    return Math.abs(targetVal - partsSum) < 0.001;
  } else if (op === 'lte') {
    const left = parseNumber(rowData?.[ruleCfg.left]);
    const right = parseNumber(rowData?.[ruleCfg.right]);
    return left <= right;
  } else if (op === 'lteSum') {
    const leftParts = ruleCfg.leftParts || [];
    const rightParts = ruleCfg.rightParts || [];
    let leftSum = 0;
    for (const p of leftParts) leftSum += parseNumber(rowData?.[p]);
    let rightSum = 0;
    for (const p of rightParts) rightSum += parseNumber(rowData?.[p]);
    return leftSum <= rightSum;
  } else if (op === 'requiredIf') {
    const field = ruleCfg.field;
    const whenCfg = ruleCfg.when || {};
    const whenField = whenCfg.field;
    const whenEq = whenCfg.eq;
    if (rowData?.[whenField] === whenEq) {
      const val = rowData?.[field];
      return val !== null && val !== undefined && String(val).trim() !== '';
    }
    return true;
  } else if (op === 'dateOrder') {
    const startStr = rowData?.[ruleCfg.start];
    const endStr = ruleCfg.end ? rowData?.[ruleCfg.end] : null;
    if (startStr && endStr) {
      return new Date(startStr) <= new Date(endStr);
    }
    return true;
  }

  return true;
}

/**
 * Resolves columns and rows for a grid block definition.
 * Uses resolvedColumns/resolvedRows if already populated by backend,
 * or dynamically computes them from columnAxis and rowAxis.
 */
export function getResolvedGridAxes(
  blockDef: any,
  cycleYear: number = 2027,
  programmes: any[] = []
): { columns: any[]; rows: any[] } {
  if (!blockDef) return { columns: [], rows: [] };

  // 1. Resolve columns
  let columns: any[] = [];
  if (Array.isArray(blockDef.resolvedColumns) && blockDef.resolvedColumns.length > 0) {
    columns = blockDef.resolvedColumns;
  } else if (Array.isArray(blockDef.columns) && blockDef.columns.length > 0) {
    columns = blockDef.columns;
  } else if (blockDef.columnAxis) {
    const colAxis = blockDef.columnAxis;
    if (colAxis.type === 'fields' && Array.isArray(colAxis.fields)) {
      columns = colAxis.fields;
    } else if (colAxis.type === 'years') {
      const series = colAxis.series || { kind: 'academic', count: 3 };
      const resolvedYears = resolveYearSeries(series.kind || 'academic', series.count || 3, cycleYear);
      const cell = colAxis.cell || {};
      columns = resolvedYears.map((yr) => ({
        id: String(yr),
        label: String(yr),
        type: cell.type || 'integer',
        min: cell.min,
        max: cell.max,
        required: cell.required || false,
      }));
    }
  }

  // 2. Resolve rows
  let rows: any[] = [];
  if (Array.isArray(blockDef.resolvedRows) && blockDef.resolvedRows.length > 0) {
    rows = blockDef.resolvedRows;
  } else if (Array.isArray(blockDef.rows) && blockDef.rows.length > 0) {
    rows = blockDef.rows;
  } else if (blockDef.rowAxis) {
    const rowAxis = blockDef.rowAxis;
    if (rowAxis.type === 'fixed' && Array.isArray(rowAxis.rows)) {
      rows = rowAxis.rows;
    } else if (rowAxis.type === 'years') {
      const series = rowAxis.series || { kind: 'academic', count: 3 };
      const resolvedYears = resolveYearSeries(series.kind || 'academic', series.count || 3, cycleYear);
      rows = resolvedYears.map((yr) => ({
        id: String(yr),
        label: String(yr),
      }));
    } else if (rowAxis.type === 'programme') {
      if (Array.isArray(programmes) && programmes.length > 0) {
        rows = programmes.map((p) => ({
          id: String(p.id),
          label: p.code ? `${p.name} (${p.code})` : p.name,
          level: p.level || p.nirfLevel || '',
        }));
      } else {
        rows = [
          { id: 'UG4', label: 'UG [4 Years Program(s)]', level: 'UG4' },
          { id: 'UG5', label: 'UG [5 Years Program(s)]', level: 'UG5' },
          { id: 'PG2', label: 'PG [2 Years Program(s)]', level: 'PG2' },
          { id: 'DOC', label: 'Ph.D / Doctoral Program(s)', level: 'DOC' },
        ];
      }
    } else if (rowAxis.type === 'programmeBatch') {
      const series = rowAxis.batchSeries || { kind: 'academic', count: 3 };
      const level = rowAxis.level || 'UG4';
      const resolvedYears = resolveYearSeries(series.kind || 'academic', series.count || 3, cycleYear);
      rows = resolvedYears.map((yr) => {
        const batchInfo = resolveBatchYears(String(yr), level);
        const subParts: string[] = [];
        if (batchInfo.entryAcademicYear) subParts.push(`First year intake: ${batchInfo.entryAcademicYear}`);
        if (batchInfo.lateralAcademicYear) subParts.push(`Lateral: ${batchInfo.lateralAcademicYear}`);
        const subLabel = subParts.length > 0 ? `(${subParts.join(', ')})` : '';
        return {
          id: String(yr),
          label: String(yr),
          subLabel,
          batchInfo,
          level,
        };
      });
    } else if (rowAxis.type === 'levelBatch') {
      const levels = rowAxis.levels || ['UG4', 'PG2'];
      const levelNames: Record<string, string> = {
        UG4: 'UG [4 Years Program(s)]',
        UG5: 'UG [5 Years Program(s)]',
        PG2: 'PG [2 Years Program(s)]',
        PG3: 'PG [3 Years Program(s)]',
        DOC: 'Ph.D / Doctoral Program(s)',
      };
      const series = rowAxis.batchSeries || { kind: 'academic', count: 3 };
      const resolvedYears = resolveYearSeries(series.kind || 'academic', series.count || 3, cycleYear);
      for (const lvl of levels) {
        const lvlLabel = levelNames[lvl] || lvl;
        for (const yr of resolvedYears) {
          rows.push({
            id: `${lvl}_${yr}`,
            label: `${lvlLabel} - ${yr}`,
            level: lvl,
            year: String(yr),
            batchInfo: resolveBatchYears(String(yr), lvl),
          });
        }
      }
    }
  }

  return { columns, rows };
}

export function validateBlockData(
  blockDef: any,
  blockData: any,
  context?: any
): { errors: Array<{ blockId: string; field?: string; message: string }>; warnings: Array<{ blockId: string; field?: string; message: string }> } {
  const errors: Array<{ blockId: string; field?: string; message: string }> = [];
  const warnings: Array<{ blockId: string; field?: string; message: string }> = [];
  const kind = blockDef?.kind;

  if (kind === 'questionnaire') {
    const dataDict = typeof blockData === 'object' && blockData !== null ? blockData : {};
    const questions = blockDef.questions || [];
    for (const q of questions) {
      const qid = q.id;
      const val = dataDict[qid];
      if (q.required && (val === null || val === undefined || val === '')) {
        errors.push({
          blockId: blockDef.id,
          field: qid,
          message: `'${q.label}' is required.`,
        });
      }
    }
    for (const v of blockDef.validations || []) {
      if (!validateRule(v.rule, dataDict)) {
        const item = {
          blockId: blockDef.id,
          message: v.message || 'Validation condition failed.',
        };
        if (v.severity === 'warning') warnings.push(item);
        else errors.push(item);
      }
    }
  } else if (kind === 'grid') {
    const gridData = typeof blockData === 'object' && blockData !== null ? blockData : {};
    const { columns: cols, rows } = getResolvedGridAxes(blockDef);

    for (const r of rows) {
      const rowKey = r.id;
      const rowData = gridData[rowKey] || {};

      for (const col of cols) {
        const colKey = col.id;
        const val = rowData[colKey];
        if (col.required && !col.derive && (val === null || val === undefined || val === '')) {
          errors.push({
            blockId: blockDef.id,
            field: `${rowKey}.${colKey}`,
            message: `Row '${r.label}', field '${col.label}' is required.`,
          });
        }
      }

      for (const v of blockDef.validations || []) {
        if (!validateRule(v.rule, rowData)) {
          const item = {
            blockId: blockDef.id,
            message: `Row '${r.label}': ${v.message || 'Validation rule failed.'}`,
          };
          if (v.severity === 'warning') warnings.push(item);
          else errors.push(item);
        }
      }
    }
  } else if (kind === 'records') {
    const rowsList = Array.isArray(blockData) ? blockData : [];
    if (!blockDef.allowEmpty && rowsList.length === 0) {
      errors.push({
        blockId: blockDef.id,
        message: 'At least one record row is required.',
      });
    }

    const fields = blockDef.fields || [];
    rowsList.forEach((row, idx) => {
      for (const f of fields) {
        const val = row[f.id];
        if (f.required && !f.derive && (val === null || val === undefined || val === '')) {
          errors.push({
            blockId: blockDef.id,
            field: `row_${idx + 1}.${f.id}`,
            message: `Row ${idx + 1}: '${f.label}' is required.`,
          });
        }
      }
      for (const v of blockDef.validations || []) {
        if (!validateRule(v.rule, row)) {
          const item = {
            blockId: blockDef.id,
            message: `Row ${idx + 1}: ${v.message || 'Validation rule failed.'}`,
          };
          if (v.severity === 'warning') warnings.push(item);
          else errors.push(item);
        }
      }
    });
  }

  return { errors, warnings };
}

export function maskPii(value: any, isElevated: boolean = false): string {
  if (!value) return '';
  if (isElevated) return String(value);
  const s = String(value);
  if (s.length <= 4) return '***';
  return s.substring(0, 2) + '****' + s.substring(s.length - 2);
}

