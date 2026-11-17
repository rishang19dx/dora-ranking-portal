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
import { exportNirfRankingsToCSV, exportToCSV } from "../utils/helpers";
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
    ranking_name: "QS Asia University Rankings 2027",
    category: "Asia",
    year: 2027,
    rank: 601,
    status: "Published",
    verified: true,
    source_url: "https://www.topuniversities.com/asia-university-rankings?search=Indian%20Institute%20of%20Technology%20Mandi",
    remarks: "QS Asia University Rankings result for IIT Mandi.",
    created_at: "2026-11-18",
    updated_at: "2026-11-18",
  },
  {
    id: "r5",
    agency_id: "qs",
    agency_name: "QS World",
    ranking_name: "QS Asian University Rankings – Southern Asia 2027",
    category: "Southern Asia",
    year: 2027,
    rank: 161,
    status: "Published",
    verified: true,
    source_url: "https://www.topuniversities.com/asia-university-rankings/southern-asia?search=mandi",
    remarks: "QS Southern Asia regional result for IIT Mandi.",
    created_at: "2026-11-18",
    updated_at: "2026-11-18",
  },
  {
    id: "r6",
    agency_id: "qs",
    agency_name: "QS World",
    ranking_name: "QS Sustainability Rankings 2026",
    category: "Sustainability",
    year: 2026,
    rank: "1501+",
    status: "Published",
    verified: true,
    source_url: "https://www.topuniversities.com/sustainability-rankings?search=Indian%20Institute%20of%20Technology%20Mandi",
    remarks: "QS Sustainability result for IIT Mandi.",
    created_at: "2026-11-18",
    updated_at: "2026-11-18",
  },
  {
    id: "r7",
    agency_id: "the",
    agency_name: "Times Higher Education",
    ranking_name: "World University Rankings 2027",
    category: "World",
    year: 2027,
    rank: "801–1000",
    status: "Published",
    verified: true,
    source_url: "https://www.timeshighereducation.com/world-university-rankings/indian-institute-technology-mandi",
    remarks: "THE World University Rankings result for IIT Mandi.",
    created_at: "2026-11-18",
    updated_at: "2026-11-18",
  },
  {
    id: "r8",
    agency_id: "the",
    agency_name: "Times Higher Education",
    ranking_name: "Interdisciplinary Science Rankings 2026",
    category: "Interdisciplinary Science",
    year: 2026,
    rank: "401–500",
    status: "Published",
    verified: true,
    source_url: "https://www.timeshighereducation.com/world-university-rankings/interdisciplinary-science-rankings",
    remarks: "THE Interdisciplinary Science Rankings result for IIT Mandi.",
    created_at: "2026-11-18",
    updated_at: "2026-11-18",
  },
  {
    id: "r9",
    agency_id: "the",
    agency_name: "Times Higher Education",
    ranking_name: "Asia University Rankings 2026",
    category: "Asia",
    year: 2026,
    rank: "401–500",
    status: "Published",
    verified: true,
    source_url: "https://www.timeshighereducation.com/world-university-rankings/2026/regional-ranking",
    remarks: "THE Asia University Rankings result for IIT Mandi.",
    created_at: "2026-11-18",
    updated_at: "2026-11-18",
  },
  {
    id: "r10",
    agency_id: "india-today-mdra",
    agency_name: "India Today–MDRA",
    ranking_name: "Best Technical University Rankings 2026",
    category: "Technical University",
    year: 2026,
    rank: 7,
    status: "Published",
    verified: true,
    source_url: "https://bestcolleges.indiatoday.in/",
    remarks: "IIT Mandi ranks #7 in the Best Technical University category.",
    created_at: "2026-11-18",
    updated_at: "2026-11-18",
  },
  {
    id: "r11",
    agency_id: "india-today-mdra",
    agency_name: "India Today–MDRA",
    ranking_name: "Best Govt. Engineering College Rankings 2026",
    category: "Engineering",
    year: 2026,
    rank: 10,
    status: "Published",
    verified: true,
    source_url: "https://bestcolleges.indiatoday.in/",
    created_at: "2026-11-18",
    updated_at: "2026-11-18",
  },
  {
    id: "r12",
    agency_id: "india-today-mdra",
    agency_name: "India Today–MDRA",
    ranking_name: "Best Engineering College Rankings 2026",
    category: "Engineering",
    year: 2026,
    rank: 11,
    status: "Published",
    verified: true,
    source_url: "https://bestcolleges.indiatoday.in/",
    created_at: "2026-11-18",
    updated_at: "2026-11-18",
  },
  {
    id: "r13",
    agency_id: "india-today-mdra",
    agency_name: "India Today–MDRA",
    ranking_name: "Best Emerging Govt. Engineering College Rankings 2026",
    category: "Engineering",
    year: 2026,
    rank: 3,
    status: "Published",
    verified: true,
    source_url: "https://bestcolleges.indiatoday.in/",
    created_at: "2026-11-18",
    updated_at: "2026-11-18",
  },
  {
    id: "r14",
    agency_id: "india-today-mdra",
    agency_name: "India Today–MDRA",
    ranking_name: "Most Improved Colleges in Engineering (Govt.) 2026",
    category: "Engineering",
    year: 2026,
    rank: 6,
    status: "Published",
    verified: true,
    source_url: "https://bestcolleges.indiatoday.in/",
    created_at: "2026-11-18",
    updated_at: "2026-11-18",
  },
];

