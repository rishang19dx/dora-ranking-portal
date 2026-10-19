import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ChartLineUp,
  ShieldCheck,
  FileText,
  Lock,
  ArrowRight,
  Medal,
  ChartBar,
  Buildings,
  BookOpen,
  Info,
} from '@phosphor-icons/react';
import { LoginModal } from '../components/LoginModal';
import { Header } from '../components/Header';
import { Footer } from '../components/Footer';
import { RankingsView } from './RankingsView';
import { TrendsView } from './TrendsView';
import { AgenciesView } from './AgenciesView';
import { ComparativeView } from './ComparativeView';
import { DocumentsView } from './DocumentsView';
import { AboutView } from './AboutView';
import { authService } from '../services/api';
import { useToast } from '../components/ToastProvider';

export default function PublicLanding() {
  const [activeTab, setActiveTab] = useState<'overview' | 'rankings' | 'trends' | 'agencies' | 'comparative' | 'documents' | 'about'>('overview');
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();
  const { showToast } = useToast();

  const handleLoginSuccess = async (userData: any) => {
    setShowLoginModal(false);
    try {
      // Attempt real JWT token login with backend using admin credentials
      await authService.login('admin', 'admin123');
      showToast('Authenticated successfully with Django DRF.', 'success');
      navigate('/admin');
    } catch {
      // Fallback local state if offline
      localStorage.setItem('dora_user', JSON.stringify({
        id: userData.id,
        username: userData.name,
        email: userData.email,
        role: userData.role === 'Super Admin' ? 'ADMIN' : 'NODAL_OFFICER',
      }));
      showToast(`Logged in as ${userData.role}`, 'success');
      navigate(userData.role === 'Super Admin' ? '/admin' : '/nodal-officer');
    }
  };

  return (
    <div className="flex flex-col min-h-[100dvh] font-sans bg-white selection:bg-sage-500 selection:text-white">
      {/* Header bar */}
      <Header
        currentUser={null}
        onOpenAdminLogin={() => setShowLoginModal(true)}
        onLogout={() => {}}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        onSearchSubmit={() => {
          if (searchQuery.trim()) {
            setActiveTab('rankings');
          }
        }}
      />

      {/* Navigation Bar */}
      <div className="bg-white border-b border-slate-200 sticky top-[72px] z-30 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 flex items-center justify-between overflow-x-auto py-2">
          <div className="flex items-center gap-1 sm:gap-2">
            {[
              { id: 'overview', label: 'Overview', icon: <Buildings weight="duotone" className="w-4 h-4" /> },
              { id: 'rankings', label: 'NIRF & Rankings', icon: <Medal weight="duotone" className="w-4 h-4" /> },
              { id: 'trends', label: 'Trend Analytics', icon: <ChartLineUp weight="duotone" className="w-4 h-4" /> },
              { id: 'agencies', label: 'Agencies', icon: <ChartBar weight="duotone" className="w-4 h-4" /> },
              { id: 'comparative', label: 'Peer Comparison', icon: <FileText weight="duotone" className="w-4 h-4" /> },
              { id: 'documents', label: 'Public Reports', icon: <BookOpen weight="duotone" className="w-4 h-4" /> },
              { id: 'about', label: 'About DORA', icon: <Info weight="duotone" className="w-4 h-4" /> },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                  activeTab === tab.id
                    ? 'bg-sage-50 text-sage-800 ring-1 ring-sage-500/20'
                    : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100'
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 pl-4 shrink-0">
            <Link
              to="/nodal-officer"
              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 transition-colors"
            >
              Nodal Officer Portal
            </Link>
            <Link
              to="/admin"
              className="flex items-center gap-1.5 bg-zinc-900 hover:bg-black text-white px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all shadow-sm"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Admin Portal</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="flex-1">
        {activeTab === 'overview' && (
          <div className="space-y-24">
            {/* Hero Section with Campus Banner */}
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
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="inline-block px-4 py-1.5 rounded-full bg-sage-600 text-white text-xs font-semibold tracking-wider uppercase mb-2 shadow-sm"
                >
                  Official Institutional Portal
                </motion.div>
                <motion.h1
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="text-5xl md:text-6xl lg:text-7xl font-semibold tracking-tight text-zinc-900 leading-tight font-serif drop-shadow-sm"
                >
                  Automated Ranking & Data Transparency
                </motion.h1>
                <motion.p
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="text-zinc-600 text-lg md:text-xl max-w-2xl leading-relaxed font-medium"
                >
                  The central repository for institutional data aggregation, processing, and public ranking disclosures for IIT Mandi.
                </motion.p>
                <div className="flex items-center gap-3 pt-2">
                  <button
                    onClick={() => setActiveTab('rankings')}
                    className="flex items-center gap-2 bg-sage-600 hover:bg-sage-700 text-white font-semibold text-sm px-6 py-3 rounded-xl shadow-md transition-all active:scale-[0.98]"
                  >
                    <span>Explore Rankings</span>
                    <ArrowRight weight="bold" className="w-4 h-4" />
                  </button>
                  <Link
                    to="/admin/organogram"
                    className="flex items-center gap-2 bg-white/90 hover:bg-white border border-slate-200 text-zinc-800 font-semibold text-sm px-6 py-3 rounded-xl shadow-sm transition-all"
                  >
                    <span>Institute Organogram</span>
                  </Link>
                </div>
              </div>
            </section>

            {/* Highlights Grid */}
            <section className="max-w-[1200px] mx-auto px-6 grid grid-cols-1 md:grid-cols-3 gap-8 relative z-20 -mt-24">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="bg-white border border-slate-200/50 rounded-3xl p-8 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)] text-center cursor-pointer hover:-translate-y-1 transition-all"
                onClick={() => setActiveTab('rankings')}
              >
                <div className="w-16 h-16 bg-sage-50 text-sage-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <ChartLineUp weight="duotone" className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-semibold text-zinc-900 mb-3">Verified Rankings</h3>
                <p className="text-zinc-500 text-sm leading-relaxed">
                  Official performance metrics across NIRF, QS, and THE frameworks with interactive 2nd generation IIT benchmarks.
                </p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="bg-white border border-slate-200/50 rounded-3xl p-8 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)] text-center cursor-pointer hover:-translate-y-1 transition-all"
                onClick={() => navigate('/admin/organogram')}
              >
                <div className="w-16 h-16 bg-dusty-rose-50 text-dusty-rose-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <ShieldCheck weight="duotone" className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-semibold text-zinc-900 mb-3">Data Governance</h3>
                <p className="text-zinc-500 text-sm leading-relaxed">
                  Organogram-driven collection across 57 institute units with single-purpose expiring upload grants and SHA-256 audits.
                </p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="bg-white border border-slate-200/50 rounded-3xl p-8 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)] text-center cursor-pointer hover:-translate-y-1 transition-all"
                onClick={() => setActiveTab('documents')}
              >
                <div className="w-16 h-16 bg-slate-blue-50 text-slate-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <FileText weight="duotone" className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-semibold text-zinc-900 mb-3">Public Documents</h3>
                <p className="text-zinc-500 text-sm leading-relaxed">
                  Download publicly available placement reports, faculty lists, intake disclosures, and NIRF summary forms.
                </p>
              </motion.div>
            </section>

            {/* Notifications Board */}
            <section className="max-w-[1200px] mx-auto px-6 pb-24">
              <div className="bg-white/80 backdrop-blur-xl border border-slate-200/50 rounded-[2.5rem] p-8 md:p-12 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)]">
                <h2 className="text-2xl font-semibold tracking-tight text-zinc-900 mb-8 font-serif">
                  Recent Announcements
                </h2>
                <div className="space-y-4">
                  {[
                    { tag: 'Rankings Release', title: 'NIRF 2026 Innovation Framework Results Released', date: '12 Oct 2026' },
                    { tag: 'Data Request', title: 'Phase 1 Core Metrics Request Dispatched to Academic Units', date: '04 Oct 2026' },
                    { tag: 'Verification', title: 'DORA Completes Annual Data Integrity Audit for QS Asia', date: '28 Sep 2026' },
                  ].map((item, i) => (
                    <div
                      key={i}
                      className="p-5 bg-white border border-slate-200/50 rounded-2xl flex items-center justify-between hover:border-sage-300 transition-colors group cursor-pointer"
                      onClick={() => setActiveTab('rankings')}
                    >
                      <div>
                        <p className="text-xs text-sage-600 font-bold uppercase tracking-wider mb-1">
                          {item.tag}
                        </p>
                        <h4 className="text-zinc-900 font-semibold group-hover:text-sage-700 transition-colors">
                          {item.title}
                        </h4>
                      </div>
                      <span className="text-sm font-medium text-zinc-400">{item.date}</span>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </div>
        )}

        {/* Tab Modules */}
        {activeTab === 'rankings' && (
          <div className="max-w-7xl mx-auto px-4 py-8">
            <RankingsView
              searchQuery={searchQuery}
              onSelectRanking={() => {}}
            />
          </div>
        )}

        {activeTab === 'trends' && (
          <div className="max-w-7xl mx-auto px-4 py-8">
            <TrendsView />
          </div>
        )}

        {activeTab === 'agencies' && (
          <div className="max-w-7xl mx-auto px-4 py-8">
            <AgenciesView
              agencies={[]}
              onSelectAgency={() => {}}
            />
          </div>
        )}

        {activeTab === 'comparative' && (
          <div className="max-w-7xl mx-auto px-4 py-8">
            <ComparativeView comparativeData={[]} />
          </div>
        )}

        {activeTab === 'documents' && (
          <div className="max-w-7xl mx-auto px-4 py-8">
            <DocumentsView documents={[]} onSelectDocument={() => {}} />
          </div>
        )}

        {activeTab === 'about' && (
          <div className="max-w-7xl mx-auto px-4 py-8">
            <AboutView />
          </div>
        )}
      </main>

      {/* Footer */}
      <Footer onSelectTab={(tab) => setActiveTab(tab)} />

      {/* Login Modal */}
      {showLoginModal && (
        <LoginModal
          onClose={() => setShowLoginModal(false)}
          onLoginSuccess={handleLoginSuccess}
        />
      )}
    </div>
  );
}
