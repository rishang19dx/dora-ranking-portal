import React from "react";
import { MapPin, Mail, Phone, ExternalLink, ShieldCheck, Building, GraduationCap, Microscope, Users } from "lucide-react";

interface FooterProps {
  lastUpdated?: string;
  onSelectTab: (tab: any) => void;
}

export const Footer: React.FC<FooterProps> = ({ lastUpdated, onSelectTab }) => {
  const formattedDate = lastUpdated
    ? new Date(lastUpdated).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : new Date().toLocaleDateString("en-IN", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });

  return (
    <footer className="bg-[#002244] text-white border-t-4 border-[#F58220] pt-10 pb-6 mt-16 text-xs sm:text-sm">
      <div className="max-w-7xl mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 pb-8 border-b border-blue-900/80">
          {/* Col 1: Institute Info */}
          <div className="md:col-span-1 space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-white rounded-full p-1 shrink-0 flex items-center justify-center">
                <svg viewBox="0 0 100 100" className="w-full h-full">
                  <circle cx="50" cy="50" r="45" fill="#003366" />
                  <path d="M25 65 L50 25 L75 65 Z" fill="none" stroke="#F58220" strokeWidth="8" />
                </svg>
              </div>
              <h3 className="font-bold text-base text-white font-serif">IIT Mandi</h3>
            </div>
            <p className="text-xs text-blue-200 leading-relaxed">
              Indian Institute of Technology Mandi is an autonomous engineering and technology university located in Kamand Valley, Mandi, Himachal Pradesh.
            </p>
            <div className="text-xs text-blue-300 space-y-1 pt-1">
              <div className="flex items-start gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-[#F58220] shrink-0 mt-0.5" />
                <span>Kamand, Himachal Pradesh – 175075, India</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-[#F58220] shrink-0" />
                <span>ranking.cell@iitmandi.ac.in</span>
              </div>
            </div>
          </div>

          {/* Col 2: Important Institutional Links */}
          <div>
            <h4 className="font-bold text-white text-sm uppercase tracking-wider mb-3 pb-1 border-b border-blue-800 text-[#F58220]">
              Important Links
            </h4>
            <ul className="space-y-2 text-xs text-blue-200">
              <li>
                <a
                  href="https://www.iitmandi.ac.in"
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-white transition flex items-center gap-1"
                >
                  <ExternalLink className="w-3 h-3 text-blue-400" /> IIT Mandi Main Website
                </a>
              </li>
              <li>
                <a
                  href="https://www.iitmandi.ac.in/academics"
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-white transition flex items-center gap-1"
                >
                  <GraduationCap className="w-3 h-3 text-blue-400" /> Admissions & Academics
                </a>
              </li>
              <li>
                <a
                  href="https://www.iitmandi.ac.in/research"
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-white transition flex items-center gap-1"
                >
                  <Microscope className="w-3 h-3 text-blue-400" /> Research & Innovation
                </a>
              </li>
              <li>
                <a
                  href="https://alumni.iitmandi.ac.in"
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-white transition flex items-center gap-1"
                >
                  <Users className="w-3 h-3 text-blue-400" /> Alumni Portal
                </a>
              </li>
              <li>
                <a
                  href="https://www.iitmandi.ac.in/contactus"
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-white transition flex items-center gap-1"
                >
                  <Building className="w-3 h-3 text-blue-400" /> Contact Director Office
                </a>
              </li>
            </ul>
          </div>

          {/* Col 3: Portal Navigation */}
          <div>
            <h4 className="font-bold text-white text-sm uppercase tracking-wider mb-3 pb-1 border-b border-blue-800 text-[#F58220]">
              Portal Modules
            </h4>
            <ul className="space-y-2 text-xs text-blue-200">
              <li>
                <button onClick={() => onSelectTab("rankings")} className="hover:text-white transition">
                  National & Global Rankings
                </button>
              </li>
              <li>
                <button onClick={() => onSelectTab("agencies")} className="hover:text-white transition">
                  NIRF / QS / THE Agencies
                </button>
              </li>
              <li>
                <button onClick={() => onSelectTab("trends")} className="hover:text-white transition">
                  Year-wise Trend Analytics
                </button>
              </li>
              <li>
                <button onClick={() => onSelectTab("parameters")} className="hover:text-white transition">
                  Ranking Parameters Breakdown
                </button>
              </li>
              <li>
                <button onClick={() => onSelectTab("documents")} className="hover:text-white transition">
                  Reports & Submissions
                </button>
              </li>
              <li>
                <button onClick={() => onSelectTab("comparative")} className="hover:text-white transition">
                  Peer Institute Comparison
                </button>
              </li>
            </ul>
          </div>

          {/* Col 4: Audit & Verification */}
          <div className="space-y-3">
            <h4 className="font-bold text-white text-sm uppercase tracking-wider mb-3 pb-1 border-b border-blue-800 text-[#F58220]">
              Verification & Policy
            </h4>
            <div className="bg-blue-950/80 p-3 rounded-lg border border-blue-800/80 text-xs text-blue-200 space-y-1.5">
              <div className="flex items-center gap-1.5 font-bold text-emerald-400">
                <ShieldCheck className="w-4 h-4" />
                <span>Verified Data Standard</span>
              </div>
              <p className="text-[11px] text-gray-300">
                All rankings displayed on this official portal undergo rigorous verification by the Ranking Nodal Office and Director's Office before public display.
              </p>
            </div>
            <div className="text-[11px] text-blue-300 pt-1">
              <span className="font-semibold text-white">Data Last Updated: </span>
              <span className="text-amber-300 font-mono">{formattedDate}</span>
            </div>
          </div>
        </div>

        {/* Bottom Copyright & Disclaimer */}
        <div className="pt-6 flex flex-col sm:flex-row items-center justify-between text-xs text-blue-300 gap-2">
          <p>© {new Date().getFullYear()} Indian Institute of Technology Mandi. All Rights Reserved.</p>
          <div className="flex items-center gap-3">
            <span className="font-medium text-white">IIT Mandi Ranking Portal</span>
            <span>•</span>
            <span>Maintained by Ranking Cell & IT Services</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
