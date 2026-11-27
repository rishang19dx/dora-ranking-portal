import React, { useEffect, useMemo, useState } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Info, Table, ChartLine } from '@phosphor-icons/react';
import { publicRankingService, type PublicRankingSystems, type RankingPoint } from '../services/api';

// Chart tokens. One series per chart (small multiples), so one hue: slot 1 of
// the validated reference palette. Text never wears the series colour.
const SERIES = '#2a78d6';
const GRID = '#e8e8e4';
const AXIS_TEXT = '#52514e';
const SURFACE = '#ffffff';

type System = PublicRankingSystems['systems'][number];

/**
 * An even, rounded rank axis around the data: steps of 1, 2 or 5 x 10^k, with
 * a step of headroom on either side so no point sits on the frame. Straight
 * segments are drawn between points; a smoothed curve would imply ranks the
 * institute never held.
 */
export function rankAxis(ranks: number[]): { domain: [number, number]; ticks: number[] } {
  const min = Math.min(...ranks);
  const max = Math.max(...ranks);
  const rough = Math.max(1, (max - min) / 3);
  const mag = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 5, 10].map((m) => m * mag).find((s) => s >= rough) ?? 10 * mag;
  const lo = Math.max(step === 1 ? 1 : 0, Math.floor(min / step) * step - (min % step === 0 ? step : 0));
  const hi = Math.ceil(max / step) * step + (max % step === 0 ? step : 0);
  const ticks: number[] = [];
  for (let t = lo; t <= hi; t += step) ticks.push(t);
  return { domain: [lo, hi], ticks };
}

function movement(series: RankingPoint[]) {
  if (series.length < 2) return null;
  const [prev, last] = series.slice(-2);
  const places = Math.round(prev.plotRank - last.plotRank); // positive = moved up
  return { places, prevYear: prev.year };
}

function PointTooltip({ active, payload }: { active?: boolean; payload?: { payload: RankingPoint }[] }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-sm px-3 py-2 text-xs text-zinc-700">
      <div className="font-semibold text-zinc-900">{p.year}</div>
      <div>Rank {p.rankText}</div>
      {p.score !== null && p.score !== undefined && <div>Score {p.score}</div>}
      {p.demo && <div className="text-orange-700 mt-0.5">Illustrative data</div>}
    </div>
  );
}

