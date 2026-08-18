"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  ChartBar, 
  Gear, 
  FileText, 
  Users, 
  Bell, 
  MagnifyingGlass,
  List,
  CaretLeft,
  Medal,
  BookOpen
} from '@phosphor-icons/react';
import { motion, AnimatePresence } from 'motion/react';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();

  return (
    <div className="flex h-[100dvh] bg-zinc-50 text-zinc-950 overflow-hidden font-sans">
      
      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileMenuOpen(false)}
              className="fixed inset-0 bg-zinc-950/20 backdrop-blur-sm z-40 md:hidden"
            />
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="fixed inset-y-0 left-0 w-64 bg-white border-r border-slate-200/50 flex flex-col z-50 md:hidden shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)]"
            >
              <SidebarContent pathname={pathname} sidebarOpen={true} setSidebarOpen={() => setMobileMenuOpen(false)} isMobile={true} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Desktop Sidebar */}
      <motion.aside 
        initial={{ width: 256 }}
        animate={{ width: sidebarOpen ? 256 : 80 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="hidden md:flex bg-white border-r border-slate-200/50 flex-col z-20 shrink-0"
      >
        <SidebarContent pathname={pathname} sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} isMobile={false} />
      </motion.aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        
        {/* Header */}
        <header className="h-16 bg-white/80 backdrop-blur-xl border-b border-slate-200/50 flex items-center justify-between px-4 md:px-8 z-10 sticky top-0 shrink-0">
          <div className="flex items-center gap-4 flex-1">
            <button onClick={() => setMobileMenuOpen(true)} className="md:hidden p-2 -ml-2 hover:bg-zinc-100 rounded-xl text-zinc-600 transition-colors">
              <List weight="bold" className="w-5 h-5" />
            </button>
            {!sidebarOpen && (
              <button onClick={() => setSidebarOpen(true)} className="hidden md:block p-2 -ml-2 hover:bg-zinc-100 rounded-xl text-zinc-600 transition-colors">
                <List weight="bold" className="w-5 h-5" />
              </button>
            )}
            <div className="relative flex-1 max-w-md hidden sm:block">
              <MagnifyingGlass weight="bold" className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input 
                type="text" 
                placeholder="Search metrics or users..." 
                className="w-full pl-9 pr-4 py-2 bg-zinc-100/50 hover:bg-zinc-100 focus:bg-zinc-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 border border-transparent focus:border-emerald-500/30 transition-all placeholder:text-zinc-400"
              />
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button className="relative p-2 hover:bg-zinc-100 rounded-xl text-zinc-600 transition-colors">
              <Bell weight="bold" className="w-5 h-5" />
              <span className="absolute top-2 right-2 w-2 h-2 bg-emerald-500 rounded-full ring-2 ring-white"></span>
            </button>
            <div className="w-9 h-9 rounded-xl bg-zinc-900 flex items-center justify-center text-white text-xs font-semibold shadow-sm cursor-pointer hover:scale-105 transition-transform">
              AD
            </div>
          </div>
        </header>

        {/* Scrollable Content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}

function SidebarContent({ pathname, sidebarOpen, setSidebarOpen, isMobile }: { pathname: string, sidebarOpen: boolean, setSidebarOpen: (v: boolean) => void, isMobile: boolean }) {
  return (
    <>
      <div className="h-16 flex items-center justify-between px-4 border-b border-slate-200/50 shrink-0">
        {sidebarOpen ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-3 px-2">
            <div className="w-8 h-8 bg-emerald-500 rounded-xl flex items-center justify-center text-white font-bold shadow-[0_4px_12px_-2px_rgba(16,185,129,0.3)]">
              M
            </div>
            <span className="font-semibold tracking-tight text-zinc-900 text-[15px] whitespace-nowrap">Ranking Portal</span>
          </motion.div>
        ) : (
          <div className="w-8 h-8 bg-emerald-500 rounded-xl flex items-center justify-center text-white font-bold shadow-[0_4px_12px_-2px_rgba(16,185,129,0.3)] mx-auto">
            M
          </div>
        )}
        
        {(sidebarOpen && !isMobile) && (
          <button onClick={() => setSidebarOpen(false)} className="p-1.5 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 rounded-lg shrink-0 transition-colors">
            <CaretLeft weight="bold" className="w-4 h-4" />
          </button>
        )}
      </div>

      <nav className="flex-1 py-6 px-3 flex flex-col gap-1.5 overflow-y-auto">
        <NavItem href="/" icon={<ChartBar weight="duotone" className="w-5 h-5" />} label="Dashboard" active={pathname === "/"} open={sidebarOpen} />
        <NavItem href="/data-collection" icon={<FileText weight="duotone" className="w-5 h-5" />} label="Data Collection" active={pathname === "/data-collection"} open={sidebarOpen} />
        <NavItem href="/nodal-officers" icon={<Users weight="duotone" className="w-5 h-5" />} label="Nodal Officers" active={pathname === "/nodal-officers"} open={sidebarOpen} />
        <NavItem href="/rankings" icon={<Medal weight="duotone" className="w-5 h-5" />} label="Rankings (NIRF)" active={pathname === "/rankings"} open={sidebarOpen} />
        <NavItem href="/documents" icon={<BookOpen weight="duotone" className="w-5 h-5" />} label="Documents" active={pathname === "/documents"} open={sidebarOpen} />
        <div className="flex-1" />
        <NavItem href="/settings" icon={<Gear weight="duotone" className="w-5 h-5" />} label="Settings" active={pathname === "/settings"} open={sidebarOpen} />
      </nav>
    </>
  );
}

function NavItem({ href, icon, label, active, open }: { href: string, icon: React.ReactNode, label: string, active?: boolean, open: boolean }) {
  return (
    <Link href={href} className="block relative outline-none">
      <div 
        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group relative z-10 ${
          active 
            ? 'text-emerald-700' 
            : 'text-zinc-500 hover:text-zinc-900'
        }`}
      >
        {active && (
          <motion.div 
            layoutId="nav-active"
            className="absolute inset-0 bg-emerald-50 rounded-xl -z-10"
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
          />
        )}
        <div className={`${active ? '' : 'group-hover:scale-110'} transition-transform shrink-0`}>
          {icon}
        </div>
        {open && <span className="font-medium text-sm whitespace-nowrap overflow-hidden text-ellipsis">{label}</span>}
      </div>
    </Link>
  );
}
