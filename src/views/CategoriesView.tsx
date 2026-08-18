import React from "react";
import { Boxes, Trophy, ShieldCheck, ChevronRight } from "lucide-react";
import { RankingItem } from "../types";
import { RankingCard } from "../components/RankingCard";

interface CategoriesViewProps {
  rankings: RankingItem[];
  onSelectRanking: (ranking: RankingItem) => void;
}

export const CategoriesView: React.FC<CategoriesViewProps> = ({
  rankings,
  onSelectRanking,
}) => {
  // Group rankings by category
  const categoriesMap = new Map<string, RankingItem[]>();
  rankings.forEach((r) => {
    const list = categoriesMap.get(r.category) || [];
    list.push(r);
    categoriesMap.set(r.category, list);
  });

  const categories = Array.from(categoriesMap.entries());

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="bg-white rounded-2xl p-6 border border-gray-200/80 shadow-sm">
        <h1 className="text-2xl font-bold text-[#003366] font-serif flex items-center gap-2">
          <Boxes className="w-6 h-6 text-[#F58220]" />
          Category-wise Rankings Overview
        </h1>
        <p className="text-xs sm:text-sm text-gray-600 mt-1">
          Explore rankings grouped by institutional discipline, including Engineering, Innovation, Overall India, and Regional QS Asian categories.
        </p>
      </div>

      {/* Category Sections */}
      <div className="space-y-8">
        {categories.map(([categoryName, catRankings]) => {
          // Sort chronologically descending
          const sorted = [...catRankings].sort((a, b) => b.year - a.year);
          const latest = sorted[0];

          return (
            <div
              key={categoryName}
              className="bg-white rounded-2xl p-6 border border-gray-200/90 shadow-sm space-y-4"
            >
              {/* Category Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-gray-100 pb-3 gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold text-[#003366] font-serif">
                      {categoryName}
                    </h2>
                    <span className="bg-blue-50 text-[#003366] text-xs font-bold px-2.5 py-0.5 rounded border border-blue-100">
                      {catRankings.length} {catRankings.length === 1 ? "Record" : "Records"}
                    </span>
                  </div>
                  {latest && (
                    <p className="text-xs text-gray-500 mt-0.5">
                      Latest Position: <strong className="text-gray-800">#{latest.rank}</strong> in {latest.year} ({latest.agency_name})
                    </p>
                  )}
                </div>
              </div>

              {/* Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {sorted.map((r) => (
                  <RankingCard key={r.id} ranking={r} onSelect={onSelectRanking} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
