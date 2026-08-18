import React, { useState } from "react";
import {
  ShieldAlert,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  Clock,
  FileCheck,
  Building2,
  FileText,
  Sliders,
  Newspaper,
  History,
  Users,
  ShieldCheck,
  X
} from "lucide-react";
import {
  RankingItem,
  RankingAgency,
  RankingCategory,
  RankingDocument,
  NewsUpdate,
  AuditLog,
  User,
  RankingStatus
} from "../types";
import { formatDate, getStatusBadge } from "../utils/helpers";

interface AdminViewProps {
  currentUser: User;
  rankings: RankingItem[];
  agencies: RankingAgency[];
  categories: RankingCategory[];
  documents: RankingDocument[];
  news: NewsUpdate[];
  auditLogs: AuditLog[];
  onRefreshData: () => void;
}

export const AdminView: React.FC<AdminViewProps> = ({
  currentUser,
  rankings,
  agencies,
  categories,
  documents,
  news,
  auditLogs,
  onRefreshData,
}) => {
  const [activeTab, setActiveTab] = useState<"rankings" | "agencies" | "documents" | "news" | "audit" | "users">("rankings");

  // Form Modal States
  const [showRankingModal, setShowRankingModal] = useState(false);
  const [editingRanking, setEditingRanking] = useState<Partial<RankingItem> | null>(null);

  const [showNewsModal, setShowNewsModal] = useState(false);
  const [newsTitle, setNewsTitle] = useState("");
  const [newsDesc, setNewsDesc] = useState("");
  const [newsContent, setNewsContent] = useState("");

  const [showAgencyModal, setShowAgencyModal] = useState(false);
  const [agencyName, setAgencyName] = useState("");
  const [agencyShort, setAgencyShort] = useState("");
  const [agencyDesc, setAgencyDesc] = useState("");
  const [agencyUrl, setAgencyUrl] = useState("");

  const [showDocModal, setShowDocModal] = useState(false);
  const [docName, setDocName] = useState("");
  const [docType, setDocType] = useState<any>("NIRF Reports");

  // Workflow update state
  const handleWorkflowChange = async (rankingId: string, newStatus: RankingStatus) => {
    try {
      await fetch(`/api/rankings/${rankingId}/workflow`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: newStatus,
          verified: newStatus === "Verified" || newStatus === "Published",
          reviewer: currentUser.name,
          role: currentUser.role,
        }),
      });
      onRefreshData();
    } catch (err) {
      console.error("Workflow update error:", err);
    }
  };

  // Delete Ranking
  const handleDeleteRanking = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this ranking record?")) return;
    try {
      await fetch(`/api/rankings/${id}`, { method: "DELETE" });
      onRefreshData();
    } catch (err) {
      console.error("Delete error:", err);
    }
  };

  // Save/Update Ranking
  const handleSaveRanking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRanking) return;

    try {
      if (editingRanking.id) {
        // Update
        await fetch(`/api/rankings/${editingRanking.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...editingRanking,
            user: currentUser.name,
            role: currentUser.role,
          }),
        });
      } else {
        // Create
        await fetch("/api/rankings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...editingRanking,
            user: currentUser.name,
            role: currentUser.role,
            created_by: currentUser.name,
          }),
        });
      }
      setShowRankingModal(false);
      setEditingRanking(null);
      onRefreshData();
    } catch (err) {
      console.error("Save error:", err);
    }
  };

  // Create Agency
  const handleSaveAgency = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await fetch("/api/agencies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: agencyName,
          short_name: agencyShort,
          description: agencyDesc,
          website: agencyUrl,
          logo: "",
          user: currentUser.name,
        }),
      });
      setShowAgencyModal(false);
      setAgencyName("");
      setAgencyShort("");
      setAgencyDesc("");
      setAgencyUrl("");
      onRefreshData();
    } catch (err) {
      console.error("Create agency error:", err);
    }
  };

  // Create News
  const handleSaveNews = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await fetch("/api/news", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newsTitle,
          short_description: newsDesc,
          full_content: newsContent,
          image_url: "https://images.unsplash.com/photo-1541829070764-84a7d30dd3f3?auto=format&fit=crop&q=80&w=800",
          user: currentUser.name,
        }),
      });
      setShowNewsModal(false);
      setNewsTitle("");
      setNewsDesc("");
      setNewsContent("");
      onRefreshData();
    } catch (err) {
      console.error("Create news error:", err);
    }
  };

  // Create Document
  const handleSaveDoc = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          document_name: docName,
          document_type: docType,
          file_url: "#",
          uploaded_by: currentUser.name,
        }),
      });
      setShowDocModal(false);
      setDocName("");
      onRefreshData();
    } catch (err) {
      console.error("Create doc error:", err);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header Bar */}
      <div className="bg-[#003366] text-white rounded-2xl p-6 shadow-md border-b-4 border-[#F58220] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="bg-[#F58220] text-white text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">
              {currentUser.role} Control Panel
            </span>
            <span className="text-emerald-400 text-xs font-semibold flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" /> Authenticated Session
            </span>
          </div>

          <h1 className="text-2xl font-bold font-serif">
            Institutional Admin Dashboard
          </h1>
          <p className="text-xs text-blue-200 mt-0.5">
            Logged in as <strong>{currentUser.name}</strong> ({currentUser.email})
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => {
              setEditingRanking({
                agency_id: "nirf",
                agency_name: "NIRF",
                ranking_name: "NIRF Engineering 2026",
                category: "Engineering",
                year: 2026,
                rank: 20,
                status: "Draft",
                verified: false,
              });
              setShowRankingModal(true);
            }}
            className="bg-[#F58220] hover:bg-[#e07115] text-white font-bold text-xs px-3.5 py-2 rounded-lg shadow transition flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Ranking</span>
          </button>
        </div>
      </div>

      {/* Admin Tabs */}
      <div className="bg-white rounded-2xl p-2 border border-gray-200/80 shadow-sm flex flex-wrap gap-1">
        {[
          { id: "rankings", label: "Rankings Management", icon: <FileCheck className="w-4 h-4" /> },
          { id: "agencies", label: "Agencies & Categories", icon: <Building2 className="w-4 h-4" /> },
          { id: "documents", label: "Documents & Reports", icon: <FileText className="w-4 h-4" /> },
          { id: "news", label: "News Releases", icon: <Newspaper className="w-4 h-4" /> },
          { id: "audit", label: "Audit Trail", icon: <History className="w-4 h-4 text-amber-600" /> },
          { id: "users", label: "User Roles", icon: <Users className="w-4 h-4" /> },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
              activeTab === tab.id
                ? "bg-[#003366] text-white shadow-sm"
                : "text-gray-700 hover:bg-slate-100"
            }`}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab Content 1: Rankings Management */}
      {activeTab === "rankings" && (
        <div className="bg-white rounded-2xl p-6 border border-gray-200/80 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <div>
              <h2 className="text-lg font-bold text-[#003366] font-serif">
                Ranking Records & Verification Workflow
              </h2>
              <p className="text-xs text-gray-500">
                Manage status flow: Draft → Submitted → Under Review → Verified → Published
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 text-gray-800 font-bold border-b border-slate-200">
                  <th className="p-3">Title & Agency</th>
                  <th className="p-3">Category</th>
                  <th className="p-3 text-center">Year</th>
                  <th className="p-3 text-center">Rank</th>
                  <th className="p-3 text-center">Status</th>
                  <th className="p-3 text-center">Workflow Action</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rankings.map((r) => {
                  const badge = getStatusBadge(r.status);
                  return (
                    <tr key={r.id} className="hover:bg-slate-50 transition">
                      <td className="p-3 font-bold text-gray-900">
                        <div>{r.ranking_name}</div>
                        <div className="text-[10px] text-gray-500 font-normal">{r.agency_name}</div>
                      </td>
                      <td className="p-3 text-gray-700">{r.category}</td>
                      <td className="p-3 text-center font-bold text-gray-800">{r.year}</td>
                      <td className="p-3 text-center font-extrabold text-[#003366]">#{r.rank}</td>
                      <td className="p-3 text-center">
                        <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded border ${badge.bg}`}>
                          {badge.label}
                        </span>
                      </td>

                      {/* Workflow transition selector */}
                      <td className="p-3 text-center">
                        <select
                          value={r.status}
                          onChange={(e) => handleWorkflowChange(r.id, e.target.value as RankingStatus)}
                          className="bg-slate-50 border border-gray-200 rounded px-2 py-1 text-[11px] font-semibold text-gray-800 focus:outline-none focus:ring-1 focus:ring-[#003366]"
                        >
                          <option value="Draft">Draft</option>
                          <option value="Submitted">Submitted</option>
                          <option value="Under Review">Under Review</option>
                          <option value="Verified">Verified</option>
                          <option value="Published">Published</option>
                        </select>
                      </td>

                      <td className="p-3 text-right space-x-1">
                        <button
                          onClick={() => {
                            setEditingRanking(r);
                            setShowRankingModal(true);
                          }}
                          className="p-1.5 bg-blue-50 hover:bg-blue-100 text-[#003366] rounded transition"
                          title="Edit Record"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteRanking(r.id)}
                          className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded transition"
                          title="Delete Record"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab Content 2: Agencies & Categories */}
      {activeTab === "agencies" && (
        <div className="bg-white rounded-2xl p-6 border border-gray-200/80 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <div>
              <h2 className="text-lg font-bold text-[#003366] font-serif">
                Agency Directory ({agencies.length})
              </h2>
              <p className="text-xs text-gray-500">Registered ranking agencies and evaluation frameworks</p>
            </div>

            <button
              onClick={() => setShowAgencyModal(true)}
              className="bg-[#003366] hover:bg-blue-900 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" /> Add Agency
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {agencies.map((ag) => (
              <div key={ag.id} className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs">
                <div className="flex justify-between items-start font-bold text-gray-900">
                  <span>{ag.name}</span>
                  <span className="bg-blue-100 text-[#003366] text-[10px] px-2 py-0.5 rounded">{ag.short_name}</span>
                </div>
                <p className="text-gray-600 text-[11px]">{ag.description}</p>
                <div className="text-[10px] text-blue-700 font-semibold">{ag.website}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab Content 3: Documents */}
      {activeTab === "documents" && (
        <div className="bg-white rounded-2xl p-6 border border-gray-200/80 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <div>
              <h2 className="text-lg font-bold text-[#003366] font-serif">
                Repository Files ({documents.length})
              </h2>
              <p className="text-xs text-gray-500">Official certificates and data sheet attachments</p>
            </div>

            <button
              onClick={() => setShowDocModal(true)}
              className="bg-[#003366] hover:bg-blue-900 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" /> Upload File Record
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {documents.map((d) => (
              <div key={d.id} className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs flex justify-between items-center">
                <div>
                  <div className="font-bold text-gray-900">{d.document_name}</div>
                  <div className="text-[10px] text-gray-500">{d.document_type} • Uploaded by {d.uploaded_by}</div>
                </div>
                <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded">
                  VERIFIED
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab Content 4: News Management */}
      {activeTab === "news" && (
        <div className="bg-white rounded-2xl p-6 border border-gray-200/80 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <div>
              <h2 className="text-lg font-bold text-[#003366] font-serif">
                Press Releases & Announcements ({news.length})
              </h2>
              <p className="text-xs text-gray-500">Manage public news feed</p>
            </div>

            <button
              onClick={() => setShowNewsModal(true)}
              className="bg-[#003366] hover:bg-blue-900 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" /> Add News
            </button>
          </div>

          <div className="space-y-3">
            {news.map((n) => (
              <div key={n.id} className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1">
                <div className="flex justify-between items-center font-bold text-gray-900">
                  <span>{n.title}</span>
                  <span className="text-[10px] text-gray-500">{formatDate(n.date)}</span>
                </div>
                <p className="text-gray-600">{n.short_description}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab Content 5: Audit Trail */}
      {activeTab === "audit" && (
        <div className="bg-white rounded-2xl p-6 border border-gray-200/80 shadow-sm space-y-4">
          <div className="border-b border-gray-100 pb-3">
            <h2 className="text-lg font-bold text-[#003366] font-serif flex items-center gap-2">
              <History className="w-5 h-5 text-[#F58220]" />
              Institutional Audit Trail & Modification Log
            </h2>
            <p className="text-xs text-gray-500">
              Immutable institutional log tracking all creations, verification status updates, and user modifications.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 text-gray-800 font-bold border-b border-slate-200">
                  <th className="p-3">Timestamp</th>
                  <th className="p-3">User & Role</th>
                  <th className="p-3">Action</th>
                  <th className="p-3">Details</th>
                  <th className="p-3 text-right">IP Address</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {auditLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50 transition">
                    <td className="p-3 font-mono text-[11px] text-gray-500">{formatDate(log.timestamp)}</td>
                    <td className="p-3 font-bold text-gray-900">
                      <div>{log.user}</div>
                      <div className="text-[10px] text-amber-700 font-medium">{log.role}</div>
                    </td>
                    <td className="p-3">
                      <span className="bg-blue-50 text-[#003366] text-[10px] font-bold px-2 py-0.5 rounded border border-blue-100 font-mono">
                        {log.action}
                      </span>
                    </td>
                    <td className="p-3 text-gray-700">{log.details}</td>
                    <td className="p-3 text-right font-mono text-[11px] text-gray-400">{log.ip_address || "14.139.243.1"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab Content 6: User Roles */}
      {activeTab === "users" && (
        <div className="bg-white rounded-2xl p-6 border border-gray-200/80 shadow-sm space-y-4">
          <div className="border-b border-gray-100 pb-3">
            <h2 className="text-lg font-bold text-[#003366] font-serif">
              Role-Based Access Control (RBAC)
            </h2>
            <p className="text-xs text-gray-500">Authorized personnel and verification hierarchy</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="p-4 bg-blue-50/70 border border-blue-100 rounded-xl space-y-1">
              <span className="font-bold text-[#003366] block">Super Admin (Director / Deans Office)</span>
              <p className="text-gray-600">Full control over ranking publication, user management, and audit log inspection.</p>
            </div>
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
              <span className="font-bold text-gray-900 block">Ranking Admin (Ranking Nodal Officer)</span>
              <p className="text-gray-600">Create and edit rankings, verify parameter scores, upload supporting documents.</p>
            </div>
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
              <span className="font-bold text-gray-900 block">Data Entry Operator</span>
              <p className="text-gray-600">Draft new ranking entries and submit them for nodal officer review.</p>
            </div>
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
              <span className="font-bold text-gray-900 block">Viewer</span>
              <p className="text-gray-600">Read-only access for internal audit and verification cross-checking.</p>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: Add/Edit Ranking Record */}
      {showRankingModal && editingRanking && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full my-auto overflow-hidden border border-gray-200 animate-in fade-in zoom-in duration-200">
            <div className="bg-[#003366] text-white p-5 flex items-center justify-between">
              <h3 className="font-bold text-base font-serif">
                {editingRanking.id ? "Edit Ranking Record" : "Add New Ranking Record"}
              </h3>
              <button
                onClick={() => {
                  setShowRankingModal(false);
                  setEditingRanking(null);
                }}
                className="text-blue-200 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveRanking} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-700 uppercase mb-1">Agency Name</label>
                  <input
                    type="text"
                    value={editingRanking.agency_name || ""}
                    onChange={(e) => setEditingRanking({ ...editingRanking, agency_name: e.target.value })}
                    required
                    className="w-full bg-slate-50 border rounded p-2 text-gray-800"
                  />
                </div>

                <div>
                  <label className="block font-bold text-gray-700 uppercase mb-1">Category</label>
                  <input
                    type="text"
                    value={editingRanking.category || ""}
                    onChange={(e) => setEditingRanking({ ...editingRanking, category: e.target.value })}
                    required
                    className="w-full bg-slate-50 border rounded p-2 text-gray-800"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-gray-700 uppercase mb-1">Ranking Record Title</label>
                <input
                  type="text"
                  value={editingRanking.ranking_name || ""}
                  onChange={(e) => setEditingRanking({ ...editingRanking, ranking_name: e.target.value })}
                  required
                  className="w-full bg-slate-50 border rounded p-2 text-gray-800 font-semibold"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-gray-700 uppercase mb-1">Year</label>
                  <input
                    type="number"
                    value={editingRanking.year || 2026}
                    onChange={(e) => setEditingRanking({ ...editingRanking, year: Number(e.target.value) })}
                    required
                    className="w-full bg-slate-50 border rounded p-2 text-gray-800"
                  />
                </div>

                <div>
                  <label className="block font-bold text-gray-700 uppercase mb-1">Current Rank</label>
                  <input
                    type="number"
                    value={editingRanking.rank || 1}
                    onChange={(e) => setEditingRanking({ ...editingRanking, rank: Number(e.target.value) })}
                    required
                    className="w-full bg-slate-50 border rounded p-2 text-gray-800 font-bold"
                  />
                </div>

                <div>
                  <label className="block font-bold text-gray-700 uppercase mb-1">Previous Rank</label>
                  <input
                    type="number"
                    value={editingRanking.previous_rank || ""}
                    onChange={(e) => setEditingRanking({ ...editingRanking, previous_rank: Number(e.target.value) })}
                    className="w-full bg-slate-50 border rounded p-2 text-gray-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-700 uppercase mb-1">Overall Score (Out of 100)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editingRanking.score || ""}
                    onChange={(e) => setEditingRanking({ ...editingRanking, score: Number(e.target.value) })}
                    className="w-full bg-slate-50 border rounded p-2 text-gray-800 font-semibold"
                  />
                </div>

                <div>
                  <label className="block font-bold text-gray-700 uppercase mb-1">Total Institutions</label>
                  <input
                    type="number"
                    value={editingRanking.total_institutions || ""}
                    onChange={(e) => setEditingRanking({ ...editingRanking, total_institutions: Number(e.target.value) })}
                    className="w-full bg-slate-50 border rounded p-2 text-gray-800"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-gray-700 uppercase mb-1">Official Source Web URL</label>
                <input
                  type="url"
                  value={editingRanking.source_url || ""}
                  onChange={(e) => setEditingRanking({ ...editingRanking, source_url: e.target.value })}
                  placeholder="https://www.nirfindia.org/..."
                  className="w-full bg-slate-50 border rounded p-2 text-gray-800"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 uppercase mb-1">Institutional Remarks & Notes</label>
                <textarea
                  value={editingRanking.remarks || ""}
                  onChange={(e) => setEditingRanking({ ...editingRanking, remarks: e.target.value })}
                  rows={2}
                  className="w-full bg-slate-50 border rounded p-2 text-gray-800"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowRankingModal(false);
                    setEditingRanking(null);
                  }}
                  className="px-4 py-2 bg-gray-200 text-gray-800 font-semibold rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#003366] text-white font-bold rounded shadow hover:bg-blue-900"
                >
                  Save Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Add Agency */}
      {showAgencyModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-gray-200">
            <div className="bg-[#003366] text-white p-4 flex justify-between items-center">
              <h3 className="font-bold text-sm">Add Ranking Agency</h3>
              <button onClick={() => setShowAgencyModal(false)}><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={handleSaveAgency} className="p-5 space-y-3 text-xs">
              <div>
                <label className="block font-bold text-gray-700 mb-1">Agency Name</label>
                <input
                  type="text"
                  value={agencyName}
                  onChange={(e) => setAgencyName(e.target.value)}
                  required
                  placeholder="e.g. ARWU Shanghai Rankings"
                  className="w-full border rounded p-2"
                />
              </div>
              <div>
                <label className="block font-bold text-gray-700 mb-1">Short Name</label>
                <input
                  type="text"
                  value={agencyShort}
                  onChange={(e) => setAgencyShort(e.target.value)}
                  required
                  placeholder="ARWU"
                  className="w-full border rounded p-2"
                />
              </div>
              <div>
                <label className="block font-bold text-gray-700 mb-1">Website URL</label>
                <input
                  type="url"
                  value={agencyUrl}
                  onChange={(e) => setAgencyUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full border rounded p-2"
                />
              </div>
              <div>
                <label className="block font-bold text-gray-700 mb-1">Description</label>
                <textarea
                  value={agencyDesc}
                  onChange={(e) => setAgencyDesc(e.target.value)}
                  rows={2}
                  className="w-full border rounded p-2"
                />
              </div>
              <button type="submit" className="w-full bg-[#003366] text-white font-bold py-2 rounded">
                Create Agency Record
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Add Document */}
      {showDocModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-gray-200">
            <div className="bg-[#003366] text-white p-4 flex justify-between items-center">
              <h3 className="font-bold text-sm">Upload Document Record</h3>
              <button onClick={() => setShowDocModal(false)}><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={handleSaveDoc} className="p-5 space-y-3 text-xs">
              <div>
                <label className="block font-bold text-gray-700 mb-1">Document Title</label>
                <input
                  type="text"
                  value={docName}
                  onChange={(e) => setDocName(e.target.value)}
                  required
                  placeholder="e.g. NIRF 2026 Institutional Data Sheet"
                  className="w-full border rounded p-2"
                />
              </div>
              <div>
                <label className="block font-bold text-gray-700 mb-1">Document Type</label>
                <select
                  value={docType}
                  onChange={(e) => setDocType(e.target.value)}
                  className="w-full border rounded p-2"
                >
                  <option value="NIRF Reports">NIRF Reports</option>
                  <option value="QS Reports">QS Reports</option>
                  <option value="THE Reports">THE Reports</option>
                  <option value="Institutional Data">Institutional Data</option>
                  <option value="Ranking Submissions">Ranking Submissions</option>
                </select>
              </div>
              <button type="submit" className="w-full bg-[#003366] text-white font-bold py-2 rounded">
                Log Verified Document
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: Add News */}
      {showNewsModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-gray-200">
            <div className="bg-[#003366] text-white p-4 flex justify-between items-center">
              <h3 className="font-bold text-sm">Publish News Release</h3>
              <button onClick={() => setShowNewsModal(false)}><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={handleSaveNews} className="p-5 space-y-3 text-xs">
              <div>
                <label className="block font-bold text-gray-700 mb-1">Release Title</label>
                <input
                  type="text"
                  value={newsTitle}
                  onChange={(e) => setNewsTitle(e.target.value)}
                  required
                  className="w-full border rounded p-2"
                />
              </div>
              <div>
                <label className="block font-bold text-gray-700 mb-1">Short Description</label>
                <input
                  type="text"
                  value={newsDesc}
                  onChange={(e) => setNewsDesc(e.target.value)}
                  required
                  className="w-full border rounded p-2"
                />
              </div>
              <div>
                <label className="block font-bold text-gray-700 mb-1">Full Article Content</label>
                <textarea
                  value={newsContent}
                  onChange={(e) => setNewsContent(e.target.value)}
                  rows={4}
                  required
                  className="w-full border rounded p-2"
                />
              </div>
              <button type="submit" className="w-full bg-[#003366] text-white font-bold py-2 rounded">
                Publish Press Release
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
