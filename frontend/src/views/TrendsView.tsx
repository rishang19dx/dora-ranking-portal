import React, { useState, useMemo, useEffect } from "react";
import {
  TrendingUp,
  Award,
  ArrowUpRight,
  ArrowDownRight,
  ShieldCheck,
  Filter,
  GitCompare,
  Building2,
  Sparkles,
  RefreshCw,
  CheckSquare,
  Square,
  BarChart3,
  SlidersHorizontal,
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  BarChart,
  Bar,
  Cell,
} from "recharts";
import { RankingItem, RankingAgency, TrendsApiResponse, PeerInstituteTrend, MandiYearlyTrend } from "../types";
import { calculateRankChange } from "../utils/helpers";
import { rankingsService } from "../services/api";
import { useToast } from "../components/ToastProvider";

interface TrendsViewProps {
  rankings?: RankingItem[];
  agencies?: RankingAgency[];
}

// Color palette for 2nd Gen IITs comparative lines
const PEER_COLORS: Record<string, string> = {
  "IIT Mandi": "#F58220",       // Vibrant Saffron (Target Focus)
  "IIT Hyderabad": "#003366",   // Deep Institutional Navy
  "IIT Indore": "#0284c7",       // Sky Blue
  "IIT Gandhinagar": "#10b981",  // Emerald Green
  "IIT Ropar": "#8b5cf6",        // Purple
  "IIT Jodhpur": "#ec4899",      // Rose Pink
  "IIT Bhubaneswar": "#f59e0b",  // Amber
  "IIT Patna": "#64748b",        // Slate Gray
};

