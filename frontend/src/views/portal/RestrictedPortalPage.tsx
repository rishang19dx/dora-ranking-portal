import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ShieldCheck,
  WarningOctagon,
  CheckCircle,
  FileArrowUp,
  Upload,
  FileText,
  Clock,
  ArrowRight,
  ArrowsClockwise,
  Check,
  X,
} from '@phosphor-icons/react';
import { FileSpreadsheet } from 'lucide-react';
import { useToast } from '../../components/ToastProvider';
import { getDataItem } from '../../lib/data-catalogue';
import { unitBreadcrumb, unitLabel } from '../../lib/organogram';
import type { PortalContext, ProofUpload } from '../../types';
import FormRenderer from '../../components/forms/FormRenderer';

interface FormSectionItem {
  section: any;
  submission: {
    id: string;
    sectionId: string;
    status: 'DRAFT' | 'SUBMITTED' | 'CORRECTION_REQUESTED' | 'APPROVED';
    notApplicable: boolean;
    payload: Record<string, any>;
    revision: number;
    warningNote?: string;
    reviewComment?: string;
    isCarryForward?: boolean;
  };
  records: Record<string, any[]>;
  proofUploadsCount: number;
  proofRequired: boolean;
}

interface PortalFormsResponse {
  officer: { id: string; name: string; email: string };
  orgUnit: { id: string; name: string; shortName: string; kind: string };
  request: { id: string; title: string; framework: string; cycleYear: number; deadline: string };
  targetStatus: string;
  yearContext: Record<string, string>;
  sections: FormSectionItem[];
}

