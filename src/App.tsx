import React, { useState, useEffect } from "react";
import { Header } from "./components/Header";
import { Navigation } from "./components/Navigation";
import { Footer } from "./components/Footer";
import { LoginModal } from "./components/LoginModal";
import { RankingDetailModal } from "./components/RankingDetailModal";
import { PDFViewerModal } from "./components/PDFViewerModal";

import { DashboardView } from "./views/DashboardView";
import { RankingsView } from "./views/RankingsView";
import { AgenciesView } from "./views/AgenciesView";
import { TrendsView } from "./views/TrendsView";
import { CategoriesView } from "./views/CategoriesView";
import { ParametersView } from "./views/ParametersView";
import { DocumentsView } from "./views/DocumentsView";
import { ComparativeView } from "./views/ComparativeView";
import { NewsView } from "./views/NewsView";
import { AboutView } from "./views/AboutView";
import { AdminView } from "./views/AdminView";

import {
  RankingItem,
  RankingAgency,
  RankingCategory,
  RankingParameter,
  RankingDocument,
  NewsUpdate,
  ComparativeData,
  AuditLog,
  User,
  ViewTab,
} from "./types";

export default function App() {
  const [activeTab, setActiveTab] = useState<ViewTab>("dashboard");
  const [searchQuery, setSearchQuery] = useState("");

  // Data states from API
  const [rankings, setRankings] = useState<RankingItem[]>([]);
  const [agencies, setAgencies] = useState<RankingAgency[]>([]);
  const [categories, setCategories] = useState<RankingCategory[]>([]);
  const [parameters, setParameters] = useState<RankingParameter[]>([]);
  const [documents, setDocuments] = useState<RankingDocument[]>([]);
  const [news, setNews] = useState<NewsUpdate[]>([]);
  const [comparative, setComparative] = useState<ComparativeData[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [stats, setStats] = useState<any>(null);

  // User Authentication State
  const [currentUser, setCurrentUser] = useState<User | null>({
    id: "u1",
    name: "Prof. Director",
    email: "director@iitmandi.ac.in",
    role: "Super Admin",
  });

  // Modal States
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [selectedRankingDetail, setSelectedRankingDetail] = useState<RankingItem | null>(null);
  const [selectedDocument, setSelectedDocument] = useState<RankingDocument | null>(null);

  // Load all data from server
  const loadAllData = async () => {
    try {
      const [
        rankingsRes,
        agenciesRes,
        categoriesRes,
        paramsRes,
        docsRes,
        newsRes,
        compRes,
        auditRes,
        statsRes,
      ] = await Promise.all([
        fetch("/api/rankings"),
        fetch("/api/agencies"),
        fetch("/api/categories"),
        fetch("/api/parameters"),
        fetch("/api/documents"),
        fetch("/api/news"),
        fetch("/api/comparative"),
        fetch("/api/audit-logs"),
        fetch("/api/stats"),
      ]);

      if (rankingsRes.ok) setRankings(await rankingsRes.ok ? await rankingsRes.json() : []);
      if (agenciesRes.ok) setAgencies(await agenciesRes.json());
      if (categoriesRes.ok) setCategories(await categoriesRes.json());
      if (paramsRes.ok) setParameters(await paramsRes.json());
      if (docsRes.ok) setDocuments(await docsRes.json());
      if (newsRes.ok) setNews(await newsRes.json());
      if (compRes.ok) setComparative(await compRes.json());
      if (auditRes.ok) setAuditLogs(await auditRes.json());
      if (statsRes.ok) setStats(await statsRes.json());
    } catch (err) {
      console.error("Failed to fetch initial application data:", err);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  // Handle Search Submission
  const handleSearchSubmit = () => {
    if (searchQuery.trim()) {
      setActiveTab("rankings");
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F7FA] text-[#1F2937] font-sans flex flex-col justify-between">
      <div>
        {/* Header Component */}
        <Header
          currentUser={currentUser}
          onOpenAdminLogin={() => setShowLoginModal(true)}
          onLogout={() => setCurrentUser(null)}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          onSearchSubmit={handleSearchSubmit}
        />

        {/* Navigation Bar */}
        <Navigation
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          isAdminLoggedIn={!!currentUser}
        />

        {/* Main Content Area with Frosted Glass Aesthetics */}
        <main className="max-w-7xl mx-auto px-4 py-6 sm:py-8">
          {activeTab === "dashboard" && (
            <DashboardView
              rankings={rankings}
              news={news}
              stats={stats}
              onSelectRanking={(ranking) => setSelectedRankingDetail(ranking)}
              onNavigateTab={(tab) => setActiveTab(tab)}
            />
          )}

          {activeTab === "rankings" && (
            <RankingsView
              rankings={rankings}
              agencies={agencies}
              searchQuery={searchQuery}
              onSelectRanking={(ranking) => setSelectedRankingDetail(ranking)}
            />
          )}

          {activeTab === "agencies" && (
            <AgenciesView
              agencies={agencies}
              rankings={rankings}
              onSelectRanking={(ranking) => setSelectedRankingDetail(ranking)}
            />
          )}

          {activeTab === "trends" && (
            <TrendsView rankings={rankings} agencies={agencies} />
          )}

          {activeTab === "categories" && (
            <CategoriesView
              rankings={rankings}
              onSelectRanking={(ranking) => setSelectedRankingDetail(ranking)}
            />
          )}

          {activeTab === "parameters" && (
            <ParametersView rankings={rankings} parameters={parameters} />
          )}

          {activeTab === "documents" && (
            <DocumentsView
              documents={documents}
              onOpenDoc={(doc) => setSelectedDocument(doc)}
            />
          )}

          {activeTab === "comparative" && (
            <ComparativeView comparativeData={comparative} />
          )}

          {activeTab === "news" && <NewsView news={news} />}

          {activeTab === "about" && <AboutView />}

          {activeTab === "admin" && (
            currentUser ? (
              <AdminView
                currentUser={currentUser}
                rankings={rankings}
                agencies={agencies}
                categories={categories}
                documents={documents}
                news={news}
                auditLogs={auditLogs}
                onRefreshData={loadAllData}
              />
            ) : (
              <div className="bg-white rounded-2xl p-10 border border-gray-200/80 shadow-sm text-center max-w-lg mx-auto space-y-4 my-10">
                <div className="w-16 h-16 bg-blue-50 text-[#003366] rounded-full flex items-center justify-center mx-auto border border-blue-100">
                  <span className="text-2xl font-bold">🔒</span>
                </div>
                <h2 className="text-xl font-bold text-[#003366] font-serif">
                  Restricted Admin Access
                </h2>
                <p className="text-xs text-gray-600 leading-relaxed">
                  The institutional administrative panel requires authentication. Please log in as an authorized nodal officer, director office representative, or data operator.
                </p>
                <button
                  onClick={() => setShowLoginModal(true)}
                  className="bg-[#003366] hover:bg-blue-900 text-white font-bold text-xs py-2.5 px-6 rounded-xl shadow transition"
                >
                  Open Login Portal
                </button>
              </div>
            )
          )}
        </main>
      </div>

      {/* Footer Component */}
      <Footer
        lastUpdated={stats?.lastUpdated}
        onSelectTab={(tab) => setActiveTab(tab)}
      />

      {/* MODALS */}

      {/* Login Modal */}
      {showLoginModal && (
        <LoginModal
          onClose={() => setShowLoginModal(false)}
          onLoginSuccess={(user) => {
            setCurrentUser(user);
            setShowLoginModal(false);
            setActiveTab("admin");
          }}
        />
      )}

      {/* Ranking Detail Modal */}
      {selectedRankingDetail && (
        <RankingDetailModal
          ranking={selectedRankingDetail}
          parameters={parameters.filter(
            (p) => p.ranking_id === selectedRankingDetail.id
          )}
          documents={documents.filter(
            (d) => d.ranking_id === selectedRankingDetail.id
          )}
          onClose={() => setSelectedRankingDetail(null)}
          onOpenDocument={(doc) => setSelectedDocument(doc)}
        />
      )}

      {/* PDF / Document Viewer Modal */}
      {selectedDocument && (
        <PDFViewerModal
          document={selectedDocument}
          onClose={() => setSelectedDocument(null)}
        />
      )}
    </div>
  );
}
