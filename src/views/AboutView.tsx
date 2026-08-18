import React from "react";
import { Info, ShieldCheck, Mail, MapPin, Phone, Award, FileCheck2, UserCheck } from "lucide-react";

export const AboutView: React.FC = () => {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="bg-white rounded-2xl p-6 border border-gray-200/80 shadow-sm">
        <h1 className="text-2xl font-bold text-[#003366] font-serif flex items-center gap-2">
          <Info className="w-6 h-6 text-[#F58220]" />
          About Institutional Rankings & Methodology
        </h1>
        <p className="text-xs sm:text-sm text-gray-600 mt-1">
          Indian Institute of Technology Mandi's dedicated Ranking Nodal Cell ensures data accuracy, verification standards, and official submission compliance.
        </p>
      </div>

      {/* Grid of About Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Cell Mission */}
        <div className="bg-white rounded-2xl p-6 border border-gray-200/90 shadow-sm space-y-3">
          <h2 className="text-lg font-bold text-[#003366] font-serif flex items-center gap-2">
            <Award className="w-5 h-5 text-[#F58220]" />
            Ranking Cell Objectives
          </h2>
          <p className="text-xs text-gray-700 leading-relaxed">
            The Ranking Cell at IIT Mandi operates under the Office of the Director and Dean (Planning / Academics). It is responsible for compiling, auditing, submitting, and publicizing accurate institutional data to national frameworks (NIRF, India Today) and global agencies (QS World, Times Higher Education).
          </p>
          <ul className="text-xs text-gray-600 space-y-2 pt-1">
            <li className="flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>Ensure 100% data audit compliance prior to official agency submission.</span>
            </li>
            <li className="flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>Maintain complete historical archives of all submissions and certificates.</span>
            </li>
            <li className="flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>Provide public transparency for students, faculty, alumni, and government bodies.</span>
            </li>
          </ul>
        </div>

        {/* Verification Standard */}
        <div className="bg-white rounded-2xl p-6 border border-gray-200/90 shadow-sm space-y-3">
          <h2 className="text-lg font-bold text-[#003366] font-serif flex items-center gap-2">
            <FileCheck2 className="w-5 h-5 text-[#F58220]" />
            5-Stage Institutional Verification Workflow
          </h2>
          <p className="text-xs text-gray-700 leading-relaxed">
            To prevent errors or unverified metrics, every record on this portal undergoes a structured institutional approval lifecycle:
          </p>
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 font-mono text-[11px] text-[#003366] space-y-1">
            <div>1. Draft → Compiled by Data Entry Operator</div>
            <div>2. Submitted → Uploaded with supporting documents</div>
            <div>3. Under Review → Audited by Ranking Nodal Officer</div>
            <div>4. Verified → Signed off by Dean / Director Office</div>
            <div>5. Published → Displayed publicly on Official Portal</div>
          </div>
        </div>
      </div>

      {/* Nodal Officer Contact Card */}
      <div className="bg-white rounded-2xl p-6 border border-gray-200/90 shadow-sm">
        <h2 className="text-lg font-bold text-[#003366] font-serif mb-4 flex items-center gap-2">
          <UserCheck className="w-5 h-5 text-[#F58220]" />
          Ranking Nodal Office Contact
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs text-gray-700">
          <div className="space-y-1">
            <span className="font-bold text-[#003366] block">Nodal Officer (NIRF & Rankings):</span>
            <p className="font-semibold text-gray-900">Dr. Ranking Nodal Officer</p>
            <p className="text-gray-500">Associate Professor & Nodal Officer</p>
            <p className="text-gray-500">Indian Institute of Technology Mandi</p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-[#F58220]" />
              <span>ranking.cell@iitmandi.ac.in</span>
            </div>
            <div className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-[#F58220]" />
              <span>+91 1905 267000</span>
            </div>
            <div className="flex items-start gap-2">
              <MapPin className="w-4 h-4 text-[#F58220] shrink-0 mt-0.5" />
              <span>Kamand Campus, Mandi, HP – 175075, India</span>
            </div>
          </div>

          <div className="bg-blue-50/80 p-4 rounded-xl border border-blue-100 text-[11px] text-blue-900 leading-relaxed">
            <strong>Public Data Inquiries:</strong> For official queries regarding data submissions or institutional reports, please email the Ranking Cell with subject tag <code>[Ranking Portal Query]</code>.
          </div>
        </div>
      </div>
    </div>
  );
};
