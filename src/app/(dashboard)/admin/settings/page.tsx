"use client";

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Gear, ShieldCheck, BellRinging, Database } from '@phosphor-icons/react';

const tabs = [
  { id: 'general', label: 'General', icon: <Gear weight="duotone" className="w-5 h-5" /> },
  { id: 'security', label: 'Security', icon: <ShieldCheck weight="duotone" className="w-5 h-5" /> },
  { id: 'notifications', label: 'Notifications', icon: <BellRinging weight="duotone" className="w-5 h-5" /> },
  { id: 'agency', label: 'Agency Schemas', icon: <Database weight="duotone" className="w-5 h-5" /> },
];

const spring = { type: "spring", stiffness: 100, damping: 20 };

export default function Settings() {
  const [activeTab, setActiveTab] = useState('general');

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={spring}
      className="max-w-[1000px] mx-auto space-y-8"
    >
      <div>
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-zinc-900">Settings</h1>
        <p className="text-zinc-500 mt-2 max-w-[65ch] leading-relaxed">Manage system configurations and preferences.</p>
      </div>

      <div className="bg-white border border-slate-200/50 rounded-[2rem] shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)] overflow-hidden flex flex-col md:flex-row min-h-[500px]">
        
        {/* Settings Sidebar */}
        <div className="w-full md:w-64 bg-zinc-50/50 p-6 border-b md:border-b-0 md:border-r border-slate-200/50 flex flex-col gap-2 shrink-0">
          {tabs.map(tab => (
            <button 
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-3 px-4 py-3 text-sm font-semibold rounded-xl transition-all relative ${
                activeTab === tab.id 
                  ? 'text-sage-700' 
                  : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100/50'
              }`}
            >
              {activeTab === tab.id && (
                <motion.div 
                  layoutId="active-tab" 
                  className="absolute inset-0 bg-sage-50 rounded-xl"
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                />
              )}
              <span className="relative z-10 flex items-center gap-3">
                {tab.icon}
                {tab.label}
              </span>
            </button>
          ))}
        </div>

        {/* Settings Content */}
        <div className="flex-1 p-8 md:p-10 relative overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
              className="space-y-8 h-full"
            >
              {activeTab === 'general' && (
                <>
                  <h3 className="text-xl font-semibold tracking-tight text-zinc-900">General Preferences</h3>
                  <div className="space-y-6">
                    <div>
                      <label className="block text-sm font-semibold text-zinc-700 mb-2">Institute Name</label>
                      <input type="text" defaultValue="IIT Mandi" className="w-full max-w-md bg-zinc-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sage-500/20 focus:border-sage-500/50 transition-all text-zinc-900" />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-zinc-700 mb-2">Default Ranking Cycle</label>
                      <select className="w-full max-w-md bg-zinc-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sage-500/20 focus:border-sage-500/50 transition-all text-zinc-900">
                        <option>NIRF 2026</option>
                        <option>QS 2026</option>
                      </select>
                    </div>
                    <div className="pt-6 border-t border-slate-100">
                      <button className="bg-sage-600 hover:bg-sage-700 active:scale-[0.98] text-white px-6 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-[0_8px_16px_-4px_rgba(16,185,129,0.3)] w-fit">
                        Save Changes
                      </button>
                    </div>
                  </div>
                </>
              )}
              
              {activeTab === 'security' && (
                <>
                  <h3 className="text-xl font-semibold tracking-tight text-zinc-900">Security Settings</h3>
                  <div className="space-y-6">
                    <p className="text-sm text-zinc-500">Configure authentication and access control policies.</p>
                    <div className="p-4 bg-zinc-50 rounded-2xl border border-slate-200/50 flex items-center justify-between">
                      <div>
                        <h4 className="font-semibold text-zinc-900 text-sm">Two-Factor Authentication</h4>
                        <p className="text-xs text-zinc-500 mt-1">Require 2FA for all Nodal Officers.</p>
                      </div>
                      <div className="w-12 h-6 bg-sage-500 rounded-full flex items-center p-1 cursor-pointer">
                        <div className="w-4 h-4 bg-white rounded-full translate-x-6"></div>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {activeTab === 'notifications' && (
                <>
                  <h3 className="text-xl font-semibold tracking-tight text-zinc-900">Notification Preferences</h3>
                  <div className="space-y-6">
                    <p className="text-sm text-zinc-500">Manage email and system alerts.</p>
                    <div className="space-y-4">
                      {['Data Submission Alerts', 'Discrepancy Flags', 'Weekly Digest'].map(item => (
                        <div key={item} className="flex items-center gap-3">
                          <input type="checkbox" defaultChecked className="w-4 h-4 text-sage-600 rounded border-slate-300 focus:ring-sage-500" />
                          <label className="text-sm font-medium text-zinc-700">{item}</label>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {activeTab === 'agency' && (
                <>
                  <h3 className="text-xl font-semibold tracking-tight text-zinc-900">Agency Schemas</h3>
                  <div className="space-y-6">
                    <p className="text-sm text-zinc-500">Manage required data fields for different ranking bodies.</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {['NIRF Schema v3.1', 'QS World v2.0', 'THE Rankings', 'ARIIA Innovation'].map(item => (
                        <div key={item} className="p-4 bg-zinc-50 rounded-2xl border border-slate-200/50 flex items-center justify-between group hover:border-sage-500/30 transition-colors cursor-pointer">
                          <span className="font-semibold text-zinc-700 text-sm">{item}</span>
                          <span className="text-xs text-sage-600 font-semibold opacity-0 group-hover:opacity-100 transition-opacity">Edit</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}
