"use client";

import React from 'react';
import { motion } from 'motion/react';
import { Medal, TrendUp, ChartBar } from '@phosphor-icons/react';

const spring = { type: "spring", stiffness: 100, damping: 20 };

export default function Rankings() {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={spring}
      className="max-w-[1400px] mx-auto space-y-8"
    >
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-zinc-900">NIRF Parameters</h1>
          <p className="text-zinc-500 mt-2 max-w-[65ch] leading-relaxed">Detailed breakdown of Teaching, Research, and Graduation outcomes.</p>
        </div>
        <select className="bg-white border border-slate-200/50 rounded-xl px-4 py-2.5 text-sm font-medium text-zinc-700 shadow-sm focus:outline-none focus:border-sage-500/50 w-full md:w-auto">
          <option>Engineering</option>
          <option>Overall</option>
          <option>Research</option>
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <motion.div 
          variants={{ hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } }}
          className="bg-white border border-slate-200/50 rounded-[2rem] p-8 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)] hover:border-sage-500/30 transition-colors group"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
            <h3 className="text-xl font-semibold text-zinc-900 flex items-center gap-3 tracking-tight">
              <div className="p-2.5 bg-sage-50 rounded-xl text-sage-600 group-hover:scale-110 transition-transform">
                <Medal weight="duotone" className="w-5 h-5"/>
              </div>
              Teaching & Learning (TLR)
            </h3>
            <span className="text-sm font-bold px-3 py-1.5 bg-sage-50 text-sage-700 rounded-lg shrink-0">Score: 82.5/100</span>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between text-sm p-4 bg-zinc-50/50 rounded-xl border border-slate-100">
              <span className="text-zinc-600 font-medium">Student Strength (SS)</span>
              <span className="font-semibold text-zinc-900">18.5/20</span>
            </div>
            <div className="flex items-center justify-between text-sm p-4 bg-zinc-50/50 rounded-xl border border-slate-100">
              <span className="text-zinc-600 font-medium">Faculty-student ratio (FSR)</span>
              <span className="font-semibold text-zinc-900">25.0/30</span>
            </div>
          </div>
        </motion.div>

        <motion.div 
          variants={{ hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } }}
          className="bg-white border border-slate-200/50 rounded-[2rem] p-8 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)] hover:border-sage-500/30 transition-colors group"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
            <h3 className="text-xl font-semibold text-zinc-900 flex items-center gap-3 tracking-tight">
              <div className="p-2.5 bg-zinc-100 rounded-xl text-zinc-600 group-hover:scale-110 group-hover:bg-sage-50 group-hover:text-sage-600 transition-all">
                <ChartBar weight="duotone" className="w-5 h-5"/>
              </div>
              Research & Practice (RPC)
            </h3>
            <span className="text-sm font-bold px-3 py-1.5 bg-sage-50 text-sage-700 rounded-lg shrink-0">Score: 65.2/100</span>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between text-sm p-4 bg-zinc-50/50 rounded-xl border border-slate-100">
              <span className="text-zinc-600 font-medium">Publications (PU)</span>
              <span className="font-semibold text-zinc-900">28.5/35</span>
            </div>
            <div className="flex items-center justify-between text-sm p-4 bg-zinc-50/50 rounded-xl border border-slate-100">
              <span className="text-zinc-600 font-medium">Quality of Publications (QP)</span>
              <span className="font-semibold text-zinc-900">25.0/35</span>
            </div>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
