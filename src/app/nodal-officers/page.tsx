"use client";

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Users, EnvelopeSimple, Phone, PencilSimple, X } from '@phosphor-icons/react';

const mockOfficers = [
  { id: 1, name: 'Dr. Jane Smith', dept: 'Computer Science', email: 'jane@iitmandi.ac.in', phone: '+91 98765 43210', status: 'Active' },
  { id: 2, name: 'Prof. Rahul Verma', dept: 'Electrical Eng.', email: 'rahul@iitmandi.ac.in', phone: '+91 98765 43211', status: 'Active' },
  { id: 3, name: 'Dr. Anita Desai', dept: 'Mechanical Eng.', email: 'anita@iitmandi.ac.in', phone: '+91 98765 43212', status: 'Pending' },
];

const spring = { type: "spring", stiffness: 100, damping: 20 };

export default function NodalOfficers() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={spring}
      className="max-w-[1400px] mx-auto space-y-8"
    >
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-zinc-900">Nodal Officers</h1>
          <p className="text-zinc-500 mt-2 max-w-[65ch] leading-relaxed">Manage departmental contacts and access permissions.</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-all shadow-[0_8px_16px_-4px_rgba(16,185,129,0.3)]"
        >
          Add Officer
        </button>
      </div>

      <div className="bg-white border border-slate-200/50 rounded-[2rem] shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 border-b border-slate-200/50">
              <tr>
                <th className="px-8 py-5 font-semibold text-zinc-500 uppercase tracking-wider text-xs">Name</th>
                <th className="px-8 py-5 font-semibold text-zinc-500 uppercase tracking-wider text-xs">Department</th>
                <th className="px-8 py-5 font-semibold text-zinc-500 uppercase tracking-wider text-xs">Contact</th>
                <th className="px-8 py-5 font-semibold text-zinc-500 uppercase tracking-wider text-xs">Status</th>
                <th className="px-8 py-5 font-semibold text-zinc-500 uppercase tracking-wider text-xs">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {mockOfficers.map((officer) => (
                <tr key={officer.id} className="hover:bg-zinc-50/50 transition-colors group">
                  <td className="px-8 py-5 font-medium text-zinc-900 flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-sm shadow-sm">
                      {officer.name.charAt(4)}
                    </div>
                    {officer.name}
                  </td>
                  <td className="px-8 py-5 text-zinc-600">{officer.dept}</td>
                  <td className="px-8 py-5">
                    <div className="flex flex-col gap-1.5 text-zinc-500">
                      <span className="flex items-center gap-2"><EnvelopeSimple weight="bold" className="w-4 h-4 text-zinc-400" /> {officer.email}</span>
                      <span className="flex items-center gap-2"><Phone weight="bold" className="w-4 h-4 text-zinc-400" /> {officer.phone}</span>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <span className={`px-3 py-1.5 rounded-full text-xs font-semibold ${
                      officer.status === 'Active' ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-500/20' : 'bg-orange-50 text-orange-700 ring-1 ring-orange-500/20'
                    }`}>
                      {officer.status}
                    </span>
                  </td>
                  <td className="px-8 py-5">
                    <button className="p-2 hover:bg-white hover:shadow-sm rounded-xl text-zinc-400 hover:text-emerald-600 transition-all">
                      <PencilSimple weight="bold" className="w-5 h-5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-zinc-950/20 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={spring}
              className="relative w-full max-w-lg bg-white border border-slate-200/50 rounded-[2rem] p-8 shadow-[0_40px_80px_-20px_rgba(0,0,0,0.1)] z-10"
            >
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-xl font-semibold tracking-tight text-zinc-900">Add Nodal Officer</h2>
                <button onClick={() => setIsModalOpen(false)} className="p-2 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 rounded-xl transition-colors">
                  <X weight="bold" className="w-5 h-5" />
                </button>
              </div>
              
              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-semibold text-zinc-700 mb-2">Full Name</label>
                  <input type="text" placeholder="e.g. Dr. John Doe" className="w-full bg-zinc-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500/50 transition-all placeholder:text-zinc-400" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-zinc-700 mb-2">Department</label>
                  <select className="w-full bg-zinc-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500/50 transition-all text-zinc-700">
                    <option>Computer Science</option>
                    <option>Electrical Eng.</option>
                    <option>Mechanical Eng.</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-zinc-700 mb-2">Email Address</label>
                  <input type="email" placeholder="john@iitmandi.ac.in" className="w-full bg-zinc-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500/50 transition-all placeholder:text-zinc-400" />
                </div>
                <div className="pt-4 mt-6 border-t border-slate-100">
                  <button className="w-full bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white px-5 py-3 rounded-xl text-sm font-semibold transition-all shadow-[0_8px_16px_-4px_rgba(16,185,129,0.3)]">
                    Send Invitation
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