const AGENCY_PRESENTATION: Record<string, { label: string; description: string; accent: string }> = {
  "NIRF India": {
    label: "National Institutional Ranking Framework",
    description: "India’s official national institutional rankings.",
    accent: "border-l-sage-600 bg-sage-50/70",
  },
  "QS World": {
    label: "QS World University Rankings",
    description: "International university rankings by Quacquarelli Symonds.",
    accent: "border-l-blue-600 bg-blue-50/70",
  },
  "Times Higher Education": {
    label: "Times Higher Education Rankings",
    description: "Global, regional, and interdisciplinary performance rankings.",
    accent: "border-l-violet-600 bg-violet-50/70",
  },
  "India Today–MDRA": {
    label: "India Today–MDRA Rankings",
    description: "National recognition across technical-university and engineering categories.",
    accent: "border-l-orange-500 bg-orange-50/70",
  },
};

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
  // Lead with IIT Mandi's published records; the complete NIRF table remains one click away.
  const [dataSource, setDataSource] = useState<"institute" | "nirf_live">("institute");
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

  const rankingGroups = useMemo(() => {
    const groups = new Map<string, RankingItem[]>();
    filteredRankings.forEach((ranking) => {
      const current = groups.get(ranking.agency_name) || [];
      current.push(ranking);
      groups.set(ranking.agency_name, current);
    });
    return Array.from(groups.entries());
  }, [filteredRankings]);

  const exportRows = dataSource === "nirf_live" ? filteredNirfData : filteredRankings;
  const handleExport = () => {
    if (dataSource === "nirf_live") {
      exportNirfRankingsToCSV(filteredNirfData, nirfYear, nirfCategory);
      return;
    }
    exportToCSV(filteredRankings, "IIT_Mandi_Verified_Rankings.csv");
  };

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
            Browse official NIRF data or IIT Mandi’s verified QS, THE, and India Today–MDRA results.
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
            onClick={handleExport}
            disabled={exportRows.length === 0}
            title={exportRows.length === 0 ? "There are no visible ranking records to export." : "Download the visible ranking records as a CSV file."}
            className="flex items-center gap-1.5 bg-emerald-700 hover:bg-emerald-800 disabled:bg-zinc-300 disabled:cursor-not-allowed text-white text-xs font-semibold px-3.5 py-2 rounded-xl shadow-xs transition"
          >
            <Download className="w-4 h-4" />
            <span>Export CSV</span>
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
                <option value="Asia">Asia</option>
                <option value="Southern Asia">Southern Asia</option>
                <option value="Sustainability">Sustainability</option>
                <option value="World">World</option>
                <option value="Technical University">Technical University</option>
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
        <div className="space-y-8">
          {rankingGroups.map(([agencyName, rankings]) => {
            const presentation = AGENCY_PRESENTATION[agencyName] || {
              label: agencyName,
              description: "Verified institutional ranking records.",
              accent: "border-l-slate-500 bg-slate-50/70",
            };
            return (
              <section key={agencyName} aria-labelledby={`agency-${agencyName.replace(/[^a-z0-9]/gi, "-")}`}>
                <div className={`border-l-4 ${presentation.accent} rounded-r-2xl px-5 py-4 mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2`}>
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Ranking Agency</p>
                    <h2 id={`agency-${agencyName.replace(/[^a-z0-9]/gi, "-")}`} className="text-lg font-bold text-zinc-900">{presentation.label}</h2>
                    <p className="text-sm text-zinc-600 mt-0.5">{presentation.description}</p>
                  </div>
                  <span className="self-start sm:self-auto bg-white/90 border border-white text-zinc-700 text-xs font-bold px-3 py-1.5 rounded-full shadow-sm">
                    {rankings.length} {rankings.length === 1 ? "ranking" : "rankings"}
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {rankings.map((ranking) => (
                    <RankingCard
                      key={ranking.id}
                      ranking={ranking}
                      onSelect={(r) => onSelectRanking && onSelectRanking(r)}
                    />
                  ))}
                </div>
              </section>
            );
          })}
          {rankingGroups.length === 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center text-sm text-zinc-500">
              No ranking records match the current filters.
            </div>
          )}
        </div>
      )}
    </div>
  );
};
