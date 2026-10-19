import React from "react";
import { X, Download, Printer, FileText, CheckCircle2, ShieldCheck } from "lucide-react";
import { RankingDocument } from "../types";

interface PDFViewerModalProps {
  document: RankingDocument | null;
  onClose: () => void;
}

export const PDFViewerModal: React.FC<PDFViewerModalProps> = ({ document: doc, onClose }) => {
  if (!doc) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = () => {
    const element = document.createElement("a");
    const file = new Blob([`
===================================================================
INDIAN INSTITUTE OF TECHNOLOGY MANDI - OFFICIAL RANKING DOCUMENT
===================================================================
Document Name: ${doc.document_name}
Category: ${doc.document_type}
Publication Date: ${doc.publication_date}
Uploaded By: ${doc.uploaded_by}
Verification Status: VERIFIED INSTITUTIONAL RECORD

CONTENT SUMMARY:
This official document contains verified ranking submission parameters,
institutional research metrics, faculty-student statistics, and 
official evaluation methodology submitted to the ranking agency.

(C) Indian Institute of Technology Mandi, Kamand, HP 175075, India.
===================================================================
    `], { type: "text/plain" });
    element.href = URL.createObjectURL(file);
    element.download = `${doc.document_name.replace(/\s+/g, "_")}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full h-[85vh] flex flex-col overflow-hidden border border-gray-200 animate-in fade-in zoom-in duration-150">
        {/* PDF Header bar */}
        <div className="bg-[#002244] text-white p-4 flex items-center justify-between border-b border-blue-900">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="p-2 bg-red-600 rounded text-white shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div className="truncate">
              <h3 className="font-bold text-sm sm:text-base text-white truncate">
                {doc.document_name}
              </h3>
              <p className="text-xs text-blue-200">
                {doc.document_type} • Verified Institutional Report
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handlePrint}
              className="p-2 bg-blue-900/80 hover:bg-blue-800 text-white rounded-lg text-xs flex items-center gap-1 transition"
              title="Print Document"
            >
              <Printer className="w-4 h-4" />
              <span className="hidden sm:inline">Print</span>
            </button>
            <button
              onClick={handleDownload}
              className="p-2 bg-[#F58220] hover:bg-[#e07115] text-white rounded-lg text-xs flex items-center gap-1 transition font-medium"
              title="Download File"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Download</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 text-blue-200 hover:text-white bg-blue-900/60 hover:bg-blue-800 rounded-lg transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Document Viewer Canvas */}
        <div className="flex-1 bg-slate-100 p-4 sm:p-8 overflow-y-auto flex justify-center">
          <div className="bg-white max-w-2xl w-full shadow-lg border border-gray-200 p-8 sm:p-12 text-gray-800 flex flex-col justify-between min-h-[650px] relative font-serif">
            {/* Watermark badge */}
            <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] pointer-events-none select-none">
              <div className="text-6xl font-black text-[#003366] rotate-[-30deg] text-center">
                IIT MANDI OFFICIAL DOCUMENT
              </div>
            </div>

            {/* Document Header */}
            <div>
              <div className="border-b-2 border-[#003366] pb-4 mb-6 flex justify-between items-start">
                <div>
                  <h1 className="text-xl font-extrabold text-[#003366] uppercase tracking-wide">
                    Indian Institute of Technology Mandi
                  </h1>
                  <p className="text-xs font-sans text-gray-600 mt-0.5">
                    Kamand, Himachal Pradesh – 175075, India
                  </p>
                </div>
                <span className="bg-emerald-50 text-emerald-800 text-[10px] font-sans font-bold px-2 py-1 rounded border border-emerald-300 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> VERIFIED
                </span>
              </div>

              <div className="text-center my-6">
                <span className="text-xs uppercase font-sans text-gray-500 font-semibold tracking-widest block">
                  Official Record & Data Sheet
                </span>
                <h2 className="text-lg font-bold text-gray-900 mt-1">
                  {doc.document_name}
                </h2>
              </div>

              {/* Metadata block */}
              <div className="grid grid-cols-2 gap-4 bg-gray-50 font-sans text-xs p-4 rounded border border-gray-200 my-6">
                <div>
                  <span className="text-gray-500 block">Report Type:</span>
                  <span className="font-semibold text-gray-800">{doc.document_type}</span>
                </div>
                <div>
                  <span className="text-gray-500 block">Publication Date:</span>
                  <span className="font-semibold text-gray-800">{doc.publication_date}</span>
                </div>
                <div>
                  <span className="text-gray-500 block">Uploaded By:</span>
                  <span className="font-semibold text-gray-800">{doc.uploaded_by}</span>
                </div>
                <div>
                  <span className="text-gray-500 block">Security Classification:</span>
                  <span className="font-semibold text-emerald-700">Public Institutional Record</span>
                </div>
              </div>

              {/* Body Content Simulation */}
              <div className="font-sans text-xs space-y-3 text-gray-700 leading-relaxed my-6">
                <p>
                  This official document contains verified ranking parameters, teaching-learning resource assessments, research output figures, citation totals, and institutional outreach statistics compiled for evaluation by national and international ranking agencies.
                </p>
                <div className="p-3 bg-blue-50 border-l-4 border-[#003366] text-blue-900 rounded-r text-xs">
                  <strong>Verification Note:</strong> Data compiled herein has been audited and verified by the Office of Dean (Academics) and Dean (Planning / IR) at IIT Mandi before submission.
                </div>
              </div>
            </div>

            {/* Document Footer */}
            <div className="pt-6 border-t border-gray-200 font-sans text-[11px] text-gray-500 flex justify-between items-end">
              <div>
                <p className="font-semibold text-gray-800">Ranking Cell, IIT Mandi</p>
                <p>Office of the Director, Kamand</p>
              </div>
              <div className="text-right">
                <p className="text-[#003366] font-bold">IIT Mandi Ranking Portal</p>
                <p>Verified Reference ID: {doc.id}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
