import React, { useEffect, useState } from "react";
import { X, ExternalLink, ShieldCheck, FileText, Calendar, Award, Sliders, CheckCircle2 } from "lucide-react";
import { RankingItem, RankingParameter, RankingDocument } from "../types";
import { calculateRankChange, formatDate } from "../utils/helpers";

interface RankingDetailModalProps {
  ranking: RankingItem | null;
  allRankings: RankingItem[];
  onClose: () => void;
  onOpenDoc: (doc: RankingDocument) => void;
}

export const RankingDetailModal: React.FC<RankingDetailModalProps> = ({
  ranking,
  allRankings,
  onClose,
  onOpenDoc,
}) => {
  const [parameters, setParameters] = useState<RankingParameter[]>([]);
  const [documents, setDocuments] = useState<RankingDocument[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (ranking) {
      setLoading(true);
      // Fetch parameters and docs for this ranking
      Promise.all([
        fetch(`/api/parameters?ranking_id=${ranking.id}`).then((r) => r.json()),
        fetch(`/api/documents?ranking_id=${ranking.id}`).then((r) => r.json()),
      ])
        .then(([pData, dData]) => {
          setParameters(pData || []);
          setDocuments(dData || []);
        })
        .catch((err) => console.error("Error fetching detail data:", err))
        .finally(() => setLoading(false));
    }
  }, [ranking]);

  if (!ranking) return null;

  const movement = calculateRankChange(ranking.rank, ranking.previous_rank);

  // Find historical records for the same agency & category
  const history = allRankings
    .filter(
      (r) =>
        r.agency_id === ranking.agency_id &&
        r.category.toLowerCase() === ranking.category.toLowerCase()
    )
    .sort((a, b) => b.year - a.year);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full my-auto overflow-hidden border border-gray-100 animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="bg-[#003366] text-white p-5 sm:p-6 relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-blue-200 hover:text-white bg-blue-900/60 p-1.5 rounded-full hover:bg-blue-800 transition"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2 mb-2">
            <span className="bg-[#F58220] text-white font-bold text-xs px-2.5 py-0.5 rounded uppercase tracking-wider">
              {ranking.agency_name}
            </span>
            <span className="text-blue-200 text-xs font-medium">
              • Category: {ranking.category}
            </span>
            {ranking.verified && (
              <span className="ml-auto bg-emerald-500/20 text-emerald-300 text-xs px-2 py-0.5 rounded border border-emerald-400/30 flex items-center gap-1 font-medium">
                <ShieldCheck className="w-3.5 h-3.5" /> Verified
              </span>
            )}
          </div>

          <h2 className="text-xl sm:text-2xl font-bold font-serif leading-tight">
            {ranking.ranking_name}
          </h2>
          <p className="text-xs text-blue-200 mt-1">
            Official Institution Record • Ranking Year {ranking.year}
          </p>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* Key Metrics Overview Box */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200/80">
            <div>
              <div className="text-xs text-gray-500 font-medium uppercase">Current Rank</div>
              <div className="text-2xl font-extrabold text-[#003366] mt-0.5">#{ranking.rank}</div>
            </div>

            <div>
              <div className="text-xs text-gray-500 font-medium uppercase">Previous Rank</div>
              <div className="text-lg font-bold text-gray-700 mt-1">
                {ranking.previous_rank ? `#${ranking.previous_rank}` : "N/A"}
              </div>
            </div>

            <div>
              <div className="text-xs text-gray-500 font-medium uppercase">YoY Position Change</div>
              <div className="mt-1">
                <span className={`inline-block text-xs font-bold px-2 py-0.5 rounded ${movement.badgeClass}`}>
                  {movement.label}
                </span>
              </div>
            </div>

            <div>
              <div className="text-xs text-gray-500 font-medium uppercase">Overall Score</div>
              <div className="text-lg font-bold text-emerald-700 mt-1">
                {ranking.score ? `${ranking.score} / 100` : "N/A"}
              </div>
            </div>
          </div>

          {/* Description & Remarks */}
          {ranking.remarks && (
            <div className="bg-blue-50/60 border border-blue-100 rounded-xl p-4 text-xs text-gray-700 leading-relaxed">
              <span className="font-semibold text-[#003366] block mb-1">Institutional Remarks & Scope:</span>
              {ranking.remarks}
            </div>
          )}

          {/* Parameter Breakdown Section */}
          <div>
            <h3 className="text-sm font-bold text-[#003366] flex items-center gap-2 mb-3 pb-1 border-b border-gray-200">
              <Sliders className="w-4 h-4 text-[#F58220]" />
              Parameter Performance Breakdown
            </h3>

            {parameters.length > 0 ? (
              <div className="space-y-3">
                {parameters.map((p) => {
                  const pct = Math.min(100, Math.max(0, (p.score / (p.maximum_score || 100)) * 100));
                  return (
                    <div key={p.id} className="bg-white border border-gray-100 p-3 rounded-lg shadow-2xs">
                      <div className="flex justify-between items-center text-xs mb-1">
                        <span className="font-semibold text-gray-800">{p.parameter_name}</span>
                        <span className="font-bold text-[#003366]">
                          {p.score} / {p.maximum_score} ({pct.toFixed(1)}%)
                        </span>
                      </div>
                      {/* Horizontal progress bar */}
                      <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden mb-1">
                        <div
                          className="bg-[#003366] h-2 rounded-full transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      {p.remarks && <p className="text-[11px] text-gray-500">{p.remarks}</p>}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-gray-500 italic bg-gray-50 p-3 rounded text-center">
                Detailed parameter scores are uploaded under supporting documents.
              </p>
            )}
          </div>

          {/* Ranking History Timeline */}
          <div>
            <h3 className="text-sm font-bold text-[#003366] flex items-center gap-2 mb-3 pb-1 border-b border-gray-200">
              <Calendar className="w-4 h-4 text-[#F58220]" />
              Historical Performance Timeline ({ranking.agency_name} - {ranking.category})
            </h3>

            <div className="flex items-center gap-2 overflow-x-auto py-2">
              {history.map((item) => (
                <div
                  key={item.id}
                  className={`flex-1 min-w-[100px] border rounded-lg p-3 text-center transition ${
                    item.id === ranking.id
                      ? "bg-blue-50 border-[#003366] shadow-sm ring-1 ring-[#003366]"
                      : "bg-gray-50 border-gray-200"
                  }`}
                >
                  <div className="text-[11px] font-bold text-gray-500">{item.year}</div>
                  <div className="text-lg font-extrabold text-[#003366] my-0.5">#{item.rank}</div>
                  <div className="text-[10px] text-gray-500">
                    {item.score ? `${item.score} pts` : "Verified"}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Documents & Reports */}
          <div>
            <h3 className="text-sm font-bold text-[#003366] flex items-center gap-2 mb-3 pb-1 border-b border-gray-200">
              <FileText className="w-4 h-4 text-[#F58220]" />
              Supporting Reports & Submissions
            </h3>

            {documents.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between p-3 border border-gray-200 rounded-lg bg-gray-50/60 hover:bg-white transition"
                  >
                    <div className="flex items-center gap-2 overflow-hidden">
                      <FileText className="w-4 h-4 text-red-600 shrink-0" />
                      <div className="truncate">
                        <div className="text-xs font-semibold text-gray-800 truncate">
                          {doc.document_name}
                        </div>
                        <div className="text-[10px] text-gray-500">{doc.document_type}</div>
                      </div>
                    </div>

                    <button
                      onClick={() => onOpenDoc(doc)}
                      className="text-xs bg-[#003366] text-white px-2.5 py-1 rounded hover:bg-blue-900 transition shrink-0"
                    >
                      View Report
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-500 italic bg-gray-50 p-3 rounded">
                No external files attached. Verified data is logged with the Dean Office.
              </p>
            )}
          </div>

          {/* Official Verification Audit Details */}
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs text-gray-600 space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-gray-700">Created By:</span>
              <span>{ranking.created_by || "Ranking Nodal Officer"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-semibold text-gray-700">Verified By:</span>
              <span className="text-emerald-700 font-medium">{ranking.verified_by || "Director's Office"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-semibold text-gray-700">Verification Date:</span>
              <span>{formatDate(ranking.verification_date || ranking.updated_at)}</span>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="bg-gray-50 p-4 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          {ranking.source_url ? (
            <a
              href={ranking.source_url}
              target="_blank"
              rel="noreferrer"
              className="text-xs bg-[#003366] text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-900 transition flex items-center gap-1.5 w-full sm:w-auto justify-center"
            >
              <span>View Official Source Website</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          ) : (
            <span className="text-xs text-gray-500">Official Web Link Logged</span>
          )}

          <button
            onClick={onClose}
            className="w-full sm:w-auto text-xs px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium rounded-lg transition"
          >
            Close Window
          </button>
        </div>
      </div>
    </div>
  );
};
