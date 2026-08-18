import React from "react";
import { ExternalLink, ChevronRight, Award, ShieldCheck, FileCheck2 } from "lucide-react";
import { RankingItem } from "../types";
import { calculateRankChange } from "../utils/helpers";

interface RankingCardProps {
  ranking: RankingItem;
  onSelect: (ranking: RankingItem) => void;
  compact?: boolean;
}

export const RankingCard: React.FC<RankingCardProps> = ({ ranking, onSelect, compact = false }) => {
  const movement = calculateRankChange(ranking.rank, ranking.previous_rank);

  return (
    <div
      onClick={() => onSelect(ranking)}
      className="bg-white rounded-xl border border-gray-200/80 shadow-sm hover:shadow-md hover:border-blue-300 transition-all duration-200 p-4 sm:p-5 flex flex-col justify-between cursor-pointer group relative overflow-hidden"
    >
      {/* Decorative top accent line */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#003366] via-[#F58220] to-[#003366]" />

      <div>
        {/* Card Header: Agency & Badges */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div>
            <span className="inline-block bg-blue-50 text-[#003366] text-xs font-bold px-2.5 py-0.5 rounded border border-blue-100 uppercase tracking-wide">
              {ranking.agency_name}
            </span>
            <span className="ml-1.5 inline-block text-gray-500 text-xs font-medium">
              • {ranking.category}
            </span>
          </div>

          <div className="flex items-center gap-1">
            {ranking.verified && (
              <span className="bg-emerald-50 text-emerald-700 text-[10px] font-medium px-1.5 py-0.5 rounded flex items-center gap-0.5 border border-emerald-200" title="Officially Verified Data">
                <ShieldCheck className="w-3 h-3 text-emerald-600" /> Verified
              </span>
            )}
            {ranking.is_demo && (
              <span className="bg-amber-50 text-amber-700 text-[10px] font-medium px-1.5 py-0.5 rounded border border-amber-200">
                Demo Data
              </span>
            )}
          </div>
        </div>

        {/* Ranking Title */}
        <h3 className="font-bold text-gray-900 text-base sm:text-lg group-hover:text-[#003366] transition-colors leading-tight mb-3">
          {ranking.ranking_name}
        </h3>

        {/* Primary Metric Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 bg-slate-50/80 rounded-lg p-3 border border-slate-100 mb-4">
          {/* Current Rank */}
          <div>
            <div className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">Rank</div>
            <div className="text-xl sm:text-2xl font-extrabold text-[#003366] flex items-baseline gap-1">
              <span className="text-sm font-normal text-gray-500">#</span>
              {ranking.rank}
            </div>
          </div>

          {/* Previous Rank & Change */}
          <div>
            <div className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">Prev Rank</div>
            <div className="text-sm font-bold text-gray-700 mt-1">
              {ranking.previous_rank ? `#${ranking.previous_rank}` : "N/A"}
            </div>
            <div className="mt-0.5">
              <span className={`inline-block text-[11px] font-semibold px-1.5 py-0.2 rounded ${movement.badgeClass}`}>
                {movement.label}
              </span>
            </div>
          </div>

          {/* Year & Score */}
          {!compact && (
            <div className="col-span-2 sm:col-span-1">
              <div className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">Score / Year</div>
              <div className="text-sm font-semibold text-gray-800 mt-1">
                {ranking.score ? `${ranking.score} pts` : "N/A"}
              </div>
              <div className="text-xs text-gray-500">Year {ranking.year}</div>
            </div>
          )}
        </div>

        {/* Additional details */}
        {!compact && (
          <div className="space-y-1.5 text-xs text-gray-600 mb-4">
            {ranking.total_institutions && (
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Total Participating Institutions:</span>
                <span className="font-medium text-gray-800">{ranking.total_institutions.toLocaleString()}</span>
              </div>
            )}
            {ranking.percentile && (
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Percentile:</span>
                <span className="font-semibold text-emerald-700">Top {100 - ranking.percentile}%</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Card Footer Actions */}
      <div className="pt-3 border-t border-gray-100 flex items-center justify-between text-xs">
        {ranking.source_url ? (
          <a
            href={ranking.source_url}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-blue-700 hover:text-blue-900 font-medium inline-flex items-center gap-1 hover:underline"
          >
            <span>Official Source</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        ) : (
          <span className="text-gray-400 italic">Official Source Logged</span>
        )}

        <button className="text-[#003366] font-semibold group-hover:text-[#F58220] flex items-center gap-0.5 transition">
          <span>View Details</span>
          <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
        </button>
      </div>
    </div>
  );
};
