"use client";

import React from 'react';
import { TrendUp, Medal, FileText, CheckCircle, Clock } from '@phosphor-icons/react';
import { motion } from 'motion/react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Legend, Cell
} from 'recharts';

const mockRankingData = [
  { year: '2020', nirf: 31, qs: 0, the: 0 },
  { year: '2021', nirf: 41, qs: 0, the: 0 },
  { year: '2022', nirf: 43, qs: 0, the: 0 },
  { year: '2023', nirf: 33, qs: 1000, the: 1000 },
  { year: '2024', nirf: 31, qs: 800, the: 800 },
  { year: '2025', nirf: 28, qs: 600, the: 600 },
];

const mockDepartmentData = [
  { name: 'SCEE', completed: 85, pending: 15 },
  { name: 'SBS', completed: 60, pending: 40 },
  { name: 'SHSS', completed: 90, pending: 10 },
  { name: 'SMME', completed: 45, pending: 55 },
];

const spring = { type: "spring", stiffness: 100, damping: 20 };

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1 } }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: spring }
};

export default function Dashboard() {
  return (
    <motion.div 
      initial="hidden"
      animate="show"
      variants={containerVariants}
      className="max-w-[1400px] mx-auto space-y-8"
    >
      
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-zinc-900">Executive Dashboard</h1>
          <p className="text-zinc-500 mt-2 max-w-[65ch] leading-relaxed">Welcome back. Here is the latest ranking overview and data collection status for IIT Mandi.</p>
        </div>
        <div className="flex items-center gap-3">
          <select className="bg-white border border-slate-200/50 rounded-xl px-4 py-2.5 text-sm font-medium text-zinc-700 shadow-sm focus:outline-none focus:border-sage-500/50">
            <option>NIRF 2026 Cycle</option>
            <option>QS 2026 Cycle</option>
          </select>
          <button className="bg-sage-600 hover:bg-sage-700 active:scale-[0.98] text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-all shadow-[0_8px_16px_-4px_rgba(90,115,89,0.3)]">
            Generate Report
          </button>
        </div>
      </div>

      {/* Bento Grid - Top Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <motion.div className="md:col-span-1" variants={itemVariants}>
          <StatCard 
            title="NIRF Ranking" 
            value="28" 
            trend="+3 positions" 
            positive={true}
            icon={<Medal weight="duotone" className="w-6 h-6 text-soft-gold-600" />} 
            iconBg="bg-soft-gold-50"
          />
        </motion.div>
        <motion.div className="md:col-span-2" variants={itemVariants}>
          <div className="h-full bg-white/70 backdrop-blur-2xl border border-slate-200/50 p-8 rounded-[2rem] shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)] relative overflow-hidden flex flex-col justify-between group hover:border-sage-500/20 hover:shadow-[0_20px_40px_-15px_rgba(90,115,89,0.15)] transition-all">
            <div className="flex justify-between items-start mb-6 z-10">
              <div className="p-3 bg-sage-50 rounded-2xl">
                <FileText weight="duotone" className="w-6 h-6 text-sage-600" />
              </div>
              <div className="flex items-center gap-2 px-3 py-1 bg-zinc-100 rounded-full text-xs font-semibold text-zinc-600">
                <motion.div 
                  animate={{ opacity: [1, 0.5, 1] }} 
                  transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                  className="w-2 h-2 rounded-full bg-sage-500" 
                />
                Live Cycle
              </div>
            </div>
            <div className="z-10">
              <h4 className="text-zinc-500 text-sm font-medium mb-2">Data Collection Progress</h4>
              <div className="flex items-end gap-4">
                <span className="text-4xl md:text-5xl font-semibold tracking-tight text-zinc-900">68%</span>
                <div className="flex -space-x-2 mb-2">
                  {[1,2,3].map(i => (
                    <div key={i} className="w-8 h-8 rounded-full border-2 border-white bg-zinc-200 flex items-center justify-center text-[10px] font-bold text-zinc-500">D{i}</div>
                  ))}
                  <div className="w-8 h-8 rounded-full border-2 border-white bg-zinc-100 flex items-center justify-center text-[10px] font-bold text-zinc-500">+12</div>
                </div>
              </div>
            </div>
            {/* Liquid Glass Refraction Effect */}
            <div className="absolute inset-0 border border-white/40 rounded-[2rem] pointer-events-none mix-blend-overlay"></div>
          </div>
        </motion.div>
        <motion.div className="md:col-span-1" variants={itemVariants}>
          <StatCard 
            title="Discrepancies" 
            value="14" 
            trend="-5 since yesterday" 
            positive={true}
            icon={<TrendUp weight="duotone" className="w-6 h-6 text-zinc-600" />} 
            iconBg="bg-zinc-50"
          />
        </motion.div>
      </div>

      {/* Bento Grid - Bottom Row */}
      <motion.div className="grid grid-cols-1 lg:grid-cols-5 gap-6" variants={containerVariants}>
        
        {/* Year-wise Trend Chart */}
        <motion.div variants={itemVariants} className="lg:col-span-3 bg-white/70 backdrop-blur-2xl border border-slate-200/50 rounded-[2rem] p-8 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)] hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.08)] transition-all">
          <h3 className="text-xl font-semibold tracking-tight text-zinc-900 mb-8">Historical Ranking Trends</h3>
          <div className="h-[320px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={mockRankingData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorNirf" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#5a7359" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#5a7359" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" opacity={0.6} />
                <XAxis dataKey="year" axisLine={false} tickLine={false} tick={{ fontSize: 13, fill: '#64748b' }} dy={10} />
                <YAxis reversed axisLine={false} tickLine={false} tick={{ fontSize: 13, fill: '#64748b' }} domain={[10, 100]} />
                <Tooltip 
                  contentStyle={{ borderRadius: '16px', border: '1px solid rgba(226, 232, 240, 0.8)', boxShadow: '0 20px 40px -15px rgba(0,0,0,0.1)', padding: '12px' }}
                  itemStyle={{ fontWeight: 600, color: '#0f172a' }}
                />
                <Area type="monotone" dataKey="nirf" name="NIRF Rank" stroke="#5a7359" strokeWidth={3} fillOpacity={1} fill="url(#colorNirf)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Department Data Collection Progress */}
        <motion.div variants={itemVariants} className="lg:col-span-2 bg-white/70 backdrop-blur-2xl border border-slate-200/50 rounded-[2rem] p-8 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)] flex flex-col hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.08)] transition-all">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-xl font-semibold tracking-tight text-zinc-900">Submission Status</h3>
            <button className="text-sm font-medium text-sage-600 hover:text-sage-700 transition-colors">View All</button>
          </div>
          <div className="flex-1 w-full min-h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={mockDepartmentData} layout="vertical" margin={{ top: 0, right: 0, left: 0, bottom: 0 }} barGap={8}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" opacity={0.6} />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 13, fontWeight: 600, fill: '#475569' }} width={50} />
                <Tooltip cursor={{fill: 'rgba(241, 245, 249, 0.4)'}} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px', fontSize: '13px', color: '#475569' }} />
                <Bar dataKey="completed" name="Completed (%)" stackId="a" fill="#5a7359" radius={[8, 0, 0, 8]} barSize={28} />
                <Bar dataKey="pending" name="Pending (%)" stackId="a" fill="#e2e8f0" radius={[0, 8, 8, 0]} barSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

      </motion.div>

    </motion.div>
  );
}

function StatCard({ title, value, trend, positive, icon, iconBg = "bg-zinc-50" }: { title: string, value: string, trend: string, positive: boolean, icon: React.ReactNode, iconBg?: string }) {
  return (
    <div className="h-full bg-white/70 backdrop-blur-2xl border border-slate-200/50 p-8 rounded-[2rem] shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)] hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.08)] hover:-translate-y-1 transition-all flex flex-col justify-between group">
      <div className="flex justify-between items-start mb-6">
        <div className={`p-3 ${iconBg} rounded-2xl group-hover:scale-105 transition-transform`}>
          {icon}
        </div>
      </div>
      <div>
        <h4 className="text-zinc-500 text-sm font-medium mb-2">{title}</h4>
        <div className="flex flex-col gap-2">
          <span className="text-4xl font-semibold tracking-tight text-zinc-900">{value}</span>
          <span className={`w-fit text-xs font-semibold px-2.5 py-1 rounded-full ${positive ? 'bg-sage-50 text-sage-700' : 'bg-dusty-rose-50 text-dusty-rose-700'}`}>
            {trend}
          </span>
        </div>
      </div>
    </div>
  );
}