export const TrendsView: React.FC<TrendsViewProps> = () => {
  const [activeTab, setActiveTab] = useState<"individual" | "peer_comparison">("individual");
  const [selectedCategory, setSelectedCategory] = useState<string>("Engineering");
  const [trendsData, setTrendsData] = useState<TrendsApiResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [selectedPeers, setSelectedPeers] = useState<Record<string, boolean>>({
    "IIT Mandi": true,
    "IIT Hyderabad": true,
    "IIT Indore": true,
    "IIT Gandhinagar": true,
    "IIT Ropar": true,
    "IIT Jodhpur": true,
    "IIT Bhubaneswar": true,
    "IIT Patna": true,
  });

  const { showToast } = useToast();

  const fetchTrends = async () => {
    try {
      setLoading(true);
      const res = await rankingsService.getTrends();
      setTrendsData(res);
    } catch (err) {
      console.error("Failed to load trends data:", err);
      showToast("Failed to fetch NIRF 5-year trend data from backend.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrends();
  }, []);

  const handleRefreshScraper = async () => {
    try {
      setRefreshing(true);
      await rankingsService.updateScraper();
      await fetchTrends();
      showToast("NIRF rankings cache updated from official portal.", "success");
    } catch {
      showToast("Failed to trigger scraper update.", "error");
    } finally {
      setRefreshing(false);
    }
  };

  // 1. Data for Individual IIT Mandi
  const mandiCategoryData: MandiYearlyTrend[] = useMemo(() => {
    if (!trendsData?.iit_mandi_trends) return [];
    return trendsData.iit_mandi_trends[selectedCategory] || [];
  }, [trendsData, selectedCategory]);

  const mandiChartData = useMemo(() => {
    return mandiCategoryData.map((item) => ({
      year: String(item.year),
      rank: typeof item.rank === "number" ? item.rank : parseInt(String(item.rank)) || null,
      score: item.score || 0,
      previous_rank: item.previous_rank,
      rank_change: item.rank_change,
    }));
  }, [mandiCategoryData]);

  // Overall 5-Year Net Movement for Mandi
  const mandiProgression = useMemo(() => {
    if (mandiCategoryData.length < 2) return null;
    const start = mandiCategoryData[0];
    const end = mandiCategoryData[mandiCategoryData.length - 1];
    const sRank = Number(start.rank);
    const eRank = Number(end.rank);
    const diff = sRank - eRank; // Positive = improved

    const validRanks = mandiCategoryData
      .map((d) => Number(d.rank))
      .filter((r) => !isNaN(r));
    const bestRank = validRanks.length ? Math.min(...validRanks) : "N/A";

    return {
      startYear: start.year,
      startRank: start.rank,
      endYear: end.year,
      endRank: end.rank,
      diff,
      improved: diff > 0,
      bestRank,
      latestScore: end.score,
      latestParameters: end.parameters,
    };
  }, [mandiCategoryData]);

  // 2. Data for 2nd Gen IITs Comparison
  const peerList: PeerInstituteTrend[] = useMemo(() => {
    if (!trendsData?.peer_comparison) return [];
    return trendsData.peer_comparison[selectedCategory] || [];
  }, [trendsData, selectedCategory]);

  // Transform for Multi-Line Comparison Chart: Year as X-axis, each Peer as Line
  const peerComparisonChartData = useMemo(() => {
    if (!trendsData?.years) return [];
    return trendsData.years.map((yr) => {
      const row: Record<string, any> = { year: String(yr) };
      peerList.forEach((peer) => {
        const rk = peer.ranks[String(yr)];
        row[peer.short_name] = typeof rk === "number" ? rk : (parseInt(String(rk)) || null);
      });
      return row;
    });
  }, [trendsData, peerList]);

  // 2025 Current Standing Bar Chart Data (sorted by 2025 rank ascending)
  const peerStanding2025Data = useMemo(() => {
    return peerList
      .filter((p) => p.latest_rank !== null && typeof p.latest_rank === "number")
      .map((p) => ({
        name: p.short_name,
        rank: p.latest_rank,
        score: p.latest_score || 0,
        isTarget: p.is_target,
      }))
      .sort((a, b) => (Number(a.rank) || 999) - (Number(b.rank) || 999));
  }, [peerList]);

  const togglePeer = (name: string) => {
    setSelectedPeers((prev) => ({
      ...prev,
      [name]: !prev[name],
    }));
  };

  const toggleAllPeers = (enable: boolean) => {
    const updated: Record<string, boolean> = {};
    Object.keys(selectedPeers).forEach((k) => {
      updated[k] = enable;
    });
    // Always keep IIT Mandi enabled
    updated["IIT Mandi"] = true;
    setSelectedPeers(updated);
  };

  // Custom Tooltip for Mandi Individual Chart
  const CustomMandiTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-3.5 rounded-xl shadow-xl border border-slate-200 text-xs">
          <p className="font-bold text-[#003366] text-sm">{label} NIRF Evaluation</p>
          <div className="flex items-center gap-2 my-1">
            <span className="text-xl font-black text-[#F58220]">Rank #{data.rank}</span>
            {data.rank_change !== undefined && data.rank_change !== 0 && (
              <span
                className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                  data.rank_change > 0 ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
                }`}
              >
                {data.rank_change > 0 ? `↑ +${data.rank_change}` : `↓ ${data.rank_change}`}
              </span>
            )}
          </div>
          {data.score > 0 && <p className="text-slate-600 font-medium">Total NIRF Score: {data.score} / 100</p>}
          <p className="text-[10px] text-emerald-700 font-semibold mt-1.5 flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5" /> Official Verified NIRF Data
          </p>
        </div>
      );
    }
    return null;
  };

  // Custom Tooltip for Multi-Line Peer Comparison Chart
  const CustomPeerTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const sorted = [...payload].sort((a, b) => (Number(a.value) || 999) - (Number(b.value) || 999));
      return (
        <div className="bg-white p-4 rounded-xl shadow-2xl border border-slate-200 text-xs min-w-[210px]">
          <p className="font-bold text-[#003366] text-sm border-b pb-1.5 mb-2">
            {label} NIRF Rankings ({selectedCategory})
          </p>
          <div className="space-y-1.5">
            {sorted.map((item: any) => {
              const isMandi = item.name === "IIT Mandi";
              return (
                <div
                  key={item.name}
                  className={`flex items-center justify-between px-2 py-1 rounded ${
                    isMandi ? "bg-amber-50 font-bold border border-amber-200" : "font-medium"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className={isMandi ? "text-[#003366] font-bold" : "text-slate-700"}>{item.name}</span>
                  </span>
                  <span className={isMandi ? "text-[#F58220] font-black" : "text-slate-900"}>
                    {item.value ? `#${item.value}` : "Band"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header Banner */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-sage-700 bg-sage-50 px-3 py-1 rounded-full ring-1 ring-sage-500/20 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#F58220]" />
              5-Year Longitudinal NIRF Analytics
            </span>
            <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
              2021 – 2025 Cycle
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#003366] font-serif tracking-tight">
            Institutional Ranking Trends
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-2xl leading-relaxed">
            Multi-year trajectory mapping for <strong>IIT Mandi</strong> with direct peer benchmarking against all <strong>2nd Generation IITs</strong> across Engineering, Innovation, and Overall categories.
          </p>
        </div>

        {/* Live Refresh and Action Buttons */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleRefreshScraper}
            disabled={refreshing}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl shadow-xs transition"
            title="Re-scrape latest ranking data from official NIRF website"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-slate-600 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "Scraping..." : "Sync NIRF Data"}
          </button>
        </div>
      </div>

      {/* Main Mode Tabs & Category Filter Bar */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Navigation Mode Tabs */}
        <div className="flex items-center p-1 bg-slate-100/80 rounded-xl w-full md:w-auto">
          <button
            onClick={() => setActiveTab("individual")}
            className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-2 rounded-lg text-xs font-bold transition ${
              activeTab === "individual"
                ? "bg-white text-[#003366] shadow-sm ring-1 ring-black/5"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <TrendingUp className="w-4 h-4 text-[#F58220]" />
            IIT Mandi Trajectory
          </button>
          <button
            onClick={() => setActiveTab("peer_comparison")}
            className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-2 rounded-lg text-xs font-bold transition ${
              activeTab === "peer_comparison"
                ? "bg-white text-[#003366] shadow-sm ring-1 ring-black/5"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <GitCompare className="w-4 h-4 text-[#003366]" />
            2nd Gen IITs Comparison
          </button>
        </div>

        {/* Category Filter Pills */}
        <div className="flex items-center gap-2 w-full md:w-auto justify-end">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400 mr-1 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" /> Category:
          </span>
          {["Engineering", "Innovation", "Overall"].map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
                selectedCategory === cat
                  ? "bg-[#003366] text-white shadow-xs"
                  : "bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="bg-white rounded-3xl p-16 text-center border border-slate-200 shadow-sm flex flex-col items-center justify-center gap-3">
          <RefreshCw className="w-8 h-8 text-[#003366] animate-spin" />
          <p className="text-sm font-semibold text-slate-700">Loading 5-year NIRF longitudinal analytics...</p>
        </div>
      ) : activeTab === "individual" ? (
        /* ==================== TAB 1: INDIVIDUAL IIT MANDI TRAJECTORY ==================== */
        <div className="space-y-6">
          {/* Key Metric Highlights */}
          {mandiProgression && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Latest Rank */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Latest 2025 Standing
                </span>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-black text-[#003366]">#{mandiProgression.endRank}</span>
                  <span className="text-xs font-bold text-slate-500">in {selectedCategory}</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-2">
                  Evaluated nationwide among premier technical institutions.
                </p>
              </div>

              {/* 5-Year High */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  5-Year Historical High
                </span>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-black text-[#F58220]">#{mandiProgression.bestRank}</span>
                  <span className="text-xs font-bold text-slate-500">Peak Standing</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-2">
                  Highest institutional rank secured during the 2021–2025 cycle.
                </p>
              </div>

              {/* Total 5-Yr Movement */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  5-Year Net Trajectory
                </span>
                <div className="flex items-baseline gap-2">
                  <span
                    className={`text-3xl font-black ${
                      mandiProgression.improved ? "text-emerald-700" : "text-rose-700"
                    }`}
                  >
                    {mandiProgression.improved
                      ? `+${mandiProgression.diff}`
                      : `${mandiProgression.diff}`}
                  </span>
                  <span className="text-xs font-bold text-slate-500">Positions</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-2">
                  #{mandiProgression.startRank} ({mandiProgression.startYear}) → #{mandiProgression.endRank} ({mandiProgression.endYear})
                </p>
              </div>

              {/* Latest Score & Metrics */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  2025 Evaluated Score
                </span>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-black text-slate-800">
                    {mandiProgression.latestScore ? `${mandiProgression.latestScore}` : "Band 10"}
                  </span>
                  <span className="text-xs font-bold text-slate-400">/ 100</span>
                </div>
                <p className="text-[11px] text-emerald-700 font-semibold mt-2 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" /> Direct NIRF Publication
                </p>
              </div>
            </div>
          )}

          {/* Individual Chart View */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-sm">
            <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-lg font-bold text-[#003366] font-serif flex items-center gap-2">
                  <Award className="w-5 h-5 text-[#F58220]" />
                  IIT Mandi Rank Trajectory ({selectedCategory})
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Inverted Y-axis: Upward curve direction reflects superior national rank standing.
                </p>
              </div>
              <span className="self-start sm:self-auto bg-amber-50 text-[#F58220] text-xs font-bold px-3 py-1 rounded-full border border-amber-200">
                5-Year Official Trend
              </span>
            </div>

            {mandiChartData.length > 0 ? (
              <div className="h-80 w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={mandiChartData} margin={{ top: 20, right: 30, left: 10, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="year" stroke="#64748b" fontSize={12} tickLine={false} />
                    <YAxis
                      reversed
                      domain={['dataMin - 5', 'dataMax + 5']}
                      stroke="#64748b"
                      fontSize={12}
                      tickFormatter={(val) => `#${val}`}
                    />
                    <Tooltip content={<CustomMandiTooltip />} />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="rank"
                      name="IIT Mandi Rank Position"
                      stroke="#003366"
                      strokeWidth={3.5}
                      dot={{ r: 6, fill: "#F58220", strokeWidth: 2, stroke: "#003366" }}
                      activeDot={{ r: 9, fill: "#F58220" }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="p-12 text-center text-slate-400 italic bg-slate-50 rounded-2xl">
                No historical records found for {selectedCategory}.
              </div>
            )}
          </div>

          {/* Historical Detailed Table */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-sm">
            <h3 className="text-lg font-bold text-[#003366] font-serif mb-4 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-slate-600" />
              Annual Historical Breakdown — IIT Mandi
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                    <th className="p-3.5">Evaluation Year</th>
                    <th className="p-3.5">Category</th>
                    <th className="p-3.5 text-center">NIRF Rank</th>
                    <th className="p-3.5 text-center">Previous Rank</th>
                    <th className="p-3.5 text-center">YoY Movement</th>
                    <th className="p-3.5 text-center">Overall Score</th>
                    <th className="p-3.5 text-center">Verification Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {mandiCategoryData.map((item) => {
                    const m = calculateRankChange(
                      Number(item.rank),
                      item.previous_rank ? Number(item.previous_rank) : undefined
                    );
                    return (
                      <tr key={item.year} className="hover:bg-slate-50/80 transition">
                        <td className="p-3.5 font-bold text-slate-900">{item.year}</td>
                        <td className="p-3.5 font-medium text-slate-700">{selectedCategory}</td>
                        <td className="p-3.5 text-center font-extrabold text-[#003366] text-sm">
                          #{item.rank}
                        </td>
                        <td className="p-3.5 text-center text-slate-500">
                          {item.previous_rank ? `#${item.previous_rank}` : "—"}
                        </td>
                        <td className="p-3.5 text-center">
                          <span className={`inline-block text-[10px] font-bold px-2.5 py-0.5 rounded-full ${m.badgeClass}`}>
                            {m.label}
                          </span>
                        </td>
                        <td className="p-3.5 text-center font-semibold text-emerald-800">
                          {item.score ? `${item.score} / 100` : "Rank Band"}
                        </td>
                        <td className="p-3.5 text-center">
                          <span className="text-emerald-700 font-bold inline-flex items-center gap-1">
                            <ShieldCheck className="w-3.5 h-3.5" /> Verified
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        /* ==================== TAB 2: 2ND GEN IITS PEER COMPARISON ==================== */
        <div className="space-y-6">
          {/* Peer Selector Checkbox Bar */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Active Comparison Institutes (2nd Gen IITs)
                </h3>
                <p className="text-xs text-slate-400">
                  Toggle peers to highlight specific comparative curves on the trajectory chart.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => toggleAllPeers(true)}
                  className="text-[11px] font-bold text-[#003366] hover:underline"
                >
                  Select All
                </button>
                <span className="text-slate-300">|</span>
                <button
                  onClick={() => toggleAllPeers(false)}
                  className="text-[11px] font-bold text-slate-500 hover:underline"
                >
                  Reset (Mandi Only)
                </button>
              </div>
            </div>

            <div className="flex flex-wrap gap-2.5">
              {peerList.map((p) => {
                const isSelected = !!selectedPeers[p.short_name];
                const color = PEER_COLORS[p.short_name] || "#64748b";
                const isTarget = p.is_target;
                return (
                  <button
                    key={p.institute}
                    onClick={() => togglePeer(p.short_name)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition border ${
                      isTarget
                        ? "bg-amber-50 text-[#003366] border-[#F58220] ring-1 ring-[#F58220]"
                        : isSelected
                        ? "bg-slate-50 text-slate-800 border-slate-300"
                        : "bg-white text-slate-400 border-slate-200 opacity-60"
                    }`}
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: color }}
                    />
                    <span>{p.short_name}</span>
                    {isTarget && (
                      <span className="text-[9px] bg-[#F58220] text-white px-1.5 py-0.2 rounded-full uppercase tracking-tighter">
                        Focus
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Multi-Line Trajectory Chart */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-sm">
            <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-lg font-bold text-[#003366] font-serif flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-[#F58220]" />
                  2nd Generation IITs 5-Year Trajectory ({selectedCategory})
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Comparative longitudinal rank positions (2021 – 2025). Inverted axis: Top line indicates premier rank.
                </p>
              </div>
              <span className="self-start sm:self-auto bg-blue-50 text-[#003366] text-xs font-bold px-3 py-1 rounded-full border border-blue-100">
                8 Institutions Evaluated
              </span>
            </div>

            <div className="h-96 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={peerComparisonChartData} margin={{ top: 20, right: 30, left: 10, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="year" stroke="#64748b" fontSize={12} tickLine={false} />
                  <YAxis
                    reversed
                    domain={['dataMin - 3', 'dataMax + 5']}
                    stroke="#64748b"
                    fontSize={12}
                    tickFormatter={(val) => `#${val}`}
                  />
                  <Tooltip content={<CustomPeerTooltip />} />
                  <Legend />
                  {peerList.map((peer) => {
                    const isVisible = selectedPeers[peer.short_name];
                    if (!isVisible) return null;
                    const isMandi = peer.is_target;
                    const color = PEER_COLORS[peer.short_name] || "#64748b";

                    return (
                      <Line
                        key={peer.short_name}
                        type="monotone"
                        dataKey={peer.short_name}
                        name={peer.short_name}
                        stroke={color}
                        strokeWidth={isMandi ? 4 : 2}
                        dot={{ r: isMandi ? 6 : 4, fill: color }}
                        activeDot={{ r: isMandi ? 9 : 6 }}
                        connectNulls
                      />
                    );
                  })}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 2025 Current Standing Peer Rank Distribution */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-sm">
            <h3 className="text-lg font-bold text-[#003366] font-serif mb-2 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-[#003366]" />
              2025 Standing Among 2nd Generation IITs ({selectedCategory})
            </h3>
            <p className="text-xs text-slate-500 mb-6">
              Official national rank standing in the 2025 evaluation cycle (shorter bar represents superior national rank).
            </p>

            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={peerStanding2025Data} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f8fafc" />
                  <XAxis dataKey="name" stroke="#64748b" fontSize={11} interval={0} angle={-25} textAnchor="end" />
                  <YAxis stroke="#64748b" fontSize={11} tickFormatter={(val) => `#${val}`} />
                  <Tooltip
                    formatter={(value: any, _name: any, item: any) => [
                      `National Rank #${value} (${item.payload.score ? `Score: ${item.payload.score}` : 'Band'})`,
                      item.payload.name,
                    ]}
                  />
                  <Bar dataKey="rank" radius={[6, 6, 0, 0]}>
                    {peerStanding2025Data.map((entry) => (
                      <Cell
                        key={`cell-${entry.name}`}
                        fill={entry.isTarget ? "#F58220" : "#003366"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 5-Year Comparative Matrix Table */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-sm">
            <h3 className="text-lg font-bold text-[#003366] font-serif mb-4 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-slate-600" />
              5-Year Peer Comparison Matrix (2021 – 2025)
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                    <th className="p-3.5">Institution</th>
                    <th className="p-3.5 text-center">2021</th>
                    <th className="p-3.5 text-center">2022</th>
                    <th className="p-3.5 text-center">2023</th>
                    <th className="p-3.5 text-center">2024</th>
                    <th className="p-3.5 text-center">2025 Rank</th>
                    <th className="p-3.5 text-center">2025 Score</th>
                    <th className="p-3.5 text-center">5-Yr Net Trend</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {peerList.map((peer) => {
                    const isTarget = peer.is_target;
                    const r21 = peer.ranks["2021"];
                    const r25 = peer.ranks["2025"];
                    const diff =
                      typeof r21 === "number" && typeof r25 === "number"
                        ? r21 - r25
                        : null;

                    return (
                      <tr
                        key={peer.institute}
                        className={`transition ${
                          isTarget ? "bg-amber-50/70 font-bold hover:bg-amber-50" : "hover:bg-slate-50"
                        }`}
                      >
                        <td className="p-3.5">
                          <div className="flex items-center gap-2">
                            <span
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: PEER_COLORS[peer.short_name] || "#64748b" }}
                            />
                            <span className={isTarget ? "font-bold text-[#003366]" : "text-slate-800"}>
                              {peer.institute}
                            </span>
                            {isTarget && (
                              <span className="text-[10px] bg-[#F58220] text-white px-2 py-0.5 rounded-full font-bold">
                                Focus
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-3.5 text-center font-medium text-slate-600">
                          {peer.ranks["2021"] ? `#${peer.ranks["2021"]}` : "—"}
                        </td>
                        <td className="p-3.5 text-center font-medium text-slate-600">
                          {peer.ranks["2022"] ? `#${peer.ranks["2022"]}` : "—"}
                        </td>
                        <td className="p-3.5 text-center font-medium text-slate-600">
                          {peer.ranks["2023"] ? `#${peer.ranks["2023"]}` : "—"}
                        </td>
                        <td className="p-3.5 text-center font-medium text-slate-600">
                          {peer.ranks["2024"] ? `#${peer.ranks["2024"]}` : "—"}
                        </td>
                        <td className="p-3.5 text-center font-extrabold text-[#003366] text-sm">
                          {peer.ranks["2025"] ? `#${peer.ranks["2025"]}` : "—"}
                        </td>
                        <td className="p-3.5 text-center font-semibold text-emerald-800">
                          {peer.scores["2025"] ? `${peer.scores["2025"]}` : "—"}
                        </td>
                        <td className="p-3.5 text-center">
                          {diff !== null ? (
                            <span
                              className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                diff > 0
                                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                  : diff < 0
                                  ? "bg-rose-50 text-rose-700 border border-rose-200"
                                  : "bg-slate-100 text-slate-600"
                              }`}
                            >
                              {diff > 0 ? `↑ +${diff}` : diff < 0 ? `↓ ${diff}` : "→ Stable"}
                            </span>
                          ) : (
                            <span className="text-slate-400 text-[10px]">N/A</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
