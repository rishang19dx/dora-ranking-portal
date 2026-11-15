import React, { useEffect, useMemo, useState } from 'react';
import { TrendUp, TrendDown, Medal, FileText, FilePdf, Warning } from '@phosphor-icons/react';
import { motion } from 'motion/react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Legend, Cell,
} from 'recharts';
import { Link } from 'react-router-dom';
import { analyticsService, rankingsService } from '../../services/api';
import { useToast } from '../../components/ToastProvider';
import type {
  DepartmentAnalyticsResponse,
  GapAnalysisResponse,
  ParameterTrendsResponse,
} from '../../types';

const spring = { type: 'spring' as const, stiffness: 100, damping: 20 };
const containerVariants = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.1 } } };
const itemVariants = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0, transition: spring } };

const CYCLE_YEAR = 2027;
const RANKING_YEAR = 2025;
const CATEGORY = 'Engineering';
const RANGE_OPTIONS = [3, 5] as const;

const PARAM_COLOURS: Record<string, string> = {
  tlr: '#5a7359',
  rpc: '#003366',
  go: '#0284c7',
  oi: '#b98a6b',
  pr: '#8b5cf6',
};

function formatInr(value: number): string {
  if (value >= 10000000) return `₹${(value / 10000000).toFixed(2)} Cr`;
  if (value >= 100000) return `₹${(value / 100000).toFixed(2)} L`;
  return `₹${value.toLocaleString('en-IN')}`;
}

