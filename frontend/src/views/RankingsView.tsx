import React, { useState, useMemo, useEffect } from "react";
import {
  Trophy,
  Search,
  Filter,
  Download,
  Printer,
  LayoutGrid,
  Table,
  ShieldCheck,
  ExternalLink,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { RankingItem, RankingAgency } from "../types";
import { RankingCard } from "../components/RankingCard";
import { exportToCSV } from "../utils/helpers";
import { rankingsService } from "../services/api";

const DEFAULT_RANKINGS: RankingItem[] = [
  {
    id: "r1",
    agency_id: "nirf",
    agency_name: "NIRF India",
    ranking_name: "NIRF Engineering 2025",
    category: "Engineering",
    year: 2025,
    rank: 28,
    previous_rank: 31,
    score: 62.84,
    status: "Published",
    verified: true,
    remarks: "Ranked #28 among all engineering institutes nationwide.",
    created_at: "2025-06-15",
    updated_at: "2025-06-15",
  },
  {
    id: "r2",
    agency_id: "nirf",
    agency_name: "NIRF India",
    ranking_name: "NIRF Overall 2025",
    category: "Overall",
    year: 2025,
    rank: 64,
    previous_rank: 71,
    score: 54.12,
    status: "Published",
    verified: true,
    remarks: "Overall institutional ranking improved by 7 ranks.",
    created_at: "2025-06-15",
    updated_at: "2025-06-15",
  },
  {
    id: "r3",
    agency_id: "nirf",
    agency_name: "NIRF India",
    ranking_name: "NIRF Innovation 2025",
    category: "Innovation",
    year: 2025,
    rank: 18,
    previous_rank: 24,
    score: 68.5,
    status: "Published",
    verified: true,
    remarks: "Top 20 in Innovation among leading technical universities.",
    created_at: "2025-06-15",
    updated_at: "2025-06-15",
  },
  {
    id: "r4",
    agency_id: "qs",
    agency_name: "QS World",
    ranking_name: "QS World University Rankings 2025",
    category: "Global",
    year: 2025,
    rank: "701-750",
    previous_rank: "801-850",
    status: "Published",
    verified: true,
    remarks: "Advanced 100 bands globally in academic reputation.",
    created_at: "2025-06-15",
    updated_at: "2025-06-15",
  },
];

interface RankingsViewProps {
  rankings?: RankingItem[];
  agencies?: RankingAgency[];
  onSelectRanking?: (ranking: RankingItem) => void;
  initialSearchQuery?: string;
  searchQuery?: string;
}

export const RankingsView: React.FC<RankingsViewProps> = ({
  rankings = DEFAULT_RANKINGS,
  onSelectRanking,
  initialSearchQuery = "",
  searchQuery = "",
}) => {
  const [search, setSearch] = useState(searchQuery || initialSearchQuery);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [yearFilter, setYearFilter] = useState("all");
  const [viewMode, setViewMode] = useState<"grid" | "table">("table");
  const [dataSource, setDataSource] = useState<"institute" | "nirf_live">("nirf_live");
  const [nirfYear, setNirfYear] = useState<number>(2025);
  const [nirfCategory, setNirfCategory] = useState<string>("overall");
  const [secondGenOnly, setSecondGenOnly] = useState<boolean>(false);
  const [nirfData, setNirfData] = useState<any[]>([]);
  const [nirfLoading, setNirfLoading] = useState<boolean>(false);

  // Fetch real NIRF ranking data from Django API
  useEffect(() => {
    if (dataSource === "nirf_live") {
      setNirfLoading(true);
      const fetchPromise = secondGenOnly
        ? rankingsService.getSecondGenIITs(nirfYear, nirfCategory)
        : rankingsService.getRankings(nirfYear, nirfCategory);

      fetchPromise
        .then((res) => setNirfData(res.data || []))
        .catch(() => setNirfData([]))
        .finally(() => setNirfLoading(false));
    }
  }, [dataSource, nirfYear, nirfCategory, secondGenOnly]);

  const activeRankings = rankings.length ? rankings : DEFAULT_RANKINGS;

  const filteredRankings = useMemo(() => {
    return activeRankings.filter((r) => {
      if (categoryFilter !== "all" && r.category.toLowerCase() !== categoryFilter.toLowerCase()) return false;
      if (yearFilter !== "all" && String(r.year) !== yearFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          r.ranking_name.toLowerCase().includes(q) ||
          r.agency_name.toLowerCase().includes(q) ||
          r.category.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [activeRankings, categoryFilter, yearFilter, search]);

  const filteredNirfData = useMemo(() => {
    if (!search) return nirfData;
    const q = search.toLowerCase();
    return nirfData.filter((item) =>
      item.name?.toLowerCase().includes(q) ||
      item.city?.toLowerCase().includes(q) ||
      item.state?.toLowerCase().includes(q)
    );
  }, [nirfData, search]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/60 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider text-sage-600 bg-sage-50 px-2.5 py-0.5 rounded-full ring-1 ring-sage-500/20">
              Live Data Engine
            </span>
          </div>
          <h1 className="text-2xl font-bold text-zinc-900 font-serif flex items-center gap-2">
            <Trophy className="w-6 h-6 text-[#F58220]" />
            Official Ranking Intelligence
          </h1>
          <p className="text-xs sm:text-sm text-zinc-500 mt-1">
            Directly connected to the Django NIRF API engine with real-time IIT Mandi & 2nd generation IIT comparisons.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Data Source Selector */}
          <div className="flex items-center p-1 bg-zinc-100 rounded-xl">
            <button
              onClick={() => setDataSource("nirf_live")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                dataSource === "nirf_live" ? "bg-white text-zinc-900 shadow-xs" : "text-zinc-500 hover:text-zinc-900"
              }`}
            >
              NIRF Official Live
            </button>
            <button
              onClick={() => setDataSource("institute")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                dataSource === "institute" ? "bg-white text-zinc-900 shadow-xs" : "text-zinc-500 hover:text-zinc-900"
              }`}
            >
              IIT Mandi Summary
            </button>
          </div>

          <button
            onClick={() => exportToCSV(dataSource === "nirf_live" ? filteredNirfData : filteredRankings)}
            className="flex items-center gap-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold px-3.5 py-2 rounded-xl shadow-xs transition"
          >
            <Download className="w-4 h-4" />
            <span>Export</span>
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200/60 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Search by institute name, city, state, or category..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-zinc-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-sm text-zinc-800 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-sage-500/20 focus:border-sage-500/50"
            />
            <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-3" />
          </div>

          {dataSource === "nirf_live" ? (
            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={nirfYear}
                onChange={(e) => setNirfYear(Number(e.target.value))}
                className="bg-zinc-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-zinc-700 outline-none"
              >
                <option value={2025}>Year 2025</option>
                <option value={2024}>Year 2024</option>
              </select>

              <select
                value={nirfCategory}
                onChange={(e) => setNirfCategory(e.target.value)}
                className="bg-zinc-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-zinc-700 outline-none"
              >
                <option value="overall">Category: Overall</option>
                <option value="engineering">Category: Engineering</option>
                <option value="innovation">Category: Innovation</option>
              </select>

              <label className="flex items-center gap-1.5 px-3 py-2 bg-zinc-50 border border-slate-200 rounded-xl text-xs font-semibold text-zinc-700 cursor-pointer hover:bg-zinc-100">
                <input
                  type="checkbox"
                  checked={secondGenOnly}
                  onChange={(e) => setSecondGenOnly(e.target.checked)}
                  className="rounded text-sage-600 focus:ring-sage-500"
                />
                <span>2nd Gen IITs Only</span>
              </label>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="bg-zinc-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-zinc-700 outline-none"
              >
                <option value="all">All Categories</option>
                <option value="Engineering">Engineering</option>
                <option value="Overall">Overall</option>
                <option value="Innovation">Innovation</option>
                <option value="Global">Global</option>
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Main Data Display */}
      {dataSource === "nirf_live" ? (
        <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-zinc-50/50 flex justify-between items-center text-xs font-semibold text-zinc-600">
            <span>
              Showing {filteredNirfData.length} institutions &middot; NIRF {nirfYear} ({nirfCategory.toUpperCase()})
            </span>
            {secondGenOnly && (
              <span className="text-sage-700 bg-sage-50 px-2 py-0.5 rounded-md font-bold">
                Filtered: 2nd Gen IITs
              </span>
            )}
          </div>

          {nirfLoading ? (
            <div className="p-12 text-center text-zinc-400 space-y-2">
              <div className="w-8 h-8 border-2 border-sage-600 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-sm">Fetching rankings from Django API...</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-50 text-zinc-500 font-semibold uppercase tracking-wider border-b border-slate-200/60">
                  <tr>
                    <th className="py-3 px-4">Rank</th>
                    <th className="py-3 px-4">Institution Name</th>
                    <th className="py-3 px-4">City</th>
                    <th className="py-3 px-4">State</th>
                    <th className="py-3 px-4 text-right">NIRF Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredNirfData.map((item, idx) => {
                    const isMandi = item.name?.includes("Mandi");
                    return (
                      <tr
                        key={item.institute_id || idx}
                        className={`transition-colors ${
                          isMandi
                            ? "bg-sage-50/70 font-semibold text-sage-950 hover:bg-sage-100/70"
                            : "hover:bg-zinc-50 text-zinc-800"
                        }`}
                      >
                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center justify-center font-bold px-2.5 py-1 rounded-lg ${
                              isMandi
                                ? "bg-sage-600 text-white"
                                : item.rank <= 10
                                ? "bg-soft-gold-100 text-soft-gold-800"
                                : "bg-zinc-100 text-zinc-700"
                            }`}
                          >
                            #{item.rank}
                          </span>
                        </td>
                        <td className="py-3 px-4 flex items-center gap-2">
                          <span>{item.name}</span>
                          {isMandi && (
                            <span className="text-[10px] font-bold uppercase bg-sage-200 text-sage-800 px-1.5 py-0.5 rounded">
                              Our Institute
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-zinc-500">{item.city}</td>
                        <td className="py-3 px-4 text-zinc-500">{item.state}</td>
                        <td className="py-3 px-4 text-right font-mono font-medium">
                          {item.score !== null ? item.score.toFixed(2) : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredRankings.map((ranking) => (
            <RankingCard
              key={ranking.id}
              ranking={ranking}
              onSelect={(r) => onSelectRanking && onSelectRanking(r)}
            />
          ))}
        </div>
      )}
    </div>
  );
};
