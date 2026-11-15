import React, { useEffect, useState } from 'react';
import { MagnifyingGlass, DownloadSimple, Files } from '@phosphor-icons/react';
import { proofService, type ProofFilters } from '../../services/api';
import { useToast } from '../../components/ToastProvider';
import type { ProofRepositoryResponse } from '../../types';

const PAGE_SIZE = 50;

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

/**
 * Centralised, searchable repository of every proof departments uploaded
 * (spec 2.4). Corrected files are kept as new versions, never overwritten,
 * so the full history behind a figure stays available to the auditor.
 */
export default function AdminProofRepository() {
  const { showToast } = useToast();
  const [filters, setFilters] = useState<ProofFilters>({ page: 1, pageSize: PAGE_SIZE });
  const [search, setSearch] = useState('');
  const [data, setData] = useState<ProofRepositoryResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await proofService.list(filters);
        if (!cancelled) setData(res);
      } catch (err: any) {
        if (!cancelled) {
          showToast(err?.response?.status === 403
            ? 'The proof repository is restricted to Admin, Director and Auditor roles.'
            : 'Could not load the proof repository.', 'error');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [filters]);

  const update = (patch: ProofFilters) => setFilters((f) => ({ ...f, ...patch, page: 1 }));
  const pages = data ? Math.max(1, Math.ceil(data.count / (data.pageSize || PAGE_SIZE))) : 1;

  return (
    <div className="max-w-[1400px] mx-auto space-y-6">
      <div>
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-zinc-900">Proof Repository</h1>
        <p className="text-zinc-500 mt-2 max-w-[70ch] text-sm leading-relaxed">
          Every document departments submitted as evidence, with the sections it supports. Corrected
          files are kept as new versions; downloads are verified against the stored checksum.
        </p>
      </div>

      <div className="bg-white border border-slate-200/60 rounded-2xl p-4 flex flex-col md:flex-row gap-3 md:items-center">
        <form
          className="relative flex-1"
          onSubmit={(e) => { e.preventDefault(); update({ q: search.trim() || undefined }); }}
        >
          <MagnifyingGlass className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            aria-label="Search proofs"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="File name, note, unit, request reference or checksum…"
            className="w-full pl-9 pr-3 py-2 text-sm border border-zinc-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-sage-500"
          />
        </form>
        <label className="inline-flex items-center gap-2 text-sm text-zinc-700">
          <input
            type="checkbox"
            checked={Boolean(filters.latestOnly)}
            onChange={(e) => update({ latestOnly: e.target.checked || undefined })}
          />
          Current versions only
        </label>
      </div>

      <div className="bg-white border border-slate-200/60 rounded-2xl overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 text-xs text-zinc-500 flex items-center gap-2">
          <Files className="w-4 h-4 text-sage-600" />
          {loading ? 'Loading…' : `${data?.count ?? 0} document${data?.count === 1 ? '' : 's'}`}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50/80 text-[11px] uppercase tracking-wider text-zinc-500">
              <tr>
                <th className="py-2.5 px-4">Document</th>
                <th className="py-2.5 px-4">Evidence for</th>
                <th className="py-2.5 px-4">Unit</th>
                <th className="py-2.5 px-4">Request</th>
                <th className="py-2.5 px-4">Version</th>
                <th className="py-2.5 px-4">Uploaded</th>
                <th className="py-2.5 px-4" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(data?.results ?? []).map((p) => (
                <tr key={p.id} className="hover:bg-zinc-50/60 align-top">
                  <td className="py-2.5 px-4">
                    <div className="font-medium text-zinc-900">{p.fileName}</div>
                    <div className="text-[11px] text-zinc-500">
                      {formatSize(p.size)}{p.note ? ` · “${p.note}”` : ''}
                    </div>
                    <div className="text-[10px] text-zinc-400 font-mono truncate max-w-[220px]" title={p.checksum}>
                      sha256 {p.checksum.slice(0, 16)}…
                    </div>
                  </td>
                  <td className="py-2.5 px-4 text-xs text-zinc-700">
                    <div className="font-medium">{p.dataItemId}</div>
                    {(p.sections ?? []).map((s) => (
                      <div key={s.sectionId} className="text-zinc-500">{s.title}</div>
                    ))}
                  </td>
                  <td className="py-2.5 px-4 text-xs text-zinc-700">{p.unitName ?? p.unitId}</td>
                  <td className="py-2.5 px-4 text-xs text-zinc-700">
                    {p.requestReference ?? p.requestId}
                    {p.cycleYear ? <div className="text-zinc-400">Cycle {p.cycleYear}</div> : null}
                  </td>
                  <td className="py-2.5 px-4">
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-md ${
                      p.isLatest ? 'bg-sage-50 text-sage-700' : 'bg-zinc-100 text-zinc-500'
                    }`}>
                      v{p.version} of {p.versionCount}{p.isLatest ? ' · current' : ''}
                    </span>
                  </td>
                  <td className="py-2.5 px-4 text-xs text-zinc-600 whitespace-nowrap">
                    {new Date(p.uploadedAt).toLocaleString('en-IN')}
                    {p.uploadedBy ? <div className="text-zinc-400">{p.uploadedBy}</div> : null}
                  </td>
                  <td className="py-2.5 px-4">
                    <button
                      aria-label={`Download ${p.fileName}`}
                      onClick={() => proofService.download(p.id, p.fileName).catch(() =>
                        showToast('Download failed: the file may be missing or fail its integrity check.', 'error'))}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-sage-700 hover:underline"
                    >
                      <DownloadSimple className="w-3.5 h-3.5" /> Download
                    </button>
                  </td>
                </tr>
              ))}
              {!loading && !data?.results?.length && (
                <tr><td colSpan={7} className="py-10 text-center text-zinc-400 text-sm">No documents match.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        {pages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 text-xs text-zinc-600">
            <span>Page {data?.page} of {pages}</span>
            <div className="flex gap-2">
              <button disabled={(filters.page ?? 1) <= 1}
                onClick={() => setFilters((f) => ({ ...f, page: (f.page ?? 1) - 1 }))}
                className="px-3 py-1.5 rounded-lg border border-zinc-200 disabled:opacity-40">Previous</button>
              <button disabled={(filters.page ?? 1) >= pages}
                onClick={() => setFilters((f) => ({ ...f, page: (f.page ?? 1) + 1 }))}
                className="px-3 py-1.5 rounded-lg border border-zinc-200 disabled:opacity-40">Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
