import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft,
  CheckCircle,
  ClockCounterClockwise,
  Copy,
  FileArrowUp,
  Lock,
  LockOpen,
  PaperPlaneTilt,
  Warning,
  Eye,
  Check,
  ArrowsCounterClockwise,
  DownloadSimple,
  X,
  FileText,
} from '@phosphor-icons/react';
import { FileSpreadsheet } from 'lucide-react';

import { ORG_TYPE_STYLES } from '../../components/organogram/OrgTree';
import { useToast } from '../../components/ToastProvider';
import { dataItemLabel } from '../../lib/data-catalogue';
import { getUnit, unitLabel, ORG_UNITS } from '../../lib/organogram';
import type { DataRequest, NodalOfficer, ProofUpload, TargetStatus } from '../../lib/types';

const spring = { type: 'spring' as const, stiffness: 100, damping: 20 };

const TARGET_STATUS_STYLES: Record<TargetStatus, string> = {
  PENDING: 'bg-orange-50 text-orange-700 ring-orange-500/20',
  PARTIAL: 'bg-soft-gold-50 text-soft-gold-700 ring-soft-gold-500/20',
  SUBMITTED: 'bg-sage-50 text-sage-700 ring-sage-500/20',
};

interface DetailPayload {
  request: DataRequest;
  officers: NodalOfficer[];
  uploads: ProofUpload[];
}

interface SubmissionItem {
  id: string;
  sectionId: string;
  orgUnit: { id: string; name: string; kind: string };
  status: 'DRAFT' | 'SUBMITTED' | 'CORRECTION_REQUESTED' | 'APPROVED';
  notApplicable: boolean;
  revision: number;
  submittedBy?: string;
  submittedAt?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  reviewComment?: string;
  warningNote?: string;
}

