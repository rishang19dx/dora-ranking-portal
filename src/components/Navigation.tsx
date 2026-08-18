import React, { useState } from "react";
import {
  LayoutDashboard,
  Trophy,
  Building2,
  TrendingUp,
  Boxes,
  Sliders,
  FileText,
  GitCompare,
  Newspaper,
  Info,
  ShieldAlert,
  Menu,
  X
} from "lucide-react";
import { ViewTab } from "../types";

interface NavigationProps {
  activeTab: ViewTab;
  setActiveTab: (tab: ViewTab) => void;
  isAdminLoggedIn: boolean;
}

export const Navigation: React.FC<NavigationProps> = ({
  activeTab,
  setActiveTab,
  isAdminLoggedIn,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems: { id: ViewTab; label: string; icon: React.ReactNode }[] = [
    { id: "dashboard", label: "Dashboard", icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: "rankings", label: "Rankings", icon: <Trophy className="w-4 h-4" /> },
    { id: "agencies", label: "Ranking Agencies", icon: <Building2 className="w-4 h-4" /> },
    { id: "trends", label: "Year-wise Trends", icon: <TrendingUp className="w-4 h-4" /> },
    { id: "categories", label: "Category Rankings", icon: <Boxes className="w-4 h-4" /> },
    { id: "parameters", label: "Parameters", icon: <Sliders className="w-4 h-4" /> },
    { id: "documents", label: "Documents & Reports", icon: <FileText className="w-4 h-4" /> },
    { id: "comparative", label: "Comparative Analysis", icon: <GitCompare className="w-4 h-4" /> },
    { id: "news", label: "News & Updates", icon: <Newspaper className="w-4 h-4" /> },
    { id: "about", label: "About Rankings", icon: <Info className="w-4 h-4" /> },
    { id: "admin", label: isAdminLoggedIn ? "Admin Dashboard" : "Admin Login", icon: <ShieldAlert className="w-4 h-4 text-amber-300" /> },
  ];

  const handleTabClick = (id: ViewTab) => {
    setActiveTab(id);
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <nav className="bg-[#002244] border-b border-blue-900/80 text-white shadow-sm sticky top-[73px] sm:top-[85px] z-30">
      <div className="max-w-7xl mx-auto px-4">
        {/* Mobile menu bar header */}
        <div className="flex items-center justify-between lg:hidden py-2.5">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-blue-200">
            <span>Navigation:</span>
            <span className="text-[#F58220] font-bold">
              {navItems.find((n) => n.id === activeTab)?.label}
            </span>
          </div>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-1.5 rounded-md bg-blue-900/70 border border-blue-700 text-white focus:outline-none focus:ring-2 focus:ring-[#F58220]"
            aria-label="Toggle Navigation Menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* Desktop Navbar Items */}
        <div className="hidden lg:flex items-center space-x-1 overflow-x-auto py-1 scrollbar-none">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleTabClick(item.id)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium whitespace-nowrap transition-all duration-150 ${
                  isActive
                    ? "bg-[#F58220] text-white font-bold shadow-sm"
                    : "text-blue-100 hover:bg-blue-900/60 hover:text-white"
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* Mobile Drawer Menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden pb-4 pt-1 border-t border-blue-800/60 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleTabClick(item.id)}
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-medium text-left transition ${
                    isActive
                      ? "bg-[#F58220] text-white font-bold"
                      : "bg-blue-950/60 text-blue-100 hover:bg-blue-900 hover:text-white"
                  }`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </nav>
  );
};
