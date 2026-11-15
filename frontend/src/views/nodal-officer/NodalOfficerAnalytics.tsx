import React, { useEffect, useState } from 'react';
import { ChartBar, TrendUp, TrendDown, Info } from '@phosphor-icons/react';
import { analyticsService } from '../../services/api';
import type { DepartmentAnalyticsResponse, DepartmentBenchmark } from '../../types';

const CYCLE_YEAR = 2027;

function formatInr(value: number): string {
  if (value >= 10000000) return `₹${(value / 10000000).toFixed(2)} Cr`;
  if (value >= 100000) return `₹${(value / 100000).toFixed(2)} L`;
  return `₹${Math.round(value).toLocaleString('en-IN')}`;
}

interface Metric {
  label: string;
  own: number | null | undefined;
  median: number | null | undefined;
  format: (v: number) => string;
}

/**
 * A department head's own analytics (spec 2.16). The API returns only this
 * officer's units, plus anonymous institute medians so they can see where the
 * department excels and where it needs work - no other department is shown
 * (spec 2.18).
 */
export default function NodalOfficerAnalytics() {
  const [data, setData] = useState<DepartmentAnalyticsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await analyticsService.getDepartmentAnalytics(CYCLE_YEAR);
        if (!cancelled) setData(res);
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.response?.data?.error
            ?? (err?.response?.status === 401 ? 'Sign in to view your department analytics.'
              : 'Could not load your department analytics.'));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return <div className="max-w-[1100px] mx-auto text-sm text-zinc-500">Loading your department analytics…</div>;
  }
  if (error || !data) {
    return (
      <div className="max-w-[1100px] mx-auto bg-white border border-slate-200/60 rounded-2xl p-8 text-sm text-zinc-600">
        {error ?? 'No analytics available.'}
      </div>
    );
  }

  const dept = data.contribution.departments[0];
  const perf = data.performance.departments[0];
  const bench: DepartmentBenchmark | null | undefined = data.benchmark;
  const name = dept?.shortName || dept?.unitName || perf?.shortName || perf?.unitName || 'Your department';

  const metrics: Metric[] = [
    { label: 'Research funding (latest FY)', own: dept?.researchFundingInr, median: bench?.medianResearchFundingInr, format: formatInr },
    { label: 'Placement rate', own: dept?.placementRatePct, median: bench?.medianPlacementRatePct, format: (v) => `${v}%` },
    { label: 'Placement + higher studies', own: dept?.outcomeRatePct, median: bench?.medianOutcomeRatePct, format: (v) => `${v}%` },
    { label: 'Ph.D completions', own: dept?.phdGraduated, median: bench?.medianPhdGraduated, format: (v) => `${Math.round(v)}` },
    { label: 'Cycle completion', own: perf?.completionPct, median: bench?.medianCompletionPct, format: (v) => `${v}%` },
    { label: 'Approved first time', own: perf?.firstPassApprovalPct, median: bench?.medianFirstPassApprovalPct, format: (v) => `${v}%` },
  ];
  const comparable = bench && !bench.withheld;

  return (
    <div className="max-w-[1100px] mx-auto space-y-6">
      <div>
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-zinc-900">{name}</h1>
        <p className="text-zinc-500 mt-2 text-sm">
          Your department&apos;s contribution to NIRF {CYCLE_YEAR}, from approved returns only.
        </p>
      </div>

      {!comparable && (
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 text-amber-900 text-xs rounded-xl p-3">
          <Info className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{bench?.reason ?? 'Institute benchmarks are not available yet.'}</span>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {metrics.map((m) => {
          const hasOwn = m.own !== null && m.own !== undefined;
          const hasMedian = comparable && m.median !== null && m.median !== undefined;
          const ahead = hasOwn && hasMedian ? (m.own as number) >= (m.median as number) : null;
          return (
            <div key={m.label} className="bg-white border border-slate-200/60 rounded-2xl p-5">
              <div className="text-xs font-medium text-zinc-500">{m.label}</div>
              <div className="text-2xl font-semibold text-zinc-900 mt-1">{hasOwn ? m.format(m.own as number) : '—'}</div>
              {hasMedian && (
                <div className={`mt-2 inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                  ahead ? 'bg-sage-50 text-sage-700' : 'bg-dusty-rose-50 text-dusty-rose-700'
                }`}>
                  {ahead ? <TrendUp className="w-3 h-3" /> : <TrendDown className="w-3 h-3" />}
                  {ahead ? 'At or above' : 'Below'} institute median ({m.format(m.median as number)})
                </div>
              )}
            </div>
          );
        })}
      </div>

      {perf && perf.missingSections.length > 0 && (
        <div className="bg-white border border-slate-200/60 rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-zinc-900 flex items-center gap-2">
            <ChartBar className="w-4 h-4 text-sage-600" /> Sections still to return
          </h2>
          <ul className="mt-2 text-sm text-zinc-600 list-disc pl-5">
            {perf.missingSections.map((s) => <li key={s}>{s}</li>)}
          </ul>
        </div>
      )}

      {comparable && (
        <p className="text-[11px] text-zinc-400">
          Compared with the median of {bench?.unitsCompared} reporting units. No other department&apos;s figures are shown.
        </p>
      )}
    </div>
  );
}
