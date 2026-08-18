import React, { useState, useMemo } from "react";
import { FileText, Search, Download, ShieldCheck, Filter, Eye } from "lucide-react";
import { RankingDocument } from "../types";
import { formatDate } from "../utils/helpers";

interface DocumentsViewProps {
  documents: RankingDocument[];
  onOpenDoc: (doc: RankingDocument) => void;
}

export const DocumentsView: React.FC<DocumentsViewProps> = ({ documents, onOpenDoc }) => {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");

  const documentTypes = [
    "NIRF Reports",
    "QS Reports",
    "THE Reports",
    "India Today Reports",
    "Institutional Data",
    "Ranking Submissions",
    "Supporting Documents",
    "Press Releases",
  ];

  const filteredDocs = useMemo(() => {
    return documents.filter((doc) => {
      if (typeFilter !== "all" && doc.document_type !== typeFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          doc.document_name.toLowerCase().includes(q) ||
          doc.document_type.toLowerCase().includes(q) ||
          doc.uploaded_by.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [documents, typeFilter, search]);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="bg-white rounded-2xl p-6 border border-gray-200/80 shadow-sm">
        <h1 className="text-2xl font-bold text-[#003366] font-serif flex items-center gap-2">
          <FileText className="w-6 h-6 text-[#F58220]" />
          Documents & Official Reports Repository
        </h1>
        <p className="text-xs sm:text-sm text-gray-600 mt-1">
          Search, view, and inspect official NIRF data submissions, QS evaluation sheets, institutional certificates, and audit reports.
        </p>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="bg-white rounded-2xl p-5 border border-gray-200/80 shadow-sm flex flex-col md:flex-row gap-4 justify-between">
        <div className="relative flex-1">
          <input
            type="text"
            placeholder="Search document title, report type, or uploader..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-50 border border-gray-200 rounded-lg pl-9 pr-4 py-2 text-xs text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#003366]"
          />
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
        </div>

        <div className="w-full md:w-64 shrink-0">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="w-full bg-slate-50 border border-gray-200 rounded-lg p-2 text-xs text-gray-800 font-medium focus:outline-none focus:ring-2 focus:ring-[#003366]"
          >
            <option value="all">All Document Types</option>
            {documentTypes.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Document Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredDocs.map((doc) => (
          <div
            key={doc.id}
            className="bg-white rounded-2xl border border-gray-200/90 shadow-sm hover:shadow-md hover:border-blue-300 transition p-5 flex flex-col justify-between"
          >
            <div>
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="p-2.5 bg-red-50 text-red-700 rounded-xl border border-red-100">
                  <FileText className="w-6 h-6" />
                </div>
                {doc.verified && (
                  <span className="bg-emerald-50 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded border border-emerald-200 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" /> VERIFIED
                  </span>
                )}
              </div>

              <span className="text-[10px] font-bold uppercase tracking-wider text-[#003366] block mb-1">
                {doc.document_type}
              </span>

              <h3 className="font-bold text-gray-900 text-sm leading-snug mb-2">
                {doc.document_name}
              </h3>

              <div className="text-xs text-gray-500 space-y-1 mb-4">
                <div className="flex justify-between">
                  <span>Publication Date:</span>
                  <span className="font-medium text-gray-700">{formatDate(doc.publication_date)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Uploaded By:</span>
                  <span className="font-medium text-gray-700">{doc.uploaded_by}</span>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-gray-100 flex items-center justify-between gap-2">
              <button
                onClick={() => onOpenDoc(doc)}
                className="flex-1 bg-[#003366] hover:bg-blue-900 text-white text-xs font-semibold py-2 px-3 rounded-lg transition flex items-center justify-center gap-1.5"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>View Document</span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
