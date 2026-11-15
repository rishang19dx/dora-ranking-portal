import React, { useEffect, useMemo, useState } from 'react';
import { GitCompare, ShieldCheck, Trophy, ArrowUpRight, RefreshCw } from 'lucide-react';
import { rankingsService } from '../services/api';
import { useToast } from '../components/ToastProvider';
import type { GapAnalysisResponse, PeerGapRow, PeerStanding } from '../types';

interface ComparativeViewProps {
  /** Categories NIRF publishes parameter sub-scores for. */
  categories?: string[];
  year?: number;
}

const DEFAULT_CATEGORIES = ['Engineering', 'Overall'];
const SHORT = (name: string) => name.replace('Indian Institute of Technology ', 'IIT ');

export const ComparativeView: React.FC<ComparativeViewProps> = ({
  categories = DEFAULT_CATEGORIES,
  year = 2025,
}) => {
  const { showToast } = useToast();
  const [category, setCategory] = useState<string>(categories[0]);
  const [data, setData] = useState<GapAnalysisResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPeer, setSelectedPeer] = useState<string>('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const res = await rankingsService.getGapAnalysis(category, year);
        if (!cancelled) setData(res);
      } catch {
        if (!cancelled) showToast('Could not load peer comparison data.', 'error');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [category, year]);

  const entry = data?.analysis?.[category];
  const peers: PeerStanding[] = entry?.vsPeers?.peers ?? [];
  const labels = data?.labels ?? {};
  const order = data?.parameterOrder ?? [];
  const gapRows: PeerGapRow[] = entry?.vsPeers?.parameters ?? [];

  const target = useMemo(() => peers.find((p) => p.isTarget), [peers]);
  const peerList = useMemo(() => peers.filter((p) => !p.isTarget), [peers]);

  useEffect(() => {
    if (peerList.length && !peerList.some((p) => p.institute === selectedPeer)) {
      setSelectedPeer(peerList[0].institute);
    }
  }, [peerList, selectedPeer]);

  const compare = useMemo(
    () => peerList.find((p) => p.institute === selectedPeer) ?? peerList[0],
    [peerList, selectedPeer],
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="bg-white rounded-2xl p-6 border border-gray-200/80 shadow-sm">
        <h1 className="text-2xl font-bold text-[#003366] font-serif flex items-center gap-2">
          <GitCompare className="w-6 h-6 text-[#F58220]" />
          Peer Institute Comparative Analysis
        </h1>
        <p className="text-xs sm:text-sm text-gray-600 mt-1">
          Benchmarking IIT Mandi against the 2nd-generation IITs on the five scored NIRF
          parameters, from the published {year} results.
        </p>
      </div>

      {/* Controls */}
      <div className="bg-white rounded-2xl p-5 border border-gray-200/80 shadow-sm flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div>
            <label htmlFor="cmp-category" className="block text-xs font-bold text-gray-500 uppercase mb-1">
              Category
            </label>
            <select
              id="cmp-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="bg-slate-50 border border-gray-200 rounded-lg p-2.5 text-xs font-bold text-[#003366] focus:outline-none focus:ring-2 focus:ring-[#003366] w-full sm:w-48"
            >
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="cmp-peer" className="block text-xs font-bold text-gray-500 uppercase mb-1">
              Compare with
            </label>
            <select
              id="cmp-peer"
              value={selectedPeer}
              onChange={(e) => setSelectedPeer(e.target.value)}
              disabled={!peerList.length}
              className="bg-slate-50 border border-gray-200 rounded-lg p-2.5 text-xs font-bold text-[#003366] focus:outline-none focus:ring-2 focus:ring-[#003366] w-full sm:w-64 disabled:opacity-60"
            >
              {peerList.map((p) => (
                <option key={p.institute} value={p.institute}>
                  {SHORT(p.institute)} (Rank #{p.rank ?? '—'})
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="bg-amber-50 border border-amber-200 p-2.5 rounded-xl text-[11px] text-amber-800 font-medium">
          Figures are the sub-scores published by NIRF for {year}.
        </div>
      </div>

      {loading && (
        <div className="bg-white rounded-2xl p-8 border border-gray-200/80 text-center text-sm text-gray-500">
          <RefreshCw className="w-4 h-4 inline-block mr-2 animate-spin" />
          Loading peer comparison…
        </div>
      )}

      {!loading && !entry?.vsPeers?.available && (
        <div className="bg-white rounded-2xl p-8 border border-gray-200/80 text-center text-sm text-gray-500">
          {entry?.vsPeers?.reason ?? 'Peer comparison is unavailable for this category.'}
        </div>
      )}

      {/* Side-by-side */}
      {!loading && target && compare && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <InstituteCard standing={target} order={order} labels={labels} isTarget />
          <InstituteCard standing={compare} order={order} labels={labels} />
        </div>
      )}

      {/* Gap analysis */}
      {!loading && gapRows.length > 0 && (
        <div className="bg-white rounded-2xl p-6 border border-gray-200/80 shadow-sm">
          <h3 className="text-lg font-bold text-[#003366] font-serif mb-1 flex items-center gap-2">
            <Trophy className="w-5 h-5 text-[#F58220]" />
            Gap Analysis vs the Strongest Peer
          </h3>
          <p className="text-xs text-gray-600 mb-4">
            &ldquo;Weighted upside&rdquo; is the points the overall score would gain by matching the
            best peer on that parameter, so the rows are directly comparable.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#003366] text-white font-semibold">
                  <th className="p-3">Parameter</th>
                  <th className="p-3 text-center">Weight</th>
                  <th className="p-3 text-center">IIT Mandi</th>
                  <th className="p-3 text-center">Peer best</th>
                  <th className="p-3">Best peer</th>
                  <th className="p-3 text-center">Gap</th>
                  <th className="p-3 text-center">Weighted upside</th>
                  <th className="p-3 text-center">Percentile</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {gapRows.map((r) => (
                  <tr key={r.key} className={r.leadsPeers ? 'bg-emerald-50/50' : 'hover:bg-slate-50'}>
                    <td className="p-3 font-semibold text-gray-900">{labels[r.key] ?? r.key}</td>
                    <td className="p-3 text-center text-gray-600">{Math.round(r.weight * 100)}%</td>
                    <td className="p-3 text-center font-bold text-[#003366]">{r.own ?? '—'}</td>
                    <td className="p-3 text-center">{r.peerBest ?? '—'}</td>
                    <td className="p-3 text-gray-700">{r.peerBestInstitute ? SHORT(r.peerBestInstitute) : '—'}</td>
                    <td className={`p-3 text-center font-semibold ${r.leadsPeers ? 'text-emerald-700' : 'text-rose-700'}`}>
                      {r.gapToBest !== null ? (r.leadsPeers ? 'leads' : r.gapToBest.toFixed(2)) : '—'}
                    </td>
                    <td className="p-3 text-center font-black text-[#F58220]">
                      {r.weightedUpsideToBest !== null ? r.weightedUpsideToBest.toFixed(2) : '—'}
                    </td>
                    <td className="p-3 text-center text-gray-600">
                      {r.percentileAmongPeers !== null ? `${r.percentileAmongPeers}%` : '—'}
                    </td>
                  </tr>
                ))}
                <tr className="bg-amber-50 font-bold">
                  <td className="p-3" colSpan={6}>Total addressable upside</td>
                  <td className="p-3 text-center text-[#F58220]">
                    {entry?.vsPeers?.totalWeightedUpside?.toFixed(2) ?? '—'}
                  </td>
                  <td className="p-3" />
                </tr>
              </tbody>
            </table>
          </div>

          {entry?.vsPeers?.priorities?.length ? (
            <div className="mt-4 p-4 bg-slate-50 rounded-xl border border-slate-200/80">
              <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500 block mb-2">
                Priority areas
              </span>
              <ul className="space-y-1.5">
                {entry.vsPeers.priorities.slice(0, 3).map((p) => (
                  <li key={p.key} className="text-xs text-gray-700 flex items-start gap-1.5">
                    <ArrowUpRight className="w-3.5 h-3.5 text-[#F58220] mt-0.5 shrink-0" />
                    <span>
                      <strong>{p.label}</strong> — {p.gapToBest?.toFixed(2)} points behind{' '}
                      {p.peerBestInstitute ? SHORT(p.peerBestInstitute) : 'the best peer'}, worth{' '}
                      <strong>{p.weightedUpsideToBest?.toFixed(2)} points</strong> on the total.
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      )}

      {/* Full matrix */}
      {!loading && peers.length > 0 && (
        <div className="bg-white rounded-2xl p-6 border border-gray-200/80 shadow-sm">
          <h3 className="text-lg font-bold text-[#003366] font-serif mb-3">
            Peer IIT Benchmarking Table ({year} NIRF {category})
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#003366] text-white font-semibold">
                  <th className="p-3">Institute</th>
                  <th className="p-3 text-center">Rank</th>
                  <th className="p-3 text-center">Score</th>
                  {order.map((k) => (
                    <th key={k} className="p-3 text-center" title={labels[k] ?? k}>
                      {k.toUpperCase()}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {peers.map((p) => (
                  <tr
                    key={p.institute}
                    className={`transition ${p.isTarget ? 'bg-blue-50/80 font-bold text-[#003366]' : 'text-gray-800 hover:bg-slate-50'}`}
                  >
                    <td className="p-3">
                      <span className="flex items-center gap-1.5">
                        {SHORT(p.institute)}
                        {p.isTarget && (
                          <span className="bg-[#F58220] text-white text-[9px] px-1.5 py-0.5 rounded font-sans uppercase">
                            IIT Mandi
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="p-3 text-center text-sm font-extrabold">#{p.rank ?? '—'}</td>
                    <td className="p-3 text-center font-bold">{p.score ?? '—'}</td>
                    {order.map((k) => (
                      <td key={k} className="p-3 text-center">{p.parameters?.[k] ?? '—'}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-gray-500 mt-3 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            Official NIRF published sub-scores. Total = 0.30·TLR + 0.30·RPC + 0.20·GO + 0.10·OI + 0.10·PR.
          </p>
        </div>
      )}
    </div>
  );
};

function InstituteCard({
  standing, order, labels, isTarget = false,
}: {
  standing: PeerStanding;
  order: string[];
  labels: Record<string, string>;
  isTarget?: boolean;
}) {
  return (
    <div className={`bg-white rounded-2xl p-6 relative ${isTarget ? 'border-2 border-[#003366] shadow-md' : 'border border-gray-200 shadow-sm'}`}>
      <div className={`absolute top-0 right-0 text-[10px] font-bold px-3 py-1 rounded-bl-xl uppercase tracking-wider ${isTarget ? 'bg-[#003366] text-white' : 'bg-gray-200 text-gray-700'}`}>
        {isTarget ? 'Focus Institute' : 'Peer Comparison'}
      </div>
      <h2 className={`text-xl font-bold font-serif mb-4 ${isTarget ? 'text-[#003366]' : 'text-gray-800'}`}>
        {SHORT(standing.institute)}
      </h2>
      <div className={`p-4 rounded-xl mb-5 flex items-center justify-between border ${isTarget ? 'bg-blue-50 border-blue-100' : 'bg-slate-100 border-slate-200'}`}>
        <div>
          <span className="text-xs text-gray-500 uppercase font-bold block">NIRF Rank</span>
          <span className={`text-3xl font-black ${isTarget ? 'text-[#003366]' : 'text-gray-800'}`}>
            #{standing.rank ?? '—'}
          </span>
        </div>
        <div>
          <span className="text-xs text-gray-500 uppercase font-bold block">Total Score</span>
          <span className={`text-2xl font-black ${isTarget ? 'text-emerald-700' : 'text-gray-700'}`}>
            {standing.score ?? '—'} / 100
          </span>
        </div>
      </div>
      <div className="space-y-3 text-xs">
        {order.map((k) => (
          <div key={k} className="flex justify-between p-2.5 bg-slate-50 rounded border border-slate-100">
            <span className="text-gray-600 font-medium">{labels[k] ?? k}:</span>
            <span className="font-bold text-gray-900">{standing.parameters?.[k] ?? '—'}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