export default function DataRequestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { showToast } = useToast();
  const [data, setData] = useState<DetailPayload | null>(null);
  const [submissions, setSubmissions] = useState<SubmissionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'targets' | 'submissions' | 'coverage' | 'rollup'>('targets');

  // Submissions review filters and actions
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [selectedSubmission, setSelectedSubmission] = useState<any | null>(null);
  const [correctionModalSubId, setCorrectionModalSubId] = useState<string | null>(null);
  const [correctionComment, setCorrectionComment] = useState('');
  const [performingAction, setPerformingAction] = useState(false);

  // Rollup & Export state
  const [rollupData, setRollupData] = useState<any | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('OVERALL');
  const [loadingRollup, setLoadingRollup] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const [response, officersRes, subsRes] = await Promise.all([
        fetch(`/api/data-requests/${id}/`),
        fetch('/api/nodal-officers/'),
        fetch(`/api/submissions/?request=${id}`),
      ]);
      if (!response.ok) throw new Error('This data request could not be loaded.');
      const reqData = await response.json();
      let officersList: NodalOfficer[] = [];
      if (officersRes.ok) {
        const raw = await officersRes.json();
        officersList = Array.isArray(raw) ? raw : (raw.officers ?? []);
      }
      setData({
        request: reqData,
        officers: officersList,
        uploads: reqData.uploads || [],
      });

      if (subsRes.ok) {
        const subsData = await subsRes.json();
        setSubmissions(Array.isArray(subsData) ? subsData : subsData.results || []);
      }
    } catch (error) {
      showToast((error as Error).message, 'error');
    } finally {
      setLoading(false);
    }
  }, [id, showToast]);

  useEffect(() => {
    load();
  }, [load]);

  const loadRollup = useCallback(async (cat: string) => {
    if (!data?.request?.cycleYear) return;
    setLoadingRollup(true);
    try {
      const res = await fetch(`/api/nirf/cycles/${data.request.cycleYear}/rollup/?category=${cat}`);
      if (res.ok) {
        const d = await res.json();
        setRollupData(d);
      }
    } catch {
      // ignore
    } finally {
      setLoadingRollup(false);
    }
  }, [data?.request?.cycleYear]);

  useEffect(() => {
    if (activeTab === 'rollup' && data?.request?.cycleYear) {
      loadRollup(selectedCategory);
    }
  }, [activeTab, selectedCategory, loadRollup, data?.request?.cycleYear]);

  const officersById = useMemo(
    () => new Map((data?.officers ?? []).map((officer) => [officer.id, officer])),
    [data],
  );

  const uploadsByUnit = useMemo(() => {
    const map = new Map<string, ProofUpload[]>();
    (data?.uploads ?? []).forEach((upload) => {
      const uId = upload.unitId || (upload as any).orgUnitId;
      if (!uId) return;
      const list = map.get(uId) ?? [];
      list.push(upload);
      map.set(uId, list);
    });
    return map;
  }, [data]);

  const act = async (body: Record<string, unknown>, key: string) => {
    setBusy(key);
    try {
      const response = await fetch(`/api/data-requests/${id}/actions/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? 'The action failed.');
      showToast(payload.message ?? 'Success.', 'success');
      load();
    } catch (error) {
      showToast((error as Error).message, 'error');
    } finally {
      setBusy(null);
    }
  };

  const handleSubmissionAction = async (subId: string, action: 'approve' | 'requestCorrection' | 'reopen', comment?: string) => {
    setPerformingAction(true);
    try {
      const res = await fetch(`/api/submissions/${subId}/actions/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('dora_access_token') || ''}`,
        },
        body: JSON.stringify({ action, comment: comment || '' }),
      });

      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || 'Action failed');

      showToast(`Submission ${action === 'approve' ? 'approved' : action === 'requestCorrection' ? 'sent back for correction' : 'reopened'}`, 'success');
      setCorrectionModalSubId(null);
      setCorrectionComment('');
      load();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setPerformingAction(false);
    }
  };

  const handleViewSubmissionDetail = async (subId: string) => {
    try {
      const res = await fetch(`/api/submissions/${subId}/`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('dora_access_token') || ''}`,
        },
      });
      if (res.ok) {
        const d = await res.json();
        setSelectedSubmission(d);
      }
    } catch {
      showToast('Could not load submission details', 'error');
    }
  };

  const handleExportDcs = (cat: string) => {
    if (!data?.request?.cycleYear) return;
    const url = `/api/nirf/cycles/${data.request.cycleYear}/export/?category=${cat}`;
    window.open(url, '_blank');
  };

  if (loading || !data) {
    return (
      <div className="max-w-[1400px] mx-auto p-8 space-y-6 animate-pulse">
        <div className="h-6 w-32 bg-zinc-200 rounded-lg" />
        <div className="h-10 w-96 bg-zinc-200 rounded-xl" />
        <div className="h-40 bg-white rounded-[2rem] border border-slate-200/50" />
      </div>
    );
  }

  const { request } = data;
  const targets = request.targets ?? [];
  const deliveries = request.deliveries ?? [];
  const submitted = targets.filter((target) => target.status === 'SUBMITTED').length;
  const progress = targets.length > 0 ? Math.round((submitted / targets.length) * 100) : 0;

  const filteredSubmissions = submissions.filter((s) => !statusFilter || s.status === statusFilter);

  // Group submissions by unit and section for coverage matrix
  const academicUnits = ORG_UNITS.filter(
    (u) => u.kind === 'SCHOOL' || u.kind === 'CENTRE' || u.type === 'ACADEMIC'
  );
  const distinctSections = Array.from(new Set(submissions.map((s) => s.sectionId))).sort();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={spring}
      className="max-w-[1400px] mx-auto space-y-8"
    >
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <Link
            to="/admin/data-collection"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-500 hover:text-zinc-900 transition-colors mb-3"
          >
            <ArrowLeft weight="bold" className="w-3.5 h-3.5" /> All Data Requests
          </Link>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold uppercase tracking-wider text-sage-700 bg-sage-50 px-2.5 py-1 rounded-md ring-1 ring-sage-500/20 font-mono">
              {request.reference}
            </span>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-zinc-100 text-zinc-700 font-mono">
              {request.framework} {request.cycleYear}
            </span>
            {request.categories && request.categories.length > 0 && (
              <span className="text-xs font-medium text-zinc-500">
                Categories: {request.categories.join(', ')}
              </span>
            )}
          </div>
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-zinc-900 mt-2">
            {request.title}
          </h1>
          <p className="text-zinc-500 mt-1 max-w-[65ch] leading-relaxed text-sm">
            Dispatched on {formatDate(request.createdAt)} &middot; Deadline{' '}
            {formatDate(request.deadline)}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {request.status === 'CLOSED' ? (
            <button
              onClick={() => act({ action: 'REOPEN' }, 'reopen')}
              disabled={busy !== null}
              className="px-4 py-2.5 rounded-xl bg-sage-600 hover:bg-sage-700 text-white text-sm font-semibold disabled:opacity-50 transition-colors flex items-center gap-2"
            >
              <LockOpen weight="bold" className="w-4 h-4" /> Reopen Request
            </button>
          ) : (
            <button
              onClick={() => act({ action: 'CLOSE' }, 'close')}
              disabled={busy !== null}
              className="px-4 py-2.5 rounded-xl bg-zinc-900 hover:bg-black text-white text-sm font-semibold disabled:opacity-50 transition-colors flex items-center gap-2"
            >
              <Lock weight="bold" className="w-4 h-4" /> Close & Revoke Links
            </button>
          )}
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="md:col-span-2 bg-white border border-slate-200/50 rounded-[2rem] p-6 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)]">
          <div className="flex items-center justify-between text-sm">
            <span className="font-semibold text-zinc-900">Collection Progress</span>
            <span className="text-zinc-500">
              {submitted} of {targets.length} sections complete ({progress}%)
            </span>
          </div>
          <div className="h-2.5 w-full bg-slate-200/70 rounded-full overflow-hidden mt-4">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ ...spring, delay: 0.1 }}
              className="h-full bg-sage-500 rounded-full"
            />
          </div>
        </div>
        <MetricCard label="NIRF Form Submissions" value={submissions.length} />
        <MetricCard label="Proof Files Received" value={(data.uploads ?? []).length} />
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-zinc-200">
        <button
          type="button"
          onClick={() => setActiveTab('targets')}
          className={`px-5 py-3 text-sm font-semibold border-b-2 transition-all ${
            activeTab === 'targets'
              ? 'border-sage-600 text-sage-800'
              : 'border-transparent text-zinc-500 hover:text-zinc-800'
          }`}
        >
          Targeted Units ({targets.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('submissions')}
          className={`px-5 py-3 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'submissions'
              ? 'border-sage-600 text-sage-800'
              : 'border-transparent text-zinc-500 hover:text-zinc-800'
          }`}
        >
          NIRF Review Queue ({submissions.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('coverage')}
          className={`px-5 py-3 text-sm font-semibold border-b-2 transition-all ${
            activeTab === 'coverage'
              ? 'border-sage-600 text-sage-800'
              : 'border-transparent text-zinc-500 hover:text-zinc-800'
          }`}
        >
          Unit Coverage Matrix
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('rollup')}
          className={`px-5 py-3 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'rollup'
              ? 'border-sage-600 text-sage-800'
              : 'border-transparent text-zinc-500 hover:text-zinc-800'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
          Rollup & DCS Export
        </button>
      </div>

      {/* TAB 1: TARGETS (Original) */}
      {activeTab === 'targets' && (
        <div className="bg-white border border-slate-200/50 rounded-[2rem] shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)] overflow-hidden">
          <div className="p-6 border-b border-slate-100">
            <h2 className="text-xl font-semibold tracking-tight text-zinc-900">Targeted Sections & Officers</h2>
            <p className="text-sm text-zinc-500 mt-1">
              Each recipient holds a restricted upload link scoped to their assigned unit.
            </p>
          </div>
          <div className="divide-y divide-slate-100">
            {targets.map((target) => {
              const unitId = target.unitId || (target as any).orgUnitId || (target as any).orgUnit?.id || '';
              const officerIds = target.officerIds ?? [];
              const unit = getUnit(unitId);
              const uploads = uploadsByUnit.get(unitId) ?? [];
              const coveredItems = new Set(uploads.map((upload) => upload.dataItemId));

              return (
                <div key={(target as any).id || unitId} className="p-6 hover:bg-zinc-50/40 transition-colors">
                  <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-zinc-900">{unitLabel(unitId) || unit?.name || unitId}</h3>
                        {unit && (
                          <span className={`px-2 py-0.5 rounded-md text-[11px] font-semibold ring-1 ${ORG_TYPE_STYLES[unit.type].chip}`}>
                            {unit.type.toLowerCase()}
                          </span>
                        )}
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ring-1 ${TARGET_STATUS_STYLES[target.status]}`}>
                          {target.status === 'SUBMITTED' ? 'Submitted' : target.status === 'PARTIAL' ? 'Partially received' : 'Awaiting upload'}
                        </span>
                      </div>

                      <p className="text-sm text-zinc-500 mt-2">
                        {officerIds.length > 0 ? (
                          officerIds.map((officerId) => officersById.get(officerId)?.name ?? officerId).join(', ')
                        ) : (
                          <span className="text-orange-600 font-medium inline-flex items-center gap-1.5">
                            <Warning weight="bold" className="w-4 h-4" /> No nodal officer assigned
                          </span>
                        )}
                      </p>

                      <div className="flex flex-wrap gap-1.5 mt-3">
                        {(target.dataItemIds ?? []).map((itemId) => (
                          <span
                            key={itemId}
                            className={`px-2.5 py-1 rounded-lg text-xs font-medium ring-1 ${
                              coveredItems.has(itemId)
                                ? 'bg-sage-50 text-sage-700 ring-sage-500/20'
                                : 'bg-zinc-100 text-zinc-600 ring-zinc-300/40'
                            }`}
                          >
                            {coveredItems.has(itemId) && (
                              <CheckCircle weight="fill" className="w-3 h-3 inline mr-1 -mt-0.5" />
                            )}
                            {dataItemLabel(itemId)}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      {officerIds.length > 0 && (
                        <button
                          onClick={() => act({ action: 'REISSUE', unitId, officerId: officerIds[0] }, `reissue-${unitId}`)}
                          disabled={busy !== null || request.status === 'CLOSED'}
                          className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-zinc-600 hover:bg-zinc-50 disabled:opacity-50 transition-colors flex items-center gap-1.5"
                        >
                          <Copy weight="bold" className="w-3.5 h-3.5" /> Copy link
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 2: NIRF REVIEW QUEUE (Maker-Checker) */}
      {activeTab === 'submissions' && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200/60 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-zinc-600">Filter by status:</span>
              {['', 'DRAFT', 'SUBMITTED', 'CORRECTION_REQUESTED', 'APPROVED'].map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-3 py-1 text-xs font-medium rounded-lg transition-all ${
                    statusFilter === st
                      ? 'bg-sage-600 text-white shadow-sm'
                      : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                  }`}
                >
                  {st || 'All'}
                </button>
              ))}
            </div>
            <span className="text-xs text-zinc-400">
              Showing {filteredSubmissions.length} of {submissions.length} submissions
            </span>
          </div>

          <div className="bg-white border border-slate-200/60 rounded-[2rem] overflow-hidden shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)]">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm divide-y divide-slate-100">
                <thead className="bg-zinc-50/80 text-zinc-600 font-semibold text-xs uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-5">Unit / Department</th>
                    <th className="py-3 px-4">Section ID</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Revision</th>
                    <th className="py-3 px-4">Last Activity</th>
                    <th className="py-3 px-5 text-right">Maker-Checker Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {filteredSubmissions.map((sub) => (
                    <tr key={sub.id} className="hover:bg-zinc-50/50 transition-colors">
                      <td className="py-3.5 px-5">
                        <div className="font-semibold text-zinc-900">{sub.orgUnit?.name}</div>
                        <div className="text-xs text-zinc-400">{sub.orgUnit?.kind}</div>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-xs text-zinc-700">
                        {sub.sectionId}
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`text-xs font-semibold px-2.5 py-1 rounded-md ${
                            sub.notApplicable
                              ? 'bg-zinc-100 text-zinc-500'
                              : sub.status === 'APPROVED'
                              ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-500/20'
                              : sub.status === 'SUBMITTED'
                              ? 'bg-slate-blue-50 text-slate-blue-700 ring-1 ring-slate-blue-500/20'
                              : sub.status === 'CORRECTION_REQUESTED'
                              ? 'bg-dusty-rose-50 text-dusty-rose-700 ring-1 ring-dusty-rose-500/20'
                              : 'bg-zinc-100 text-zinc-600'
                          }`}
                        >
                          {sub.notApplicable ? 'Not Applicable' : sub.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-xs font-mono text-zinc-500">
                        rev {sub.revision}
                      </td>
                      <td className="py-3.5 px-4 text-xs text-zinc-500">
                        {sub.submittedAt ? formatDate(sub.submittedAt) : 'Draft'}
                      </td>
                      <td className="py-3.5 px-5 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleViewSubmissionDetail(sub.id)}
                            className="p-1.5 text-zinc-500 hover:text-zinc-800 hover:bg-zinc-100 rounded-lg"
                            title="Inspect Payload"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {sub.status === 'SUBMITTED' && (
                            <>
                              <button
                                type="button"
                                disabled={performingAction}
                                onClick={() => handleSubmissionAction(sub.id, 'approve')}
                                className="px-2.5 py-1 text-xs font-semibold text-white bg-sage-600 hover:bg-sage-700 rounded-lg shadow-sm"
                              >
                                Approve
                              </button>
                              <button
                                type="button"
                                disabled={performingAction}
                                onClick={() => setCorrectionModalSubId(sub.id)}
                                className="px-2.5 py-1 text-xs font-semibold text-dusty-rose-700 bg-dusty-rose-50 hover:bg-dusty-rose-100 rounded-lg"
                              >
                                Request Fix
                              </button>
                            </>
                          )}

                          {sub.status === 'APPROVED' && (
                            <button
                              type="button"
                              disabled={performingAction}
                              onClick={() => handleSubmissionAction(sub.id, 'reopen')}
                              className="px-2.5 py-1 text-xs font-semibold text-zinc-600 bg-zinc-100 hover:bg-zinc-200 rounded-lg"
                            >
                              Reopen
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: UNIT COVERAGE MATRIX */}
      {activeTab === 'coverage' && (
        <div className="bg-white border border-slate-200/50 rounded-[2rem] p-6 shadow-sm overflow-hidden space-y-4">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-zinc-900">
              Unit Coverage Matrix (Schools & Centres)
            </h2>
            <p className="text-xs text-zinc-500 mt-1">
              Live status mapping across all units and applicable NIRF sections.
            </p>
          </div>

          <div className="overflow-x-auto border border-zinc-200 rounded-2xl">
            <table className="w-full text-left text-xs divide-y divide-zinc-200">
              <thead className="bg-zinc-50 text-zinc-700 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4 sticky left-0 bg-zinc-50 z-10 w-48">Unit</th>
                  {distinctSections.map((secId) => (
                    <th key={secId} className="py-3 px-3 min-w-[120px] text-center font-mono">
                      {secId}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 bg-white">
                {academicUnits.map((u) => (
                  <tr key={u.id} className="hover:bg-zinc-50/50">
                    <td className="py-2.5 px-4 font-semibold text-zinc-900 sticky left-0 bg-white">
                      {u.name} ({u.shortName || u.id})
                    </td>
                    {distinctSections.map((secId) => {
                      const match = submissions.find(
                        (s) => s.orgUnit?.id === u.id && s.sectionId === secId
                      );

                      return (
                        <td key={secId} className="py-2.5 px-3 text-center">
                          {!match ? (
                            <span className="text-zinc-300">&ndash;</span>
                          ) : match.notApplicable ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-zinc-100 text-zinc-500">
                              N/A
                            </span>
                          ) : match.status === 'APPROVED' ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700">
                              Approved
                            </span>
                          ) : match.status === 'SUBMITTED' ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-blue-50 text-slate-blue-700">
                              Submitted
                            </span>
                          ) : match.status === 'CORRECTION_REQUESTED' ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-dusty-rose-50 text-dusty-rose-700">
                              Fix Req.
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-orange-50 text-orange-700">
                              Draft
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: ROLLUP & DCS EXPORT */}
      {activeTab === 'rollup' && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200/50 rounded-[2rem] p-6 sm:p-8 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold tracking-tight text-zinc-900">
                  NIRF DCS Rollup & Excel Exporter
                </h2>
                <p className="text-xs text-zinc-500 mt-1">
                  Rolls up approved unit data and central items into official NIRF Data Capture System (DCS) workbooks.
                </p>
              </div>

              <div className="flex items-center gap-2">
                {['OVERALL', 'ENGINEERING', 'INNOVATION', 'SDG'].map((cat) => (
                  <button
                    key={cat}
                    onClick={() => {
                      setSelectedCategory(cat);
                      loadRollup(cat);
                    }}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition-all ${
                      selectedCategory === cat
                        ? 'bg-sage-600 text-white shadow-sm'
                        : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Export Trigger Button */}
            <div className="p-4 bg-zinc-50 border border-zinc-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="font-semibold text-zinc-900 text-sm">
                  Download {selectedCategory} DCS Workbook
                </h3>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Generates an .xlsx file matching IIT Mandi's NIRF format with sanitized fields.
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleExportDcs(selectedCategory)}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl transition-all shadow-sm shrink-0"
              >
                <DownloadSimple className="w-4 h-4" />
                Export {selectedCategory} (.xlsx)
              </button>
            </div>

            {/* Rollup Summary Details */}
            {loadingRollup ? (
              <div className="text-center py-10 text-zinc-400 text-xs">
                Computing category rollup and evaluating cross-checks...
              </div>
            ) : rollupData ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-4 bg-zinc-50 rounded-xl border border-zinc-100">
                    <span className="text-xs text-zinc-400">Total Sections</span>
                    <p className="text-xl font-bold text-zinc-900 mt-1">
                      {rollupData.sectionsCount || 0}
                    </p>
                  </div>
                  <div className="p-4 bg-zinc-50 rounded-xl border border-zinc-100">
                    <span className="text-xs text-zinc-400">Approved Submissions</span>
                    <p className="text-xl font-bold text-emerald-700 mt-1">
                      {rollupData.approvedCount || 0}
                    </p>
                  </div>
                  <div className="p-4 bg-zinc-50 rounded-xl border border-zinc-100">
                    <span className="text-xs text-zinc-400">Missing Units</span>
                    <p className="text-xl font-bold text-orange-600 mt-1">
                      {rollupData.missingUnitsCount || 0}
                    </p>
                  </div>
                  <div className="p-4 bg-zinc-50 rounded-xl border border-zinc-100">
                    <span className="text-xs text-zinc-400">Cross-Check Anomalies</span>
                    <p className="text-xl font-bold text-zinc-900 mt-1">
                      {rollupData.crossChecks?.filter((c: any) => !c.valid).length || 0}
                    </p>
                  </div>
                </div>

                {/* Cross checks list */}
                {rollupData.crossChecks && rollupData.crossChecks.length > 0 && (
                  <div className="border border-zinc-200 rounded-2xl p-4 bg-white space-y-2">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-700">
                      Cross-Check Validation Results
                    </h4>
                    <div className="space-y-1.5 pt-1">
                      {rollupData.crossChecks.map((chk: any, idx: number) => (
                        <div
                          key={idx}
                          className={`text-xs p-2.5 rounded-xl flex items-center justify-between ${
                            chk.valid
                              ? 'bg-emerald-50/70 text-emerald-800'
                              : 'bg-soft-gold-50 text-soft-gold-900 border border-soft-gold-200'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            {chk.valid ? (
                              <Check className="w-4 h-4 text-emerald-600" />
                            ) : (
                              <Warning className="w-4 h-4 text-soft-gold-700" />
                            )}
                            <span className="font-medium">{chk.checkId}: </span>
                            <span>{chk.message || (chk.valid ? 'Passed' : 'Advisory warning')}</span>
                          </div>
                          <span className="text-[10px] font-mono uppercase">{chk.status}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* Inspect Submission Payload Modal */}
      {selectedSubmission && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-[2rem] max-w-2xl w-full p-6 space-y-4 shadow-xl max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-zinc-900 text-lg">
                  Submission Data: {selectedSubmission.sectionId}
                </h3>
                <p className="text-xs text-zinc-500">
                  Unit: {selectedSubmission.orgUnit?.name} &middot; Revision {selectedSubmission.revision}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSubmission(null)}
                className="text-zinc-400 hover:text-zinc-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {selectedSubmission.warningNote && (
              <div className="p-3 bg-soft-gold-50 border border-soft-gold-200 rounded-xl text-xs text-soft-gold-900">
                <span className="font-semibold">Nodal Officer Warning Note: </span>
                {selectedSubmission.warningNote}
              </div>
            )}

            <div>
              <span className="text-xs font-semibold text-zinc-700 block mb-1">Raw Payload (JSON):</span>
              <pre className="p-4 bg-zinc-900 text-zinc-100 rounded-2xl text-xs overflow-x-auto max-h-80 font-mono">
                {JSON.stringify(selectedSubmission.payload, null, 2)}
              </pre>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setSelectedSubmission(null)}
                className="px-4 py-2 text-xs font-semibold text-zinc-600 hover:bg-zinc-100 rounded-xl"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Request Correction Comment Modal */}
      {correctionModalSubId && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-[2rem] max-w-md w-full p-6 space-y-4 shadow-xl">
            <h3 className="font-bold text-zinc-900">Request Data Correction</h3>
            <p className="text-xs text-zinc-500">
              Provide feedback for the nodal officer detailing the figures or records that require amendment.
            </p>
            <textarea
              value={correctionComment}
              onChange={(e) => setCorrectionComment(e.target.value)}
              placeholder="e.g. Please verify the lateral intake count for 2023-24 batch..."
              rows={3}
              className="w-full p-3 text-xs border border-zinc-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-sage-500"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCorrectionModalSubId(null)}
                className="px-4 py-2 text-xs font-semibold text-zinc-600 hover:bg-zinc-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!correctionComment.trim() || performingAction}
                onClick={() =>
                  handleSubmissionAction(correctionModalSubId, 'requestCorrection', correctionComment)
                }
                className="px-4 py-2 text-xs font-semibold text-white bg-dusty-rose-700 hover:bg-dusty-rose-800 disabled:opacity-50 rounded-xl"
              >
                Send Request
              </button>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white border border-slate-200/50 rounded-[2rem] p-6 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)]">
      <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">{label}</p>
      <p className="text-3xl font-semibold tracking-tight text-zinc-900 mt-2">{value}</p>
    </div>
  );
}

function formatDate(iso?: string): string {
  if (!iso) return '-';
  return new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}
