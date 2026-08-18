import React, { useState, useMemo } from "react";
import { TrendingUp, Award, ArrowUpRight, ArrowDownRight, ShieldCheck, Filter } from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend
} from "recharts";
import { RankingItem, RankingAgency } from "../types";
import { calculateRankChange } from "../utils/helpers";

interface TrendsViewProps {
  rankings: RankingItem[];
  agencies: RankingAgency[];
}

export const TrendsView: React.FC<TrendsViewProps> = ({ rankings, agencies }) => {
  const [selectedAgency, setSelectedAgency] = useState("nirf");
  const [selectedCategory, setSelectedCategory] = useState("Engineering");

  // Get available categories for selected agency
  const availableCategories = useMemo(() => {
    const set = new Set<string>();
    rankings
      .filter((r) => r.agency_id === selectedAgency)
      .forEach((r) => set.add(r.category));
    return Array.from(set);
  }, [rankings, selectedAgency]);

  // Filter rankings for selected agency & category, sorted chronologically ascending
  const trendData = useMemo(() => {
    const list = rankings.filter(
      (r) =>
        r.agency_id === selectedAgency &&
        r.category.toLowerCase() === selectedCategory.toLowerCase()
    );
    return list.sort((a, b) => a.year - b.year);
  }, [rankings, selectedAgency, selectedCategory]);

  // Compute total improvement (start year vs end year)
  const totalProgression = useMemo(() => {
    if (trendData.length < 2) return null;
    const start = trendData[0];
    const end = trendData[trendData.length - 1];
    // Improvement = start.rank - end.rank (e.g. 42 - 26 = +16)
    const diff = start.rank - end.rank;
    return {
      startYear: start.year,
      startRank: start.rank,
      endYear: end.year,
      endRank: end.rank,
      diff,
      improved: diff > 0,
    };
  }, [trendData]);

  // Transform data for Recharts
  const chartData = useMemo(() => {
    return trendData.map((item) => ({
      year: String(item.year),
      rank: item.rank,
      score: item.score || 0,
      name: item.ranking_name,
    }));
  }, [trendData]);

  // Custom Tooltip for Recharts
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-3 rounded-xl shadow-lg border border-gray-200 text-xs">
          <p className="font-bold text-[#003366]">{label} Evaluation</p>
          <p className="text-lg font-black text-[#F58220] my-0.5">Rank #{data.rank}</p>
          {data.score > 0 && <p className="text-gray-600">Score: {data.score} / 100</p>}
          <p className="text-[10px] text-emerald-700 font-medium mt-1">✓ Verified Official Data</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="bg-white rounded-2xl p-6 border border-gray-200/80 shadow-sm">
        <h1 className="text-2xl font-bold text-[#003366] font-serif flex items-center gap-2">
          <TrendingUp className="w-6 h-6 text-[#F58220]" />
          Year-wise Ranking Trends
        </h1>
        <p className="text-xs sm:text-sm text-gray-600 mt-1">
          Track historical position trajectories and year-over-year rank advancements. Note that lower rank numbers represent better institutional standing.
        </p>
      </div>

      {/* Control Filters */}
      <div className="bg-white rounded-2xl p-5 border border-gray-200/80 shadow-sm flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <div>
            <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">Ranking Agency</label>
            <select
              value={selectedAgency}
              onChange={(e) => {
                setSelectedAgency(e.target.value);
                // Reset category to first available
                const firstCat = rankings.find((r) => r.agency_id === e.target.value)?.category || "Engineering";
                setSelectedCategory(firstCat);
              }}
              className="bg-slate-50 border border-gray-200 rounded-lg p-2 text-xs font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#003366] w-full sm:w-48"
            >
              {agencies.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">Ranking Category</label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="bg-slate-50 border border-gray-200 rounded-lg p-2 text-xs font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#003366] w-full sm:w-48"
            >
              {availableCategories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Overall Progression Summary Box */}
        {totalProgression && (
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/90 text-xs w-full sm:w-auto text-left sm:text-right">
            <span className="text-gray-500 block">
              Historical Range ({totalProgression.startYear} → {totalProgression.endYear}):
            </span>
            <span className={`text-sm font-extrabold block ${totalProgression.improved ? "text-emerald-700" : "text-rose-700"}`}>
              {totalProgression.improved
                ? `Improved by ${totalProgression.diff} positions (#${totalProgression.startRank} → #${totalProgression.endRank})`
                : `Moved ${Math.abs(totalProgression.diff)} positions (#${totalProgression.startRank} → #${totalProgression.endRank})`}
            </span>
          </div>
        )}
      </div>

      {/* Main Trend Line Chart */}
      <div className="bg-white rounded-2xl p-6 border border-gray-200/80 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-[#003366] font-serif">
              Rank Trajectory ({selectedCategory})
            </h2>
            <p className="text-xs text-gray-500">
              Inverted Y-axis: Higher curve position indicates superior rank
            </p>
          </div>
          <span className="bg-blue-50 text-[#003366] text-xs font-bold px-2.5 py-1 rounded border border-blue-100">
            {selectedAgency.toUpperCase()}
          </span>
        </div>

        {chartData.length > 0 ? (
          <div className="h-80 w-full pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 20, right: 30, left: 10, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="year" stroke="#64748b" fontSize={12} tickLine={false} />
                <YAxis
                  reversed
                  domain={['dataMin - 5', 'dataMax + 5']}
                  stroke="#64748b"
                  fontSize={12}
                  tickFormatter={(val) => `#${val}`}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="rank"
                  name="National Rank Position"
                  stroke="#003366"
                  strokeWidth={3}
                  dot={{ r: 6, fill: "#F58220", strokeWidth: 2, stroke: "#003366" }}
                  activeDot={{ r: 8, fill: "#F58220" }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="p-12 text-center text-gray-400 italic bg-gray-50 rounded-xl">
            No historical trend records found for this combination.
          </div>
        )}
      </div>

      {/* Detailed Year-by-Year Historical Breakdown Table */}
      <div className="bg-white rounded-2xl p-6 border border-gray-200/80 shadow-sm">
        <h3 className="text-lg font-bold text-[#003366] font-serif mb-3">
          Historical Year-wise Breakdown
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 text-gray-700 font-bold border-b border-slate-200">
                <th className="p-3">Year</th>
                <th className="p-3">Ranking Name</th>
                <th className="p-3 text-center">Rank</th>
                <th className="p-3 text-center">Prev Rank</th>
                <th className="p-3 text-center">YoY Movement</th>
                <th className="p-3 text-center">Score</th>
                <th className="p-3 text-center">Verified Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {trendData.map((item) => {
                const m = calculateRankChange(item.rank, item.previous_rank);
                return (
                  <tr key={item.id} className="hover:bg-slate-50 transition">
                    <td className="p-3 font-bold text-gray-900">{item.year}</td>
                    <td className="p-3 font-medium text-gray-800">{item.ranking_name}</td>
                    <td className="p-3 text-center font-extrabold text-[#003366] text-sm">#{item.rank}</td>
                    <td className="p-3 text-center text-gray-600">
                      {item.previous_rank ? `#${item.previous_rank}` : "N/A"}
                    </td>
                    <td className="p-3 text-center">
                      <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded ${m.badgeClass}`}>
                        {m.label}
                      </span>
                    </td>
                    <td className="p-3 text-center font-semibold text-emerald-800">
                      {item.score ? `${item.score} / 100` : "N/A"}
                    </td>
                    <td className="p-3 text-center">
                      {item.verified ? (
                        <span className="text-emerald-700 font-bold inline-flex items-center gap-0.5">
                          <ShieldCheck className="w-3.5 h-3.5" /> Verified
                        </span>
                      ) : (
                        <span className="text-amber-600 font-medium">Pending Audit</span>
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
  );
};