function SystemCard({ system }: { system: System }) {
  const series = system.series;
  const last = series[series.length - 1];
  const move = movement(series);
  const isDemo = series.some((p) => p.demo);
  const { domain, ticks } = rankAxis(series.map((p) => p.plotRank));

  return (
    <article className="bg-white border border-slate-200/70 rounded-2xl p-5" aria-label={`${system.label} trend`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-zinc-900">{system.label}</h3>
          <p className="text-xs text-zinc-500">{series[0].year}–{last.year}</p>
        </div>
        {isDemo && (
          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-orange-50 text-orange-800">
            Illustrative
          </span>
        )}
      </div>
      <div className="mt-3 flex items-baseline gap-3">
        <span className="text-3xl font-semibold text-zinc-900 tabular-nums">#{last.rankText}</span>
        <span className="text-xs text-zinc-500">in {last.year}</span>
        {move && move.places !== 0 && (
          <span className="text-xs font-semibold text-zinc-700">
            {move.places > 0 ? '▲' : '▼'} {Math.abs(move.places)} place{Math.abs(move.places) === 1 ? '' : 's'} since {move.prevYear}
          </span>
        )}
        {move && move.places === 0 && <span className="text-xs text-zinc-500">unchanged since {move.prevYear}</span>}
      </div>
      <div className="h-40 mt-3">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={series} margin={{ top: 8, right: 12, bottom: 0, left: -8 }}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="year" tick={{ fill: AXIS_TEXT, fontSize: 11 }} tickLine={false} axisLine={{ stroke: GRID }} />
            {/* Lower rank is better, so the axis runs best-at-top. */}
            <YAxis reversed domain={domain} ticks={ticks} interval={0} allowDecimals={false} tick={{ fill: AXIS_TEXT, fontSize: 11 }} tickLine={false} axisLine={false} width={44} />
            <Tooltip content={<PointTooltip />} cursor={{ stroke: GRID }} />
            <Line
              type="linear"
              dataKey="plotRank"
              stroke={SERIES}
              strokeWidth={2}
              dot={{ r: 4, fill: SERIES, stroke: SURFACE, strokeWidth: 2 }}
              activeDot={{ r: 6, fill: SERIES, stroke: SURFACE, strokeWidth: 2 }}
              strokeDasharray={isDemo ? '5 4' : undefined}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      {series.some((p) => p.rankHigh === null || p.rankHigh !== p.rankLow) && (
        <p className="text-[11px] text-zinc-500 mt-1">Banded ranks (e.g. 801–1000) are plotted at the band&rsquo;s midpoint.</p>
      )}
    </article>
  );
}

/**
 * Public portal: IIT Mandi's year-wise position in every ranking system DORA
 * tracks (spec 2.14). No login. Each system has its own chart because their
 * rank scales differ by an order of magnitude; one shared axis would flatten
 * NIRF into a line along the top.
 */
export function RankingSystemsView() {
  const [data, setData] = useState<PublicRankingSystems | null>(null);
  const [error, setError] = useState(false);
  const [family, setFamily] = useState('ALL');
  const [view, setView] = useState<'charts' | 'table'>('charts');

  useEffect(() => {
    publicRankingService.systems().then(setData).catch(() => setError(true));
  }, []);

  const families = useMemo(() => ['ALL', ...Array.from(new Set((data?.systems ?? []).map((s) => s.family)))], [data]);
  const shown = (data?.systems ?? []).filter((s) => family === 'ALL' || s.family === family);
  const years = useMemo(
    () => Array.from(new Set(shown.flatMap((s) => s.series.map((p) => p.year)))).sort((a, b) => a - b),
    [shown],
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl md:text-3xl font-semibold tracking-tight text-zinc-900 font-serif">IIT Mandi across ranking systems</h2>
        <p className="text-sm text-zinc-500 mt-1 max-w-[70ch]">
          Year-wise rank in each ranking IIT Mandi takes part in. NIRF figures come from the published NIRF results;
          other systems are entered by the DORA office from each ranking&rsquo;s own publication.
        </p>
      </div>

      {data?.hasDemoData && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-orange-50 border border-orange-200 text-sm text-orange-900" role="note">
          <Info weight="fill" className="w-4 h-4 mt-0.5 shrink-0" />
          <span>Charts marked <strong>Illustrative</strong> (dashed) show demonstration data, not published results.</span>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Ranking system">
          {families.map((f) => (
            <button
              key={f}
              onClick={() => setFamily(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${family === f ? 'bg-zinc-900 text-white' : 'bg-white border border-zinc-200 text-zinc-600 hover:bg-zinc-50'}`}
            >
              {f === 'ALL' ? 'All systems' : f}
            </button>
          ))}
        </div>
        <div className="flex gap-1.5" role="group" aria-label="View">
          <button onClick={() => setView('charts')} aria-pressed={view === 'charts'}
            className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold ${view === 'charts' ? 'bg-sage-50 text-sage-800 ring-1 ring-sage-500/20' : 'text-zinc-600'}`}>
            <ChartLine className="w-4 h-4" /> Charts
          </button>
          <button onClick={() => setView('table')} aria-pressed={view === 'table'}
            className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold ${view === 'table' ? 'bg-sage-50 text-sage-800 ring-1 ring-sage-500/20' : 'text-zinc-600'}`}>
            <Table className="w-4 h-4" /> Table
          </button>
        </div>
      </div>

      {error ? (
        <p className="text-sm text-zinc-500">Ranking data is unavailable right now. Please try again later.</p>
      ) : !data ? (
        <p className="text-sm text-zinc-400">Loading rankings…</p>
      ) : shown.length === 0 ? (
        <p className="text-sm text-zinc-500">No ranking results have been published yet.</p>
      ) : view === 'charts' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {shown.map((s) => <SystemCard key={s.id} system={s} />)}
        </div>
      ) : (
        <div className="bg-white border border-slate-200/70 rounded-2xl overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">IIT Mandi rank by ranking system and year</caption>
            <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wider text-zinc-500">
              <tr>
                <th className="px-4 py-2">System</th>
                {years.map((y) => <th key={y} className="px-4 py-2 text-right">{y}</th>)}
              </tr>
            </thead>
            <tbody>
              {shown.map((s) => (
                <tr key={s.id} className="border-t border-slate-100">
                  <td className="px-4 py-2 font-medium text-zinc-900">
                    {s.label}
                    {s.series.some((p) => p.demo) && <span className="ml-2 text-[10px] uppercase text-orange-700">illustrative</span>}
                  </td>
                  {years.map((y) => {
                    const p = s.series.find((pt) => pt.year === y);
                    return <td key={y} className="px-4 py-2 text-right tabular-nums text-zinc-700">{p ? p.rankText : '—'}</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
