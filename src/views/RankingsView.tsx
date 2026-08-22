import React, { useState, useMemo } from "react";
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
  ArrowUpDown
} from "lucide-react";
import { RankingItem, RankingAgency } from "../types";
import { RankingCard } from "../components/RankingCard";
import { exportToCSV, calculateRankChange, getStatusBadge } from "../utils/helpers";

interface RankingsViewProps {
  rankings: RankingItem[];
  agencies: RankingAgency[];
  onSelectRanking: (ranking: RankingItem) => void;
  initialSearchQuery?: string;
}

export const RankingsView: React.FC<RankingsViewProps> = ({
  rankings,
  agencies,
  onSelectRanking,
  initialSearchQuery = "",
}) => {
  const [search, setSearch] = useState(initialSearchQuery);
  const [agencyFilter, setAgencyFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [yearFilter, setYearFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
  const [sortBy, setSortBy] = useState<"year_desc" | "rank_asc" | "agency" | "score_desc">("year_desc");

  // Extract unique categories and years
  const categories = useMemo(() => {
    const set = new Set<string>();
    rankings.forEach((r) => set.add(r.category));
    return Array.from(set);
  }, [rankings]);

  const years = useMemo(() => {
    const set = new Set<number>();
    rankings.forEach((r) => set.add(r.year));
    return Array.from(set).sort((a, b) => b - a);
  }, [rankings]);

  // Filter logic
  const filteredRankings = useMemo(() => {
    return rankings
      .filter((r) => {
        if (agencyFilter !== "all" && r.agency_id !== agencyFilter) return false;
        if (categoryFilter !== "all" && r.category.toLowerCase() !== categoryFilter.toLowerCase()) return false;
        if (yearFilter !== "all" && String(r.year) !== yearFilter) return false;
        if (statusFilter !== "all" && r.status.toLowerCase() !== statusFilter.toLowerCase()) return false;
        if (search) {
          const q = search.toLowerCase();
          return (
            r.ranking_name.toLowerCase().includes(q) ||
            r.agency_name.toLowerCase().includes(q) ||
            r.category.toLowerCase().includes(q) ||
            (r.remarks && r.remarks.toLowerCase().includes(q))
          );
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === "rank_asc") return a.rank - b.rank;
        if (sortBy === "score_desc") return (b.score || 0) - (a.score || 0);
        if (sortBy === "agency") return a.agency_name.localeCompare(b.agency_name);
        return b.year - a.year; // year_desc
      });
  }, [rankings, agencyFilter, categoryFilter, yearFilter, statusFilter, search, sortBy]);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="bg-white rounded-2xl p-6 border border-gray-200/80 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#003366] font-serif flex items-center gap-2">
            <Trophy className="w-6 h-6 text-[#F58220]" />
            Institutional Rankings Database
          </h1>
          <p className="text-xs sm:text-sm text-gray-600 mt-1">
            Search, filter, and verify official ranking records across national and international agencies.
          </p>
        </div>

        <div className="flex items-center gap-2 self-end md:self-auto">
          <button
            onClick={() => exportToCSV(filteredRankings)}
            className="flex items-center gap-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold px-3.5 py-2 rounded-lg shadow-sm transition"
            title="Export list to Excel CSV"
          >
            <Download className="w-4 h-4" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-semibold px-3.5 py-2 rounded-lg transition"
            title="Print View"
          >
            <Printer className="w-4 h-4 text-gray-600" />
            <span className="hidden sm:inline">Print</span>
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white rounded-2xl p-5 border border-gray-200/80 shadow-sm space-y-4">
        {/* Search Row */}
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Search by ranking name, agency, category, or notes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-50 border border-gray-200 rounded-lg pl-9 pr-4 py-2 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#003366]"
            />
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* View switcher */}
            <div className="flex items-center bg-gray-100 rounded-lg p-1 border border-gray-200">
              <button
                onClick={() => setViewMode("grid")}
                className={`p-1.5 rounded text-xs flex items-center gap-1 font-medium transition ${
                  viewMode === "grid" ? "bg-white text-[#003366] shadow-2xs font-bold" : "text-gray-600"
                }`}
              >
                <LayoutGrid className="w-4 h-4" />
                <span className="hidden sm:inline">Grid</span>
              </button>
              <button
                onClick={() => setViewMode("table")}
                className={`p-1.5 rounded text-xs flex items-center gap-1 font-medium transition ${
                  viewMode === "table" ? "bg-white text-[#003366] shadow-2xs font-bold" : "text-gray-600"
                }`}
              >
                <Table className="w-4 h-4" />
                <span className="hidden sm:inline">Table</span>
              </button>
            </div>

            {/* Sort Selector */}
            <div className="relative">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-slate-50 border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-800 font-medium focus:outline-none focus:ring-2 focus:ring-[#003366]"
              >
                <option value="year_desc">Sort: Latest Year</option>
                <option value="rank_asc">Sort: Best Rank (#1 First)</option>
                <option value="score_desc">Sort: Highest Score</option>
                <option value="agency">Sort: Agency Name</option>
              </select>
            </div>
          </div>
        </div>

        {/* Filter Dropdowns Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-gray-100">
          <div>
            <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">Agency</label>
            <select
              value={agencyFilter}
              onChange={(e) => setAgencyFilter(e.target.value)}
              className="w-full bg-slate-50 border border-gray-200 rounded-lg p-2 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#003366]"
            >
              <option value="all">All Agencies</option>
              {agencies.map((a) => (
                <option key={a.id} value={a.id}>{a.short_name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">Category</label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full bg-slate-50 border border-gray-200 rounded-lg p-2 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#003366]"
            >
              <option value="all">All Categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">Year</label>
            <select
              value={yearFilter}
              onChange={(e) => setYearFilter(e.target.value)}
              className="w-full bg-slate-50 border border-gray-200 rounded-lg p-2 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#003366]"
            >
              <option value="all">All Years</option>
              {years.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full bg-slate-50 border border-gray-200 rounded-lg p-2 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#003366]"
            >
              <option value="all">All Statuses</option>
              <option value="published">Published</option>
              <option value="verified">Verified</option>
              <option value="under review">Under Review</option>
              <option value="submitted">Submitted</option>
              <option value="draft">Draft</option>
            </select>
          </div>
        </div>

        {/* Active filter count indicator */}
        <div className="flex items-center justify-between text-xs text-gray-500 pt-1">
          <span>Showing <strong>{filteredRankings.length}</strong> of {rankings.length} ranking records</span>
          {(agencyFilter !== "all" || categoryFilter !== "all" || yearFilter !== "all" || statusFilter !== "all" || search) && (
            <button
              onClick={() => {
                setAgencyFilter("all");
                setCategoryFilter("all");
                setYearFilter("all");
                setStatusFilter("all");
                setSearch("");
              }}
              className="text-[#003366] hover:underline font-semibold"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Main Content Display */}
      {filteredRankings.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-gray-200/80 my-8">
          <Trophy className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-gray-800">No Ranking Records Found</h3>
          <p className="text-xs text-gray-500 max-w-md mx-auto mt-1">
            Try adjusting your search criteria, clearing filters, or choosing a different agency or year.
          </p>
        </div>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredRankings.map((ranking) => (
            <RankingCard key={ranking.id} ranking={ranking} onSelect={onSelectRanking} />
          ))}
        </div>
      ) : (
        /* Table View */
        <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#003366] text-white font-semibold">
                  <th className="p-3.5">Agency / Title</th>
                  <th className="p-3.5">Category</th>
                  <th className="p-3.5 text-center">Year</th>
                  <th className="p-3.5 text-center">Current Rank</th>
                  <th className="p-3.5 text-center">Prev Rank</th>
                  <th className="p-3.5 text-center">YoY Change</th>
                  <th className="p-3.5 text-center">Score</th>
                  <th className="p-3.5 text-center">Status</th>
                  <th className="p-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredRankings.map((r) => {
                  const m = calculateRankChange(r.rank, r.previous_rank);
                  const st = getStatusBadge(r.status);
                  return (
                    <tr
                      key={r.id}
                      onClick={() => onSelectRanking(r)}
                      className="hover:bg-slate-50 transition cursor-pointer"
                    >
                      <td className="p-3.5 font-bold text-gray-900">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[#003366]">{r.ranking_name}</span>
                          {r.verified && (
                            <span title="Verified" className="flex items-center">
                              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-gray-500 font-normal">{r.agency_name}</div>
                      </td>
                      <td className="p-3.5 text-gray-700 font-medium">{r.category}</td>
                      <td className="p-3.5 text-center font-bold text-gray-800">{r.year}</td>
                      <td className="p-3.5 text-center font-extrabold text-[#003366] text-sm">#{r.rank}</td>
                      <td className="p-3.5 text-center text-gray-600">{r.previous_rank ? `#${r.previous_rank}` : "N/A"}</td>
                      <td className="p-3.5 text-center">
                        <span className={`inline-block text-[10px] font-bold px-1.5 py-0.5 rounded ${m.badgeClass}`}>
                          {m.label}
                        </span>
                      </td>
                      <td className="p-3.5 text-center font-semibold text-emerald-800">{r.score ?? "N/A"}</td>
                      <td className="p-3.5 text-center">
                        <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded border ${st.bg}`}>
                          {st.label}
                        </span>
                      </td>
                      <td className="p-3.5 text-right">
                        <button className="text-xs bg-blue-50 hover:bg-blue-100 text-[#003366] font-bold px-2.5 py-1 rounded transition">
                          Details
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
