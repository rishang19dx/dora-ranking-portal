import React from "react";
import { Search, ShieldCheck, UserCheck, Lock, ExternalLink } from "lucide-react";
import { UserRole } from "../types";

interface HeaderProps {
  currentUser: { name: string; email: string; role: UserRole } | null;
  onOpenAdminLogin: () => void;
  onLogout: () => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  onSearchSubmit: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentUser,
  onOpenAdminLogin,
  onLogout,
  searchQuery,
  setSearchQuery,
  onSearchSubmit,
}) => {
  return (
    <header className="bg-[#003366] text-white shadow-md border-b-4 border-[#F58220] sticky top-0 z-40">
      {/* Top institutional banner bar */}
      <div className="bg-[#002244] text-xs py-1 px-4 border-b border-blue-900/50">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-2">
          <div className="flex items-center gap-3">
            <span className="text-gray-300 font-medium">
              भारतीय प्रौद्योगिकी संस्थान मण्डी | Indian Institute of Technology Mandi
            </span>
            <span className="hidden md:inline-block text-blue-400">•</span>
            <span className="hidden md:inline-block text-emerald-400 flex items-center gap-1 font-medium">
              <ShieldCheck className="w-3.5 h-3.5" /> Official Institutional Portal
            </span>
          </div>
          <div className="flex items-center gap-4 text-gray-300">
            <a
              href="https://www.iitmandi.ac.in"
              target="_blank"
              rel="noreferrer"
              className="hover:text-white transition flex items-center gap-1"
            >
              IIT Mandi Main Site <ExternalLink className="w-3 h-3" />
            </a>
            <span>|</span>
            <span className="text-amber-400 font-medium">Kamand, H.P., India</span>
          </div>
        </div>
      </div>

      {/* Main Header Content */}
      <div className="max-w-7xl mx-auto px-4 py-3 sm:py-4 flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Logo and Title */}
        <div className="flex items-center gap-3 sm:gap-4 cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
          <div className="w-12 h-12 sm:w-14 sm:h-14 bg-white rounded-full p-1.5 shadow-inner border-2 border-[#F58220] flex items-center justify-center shrink-0">
            {/* IIT Mandi Crest SVG */}
            <svg viewBox="0 0 100 100" className="w-full h-full">
              <circle cx="50" cy="50" r="45" fill="#003366" />
              <path d="M25 65 L50 25 L75 65 Z" fill="none" stroke="#F58220" strokeWidth="6" />
              <circle cx="50" cy="45" r="10" fill="#FFFFFF" />
              <path d="M35 72 L65 72" stroke="#FFFFFF" strokeWidth="4" />
              <text x="50" y="85" textAnchor="middle" fill="#FFFFFF" fontSize="9" fontWeight="bold">IIT MANDI</text>
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-2xl font-bold tracking-tight text-white font-serif">
                IIT Mandi Ranking Portal
              </h1>
              <span className="bg-[#F58220] text-white text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded shadow-sm">
                NIRF / QS / THE
              </span>
            </div>
            <p className="text-xs sm:text-sm text-blue-200">
              Institutional Performance, Verification & Global Recognition
            </p>
          </div>
        </div>

        {/* Search & User Status */}
        <div className="flex items-center gap-3 w-full md:w-auto justify-end">
          {/* Quick Search */}
          <div className="relative flex-1 md:w-64">
            <input
              type="text"
              placeholder="Search rankings, NIRF, QS..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && onSearchSubmit()}
              className="w-full bg-blue-950/70 border border-blue-700/60 rounded-lg pl-9 pr-3 py-1.5 text-sm text-white placeholder-blue-300 focus:outline-none focus:ring-2 focus:ring-[#F58220] focus:border-transparent transition"
            />
            <Search className="w-4 h-4 text-blue-300 absolute left-2.5 top-2.5" />
          </div>

          {/* Admin User Button */}
          {currentUser ? (
            <div className="flex items-center gap-2 bg-blue-900/90 border border-blue-700 py-1 px-3 rounded-lg text-xs">
              <UserCheck className="w-4 h-4 text-emerald-400" />
              <div className="hidden sm:block text-left">
                <div className="font-semibold text-white leading-tight">{currentUser.name}</div>
                <div className="text-[10px] text-amber-300 font-medium">{currentUser.role}</div>
              </div>
              <button
                onClick={onLogout}
                className="ml-2 bg-rose-600 hover:bg-rose-700 text-white px-2 py-1 rounded text-[11px] transition"
                title="Logout"
              >
                Exit Admin
              </button>
            </div>
          ) : (
            <button
              onClick={onOpenAdminLogin}
              className="flex items-center gap-1.5 bg-[#F58220] hover:bg-[#e07115] text-white font-medium text-xs sm:text-sm px-3 py-1.5 rounded-lg shadow transition shrink-0"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Admin Login</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
