"use client";

import React from 'react';
import { motion } from 'motion/react';
import { FileText, Clock, CheckCircle } from '@phosphor-icons/react';
import Link from 'next/link';

export default function NodalOfficerDashboard() {
  return (
    <div className="max-w-[1400px] mx-auto space-y-8">
      <div>
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-zinc-900">Officer Dashboard</h1>
        <p className="text-zinc-500 mt-2 max-w-[65ch] leading-relaxed">Welcome back. You have pending tasks for your department.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Pending Submissions */}
        <div className="bg-white border border-orange-200/50 rounded-[2rem] p-8 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)] relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-orange-400"></div>
          <h3 className="text-xl font-semibold tracking-tight text-zinc-900 mb-6 flex items-center gap-2">
            <Clock className="w-6 h-6 text-orange-500" /> Action Required
          </h3>
          
          <div className="p-5 border border-slate-200/50 rounded-2xl bg-zinc-50/50 hover:border-sage-500/30 transition-colors">
            <h4 className="font-semibold text-zinc-900 text-[15px]">NIRF 2026 Institutional Data</h4>
            <p className="text-sm text-zinc-500 mt-1 mb-4">Please submit the Faculty and Student Intake data for SCEE.</p>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-orange-600 bg-orange-50 px-2 py-1 rounded-md">Due in 5 days</span>
              <Link href="/nodal-officer/submissions/new" className="bg-zinc-900 hover:bg-black active:scale-[0.98] text-white px-4 py-2 rounded-xl text-sm font-semibold transition-all">
                Submit Data
              </Link>
            </div>
          </div>
        </div>

        {/* Previous Submissions */}
        <div className="bg-white border border-slate-200/50 rounded-[2rem] p-8 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)]">
          <h3 className="text-xl font-semibold tracking-tight text-zinc-900 mb-6 flex items-center gap-2">
            <CheckCircle className="w-6 h-6 text-sage-600" /> Recent Submissions
          </h3>
          
          <div className="space-y-3">
            <div className="p-4 border border-slate-200/50 rounded-2xl flex items-center justify-between">
              <div>
                <p className="font-semibold text-zinc-900 text-sm">Placement Statistics 2025</p>
                <p className="text-xs text-zinc-500 mt-0.5">Approved by Admin</p>
              </div>
              <FileText className="w-5 h-5 text-zinc-400" />
            </div>
            <div className="p-4 border border-slate-200/50 rounded-2xl flex items-center justify-between">
              <div>
                <p className="font-semibold text-zinc-900 text-sm">Financial Resources 2025</p>
                <p className="text-xs text-zinc-500 mt-0.5">Approved by Admin</p>
              </div>
              <FileText className="w-5 h-5 text-zinc-400" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
