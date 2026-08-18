"use client";

import React from 'react';
import { motion } from 'motion/react';
import { File, FileText, MagnifyingGlass, Faders, DownloadSimple } from '@phosphor-icons/react';

const spring = { type: "spring", stiffness: 100, damping: 20 };

export default function Documents() {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={spring}
      className="max-w-[1400px] mx-auto space-y-8"
    >
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-zinc-900">Document Repository</h1>
          <p className="text-zinc-500 mt-2 max-w-[65ch] leading-relaxed">Centralized storage for all uploaded ranking proofs.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <MagnifyingGlass weight="bold" className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input 
              type="text" 
              placeholder="Search documents..." 
              className="pl-10 pr-4 py-2.5 bg-white border border-slate-200/50 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sage-500/20 focus:border-sage-500/50 w-full sm:w-64 transition-all placeholder:text-zinc-400 shadow-sm"
            />
          </div>
          <button className="p-2.5 border border-slate-200/50 bg-white rounded-xl hover:bg-zinc-50 text-zinc-500 hover:text-zinc-900 transition-colors shadow-sm">
            <Faders weight="bold" className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="bg-white border border-slate-200/50 rounded-[2rem] p-6 flex flex-col gap-5 shadow-[0_10px_30px_-15px_rgba(0,0,0,0.05)] hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.08)] hover:-translate-y-1 transition-all cursor-pointer group">
            <div className="w-14 h-14 bg-zinc-50 text-zinc-600 rounded-2xl flex items-center justify-center group-hover:scale-110 group-hover:bg-sage-50 group-hover:text-sage-600 transition-all">
              <FileText weight="duotone" className="w-7 h-7" />
            </div>
            <div>
              <h4 className="font-semibold text-sm text-zinc-900 truncate">Placement_Data_2025.pdf</h4>
              <p className="text-xs font-medium text-zinc-400 mt-1">Uploaded by SCEE • 2 days ago</p>
            </div>
            <div className="pt-4 border-t border-slate-100 flex justify-between items-center opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all">
              <span className="text-xs font-semibold text-zinc-400">1.2 MB</span>
              <button className="text-sage-600 hover:text-sage-700 bg-sage-50 p-1.5 rounded-lg"><DownloadSimple weight="bold" className="w-4 h-4" /></button>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
