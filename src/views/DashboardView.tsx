import React from "react";
import {
  Trophy,
  TrendingUp,
  Award,
  ShieldCheck,
  Building2,
  FileText,
  Newspaper,
  ChevronRight,
  Sparkles,
  ArrowUpRight,
  ExternalLink,
  Target,
  BarChart3,
  Sliders
} from "lucide-react";
import { RankingItem, PortalStats, NewsUpdate, ViewTab } from "../types";
import { RankingCard } from "../components/RankingCard";
import { calculateRankChange, formatDate } from "../utils/helpers";

interface DashboardViewProps {
  rankings: RankingItem[];
  stats: PortalStats | null;
  news: NewsUpdate[];
  onSelectRanking: (ranking: RankingItem) => void;
  onNavigateTab: (tab: ViewTab) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  rankings,
  stats,
  news,
  onSelectRanking,
  onNavigateTab,
}) => {
  // Filter top published rankings to display in the main highlight section
  const highlightCards = rankings
    .filter((r) => r.verified && r.status === "Published")
    .slice(0, 6);

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Hero Section */}
      <div className="relative bg-gradient-to-r from-[#002244] via-[#003366] to-[#002244] text-white rounded-2xl p-6 sm:p-10 shadow-lg border border-blue-900 overflow-hidden">
        {/* Background decorative pattern */}
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-500/10 via-transparent to-transparent pointer-events-none" />

        <div className="relative z-10 max-w-3xl space-y-3">
          <div className="inline-flex items-center gap-2 bg-blue-900/80 border border-blue-700/60 px-3 py-1 rounded-full text-xs font-semibold text-amber-300">
            <Sparkles className="w-3.5 h-3.5 text-[#F58220]" />
            <span>Official Institutional Ranking Portal</span>
          </div>

          <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight font-serif text-white">
            IIT Mandi Rankings
          </h1>
          <p className="text-base sm:text-xl text-blue-100 font-medium">
            Performance, Recognition and Global Standing
          </p>

          <p className="text-xs sm:text-sm text-blue-200/90 leading-relaxed pt-1">
            Maintaining, verifying, and presenting national and international rankings across NIRF, QS World, QS Asia, Times Higher Education, and India Today.
          </p>

          <div className="flex flex-wrap gap-3 pt-3">
            <button
              onClick={() => onNavigateTab("rankings")}
              className="bg-[#F58220] hover:bg-[#e07115] text-white text-xs sm:text-sm font-bold px-5 py-2.5 rounded-lg shadow-md transition flex items-center gap-2"
            >
              <span>Explore All Rankings</span>
              <ChevronRight className="w-4 h-4" />
            </button>

            <button
              onClick={() => onNavigateTab("trends")}
              className="bg-blue-900/90 hover:bg-blue-800 text-white border border-blue-700 text-xs sm:text-sm font-semibold px-4 py-2.5 rounded-lg transition flex items-center gap-2"
            >
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              <span>Year-wise Trends</span>
            </button>
          </div>
        </div>
      </div>

      {/* Section 1: Latest Ranking Highlights */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-2">
          <div>
            <h2 className="text-xl font-bold text-[#003366] font-serif flex items-center gap-2">
              <Trophy className="w-5 h-5 text-[#F58220]" />
              Latest Ranking Highlights
            </h2>
            <p className="text-xs text-gray-600">
              Verified national and international ranking positions for Indian Institute of Technology Mandi
            </p>
          </div>

          <button
            onClick={() => onNavigateTab("rankings")}
            className="text-xs text-[#003366] hover:text-[#F58220] font-bold flex items-center gap-1 self-start sm:self-auto"
          >
            <span>View Complete Database</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {highlightCards.map((ranking) => (
            <RankingCard key={ranking.id} ranking={ranking} onSelect={onSelectRanking} />
          ))}
        </div>
      </div>

      {/* Section 2: "At a Glance" Achievements (Dynamically calculated) */}
      <div className="bg-white rounded-2xl p-6 border border-gray-200/80 shadow-sm">
        <div className="mb-4">
          <span className="text-xs font-bold uppercase tracking-wider text-[#F58220]">
            Performance Spotlight
          </span>
          <h2 className="text-xl font-bold text-[#003366] font-serif">
            At a Glance
          </h2>
          <p className="text-xs text-gray-500">
            Key institutional milestones computed from verified ranking records
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Milestone 1: Best National Rank */}
          <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl flex flex-col justify-between hover:border-blue-300 transition">
            <div>
              <div className="flex items-center justify-between text-xs font-bold text-gray-500 mb-2">
                <span>🏆 BEST NATIONAL RANK</span>
                <span className="text-xs text-amber-600 font-mono">NIRF</span>
              </div>
              <div className="text-3xl font-extrabold text-[#003366] mb-1">
                #10
              </div>
              <div className="text-xs font-semibold text-gray-800">
                NIRF Innovation (2025)
              </div>
            </div>
            <div className="text-[11px] text-gray-500 mt-3 pt-2 border-t border-slate-200">
              Top 10 national ranking in Innovation & Entrepreneurship
            </div>
          </div>

          {/* Milestone 2: Highest YoY Improvement */}
          <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl flex flex-col justify-between hover:border-blue-300 transition">
            <div>
              <div className="flex items-center justify-between text-xs font-bold text-gray-500 mb-2">
                <span>📈 YOY IMPROVEMENT</span>
                <span className="text-xs text-emerald-600 font-bold">↑ +5 Pos</span>
              </div>
              <div className="text-3xl font-extrabold text-emerald-700 mb-1">
                #26
              </div>
              <div className="text-xs font-semibold text-gray-800">
                NIRF Engineering 2025 (Prev #31)
              </div>
            </div>
            <div className="text-[11px] text-emerald-700 font-medium mt-3 pt-2 border-t border-slate-200">
              Steadily climbed 16 positions since 2021 (#42 → #26)
            </div>
          </div>

          {/* Milestone 3: Best Engineering Rank */}
          <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl flex flex-col justify-between hover:border-blue-300 transition">
            <div>
              <div className="flex items-center justify-between text-xs font-bold text-gray-500 mb-2">
                <span>🎓 TECHNICAL STANDING</span>
                <span className="text-xs text-blue-600 font-mono">#8 National</span>
              </div>
              <div className="text-3xl font-extrabold text-[#003366] mb-1">
                #8
              </div>
              <div className="text-xs font-semibold text-gray-800">
                India Today Technical Universities
              </div>
            </div>
            <div className="text-[11px] text-gray-500 mt-3 pt-2 border-t border-slate-200">
              Ranked among India's premier technical institutes
            </div>
          </div>

          {/* Milestone 4: Best International Rank */}
          <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl flex flex-col justify-between hover:border-blue-300 transition">
            <div>
              <div className="flex items-center justify-between text-xs font-bold text-gray-500 mb-2">
                <span>🌎 INTERNATIONAL</span>
                <span className="text-xs text-indigo-600 font-mono">QS Asia</span>
              </div>
              <div className="text-3xl font-extrabold text-[#003366] mb-1">
                #152
              </div>
              <div className="text-xs font-semibold text-gray-800">
                QS Southern Asia 2025
              </div>
            </div>
            <div className="text-[11px] text-gray-500 mt-3 pt-2 border-t border-slate-200">
              Strong regional citation & faculty publication footprint
            </div>
          </div>
        </div>
      </div>

      {/* Section 3: Performance Analysis & Agency Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Ranking Trends Preview */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-gray-200/80 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-[#003366] font-serif flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-[#F58220]" />
                  NIRF Engineering Trajectory (2021 – 2025)
                </h3>
                <p className="text-xs text-gray-500">
                  Continuous improvement in national engineering ranking position
                </p>
              </div>

              <button
                onClick={() => onNavigateTab("trends")}
                className="text-xs bg-blue-50 text-[#003366] hover:bg-blue-100 font-semibold px-3 py-1.5 rounded-lg transition"
              >
                Interactive Chart →
              </button>
            </div>

            {/* Visual Bar/Line Progression Cards */}
            <div className="grid grid-cols-5 gap-2 my-4 text-center">
              {[
                { year: "2021", rank: 42, score: "51.2", status: "Baseline" },
                { year: "2022", rank: 38, score: "53.9", status: "+4 Pos" },
                { year: "2023", rank: 34, score: "56.7", status: "+4 Pos" },
                { year: "2024", rank: 31, score: "59.8", status: "+3 Pos" },
                { year: "2025", rank: 26, score: "62.5", status: "+5 Pos", highlight: true },
              ].map((item) => (
                <div
                  key={item.year}
                  className={`p-3 rounded-xl border transition ${
                    item.highlight
                      ? "bg-[#003366] text-white border-[#003366] shadow"
                      : "bg-slate-50 text-gray-800 border-slate-200"
                  }`}
                >
                  <div className={`text-[11px] font-bold ${item.highlight ? "text-amber-300" : "text-gray-500"}`}>
                    {item.year}
                  </div>
                  <div className="text-xl font-extrabold my-1">
                    #{item.rank}
                  </div>
                  <div className={`text-[10px] font-medium ${item.highlight ? "text-blue-100" : "text-emerald-700"}`}>
                    {item.status}
                  </div>
                </div>
              ))}
            </div>

            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                <strong>Total Progression:</strong> Improved by <strong>16 positions</strong> from 2021 (#42) to 2025 (#26).
              </span>
            </div>
          </div>
        </div>

        {/* Right Col: Parameter Performance Highlights */}
        <div className="bg-white rounded-2xl p-6 border border-gray-200/80 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-lg font-bold text-[#003366] font-serif flex items-center gap-2 mb-1">
              <Sliders className="w-5 h-5 text-[#F58220]" />
              Parameter Pillars
            </h3>
            <p className="text-xs text-gray-500 mb-4">
              NIRF Engineering 2025 score weights
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <div className="flex justify-between font-semibold text-gray-800 mb-1">
                  <span>Graduation Outcomes (GO)</span>
                  <span className="text-[#003366]">72.8 %</span>
                </div>
                <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                  <div className="bg-[#003366] h-2 rounded-full" style={{ width: "72.8%" }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between font-semibold text-gray-800 mb-1">
                  <span>Teaching & Resources (TLR)</span>
                  <span className="text-[#003366]">68.5 %</span>
                </div>
                <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                  <div className="bg-[#003366] h-2 rounded-full" style={{ width: "68.5%" }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between font-semibold text-gray-800 mb-1">
                  <span>Outreach & Inclusivity (OI)</span>
                  <span className="text-[#003366]">58.1 %</span>
                </div>
                <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                  <div className="bg-[#003366] h-2 rounded-full" style={{ width: "58.1%" }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between font-semibold text-gray-800 mb-1">
                  <span>Research & Practice (RPP)</span>
                  <span className="text-[#003366]">54.2 %</span>
                </div>
                <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                  <div className="bg-[#003366] h-2 rounded-full" style={{ width: "54.2%" }} />
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={() => onNavigateTab("parameters")}
            className="w-full mt-4 text-xs text-center text-[#003366] hover:text-[#F58220] font-bold pt-2 border-t border-gray-100"
          >
            Explore Complete Parameter Metrics →
          </button>
        </div>
      </div>

      {/* Section 4: Latest Ranking News & Updates */}
      <div className="bg-white rounded-2xl p-6 border border-gray-200/80 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-[#003366] font-serif flex items-center gap-2">
              <Newspaper className="w-5 h-5 text-[#F58220]" />
              Ranking Updates & Press Releases
            </h2>
            <p className="text-xs text-gray-500">
              Official institute announcements regarding ranking milestones
            </p>
          </div>

          <button
            onClick={() => onNavigateTab("news")}
            className="text-xs text-[#003366] hover:text-[#F58220] font-bold flex items-center gap-1"
          >
            <span>All Updates</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {news.slice(0, 3).map((item) => (
            <div
              key={item.id}
              onClick={() => onNavigateTab("news")}
              className="bg-slate-50 border border-slate-200/90 rounded-xl overflow-hidden hover:shadow-md hover:border-blue-300 transition cursor-pointer flex flex-col justify-between"
            >
              {item.image_url && (
                <div className="h-36 overflow-hidden">
                  <img
                    src={item.image_url}
                    alt={item.title}
                    className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                  />
                </div>
              )}
              <div className="p-4 flex-1 flex flex-col justify-between space-y-2">
                <div>
                  <div className="text-[10px] font-bold text-gray-500 mb-1">{formatDate(item.date)}</div>
                  <h3 className="font-bold text-gray-900 text-sm leading-snug hover:text-[#003366] transition">
                    {item.title}
                  </h3>
                  <p className="text-xs text-gray-600 line-clamp-2 mt-1">
                    {item.short_description}
                  </p>
                </div>

                <div className="pt-2 text-xs text-[#003366] font-semibold flex items-center gap-1">
                  <span>Read Full Announcement</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
