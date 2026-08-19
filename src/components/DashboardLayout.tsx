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
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
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
                className="w-full pl-9 pr-4 py-2 bg-zinc-100/50 hover:bg-zinc-100 focus:bg-zinc-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sage-500/20 border border-transparent focus:border-sage-500/30 transition-all placeholder:text-zinc-400"
              />
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="relative">
              <button 
                onClick={() => { setNotificationsOpen(!notificationsOpen); setProfileOpen(false); }}
                className="relative p-2 hover:bg-zinc-100 rounded-xl text-zinc-600 transition-colors"
              >
                <Bell weight="bold" className="w-5 h-5" />
                <span className="absolute top-2 right-2 w-2 h-2 bg-dusty-rose-500 rounded-full ring-2 ring-white"></span>
              </button>
              
              <AnimatePresence>
                {notificationsOpen && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute right-0 mt-2 w-80 bg-white border border-slate-200/50 rounded-2xl shadow-[0_20px_40px_-15px_rgba(0,0,0,0.1)] overflow-hidden z-50"
                  >
                    <div className="p-4 border-b border-slate-100 bg-zinc-50/50 flex justify-between items-center">
                      <h4 className="font-semibold text-sm text-zinc-900">Notifications</h4>
                      <span className="text-xs text-sage-600 font-medium cursor-pointer">Mark all as read</span>
                    </div>
                    <div className="p-2 max-h-64 overflow-y-auto">
                      <div className="p-3 hover:bg-zinc-50 rounded-xl transition-colors cursor-pointer">
                        <p className="text-sm font-medium text-zinc-900">Submission Received</p>
                        <p className="text-xs text-zinc-500 mt-1">SCEE has uploaded Student Intake data.</p>
                        <p className="text-[10px] text-zinc-400 mt-2 uppercase font-semibold">2 hours ago</p>
                      </div>
                      <div className="p-3 hover:bg-zinc-50 rounded-xl transition-colors cursor-pointer">
                        <p className="text-sm font-medium text-zinc-900">Deadline Approaching</p>
                        <p className="text-xs text-zinc-500 mt-1">NIRF 2026 Phase 1 ends in 5 days.</p>
                        <p className="text-[10px] text-zinc-400 mt-2 uppercase font-semibold">1 day ago</p>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="relative">
              <div 
                onClick={() => { setProfileOpen(!profileOpen); setNotificationsOpen(false); }}
                className="w-9 h-9 rounded-xl bg-zinc-900 flex items-center justify-center text-white text-xs font-semibold shadow-sm cursor-pointer hover:scale-105 transition-transform"
              >
                AD
              </div>
              
              <AnimatePresence>
                {profileOpen && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute right-0 mt-2 w-56 bg-white border border-slate-200/50 rounded-2xl shadow-[0_20px_40px_-15px_rgba(0,0,0,0.1)] overflow-hidden z-50 p-2"
                  >
                    <div className="p-3 border-b border-slate-100 mb-2">
                      <p className="text-sm font-semibold text-zinc-900">Admin User</p>
                      <p className="text-xs text-zinc-500 truncate">admin@iitmandi.ac.in</p>
                    </div>
                    <Link href="/settings" className="flex items-center gap-2 w-full p-2 text-sm text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50 rounded-xl transition-colors">
                      <Gear weight="bold" className="w-4 h-4" /> Settings
                    </Link>
                    <button className="flex items-center gap-2 w-full p-2 text-sm text-red-600 hover:bg-red-50 rounded-xl transition-colors mt-1">
                      Sign out
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
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
            <div className="w-8 h-8 bg-slate-blue-600 rounded-xl flex items-center justify-center text-white font-bold shadow-[0_4px_12px_-2px_rgba(65,93,126,0.3)]">
              <span className="font-serif italic">M</span>
            </div>
            <span className="font-serif font-semibold tracking-tight text-zinc-900 text-[16px] whitespace-nowrap">Ranking Portal</span>
          </motion.div>
        ) : (
          <div className="w-8 h-8 bg-slate-blue-600 rounded-xl flex items-center justify-center text-white font-bold shadow-[0_4px_12px_-2px_rgba(65,93,126,0.3)] mx-auto">
            <span className="font-serif italic">M</span>
          </div>
        )}
        
        {(sidebarOpen && !isMobile) && (
          <button onClick={() => setSidebarOpen(false)} className="p-1.5 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 rounded-lg shrink-0 transition-colors">
            <CaretLeft weight="bold" className="w-4 h-4" />
          </button>
        )}
      </div>

      <nav className="flex-1 py-6 px-3 flex flex-col gap-1.5 overflow-y-auto">
        {pathname.startsWith('/nodal-officer') ? (
          <>
            <NavItem href="/nodal-officer" icon={<ChartBar weight="duotone" className="w-5 h-5" />} label="My Dashboard" active={pathname === "/nodal-officer"} open={sidebarOpen} />
            <NavItem href="/nodal-officer/submissions/new" icon={<FileText weight="duotone" className="w-5 h-5" />} label="Submit Data" active={pathname.includes("/submissions/new")} open={sidebarOpen} />
          </>
        ) : (
          <>
            <NavItem href="/admin" icon={<ChartBar weight="duotone" className="w-5 h-5" />} label="Dashboard" active={pathname === "/admin"} open={sidebarOpen} />
            <NavItem href="/admin/data-collection" icon={<FileText weight="duotone" className="w-5 h-5" />} label="Data Collection" active={pathname.includes("/data-collection")} open={sidebarOpen} />
            <NavItem href="/admin/nodal-officers" icon={<Users weight="duotone" className="w-5 h-5" />} label="Nodal Officers" active={pathname.includes("/nodal-officers")} open={sidebarOpen} />
            <NavItem href="/admin/rankings" icon={<Medal weight="duotone" className="w-5 h-5" />} label="Rankings (NIRF)" active={pathname.includes("/rankings")} open={sidebarOpen} />
            <NavItem href="/admin/documents" icon={<BookOpen weight="duotone" className="w-5 h-5" />} label="Documents" active={pathname.includes("/documents")} open={sidebarOpen} />
            <div className="flex-1" />
            <NavItem href="/admin/settings" icon={<Gear weight="duotone" className="w-5 h-5" />} label="Settings" active={pathname.includes("/settings")} open={sidebarOpen} />
          </>
        )}
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
            ? 'text-sage-700' 
            : 'text-zinc-500 hover:text-zinc-900'
        }`}
      >
        {active && (
          <motion.div 
            layoutId="nav-active"
            className="absolute inset-0 bg-sage-50 rounded-xl -z-10"
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