export default function RestrictedPortalPage() {
  const { token } = useParams<{ token: string }>();
  const { showToast } = useToast();
  const [context, setContext] = useState<PortalContext | null>(null);
  const [formsData, setFormsData] = useState<PortalFormsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'forms' | 'proofs'>('forms');

  const loadData = useCallback(async () => {
    if (!token) return;
    try {
      const [ctxRes, formsRes] = await Promise.all([
        fetch(`/api/portal/${token}/`),
        fetch(`/api/portal/${token}/forms/`),
      ]);

      const ctxPayload = await ctxRes.json();
      if (!ctxRes.ok) {
        setErrorMsg(ctxPayload.error || 'Access unavailable.');
        return;
      }
      setContext(ctxPayload as PortalContext);

      if (formsRes.ok) {
        const formsPayload = await formsRes.json();
        setFormsData(formsPayload as PortalFormsResponse);
      }
    } catch {
      setErrorMsg('Unable to connect to the portal service.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) {
    return (
      <main className="min-h-[100dvh] flex items-center justify-center p-6 bg-zinc-50">
        <div className="max-w-md w-full bg-white border border-slate-200/50 rounded-[2rem] p-10 text-center animate-pulse shadow-sm">
          <div className="w-12 h-12 bg-zinc-100 rounded-full mx-auto mb-4" />
          <div className="h-6 bg-zinc-100 rounded-lg w-48 mx-auto mb-2" />
          <div className="h-4 bg-zinc-100 rounded-lg w-64 mx-auto" />
        </div>
      </main>
    );
  }

  if (errorMsg || !context || !token) {
    return (
      <main className="min-h-[100dvh] flex items-center justify-center p-6 bg-zinc-50">
        <div className="max-w-md w-full bg-white border border-slate-200/50 rounded-[2rem] p-10 text-center shadow-[0_20px_40px_-15px_rgba(0,0,0,0.06)]">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-dusty-rose-50 text-dusty-rose-600 flex items-center justify-center">
            <WarningOctagon weight="duotone" className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 mt-6">
            Access unavailable
          </h1>
          <p className="text-sm text-zinc-500 leading-relaxed mt-3">
            {errorMsg || 'This link is invalid or has expired.'}
          </p>
          <Link
            to="/"
            className="inline-block mt-8 text-sm font-semibold text-sage-700 hover:underline"
          >
            Go to the public portal
          </Link>
        </div>
      </main>
    );
  }

  const { grant, request, officer, orgUnit, allowedDataItems, uploads } = context;
  const items = (allowedDataItems || []).map((id: string) => ({
    id,
    label: getDataItem(id)?.label ?? id,
    description: getDataItem(id)?.description ?? '',
    proofFormats: getDataItem(id)?.proofFormats ?? [],
  }));

  const activeSectionItem = formsData?.sections?.find(
    (s) => s.section.id === activeSectionId
  );

  // Overall completion status
  const totalSections = formsData?.sections?.length || 0;
  const completedSections = (formsData?.sections || []).filter(
    (s) => s.submission.status === 'SUBMITTED' || s.submission.status === 'APPROVED' || s.submission.notApplicable
  ).length;

  return (
    <main className="min-h-[100dvh] py-10 px-4 md:px-8 bg-zinc-50/50">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header card */}
        <header className="bg-white border border-slate-200/50 rounded-[2rem] p-8 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-sage-700">
              <ShieldCheck weight="duotone" className="w-4 h-4" />
              Restricted Nodal Officer Portal
            </div>
            <span
              className={`px-3 py-1 rounded-full text-xs font-semibold self-start sm:self-auto ${
                formsData?.targetStatus === 'SUBMITTED'
                  ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-500/20'
                  : formsData?.targetStatus === 'PARTIAL'
                  ? 'bg-soft-gold-50 text-soft-gold-700 ring-1 ring-soft-gold-500/20'
                  : 'bg-zinc-100 text-zinc-600'
              }`}
            >
              Status: {formsData?.targetStatus || 'PENDING'}
            </span>
          </div>

          <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 mt-3">
            {request.title}
          </h1>
          <p className="text-sm text-zinc-500 mt-2 leading-relaxed">
            {request.reference} &middot; {request.framework} {request.cycleYear} &middot; deadline{' '}
            {new Date(request.deadline).toLocaleDateString('en-IN', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </p>

          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6 pt-6 border-t border-slate-100 text-sm">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Nodal officer
              </dt>
              <dd className="text-zinc-900 font-medium mt-1">{officer.name}</dd>
              <dd className="text-zinc-500 text-xs">{officer.email}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Assigned Unit / Department
              </dt>
              <dd className="text-zinc-900 font-medium mt-1">{orgUnit.name}</dd>
              <dd className="text-zinc-500 text-xs">
                {unitBreadcrumb(orgUnit.id).join(' / ') || 'Institute'}
              </dd>
            </div>
          </dl>

          {/* Progress Banner */}
          {totalSections > 0 && (
            <div className="mt-6 pt-6 border-t border-slate-100">
              <div className="flex items-center justify-between text-xs font-medium text-zinc-600 mb-2">
                <span>NIRF Form Completion Progress</span>
                <span className="font-semibold text-zinc-900">
                  {completedSections} of {totalSections} sections submitted ({Math.round((completedSections / totalSections) * 100)}%)
                </span>
              </div>
              <div className="w-full h-2.5 bg-zinc-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-sage-600 rounded-full transition-all duration-500"
                  style={{ width: `${(completedSections / totalSections) * 100}%` }}
                />
              </div>
            </div>
          )}

          <p className="text-xs text-zinc-400 mt-6 leading-relaxed">
            This token is personal, expires on{' '}
            {new Date(grant.expiresAt).toLocaleDateString('en-IN', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
            , and is strictly scoped to {orgUnit.name}.
          </p>
        </header>

        {/* View Tabs */}
        <div className="flex items-center gap-2 border-b border-zinc-200">
          <button
            type="button"
            onClick={() => setActiveTab('forms')}
            className={`px-5 py-3 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'forms'
                ? 'border-sage-600 text-sage-800'
                : 'border-transparent text-zinc-500 hover:text-zinc-800'
            }`}
          >
            <FileText className="w-4 h-4" />
            Structured NIRF Sections ({totalSections})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('proofs')}
            className={`px-5 py-3 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'proofs'
                ? 'border-sage-600 text-sage-800'
                : 'border-transparent text-zinc-500 hover:text-zinc-800'
            }`}
          >
            <Upload className="w-4 h-4" />
            Proof Uploads & Audit Files ({uploads.length})
          </button>
        </div>

        {/* ACTIVE MODAL: FORM RENDERER */}
        {activeSectionItem && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 z-50 overflow-y-auto">
            <div className="w-full max-w-5xl max-h-[92vh] overflow-y-auto rounded-[2rem] my-auto">
              <FormRenderer
                token={token}
                section={activeSectionItem.section}
                initialData={{
                  ...activeSectionItem.submission,
                  records: activeSectionItem.records,
                }}
                cycleYear={formsData?.request?.cycleYear ?? 2027}
                onClose={() => setActiveSectionId(null)}
                onSave={() => loadData()}
                onSubmitSuccess={() => {
                  loadData();
                  setActiveSectionId(null);
                }}
              />
            </div>
          </div>
        )}

        {/* TAB 1: STRUCTURED FORMS LIST */}
        {activeTab === 'forms' && (
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold tracking-tight text-zinc-900">
                  Assigned NIRF Sections
                </h2>
                <p className="text-xs text-zinc-500 mt-1">
                  Click on any section to enter quantitative metrics, review prefilled entries, or upload spreadsheet records.
                </p>
              </div>
            </div>

            {totalSections === 0 ? (
              <div className="bg-white border border-slate-200/50 rounded-[2rem] p-10 text-center">
                <p className="text-zinc-600 font-medium">No NIRF form sections assigned for your unit.</p>
                <p className="text-xs text-zinc-400 mt-1">
                  You may still upload documentary evidence under the Proof Uploads tab.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {formsData?.sections?.map((item) => {
                  const sec = item.section;
                  const sub = item.submission;
                  const isDone = sub.status === 'SUBMITTED' || sub.status === 'APPROVED' || sub.notApplicable;

                  return (
                    <div
                      key={sec.id}
                      className="bg-white border border-slate-200/60 rounded-[2rem] p-6 shadow-sm hover:border-sage-500/30 transition-all flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-3">
                          <span className="text-xs font-semibold px-2 py-0.5 rounded bg-zinc-100 text-zinc-700 font-mono">
                            {sec.id}
                          </span>
                          <span
                            className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${
                              sub.notApplicable
                                ? 'bg-zinc-100 text-zinc-500'
                                : sub.status === 'APPROVED'
                                ? 'bg-emerald-50 text-emerald-700'
                                : sub.status === 'SUBMITTED'
                                ? 'bg-slate-blue-50 text-slate-blue-700'
                                : sub.status === 'CORRECTION_REQUESTED'
                                ? 'bg-dusty-rose-50 text-dusty-rose-700'
                                : 'bg-orange-50 text-orange-700'
                            }`}
                          >
                            {sub.notApplicable ? 'Not Applicable' : sub.status}
                          </span>
                        </div>

                        <h3 className="text-lg font-semibold text-zinc-900">{sec.title}</h3>
                        {sec.description && (
                          <p className="text-xs text-zinc-500 mt-1 line-clamp-2 leading-relaxed">
                            {sec.description}
                          </p>
                        )}

                        {sub.reviewComment && (
                          <div className="mt-3 p-3 rounded-xl bg-dusty-rose-50/70 border border-dusty-rose-200 text-xs text-dusty-rose-900">
                            <span className="font-semibold">Admin feedback: </span>
                            {sub.reviewComment}
                          </div>
                        )}

                        <div className="flex flex-wrap items-center gap-3 mt-4 text-xs text-zinc-500">
                          <span>
                            Scope: {sec.ownership?.submitBy === 'central' ? 'Central Institute' : 'Unit'}
                          </span>
                          <span>&middot;</span>
                          <span>
                            {item.proofUploadsCount > 0 ? (
                              <span className="text-sage-700 font-medium">
                                {item.proofUploadsCount} proof file(s) attached
                              </span>
                            ) : item.proofRequired ? (
                              <span className="text-orange-600 font-medium">Proof required</span>
                            ) : (
                              'Optional proof'
                            )}
                          </span>
                        </div>
                      </div>

                      <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
                        <span className="text-xs text-zinc-400 font-mono">
                          Revision {sub.revision || 1}
                        </span>
                        <button
                          type="button"
                          onClick={() => setActiveSectionId(sec.id)}
                          className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                            isDone
                              ? 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700'
                              : 'bg-sage-600 hover:bg-sage-700 text-white shadow-sm'
                          }`}
                        >
                          {isDone ? 'View Submission' : 'Fill Form'}
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* TAB 2: PROOF UPLOADS & AUDIT INTEGRITY */}
        {activeTab === 'proofs' && (
          <PortalUploaderComponent
            token={token}
            items={items}
            initialUploads={uploads}
            onUploadSuccess={() => loadData()}
          />
        )}
      </div>
    </main>
  );
}

function PortalUploaderComponent({
  token,
  items,
  initialUploads,
  onUploadSuccess,
}: {
  token: string;
  items: { id: string; label: string; description: string; proofFormats: string[] }[];
  initialUploads: ProofUpload[];
  onUploadSuccess?: () => void;
}) {
  const { showToast } = useToast();
  const [uploads, setUploads] = useState<ProofUpload[]>(initialUploads);
  const [files, setFiles] = useState<Record<string, File | null>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busyItem, setBusyItem] = useState<string | null>(null);

  useEffect(() => {
    setUploads(initialUploads);
  }, [initialUploads]);

  const uploadsByItem = useMemo(() => {
    const map = new Map<string, ProofUpload[]>();
    uploads.forEach((upload) => {
      const list = map.get(upload.dataItemId) ?? [];
      list.push(upload);
      map.set(upload.dataItemId, list);
    });
    return map;
  }, [uploads]);

  const completed = items.filter((item) => (uploadsByItem.get(item.id)?.length ?? 0) > 0).length;

  const submit = async (itemId: string) => {
    const file = files[itemId];
    if (!file) {
      showToast('Choose a file to upload for this item.', 'error');
      return;
    }

    setBusyItem(itemId);
    try {
      const body = new FormData();
      body.append('file', file);
      body.append('dataItemId', itemId);
      if (notes[itemId]) body.append('note', notes[itemId]);

      const response = await fetch(`/api/portal/${token}/upload/`, { method: 'POST', body });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? 'The upload failed.');

      setUploads((prev) => [...prev, payload as ProofUpload]);
      setFiles((prev) => ({ ...prev, [itemId]: null }));
      setNotes((prev) => ({ ...prev, [itemId]: '' }));
      showToast('File uploaded and verified with SHA-256 checksum.', 'success');
      if (onUploadSuccess) onUploadSuccess();
    } catch (error) {
      showToast((error as Error).message, 'error');
    } finally {
      setBusyItem(null);
    }
  };

  return (
    <section className="bg-white border border-slate-200/50 rounded-[2rem] p-6 md:p-8 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)]">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-zinc-900">Documentary Evidence</h2>
          <p className="text-sm text-zinc-500 mt-1">
            Upload official proof files per requested item. Files are checksummed (SHA-256) for audit integrity.
          </p>
        </div>
        <span className="px-3 py-1.5 rounded-full bg-sage-50 text-sage-700 text-xs font-semibold ring-1 ring-sage-500/20 shrink-0">
          {completed} of {items.length} items verified
        </span>
      </div>

      <div className="divide-y divide-slate-100">
        {items.map((item) => {
          const itemUploads = uploadsByItem.get(item.id) ?? [];
          const selectedFile = files[item.id];
          const isBusy = busyItem === item.id;

          return (
            <div key={item.id} className="py-6 first:pt-0 last:pb-0 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold text-zinc-900 text-base">{item.label}</h3>
                  <p className="text-xs text-zinc-500 mt-1">{item.description}</p>
                  {item.proofFormats.length > 0 && (
                    <p className="text-[11px] text-zinc-400 mt-1">
                      Accepts: {item.proofFormats.join(', ')}
                    </p>
                  )}
                </div>
                {itemUploads.length > 0 && (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-sage-700 bg-sage-50 px-2.5 py-1 rounded-full ring-1 ring-sage-500/20 shrink-0">
                    <Check weight="bold" className="w-3.5 h-3.5" />
                    {itemUploads.length} uploaded
                  </span>
                )}
              </div>

              {itemUploads.length > 0 && (
                <div className="space-y-2 bg-zinc-50/60 p-3 rounded-xl border border-zinc-100">
                  {itemUploads.map((up) => (
                    <div
                      key={up.id}
                      className="flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-600"
                    >
                      <div className="flex items-center gap-2">
                        <FileArrowUp weight="bold" className="w-4 h-4 text-sage-600 shrink-0" />
                        <span className="font-medium text-zinc-900">{up.fileName}</span>
                        <span className="text-zinc-400 font-mono text-[10px]">
                          sha256:{up.checksum.slice(0, 10)}...
                        </span>
                      </div>
                      <span className="text-zinc-400 text-[11px]">
                        {new Date(up.uploadedAt).toLocaleDateString('en-IN')}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex flex-col sm:flex-row items-center gap-3">
                <input
                  type="file"
                  onChange={(e) => {
                    const f = e.target.files?.[0] || null;
                    setFiles((prev) => ({ ...prev, [item.id]: f }));
                  }}
                  className="w-full text-xs text-zinc-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-zinc-100 file:text-zinc-700 hover:file:bg-zinc-200 cursor-pointer"
                />
                <button
                  type="button"
                  disabled={!selectedFile || isBusy}
                  onClick={() => submit(item.id)}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-zinc-900 hover:bg-black disabled:opacity-50 rounded-xl transition-all shadow-sm shrink-0"
                >
                  {isBusy ? (
                    <>
                      <ArrowsClockwise className="w-3.5 h-3.5 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="w-3.5 h-3.5" />
                      Upload Evidence
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
