import React, { useEffect, useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ShieldCheck,
  WarningOctagon,
  CheckCircle,
  FileArrowUp,
  Upload,
} from '@phosphor-icons/react';
import { useToast } from '../../components/ToastProvider';
import { getDataItem } from '../../lib/data-catalogue';
import { unitBreadcrumb, unitLabel } from '../../lib/organogram';
import type { PortalContext, ProofUpload } from '../../types';

export default function RestrictedPortalPage() {
  const { token } = useParams<{ token: string }>();
  const { showToast } = useToast();
  const [context, setContext] = useState<PortalContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const response = await fetch(`/api/portal/${token}/`);
        const payload = await response.json();
        if (!response.ok) {
          setErrorMsg(payload.error || 'Access unavailable.');
        } else {
          setContext(payload as PortalContext);
        }
      } catch (err) {
        setErrorMsg('Unable to connect to the portal service.');
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  if (loading) {
    return (
      <main className="min-h-[100dvh] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white border border-slate-200/50 rounded-[2rem] p-10 text-center animate-pulse">
          <div className="w-12 h-12 bg-zinc-100 rounded-full mx-auto mb-4" />
          <div className="h-6 bg-zinc-100 rounded-lg w-48 mx-auto mb-2" />
          <div className="h-4 bg-zinc-100 rounded-lg w-64 mx-auto" />
        </div>
      </main>
    );
  }

  if (errorMsg || !context || !token) {
    return (
      <main className="min-h-[100dvh] flex items-center justify-center p-6">
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

  return (
    <main className="min-h-[100dvh] py-10 px-4 md:px-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <header className="bg-white border border-slate-200/50 rounded-[2rem] p-8 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)]">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-sage-700">
            <ShieldCheck weight="duotone" className="w-4 h-4" />
            Restricted upload access
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
                Section
              </dt>
              <dd className="text-zinc-900 font-medium mt-1">{orgUnit.name}</dd>
              <dd className="text-zinc-500 text-xs">
                {unitBreadcrumb(orgUnit.id).join(' / ') || 'Institute'}
              </dd>
            </div>
          </dl>

          <p className="text-xs text-zinc-400 mt-6 leading-relaxed">
            This link is personal, expires on{' '}
            {new Date(grant.expiresAt).toLocaleDateString('en-IN', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
            , and can only be used to upload evidence for the section named above.
          </p>
        </header>

        <PortalUploaderComponent token={token} items={items} initialUploads={uploads} />
      </div>
    </main>
  );
}

function PortalUploaderComponent({
  token,
  items,
  initialUploads,
}: {
  token: string;
  items: { id: string; label: string; description: string; proofFormats: string[] }[];
  initialUploads: ProofUpload[];
}) {
  const { showToast } = useToast();
  const [uploads, setUploads] = useState<ProofUpload[]>(initialUploads);
  const [files, setFiles] = useState<Record<string, File | null>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busyItem, setBusyItem] = useState<string | null>(null);

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
          <h2 className="text-xl font-semibold tracking-tight text-zinc-900">Required data</h2>
          <p className="text-sm text-zinc-500 mt-1">
            Upload proof files per requested item. Files are checksummed (SHA-256) for audit integrity.
          </p>
        </div>
        <span className="px-3 py-1.5 rounded-full bg-sage-50 text-sage-700 text-xs font-semibold ring-1 ring-sage-500/20 shrink-0">
          {completed} of {items.length} completed
        </span>
      </div>

      <div className="space-y-4">
        {items.map((item) => {
          const itemUploads = uploadsByItem.get(item.id) ?? [];
          const done = itemUploads.length > 0;
          const file = files[item.id] ?? null;

          return (
            <div
              key={item.id}
              className={`p-5 rounded-2xl border transition-all ${
                done
                  ? 'bg-sage-50/40 border-sage-200/70'
                  : 'bg-zinc-50/60 border-slate-200/70 hover:border-slate-300'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-semibold text-zinc-900">{item.label}</h3>
                    {done && (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-sage-700 bg-sage-100/80 px-2 py-0.5 rounded-md">
                        <CheckCircle weight="fill" className="w-3.5 h-3.5" /> Received
                      </span>
                    )}
                  </div>
                  {item.description && (
                    <p className="text-xs text-zinc-500 leading-relaxed">{item.description}</p>
                  )}
                  {item.proofFormats.length > 0 && (
                    <p className="text-[11px] text-zinc-400">
                      Accepted: {item.proofFormats.join(', ')} (Max 25 MB)
                    </p>
                  )}
                </div>
              </div>

              {itemUploads.length > 0 && (
                <div className="mt-4 pt-3 border-t border-slate-200/50 space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                    Uploaded evidence:
                  </p>
                  {itemUploads.map((up) => (
                    <div
                      key={up.id}
                      className="flex items-center justify-between text-xs bg-white p-2.5 rounded-xl border border-slate-200/70"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <FileArrowUp weight="duotone" className="w-4 h-4 text-sage-600 shrink-0" />
                        <span className="font-medium text-zinc-800 truncate">{up.fileName}</span>
                        <span className="text-zinc-400">({(up.size / 1024).toFixed(1)} KB)</span>
                      </div>
                      <span className="text-[10px] font-mono text-zinc-400 shrink-0">
                        SHA: {up.checksum.slice(0, 8)}...
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-4 flex flex-col sm:flex-row items-center gap-3">
                <label className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-zinc-100 border border-slate-200 rounded-xl text-xs font-semibold text-zinc-700 cursor-pointer shadow-sm transition-colors">
                  <Upload weight="bold" className="w-3.5 h-3.5" />
                  {file ? file.name : done ? 'Upload updated version' : 'Choose file'}
                  <input
                    type="file"
                    className="sr-only"
                    accept=".pdf,.xlsx,.csv,.docx"
                    onChange={(e) => {
                      const f = e.target.files?.[0] || null;
                      setFiles((prev) => ({ ...prev, [item.id]: f }));
                    }}
                  />
                </label>

                <input
                  type="text"
                  placeholder="Optional note for DORA..."
                  value={notes[item.id] || ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    setNotes((prev) => ({ ...prev, [item.id]: val }));
                  }}
                  className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs outline-none focus:border-sage-500 text-zinc-800 placeholder:text-zinc-400"
                />

                {file && (
                  <button
                    type="button"
                    disabled={busyItem === item.id}
                    onClick={() => submit(item.id)}
                    className="px-4 py-2 bg-sage-600 hover:bg-sage-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-sm transition-all shrink-0"
                  >
                    {busyItem === item.id ? 'Uploading...' : 'Submit Evidence'}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
