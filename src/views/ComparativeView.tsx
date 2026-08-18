import React, { useState } from "react";
import { GitCompare, ShieldCheck, Trophy, ArrowUpRight, Award } from "lucide-react";
import { ComparativeData } from "../types";

interface ComparativeViewProps {
  comparativeData: ComparativeData[];
}

export const ComparativeView: React.FC<ComparativeViewProps> = ({ comparativeData }) => {
  const [selectedInstitute, setSelectedInstitute] = useState<string>("IIT Ropar");

  const targetIIT = comparativeData.find((c) => c.is_target) || comparativeData[0];
  const compareIIT = comparativeData.find((c) => c.institute_name === selectedInstitute) || comparativeData[1];

  const peerList = comparativeData.filter((c) => !c.is_target);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="bg-white rounded-2xl p-6 border border-gray-200/80 shadow-sm">
        <h1 className="text-2xl font-bold text-[#003366] font-serif flex items-center gap-2">
          <GitCompare className="w-6 h-6 text-[#F58220]" />
          Peer Institute Comparative Analysis
        </h1>
        <p className="text-xs sm:text-sm text-gray-600 mt-1">
          Benchmark IIT Mandi's NIRF metrics against other Indian Institutes of Technology (IITs).
        </p>
      </div>

      {/* Peer Selector */}
      <div className="bg-white rounded-2xl p-5 border border-gray-200/80 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Select Peer Institute to Compare</label>
          <select
            value={selectedInstitute}
            onChange={(e) => setSelectedInstitute(e.target.value)}
            className="bg-slate-50 border border-gray-200 rounded-lg p-2.5 text-xs font-bold text-[#003366] focus:outline-none focus:ring-2 focus:ring-[#003366] w-full sm:w-64"
          >
            {peerList.map((p) => (
              <option key={p.id} value={p.institute_name}>
                {p.institute_name} (Rank #{p.rank})
              </option>
            ))}
          </select>
        </div>

        <div className="bg-amber-50 border border-amber-200 p-2.5 rounded-xl text-[11px] text-amber-800 font-medium">
          Note: Comparison figures are sourced from published NIRF reports.
        </div>
      </div>

      {/* Side-by-Side Comparison Card */}
      {targetIIT && compareIIT && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Target: IIT Mandi */}
          <div className="bg-white rounded-2xl border-2 border-[#003366] p-6 shadow-md relative">
            <div className="absolute top-0 right-0 bg-[#003366] text-white text-[10px] font-bold px-3 py-1 rounded-bl-xl uppercase tracking-wider">
              Focus Institute
            </div>

            <h2 className="text-xl font-bold text-[#003366] font-serif mb-1">
              {targetIIT.institute_name}
            </h2>
            <p className="text-xs text-gray-500 mb-4">
              {targetIIT.agency_name} {targetIIT.category_name} ({targetIIT.year})
            </p>

            <div className="bg-blue-50 p-4 rounded-xl mb-5 flex items-center justify-between border border-blue-100">
              <div>
                <span className="text-xs text-gray-500 uppercase font-bold block">NIRF Rank</span>
                <span className="text-3xl font-black text-[#003366]">#{targetIIT.rank}</span>
              </div>
              <div>
                <span className="text-xs text-gray-500 uppercase font-bold block">Total Score</span>
                <span className="text-2xl font-black text-emerald-700">{targetIIT.score} / 100</span>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between p-2.5 bg-slate-50 rounded border border-slate-100">
                <span className="text-gray-600 font-medium">Teaching & Resources (TLR):</span>
                <span className="font-bold text-gray-900">{targetIIT.teaching}</span>
              </div>
              <div className="flex justify-between p-2.5 bg-slate-50 rounded border border-slate-100">
                <span className="text-gray-600 font-medium">Research & Practice (RPP):</span>
                <span className="font-bold text-gray-900">{targetIIT.research}</span>
              </div>
              <div className="flex justify-between p-2.5 bg-slate-50 rounded border border-slate-100">
                <span className="text-gray-600 font-medium">Graduation Outcomes (GO):</span>
                <span className="font-bold text-gray-900">{targetIIT.graduation_outcomes}</span>
              </div>
              <div className="flex justify-between p-2.5 bg-slate-50 rounded border border-slate-100">
                <span className="text-gray-600 font-medium">Outreach & Inclusivity (OI):</span>
                <span className="font-bold text-gray-900">{targetIIT.outreach}</span>
              </div>
              <div className="flex justify-between p-2.5 bg-slate-50 rounded border border-slate-100">
                <span className="text-gray-600 font-medium">Peer Perception (PR):</span>
                <span className="font-bold text-gray-900">{targetIIT.perception}</span>
              </div>
              <div className="flex justify-between p-2.5 bg-slate-50 rounded border border-slate-100">
                <span className="text-gray-600 font-medium">Faculty/Student Ratio:</span>
                <span className="font-bold text-gray-900">{targetIIT.faculty_student_ratio}</span>
              </div>
              <div className="flex justify-between p-2.5 bg-slate-50 rounded border border-slate-100">
                <span className="text-gray-600 font-medium">Citations Total:</span>
                <span className="font-bold text-emerald-700">{targetIIT.citations}</span>
              </div>
            </div>
          </div>

          {/* Selected Peer IIT */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm relative">
            <div className="absolute top-0 right-0 bg-gray-200 text-gray-700 text-[10px] font-bold px-3 py-1 rounded-bl-xl uppercase tracking-wider">
              Peer Comparison
            </div>

            <h2 className="text-xl font-bold text-gray-800 font-serif mb-1">
              {compareIIT.institute_name}
            </h2>
            <p className="text-xs text-gray-500 mb-4">
              {compareIIT.agency_name} {compareIIT.category_name} ({compareIIT.year})
            </p>

            <div className="bg-slate-100 p-4 rounded-xl mb-5 flex items-center justify-between border border-slate-200">
              <div>
                <span className="text-xs text-gray-500 uppercase font-bold block">NIRF Rank</span>
                <span className="text-3xl font-black text-gray-800">#{compareIIT.rank}</span>
              </div>
              <div>
                <span className="text-xs text-gray-500 uppercase font-bold block">Total Score</span>
                <span className="text-2xl font-black text-gray-700">{compareIIT.score} / 100</span>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between p-2.5 bg-slate-50 rounded border border-slate-100">
                <span className="text-gray-600 font-medium">Teaching & Resources (TLR):</span>
                <span className="font-bold text-gray-900">{compareIIT.teaching}</span>
              </div>
              <div className="flex justify-between p-2.5 bg-slate-50 rounded border border-slate-100">
                <span className="text-gray-600 font-medium">Research & Practice (RPP):</span>
                <span className="font-bold text-gray-900">{compareIIT.research}</span>
              </div>
              <div className="flex justify-between p-2.5 bg-slate-50 rounded border border-slate-100">
                <span className="text-gray-600 font-medium">Graduation Outcomes (GO):</span>
                <span className="font-bold text-gray-900">{compareIIT.graduation_outcomes}</span>
              </div>
              <div className="flex justify-between p-2.5 bg-slate-50 rounded border border-slate-100">
                <span className="text-gray-600 font-medium">Outreach & Inclusivity (OI):</span>
                <span className="font-bold text-gray-900">{compareIIT.outreach}</span>
              </div>
              <div className="flex justify-between p-2.5 bg-slate-50 rounded border border-slate-100">
                <span className="text-gray-600 font-medium">Peer Perception (PR):</span>
                <span className="font-bold text-gray-900">{compareIIT.perception}</span>
              </div>
              <div className="flex justify-between p-2.5 bg-slate-50 rounded border border-slate-100">
                <span className="text-gray-600 font-medium">Faculty/Student Ratio:</span>
                <span className="font-bold text-gray-900">{compareIIT.faculty_student_ratio}</span>
              </div>
              <div className="flex justify-between p-2.5 bg-slate-50 rounded border border-slate-100">
                <span className="text-gray-600 font-medium">Citations Total:</span>
                <span className="font-bold text-gray-800">{compareIIT.citations}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Matrix Table */}
      <div className="bg-white rounded-2xl p-6 border border-gray-200/80 shadow-sm">
        <h3 className="text-lg font-bold text-[#003366] font-serif mb-3">
          Peer IIT Benchmarking Table (2025 NIRF Engineering)
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#003366] text-white font-semibold">
                <th className="p-3">Institute</th>
                <th className="p-3 text-center">Rank</th>
                <th className="p-3 text-center">Score</th>
                <th className="p-3 text-center">TLR</th>
                <th className="p-3 text-center">RPP</th>
                <th className="p-3 text-center">GO</th>
                <th className="p-3 text-center">OI</th>
                <th className="p-3 text-center">PR</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {comparativeData.map((item) => (
                <tr
                  key={item.id}
                  className={`hover:bg-slate-50 transition ${
                    item.is_target ? "bg-blue-50/80 font-bold text-[#003366]" : "text-gray-800"
                  }`}
                >
                  <td className="p-3">
                    <span className="flex items-center gap-1.5">
                      {item.institute_name}
                      {item.is_target && (
                        <span className="bg-[#F58220] text-white text-[9px] px-1.5 py-0.2 rounded font-sans uppercase">
                          IIT MANDI
                        </span>
                      )}
                    </span>
                  </td>
                  <td className="p-3 text-center text-sm font-extrabold">#{item.rank}</td>
                  <td className="p-3 text-center font-bold">{item.score}</td>
                  <td className="p-3 text-center">{item.teaching}</td>
                  <td className="p-3 text-center">{item.research}</td>
                  <td className="p-3 text-center">{item.graduation_outcomes}</td>
                  <td className="p-3 text-center">{item.outreach}</td>
                  <td className="p-3 text-center">{item.perception}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
