import React from 'react';

/** One previously approved figure, as returned by the backend history engine. */
export interface HistoryCell {
  previous: unknown;
  basis: 'same-period' | 'prior-period';
  period: string | null;
  previousCycle: number;
  change: number | null;
  changePct: number | null;
  direction: 'up' | 'down' | 'same' | null;
  restated: boolean;
}

export interface SectionHistory {
  previousCycle: number;
  previousReference: string;
  cells: Record<string, Record<string, Record<string, HistoryCell>>>;
  questions: Record<string, Record<string, HistoryCell>>;
  records: Record<string, { previous: number; previousCycle: number }>;
}

/** Year-on-year moves at or beyond this size are highlighted for a second look. */
export const NOTABLE_CHANGE_PCT = 25;

export function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || typeof value === 'boolean') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const text = String(value).replace(/[,₹\s]/g, '');
  if (!text) return null;
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
}

const inr = (n: number) => n.toLocaleString('en-IN', { maximumFractionDigits: 2 });

/**
 * "Previous: X · New: Y · Change" beside an input (spec 2.6), recomputed as
 * the officer types. A different figure for a period that was already
 * reported is called out as a restatement; a large year-on-year move is
 * highlighted so it is checked before submission rather than at review.
 */
export function HistoryHint({ cell, current }: { cell?: HistoryCell; current: unknown }) {
  if (!cell) return null;
  const prev = toNumber(cell.previous);
  if (prev === null) return null;

  const now = toNumber(current);
  const delta = now === null ? null : now - prev;
  const pct = delta === null || prev === 0 ? null : (delta / Math.abs(prev)) * 100;
  const label = cell.basis === 'same-period'
    ? `Reported in NIRF ${cell.previousCycle}`
    : `${cell.period ?? 'Prior year'} (NIRF ${cell.previousCycle})`;

  const restated = cell.basis === 'same-period' && delta !== null && delta !== 0;
  const notable = cell.basis === 'prior-period' && pct !== null && Math.abs(pct) >= NOTABLE_CHANGE_PCT;
  const tone = restated || notable ? 'text-orange-700' : 'text-zinc-400';

  return (
    <div className={`text-[10px] mt-1 leading-tight ${tone}`} data-testid="history-hint">
      <span>{label}: {inr(prev)}</span>
      {delta !== null && delta !== 0 && (
        <span className="ml-1 font-semibold">
          {delta > 0 ? '▲' : '▼'} {pct === null ? inr(Math.abs(delta)) : `${Math.abs(pct).toFixed(1)}%`}
        </span>
      )}
      {delta === 0 && <span className="ml-1">· unchanged</span>}
      {restated && <span className="ml-1">· restated</span>}
    </div>
  );
}
