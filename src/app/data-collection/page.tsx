"use client";

import React from 'react';
import { motion } from 'motion/react';
import { FileText, Clock, CheckCircle, WarningCircle } from '@phosphor-icons/react';

const spring = { type: "spring", stiffness: 100, damping: 20 };

export default function DataCollection() {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={spring}
      className="max-w-[1400px] mx-auto space-y-8"
    >
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-zinc-900">Data Collection</h1>
          <p className="text-zinc-500 mt-2 max-w-[65ch] leading-relaxed">Manage active data requests and submission deadlines.</p>
        </div>
        <button className="bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-all shadow-[0_8px_16px_-4px_rgba(16,185,129,0.3)]">
          New Request Cycle
        </button>
      </div>

      <div className="bg-white border border-slate-200/50 rounded-[2rem] p-8 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)]">
        <h3 className="text-xl font-semibold tracking-tight text-zinc-900 mb-6">Active Cycles</h3>
        
        <div className="space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between p-6 border border-slate-200/50 rounded-2xl bg-zinc-50/50 group hover:border-emerald-500/30 transition-colors gap-6 lg:gap-0">
            <div className="flex items-center gap-5">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600 shadow-sm group-hover:scale-105 transition-transform">
                <FileText weight="duotone" className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-semibold text-zinc-900 text-[15px]">NIRF 2026 Institutional Data</h4>
                <p className="text-sm text-zinc-500 mt-0.5">Requested from 14 Departments</p>
              </div>
            </div>
            <div className="flex items-center gap-8 lg:gap-10">
              <div className="text-right">
                <div className="text-xs font-semibold text-zinc-500 flex items-center gap-1.5 justify-end uppercase tracking-wider mb-1">
                  <Clock weight="bold" className="w-3.5 h-3.5" /> Deadline
                </div>
                <div className="font-semibold text-orange-600">in 5 days</div>
              </div>
              <div className="w-40">
                <div className="flex justify-between text-xs font-semibold mb-2">
                  <span className="text-zinc-700">68%</span>
                </div>
                <div className="h-2.5 w-full bg-slate-200/70 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: "68%" }}
                    transition={{ ...spring, delay: 0.2 }}
                    className="h-full bg-emerald-500 rounded-full" 
                  />
                </div>
              </div>
              <button className="text-emerald-600 text-sm font-semibold hover:text-emerald-700 hover:bg-emerald-50 px-4 py-2 rounded-lg transition-all hidden sm:block">Manage</button>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
