"use client";

import React from 'react';
import { motion } from 'motion/react';
import { ChartLineUp, ShieldCheck, FileText } from '@phosphor-icons/react';

export default function PublicLanding() {
  return (
    <div className="space-y-24">
      {/* Hero Section with Banner */}
      <section className="relative pt-32 pb-40 overflow-hidden flex flex-col items-center justify-center text-center px-6">
        <div className="absolute inset-0 z-0">
          <img 
            src="https://upload.wikimedia.org/wikipedia/commons/4/4d/IIT_Mandi_South_Campus.jpg" 
            alt="IIT Mandi Campus Banner" 
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-white/80 backdrop-blur-sm bg-gradient-to-t from-white via-white/80 to-transparent"></div>
        </div>
        
        <div className="relative z-10 space-y-6 max-w-4xl flex flex-col items-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="inline-block px-4 py-1.5 rounded-full bg-sage-600 text-white text-xs font-semibold tracking-wider uppercase mb-2 shadow-sm">
            Official Data Portal
          </motion.div>
          <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="text-5xl md:text-6xl lg:text-7xl font-semibold tracking-tight text-zinc-900 leading-tight font-serif drop-shadow-sm">
            Automated Ranking & Data Transparency
          </motion.h1>
          <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="text-zinc-600 text-lg md:text-xl max-w-2xl leading-relaxed font-medium">
            The central repository for institutional data aggregation, processing, and public ranking disclosures for IIT Mandi.
          </motion.p>
        </div>
      </section>

      {/* Highlights Grid */}
      <section className="max-w-[1200px] mx-auto px-6 grid grid-cols-1 md:grid-cols-3 gap-8 relative z-20 -mt-24">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="bg-white border border-slate-200/50 rounded-3xl p-8 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)] text-center">
          <div className="w-16 h-16 bg-sage-50 text-sage-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <ChartLineUp weight="duotone" className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-semibold text-zinc-900 mb-3">Verified Rankings</h3>
          <p className="text-zinc-500 text-sm leading-relaxed">Access official performance metrics across NIRF, QS, and THE frameworks.</p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="bg-white border border-slate-200/50 rounded-3xl p-8 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)] text-center">
          <div className="w-16 h-16 bg-dusty-rose-50 text-dusty-rose-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <ShieldCheck weight="duotone" className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-semibold text-zinc-900 mb-3">Data Governance</h3>
          <p className="text-zinc-500 text-sm leading-relaxed">Strict maker-checker workflows ensuring 100% accurate and auditable data.</p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="bg-white border border-slate-200/50 rounded-3xl p-8 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)] text-center">
          <div className="w-16 h-16 bg-slate-blue-50 text-slate-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <FileText weight="duotone" className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-semibold text-zinc-900 mb-3">Public Documents</h3>
          <p className="text-zinc-500 text-sm leading-relaxed">Download publicly available placement reports, faculty lists, and intake data.</p>
        </motion.div>
      </section>

      {/* Notifications Board */}
      <section className="max-w-[1200px] mx-auto px-6 pb-24">
        <div className="bg-white/80 backdrop-blur-xl border border-slate-200/50 rounded-[2.5rem] p-8 md:p-12 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)]">
          <h2 className="text-2xl font-semibold tracking-tight text-zinc-900 mb-8 font-serif">Recent Announcements</h2>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="p-5 bg-white border border-slate-200/50 rounded-2xl flex items-center justify-between hover:border-sage-300 transition-colors group cursor-pointer">
              <div>
                <p className="text-xs text-sage-600 font-bold uppercase tracking-wider mb-1">Rankings Release</p>
                <h4 className="text-zinc-900 font-semibold group-hover:text-sage-700 transition-colors">NIRF 2026 Innovation Framework Results</h4>
              </div>
              <span className="text-sm font-medium text-zinc-400">12 Oct 2026</span>
            </div>
          ))}
        </div>
        </div>
      </section>
    </div>
  );
}
