"use client";

import React, { useMemo, useState } from 'react';
import {
  CheckCircle,
  FileArrowUp,
  PaperPlaneTilt,
  Upload,
} from '@phosphor-icons/react';

import { useToast } from '@/components/ToastProvider';
import type { ProofUpload } from '@/lib/types';

interface PortalItem {
  id: string;
  label: string;
  description: string;
  proofFormats: string[];
}

export default function PortalUploader({
  token,
  items,
  initialUploads,
}: {
  token: string;
  items: PortalItem[];
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

      const response = await fetch(`/api/portal/${token}/upload`, { method: 'POST', body });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? 'The upload failed.');

      setUploads((prev) => [...prev, payload.upload as ProofUpload]);
      setFiles((prev) => ({ ...prev, [itemId]: null }));
      setNotes((prev) => ({ ...prev, [itemId]: '' }));
      showToast(
        payload.status === 'SUBMITTED'
          ? 'All requested items have been received. Thank you.'
          : 'File uploaded and recorded against your section.',
        'success',
      );
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
            Upload one proof file per item. Files are stored with a SHA-256 checksum for audit.
          </p>
        </div>
        <span className="px-3 py-1.5 rounded-full bg-sage-50 text-sage-700 text-xs font-semibold ring-1 ring-sage-500/20 shrink-0">
          {completed} of {items.length} received
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
              className={`rounded-2xl border p-5 transition-colors ${
                done ? 'border-sage-500/30 bg-sage-50/40' : 'border-slate-200/60 bg-zinc-50/40'
              }`}
            >
              <div className="flex items-start gap-3">
                <span
                  className={`mt-0.5 shrink-0 p-2 rounded-xl ${
                    done ? 'bg-sage-100 text-sage-700' : 'bg-white text-zinc-400 border border-slate-200'
                  }`}
                >
                  {done ? (
                    <CheckCircle weight="fill" className="w-5 h-5" />
                  ) : (
                    <FileArrowUp weight="duotone" className="w-5 h-5" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-zinc-900 text-[15px]">{item.label}</h3>
                  {item.description && (
                    <p className="text-sm text-zinc-500 mt-1 leading-relaxed">{item.description}</p>
                  )}
                  <p className="text-[11px] text-zinc-400 mt-2">
                    Accepted formats: {item.proofFormats.join(', ')} &middot; max 25 MB
                  </p>

                  {itemUploads.length > 0 && (
                    <ul className="mt-3 space-y-1">
                      {itemUploads.map((upload) => (
                        <li key={upload.id} className="text-xs text-sage-800 flex flex-wrap gap-2">
                          <span className="font-medium">{upload.fileName}</span>
                          <span className="text-sage-600/70 font-mono">
                            sha256:{upload.checksum.slice(0, 12)}
                          </span>
                          <span className="text-sage-600/70">
                            {new Date(upload.uploadedAt).toLocaleString('en-IN')}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}

                  <div className="mt-4 grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_auto] gap-3">
                    <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-slate-300 bg-white px-4 py-3 transition hover:border-sage-500 hover:bg-sage-50/40">
                      <Upload className="w-4 h-4 shrink-0 text-zinc-400" aria-hidden="true" />
                      <span className="min-w-0 flex-1 truncate text-sm text-zinc-600">
                        {file?.name ?? 'Choose a file'}
                      </span>
                      <input
                        type="file"
                        accept={item.proofFormats.map((format) => `.${format.toLowerCase()}`).join(',')}
                        onChange={(event) =>
                          setFiles((prev) => ({
                            ...prev,
                            [item.id]: event.target.files?.[0] ?? null,
                          }))
                        }
                        className="sr-only"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => submit(item.id)}
                      disabled={busyItem === item.id || !file}
                      className="px-5 py-3 rounded-xl bg-zinc-900 hover:bg-black text-white text-sm font-semibold transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
                    >
                      <PaperPlaneTilt weight="bold" className="w-4 h-4" />
                      {busyItem === item.id ? 'Uploading...' : 'Upload'}
                    </button>
                  </div>

                  <input
                    value={notes[item.id] ?? ''}
                    onChange={(event) =>
                      setNotes((prev) => ({ ...prev, [item.id]: event.target.value }))
                    }
                    placeholder="Optional note for the DORA office"
                    className="mt-3 w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sage-500/20 focus:border-sage-500/50 transition-all placeholder:text-zinc-400"
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