export default function AdminOverview() {
  const { showToast } = useToast();
  const [range, setRange] = useState<number>(5);
  const [trends, setTrends] = useState<ParameterTrendsResponse | null>(null);
  const [gap, setGap] = useState<GapAnalysisResponse | null>(null);
  const [analytics, setAnalytics] = useState<DepartmentAnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [briefingBusy, setBriefingBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      // Each panel degrades on its own: the ranking data is public and cached,
      // while the cycle analytics need an authenticated session.
      const [t, g, a] = await Promise.allSettled([
        rankingsService.getParameterTrends(CATEGORY, { last: range }),
        rankingsService.getGapAnalysis(CATEGORY, RANKING_YEAR),
        analyticsService.getDepartmentAnalytics(CYCLE_YEAR),
      ]);
      if (cancelled) return;
      if (t.status === 'fulfilled') setTrends(t.value);
      if (g.status === 'fulfilled') setGap(g.value);
      if (a.status === 'fulfilled') setAnalytics(a.value);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [range]);

  const entry = gap?.analysis?.[CATEGORY];
  const peers = entry?.vsPeers;
  const ownHistory = entry?.vsOwnHistory;
  const series = trends?.trends?.[CATEGORY]?.series ?? [];
  const labels = trends?.labels ?? gap?.labels ?? {};
  const order = trends?.parameterOrder ?? gap?.parameterOrder ?? [];

  const rankChartData = useMemo(
    () => series.map((p) => ({
      year: String(p.year),
      rank: typeof p.rank === 'number' ? p.rank : null,
      score: p.score,
    })),
    [series],
  );

  // Parameter-wise breakdown: what each parameter contributed to the total.
  const contributionChartData = useMemo(
    () => series.map((p) => {
      const row: Record<string, number | string | null> = { year: String(p.year) };
      order.forEach((k) => { row[k] = p.parameters?.[k]?.weightedContribution ?? null; });
      return row;
    }),
    [series, order],
  );

  const gapChartData = useMemo(
    () => (peers?.parameters ?? [])
      .filter((p) => p.weightedUpsideToBest !== null)
      .map((p) => ({
        name: (labels[p.key] ?? p.key).split(/[,&]/)[0].trim(),
        upside: p.weightedUpsideToBest ?? 0,
        gap: p.gapToBest ?? 0,
        leads: Boolean(p.leadsPeers),
      }))
      .sort((a, b) => b.upside - a.upside),
    [peers, labels],
  );

  const latest = series.length ? series[series.length - 1] : null;
  const first = series.length ? series[0] : null;
  const rankMove =
    latest && first && typeof latest.rank === 'number' && typeof first.rank === 'number'
      ? first.rank - latest.rank
      : null;

  const perf = analytics?.performance?.institute;
  const contrib = analytics?.contribution?.institute;
  const leaders = analytics?.contribution?.leaders;

  const handleBriefing = async () => {
    try {
      setBriefingBusy(true);
      await analyticsService.downloadBriefing(CYCLE_YEAR, { rankingYear: RANKING_YEAR });
      showToast('Boardroom briefing generated.', 'success');
    } catch {
      showToast('Could not generate the briefing.', 'error');
    } finally {
      setBriefingBusy(false);
    }
  };

  return (
    <motion.div initial="hidden" animate="show" variants={containerVariants} className="max-w-[1400px] mx-auto space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-zinc-900">Executive Dashboard</h1>
          <p className="text-zinc-500 mt-2 max-w-[65ch] leading-relaxed">
            NIRF {CATEGORY} performance, peer gap analysis and the live {CYCLE_YEAR} collection cycle.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center rounded-xl border border-slate-200 bg-white p-1" role="group" aria-label="Time range">
            {RANGE_OPTIONS.map((n) => (
              <button
                key={n}
                onClick={() => setRange(n)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  range === n ? 'bg-sage-600 text-white' : 'text-zinc-600 hover:bg-zinc-100'
                }`}
              >
                Last {n}y
              </button>
            ))}
          </div>
          <button
            onClick={handleBriefing}
            disabled={briefingBusy}
            className="bg-zinc-900 hover:bg-black disabled:opacity-60 active:scale-[0.98] text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-all inline-flex items-center gap-2"
          >
            <FilePdf weight="duotone" className="w-4 h-4" />
            {briefingBusy ? 'Generating…' : 'Boardroom briefing'}
          </button>
          <Link
            to="/admin/data-requests/new"
            className="bg-sage-600 hover:bg-sage-700 active:scale-[0.98] text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-all shadow-[0_8px_16px_-4px_rgba(90,115,89,0.3)]"
          >
            New Data Request
          </Link>
        </div>
      </div>

      {loading && (
        <div className="bg-white/70 border border-slate-200/50 rounded-[2rem] p-8 text-sm text-zinc-500">
          Loading executive analytics…
        </div>
      )}

      {/* KPI row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <motion.div variants={itemVariants}>
          <StatCard
            title={`NIRF ${CATEGORY} Rank`}
            value={latest && latest.rank !== null ? `${latest.rank}` : '—'}
            trend={
              rankMove === null
                ? `${RANKING_YEAR} standing`
                : `${rankMove > 0 ? '+' : ''}${rankMove} since ${first?.year}`
            }
            positive={(rankMove ?? 0) >= 0}
            icon={<Medal weight="duotone" className="w-6 h-6 text-soft-gold-600" />}
            iconBg="bg-soft-gold-50"
          />
        </motion.div>
        <motion.div variants={itemVariants}>
          <StatCard
            title="Total score"
            value={latest?.score !== null && latest?.score !== undefined ? `${latest.score}` : '—'}
            trend={`recomposed ${latest?.recomposedScore ?? '—'}`}
            positive
            icon={<TrendUp weight="duotone" className="w-6 h-6 text-sage-600" />}
            iconBg="bg-sage-50"
          />
        </motion.div>
        <motion.div variants={itemVariants}>
          <StatCard
            title="Addressable gap to peers"
            value={peers?.totalWeightedUpside !== undefined ? `${peers.totalWeightedUpside} pts` : '—'}
            trend={
              peers?.priorities?.length
                ? `${(labels[peers.priorities[0].key] ?? '').split(/[,&]/)[0].trim()} leads the gap`
                : 'leads every parameter'
            }
            positive={false}
            icon={<TrendDown weight="duotone" className="w-6 h-6 text-dusty-rose-600" />}
            iconBg="bg-dusty-rose-50"
          />
        </motion.div>
        <motion.div variants={itemVariants}>
          <StatCard
            title={`Cycle ${CYCLE_YEAR} completion`}
            value={perf ? `${perf.overallCompletionPct}%` : '—'}
            trend={
              perf
                ? `${perf.approved} approved · ${perf.awaitingReview} awaiting`
                : 'no submissions yet'
            }
            positive
            icon={<FileText weight="duotone" className="w-6 h-6 text-slate-blue-600" />}
            iconBg="bg-slate-blue-50"
          />
        </motion.div>
      </div>

      {/* Rank trajectory + parameter contribution */}
      <motion.div className="grid grid-cols-1 lg:grid-cols-5 gap-6" variants={containerVariants}>
        <motion.div variants={itemVariants} className="lg:col-span-2 bg-white/70 backdrop-blur-2xl border border-slate-200/50 rounded-[2rem] p-8 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)]">
          <h3 className="text-xl font-semibold tracking-tight text-zinc-900 mb-1">Rank trajectory</h3>
          <p className="text-xs text-zinc-500 mb-6">Published NIRF {CATEGORY} rank (lower is better).</p>
          <div className="h-[300px] w-full">
            {rankChartData.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={rankChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="rankFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#5a7359" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#5a7359" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" opacity={0.6} />
                  <XAxis dataKey="year" axisLine={false} tickLine={false} tick={{ fontSize: 13, fill: '#64748b' }} dy={10} />
                  <YAxis reversed axisLine={false} tickLine={false} tick={{ fontSize: 13, fill: '#64748b' }} />
                  <Tooltip contentStyle={{ borderRadius: '16px', border: '1px solid rgba(226,232,240,0.8)', padding: '12px' }} />
                  <Area type="monotone" dataKey="rank" name="NIRF rank" stroke="#5a7359" strokeWidth={3} fillOpacity={1} fill="url(#rankFill)" connectNulls />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <EmptyPanel message="Ranking history unavailable." />
            )}
          </div>
        </motion.div>

        <motion.div variants={itemVariants} className="lg:col-span-3 bg-white/70 backdrop-blur-2xl border border-slate-200/50 rounded-[2rem] p-8 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)]">
          <h3 className="text-xl font-semibold tracking-tight text-zinc-900 mb-1">
            Where the points came from
          </h3>
          <p className="text-xs text-zinc-500 mb-6">
            Each parameter's weighted contribution to the total score, so gains and losses are directly comparable.
          </p>
          <div className="h-[300px] w-full">
            {contributionChartData.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={contributionChartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" opacity={0.6} />
                  <XAxis dataKey="year" axisLine={false} tickLine={false} tick={{ fontSize: 13, fill: '#64748b' }} dy={8} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                  <Tooltip
                    contentStyle={{ borderRadius: '12px', border: '1px solid rgba(226,232,240,0.8)' }}
                    formatter={(v: any, k: any) => [`${Number(v).toFixed(2)} pts`, labels[k] ?? k]}
                  />
                  <Legend iconType="circle" wrapperStyle={{ paddingTop: 12, fontSize: 12 }} formatter={(k) => labels[k] ?? k} />
                  {order.map((k) => (
                    <Bar key={k} dataKey={k} stackId="score" fill={PARAM_COLOURS[k] ?? '#94a3b8'} barSize={34} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyPanel message="Parameter history unavailable." />
            )}
          </div>
        </motion.div>
      </motion.div>

      {/* Gap analysis */}
      <motion.div className="grid grid-cols-1 lg:grid-cols-5 gap-6" variants={containerVariants}>
        <motion.div variants={itemVariants} className="lg:col-span-3 bg-white/70 backdrop-blur-2xl border border-slate-200/50 rounded-[2rem] p-8 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)]">
          <h3 className="text-xl font-semibold tracking-tight text-zinc-900 mb-1">Gap to best peer</h3>
          <p className="text-xs text-zinc-500 mb-6">
            Points the total score would gain by matching the strongest 2nd-generation IIT on each parameter.
          </p>
          <div className="h-[280px] w-full">
            {gapChartData.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={gapChartData} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" opacity={0.6} />
                  <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                  <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 12, fontWeight: 600, fill: '#475569' }} width={110} />
                  <Tooltip
                    cursor={{ fill: 'rgba(241,245,249,0.4)' }}
                    contentStyle={{ borderRadius: '12px', border: '1px solid rgba(226,232,240,0.8)' }}
                    formatter={(v: any, _k: any, item: any) => [
                      `${Number(v).toFixed(2)} pts (raw gap ${item?.payload?.gap?.toFixed?.(2) ?? '—'})`,
                      'Weighted upside',
                    ]}
                  />
                  <Bar dataKey="upside" radius={[0, 8, 8, 0]} barSize={26}>
                    {gapChartData.map((d) => (
                      <Cell key={d.name} fill={d.leads ? '#5a7359' : '#b98a6b'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyPanel message="Gap analysis unavailable for this category." />
            )}
          </div>
        </motion.div>

        <motion.div variants={itemVariants} className="lg:col-span-2 bg-white/70 backdrop-blur-2xl border border-slate-200/50 rounded-[2rem] p-8 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)]">
          <h3 className="text-xl font-semibold tracking-tight text-zinc-900 mb-1">Against our own history</h3>
          <p className="text-xs text-zinc-500 mb-5">
            {ownHistory?.comparedAgainstYears?.length
              ? `Compared with ${ownHistory.comparedAgainstYears[0]}–${
                  ownHistory.comparedAgainstYears[ownHistory.comparedAgainstYears.length - 1]
                }.`
              : 'Parameter history against prior cycles.'}
          </p>
          {ownHistory?.available ? (
            <div className="space-y-2.5">
              {(ownHistory.parameters ?? []).map((p) => (
                <div key={p.key} className="flex items-center justify-between p-3 rounded-xl bg-white border border-slate-200/70">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-zinc-900 truncate">
                      {(labels[p.key] ?? p.key).split(/[,&]/)[0].trim()}
                    </div>
                    <div className="text-[11px] text-zinc-500">
                      now {p.own ?? '—'} · mean {p.historicalMean ?? '—'} · best {p.historicalBest ?? '—'}
                      {p.historicalBestYear ? ` (${p.historicalBestYear})` : ''}
                    </div>
                  </div>
                  <span
                    className={`shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full ${
                      p.belowOwnAverage ? 'bg-dusty-rose-50 text-dusty-rose-700' : 'bg-sage-50 text-sage-700'
                    }`}
                  >
                    {p.belowOwnAverage ? 'below average' : 'at or above'}
                  </span>
                </div>
              ))}
              {ownHistory.totalWeightedUpsideToOwnBest ? (
                <p className="text-xs text-zinc-500 pt-1">
                  Returning to our own peak on every parameter is worth{' '}
                  <span className="font-semibold text-zinc-900">
                    {ownHistory.totalWeightedUpsideToOwnBest} pts
                  </span>.
                </p>
              ) : null}
            </div>
          ) : (
            <EmptyPanel message={ownHistory?.reason ?? 'Historical comparison unavailable.'} />
          )}
        </motion.div>
      </motion.div>

      {/* Department contribution + cycle status */}
      <motion.div className="grid grid-cols-1 lg:grid-cols-5 gap-6" variants={containerVariants}>
        <motion.div variants={itemVariants} className="lg:col-span-3 bg-white/70 backdrop-blur-2xl border border-slate-200/50 rounded-[2rem] p-8 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)]">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-xl font-semibold tracking-tight text-zinc-900">Department contribution</h3>
            <Link to="/admin/data-collection" className="text-sm font-medium text-sage-600 hover:text-sage-700">View cycle</Link>
          </div>
          <p className="text-xs text-zinc-500 mb-5">
            {contrib
              ? `${formatInr(contrib.totalResearchFundingInr)} research funding across ${contrib.departmentsReporting} reporting unit(s).`
              : 'Submitted research funding and placement outcomes per unit.'}
          </p>
          {analytics?.contribution?.departments?.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-[11px] uppercase tracking-wider text-zinc-500">
                  <tr>
                    <th className="py-2 pr-4">School / Centre</th>
                    <th className="py-2 pr-4">Research funding</th>
                    <th className="py-2 pr-4">Share</th>
                    <th className="py-2 pr-4">Placement</th>
                    <th className="py-2">Ph.D out</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {analytics.contribution.departments.map((d) => (
                    <tr key={d.unitId} className="hover:bg-zinc-50/60">
                      <td className="py-2.5 pr-4 font-medium text-zinc-900">{d.shortName || d.unitName}</td>
                      <td className="py-2.5 pr-4 font-mono text-xs">{formatInr(d.researchFundingInr)}</td>
                      <td className="py-2.5 pr-4 text-zinc-600">{d.fundingSharePct !== null ? `${d.fundingSharePct}%` : '—'}</td>
                      <td className="py-2.5 pr-4 text-zinc-600">{d.placementRatePct !== null ? `${d.placementRatePct}%` : '—'}</td>
                      <td className="py-2.5 text-zinc-600">{d.phdGraduated || 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {leaders?.mostResearchFunding || leaders?.highestPlacementRate ? (
                <div className="flex flex-wrap gap-2 mt-4">
                  {leaders?.mostResearchFunding && (
                    <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-sage-50 text-sage-700">
                      Most funding: {leaders.mostResearchFunding.shortName || leaders.mostResearchFunding.unitName}
                    </span>
                  )}
                  {leaders?.highestPlacementRate && (
                    <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-slate-blue-50 text-slate-blue-700">
                      Best placement: {leaders.highestPlacementRate.shortName || leaders.highestPlacementRate.unitName}
                    </span>
                  )}
                </div>
              ) : null}
            </div>
          ) : (
            <EmptyPanel message={`No departmental values submitted for cycle ${CYCLE_YEAR} yet.`} />
          )}
        </motion.div>

        <motion.div variants={itemVariants} className="lg:col-span-2 bg-white/70 backdrop-blur-2xl border border-slate-200/50 rounded-[2rem] p-8 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)]">
          <h3 className="text-xl font-semibold tracking-tight text-zinc-900 mb-1">Collection bottlenecks</h3>
          <p className="text-xs text-zinc-500 mb-5">Sections with the lowest completion, holding up the export.</p>
          {analytics?.performance?.sections?.length ? (
            <div className="space-y-2.5">
              {analytics.performance.sections.slice(0, 6).map((s) => (
                <div key={s.sectionId} className="p-3 rounded-xl bg-white border border-slate-200/70">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium text-zinc-900 truncate">{s.title}</span>
                    <span className="shrink-0 text-xs font-semibold text-zinc-700">{s.completionPct}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-zinc-100 rounded-full overflow-hidden mt-2">
                    <div className="h-full bg-sage-600 rounded-full" style={{ width: `${s.completionPct}%` }} />
                  </div>
                  <div className="text-[11px] text-zinc-500 mt-1.5">
                    {s.settled}/{s.expected} settled · {s.awaitingReview} awaiting · {s.inCorrection} in correction
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-start gap-2 text-sm text-zinc-500">
              <Warning weight="duotone" className="w-4 h-4 mt-0.5 shrink-0" />
              <span>Cycle analytics need an active data request for {CYCLE_YEAR}.</span>
            </div>
          )}
        </motion.div>
      </motion.div>
    </motion.div>
  );
}

function EmptyPanel({ message }: { message: string }) {
  return (
    <div className="h-full w-full flex items-center justify-center text-sm text-zinc-400 text-center px-4">
      {message}
    </div>
  );
}

function StatCard({ title, value, trend, positive, icon, iconBg = 'bg-zinc-50' }: {
  title: string; value: string; trend: string; positive: boolean; icon: React.ReactNode; iconBg?: string;
}) {
  return (
    <div className="h-full bg-white/70 backdrop-blur-2xl border border-slate-200/50 p-8 rounded-[2rem] shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)] hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.08)] hover:-translate-y-1 transition-all flex flex-col justify-between group">
      <div className="flex justify-between items-start mb-6">
        <div className={`p-3 ${iconBg} rounded-2xl group-hover:scale-105 transition-transform`}>{icon}</div>
      </div>
      <div>
        <h4 className="text-zinc-500 text-sm font-medium mb-2">{title}</h4>
        <div className="flex flex-col gap-2">
          <span className="text-4xl font-semibold tracking-tight text-zinc-900">{value}</span>
          <span className={`w-fit text-xs font-semibold px-2.5 py-1 rounded-full ${positive ? 'bg-sage-50 text-sage-700' : 'bg-dusty-rose-50 text-dusty-rose-700'}`}>
            {trend}
          </span>
        </div>
      </div>
    </div>
  );
}
