import React, { useState } from "react";
import { Sliders, Award, Info, BarChart2, ShieldCheck } from "lucide-react";
import { RankingItem, RankingParameter } from "../types";

interface ParametersViewProps {
  rankings: RankingItem[];
  parameters: RankingParameter[];
}

export const ParametersView: React.FC<ParametersViewProps> = ({ rankings, parameters }) => {
  const [selectedRankingId, setSelectedRankingId] = useState<string>(
    rankings[0]?.id || "rnk-1"
  );

  const activeRanking = rankings.find((r) => r.id === selectedRankingId) || rankings[0];
  const activeParams = parameters.filter((p) => p.ranking_id === activeRanking?.id);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="bg-white rounded-2xl p-6 border border-gray-200/80 shadow-sm">
        <h1 className="text-2xl font-bold text-[#003366] font-serif flex items-center gap-2">
          <Sliders className="w-6 h-6 text-[#F58220]" />
          Ranking Parameter Analysis
        </h1>
        <p className="text-xs sm:text-sm text-gray-600 mt-1">
          Detailed evaluation parameters including Teaching, Learning & Resources (TLR), Research Output (RPP), Graduation Outcomes (GO), Outreach (OI), and Peer Perception (PR).
        </p>
      </div>

      {/* Select Ranking Record */}
      <div className="bg-white rounded-2xl p-5 border border-gray-200/80 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Select Ranking Record</label>
          <select
            value={selectedRankingId}
            onChange={(e) => setSelectedRankingId(e.target.value)}
            className="bg-slate-50 border border-gray-200 rounded-lg p-2.5 text-xs font-bold text-[#003366] focus:outline-none focus:ring-2 focus:ring-[#003366] w-full sm:w-80"
          >
            {rankings.map((r) => (
              <option key={r.id} value={r.id}>
                {r.ranking_name} (Rank #{r.rank})
              </option>
            ))}
          </select>
        </div>

        {activeRanking && (
          <div className="flex items-center gap-4 bg-blue-50/80 border border-blue-100 p-3 rounded-xl text-xs w-full sm:w-auto">
            <div>
              <span className="text-gray-500 block">Overall Rank:</span>
              <span className="text-lg font-extrabold text-[#003366]">#{activeRanking.rank}</span>
            </div>
            <div>
              <span className="text-gray-500 block">Total Score:</span>
              <span className="text-lg font-extrabold text-emerald-700">{activeRanking.score ?? "N/A"} / 100</span>
            </div>
          </div>
        )}
      </div>

      {/* Parameters Scorecard List */}
      <div className="bg-white rounded-2xl p-6 border border-gray-200/80 shadow-sm space-y-6">
        <div className="border-b border-gray-100 pb-3">
          <h2 className="text-lg font-bold text-[#003366] font-serif">
            {activeRanking?.ranking_name} — Score Breakdown
          </h2>
          <p className="text-xs text-gray-500">
            Parameters normalized on a 100-point scale according to agency methodology
          </p>
        </div>

        {activeParams.length > 0 ? (
          <div className="space-y-5">
            {activeParams.map((param) => {
              const pct = Math.min(100, Math.max(0, (param.score / (param.maximum_score || 100)) * 100));
              return (
                <div key={param.id} className="bg-slate-50 border border-slate-200 p-4 rounded-xl space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs gap-1">
                    <span className="font-bold text-gray-900 text-sm">{param.parameter_name}</span>
                    <span className="font-extrabold text-[#003366] text-sm">
                      {param.score} / {param.maximum_score} ({pct.toFixed(1)}%)
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden shadow-inner">
                    <div
                      className="bg-gradient-to-r from-[#003366] to-[#F58220] h-3 rounded-full transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>

                  {param.remarks && (
                    <p className="text-xs text-gray-600 bg-white p-2.5 rounded border border-gray-200/80 mt-2">
                      <strong className="text-[#003366]">Highlights:</strong> {param.remarks}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-8 text-center text-gray-500 bg-gray-50 rounded-xl text-xs space-y-2">
            <Info className="w-8 h-8 text-gray-400 mx-auto" />
            <p>Detailed sub-parameter scores for this record are logged in the official submission PDF.</p>
          </div>
        )}
      </div>

      {/* Parameter Methodology Guide */}
      <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-sm space-y-3">
        <h3 className="font-bold text-base text-amber-400 font-serif flex items-center gap-2">
          <Info className="w-4 h-4" />
          NIRF Methodology Parameters Explained
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-gray-300">
          <div>
            <strong className="text-white block mb-0.5">1. Teaching, Learning & Resources (TLR - 30%):</strong>
            Focuses on student strength, faculty-student ratio, faculty with PhD, financial resources utilization.
          </div>
          <div>
            <strong className="text-white block mb-0.5">2. Research & Professional Practice (RPP - 30%):</strong>
            Evaluates Scopus/Web of Science publications, citation counts, patents filed/granted, and research earnings.
          </div>
          <div>
            <strong className="text-white block mb-0.5">3. Graduation Outcomes (GO - 20%):</strong>
            Measures university exams outcomes, placement records, higher studies enrolment, and median salary.
          </div>
          <div>
            <strong className="text-white block mb-0.5">4. Outreach & Inclusivity (OI - 10%):</strong>
            Assesses region diversity, women faculty/students, economically challenged students, and physical facilities for PwD.
          </div>
        </div>
      </div>
    </div>
  );
};
