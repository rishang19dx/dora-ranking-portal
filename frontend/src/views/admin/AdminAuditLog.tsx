import React, { useEffect, useState } from 'react';
import { MagnifyingGlass, DownloadSimple, ShieldCheck, CaretDown, CaretRight } from '@phosphor-icons/react';
import { auditService, type AuditLogFilters } from '../../services/api';
import { useToast } from '../../components/ToastProvider';
import type { AuditChange, AuditLogEntry, AuditLogResponse } from '../../types';

const PAGE_SIZE = 50;

const ACTION_STYLES: Record<string, string> = {
  APPROVE: 'bg-sage-50 text-sage-700',
  REJECT: 'bg-dusty-rose-50 text-dusty-rose-700',
  REQUEST_CORRECTION: 'bg-amber-50 text-amber-700',
  EXPORT: 'bg-slate-blue-50 text-slate-blue-700',
};

function display(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

/**
 * The auditor's view onto the immutable audit trail (spec 2.11): filter,
 * search and export every create, edit, approve, reject and export action,
 * with old and new values. Personal fields arrive already redacted.
 */
export default function AdminAuditLog() {
  const { showToast } = useToast();
  const [filters, setFilters] = useState<AuditLogFilters>({ page: 1, pageSize: PAGE_SIZE });
  const [search, setSearch] = useState('');
  const [data, setData] = useState<AuditLogResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await auditService.list(filters);
        if (!cancelled) setData(res);
      } catch (err: any) {
        if (!cancelled) {
          const status = err?.response?.status;
          showToast(status === 403 ? 'The audit log is restricted to Admin, Director and Auditor roles.'
            : err?.response?.data?.error ?? 'Could not load the audit log.', 'error');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [filters]);

  const update = (patch: AuditLogFilters) => setFilters((f) => ({ ...f, ...patch, page: 1 }));

  const handleExport = async () => {
    try {
      setExporting(true);
      await auditService.exportCsv(filters);
      showToast('Audit log exported.', 'success');
    } catch {
      showToast('Export failed.', 'error');
    } finally {
      setExporting(false);
    }
  };

  const pages = data ? Math.max(1, Math.ceil(data.count / (data.pageSize || PAGE_SIZE))) : 1;

  return (
    <div className="max-w-[1400px] mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-zinc-900">Audit Log</h1>
          <p className="text-zinc-500 mt-2 max-w-[70ch] text-sm leading-relaxed">
            Every create, edit, approval, rejection and export, with the old and new value, actor and time.
            Entries are immutable. Personal fields are redacted.
          </p>
        </div>
        <button
          onClick={handleExport}
          disabled={exporting}
          className="inline-flex items-center gap-2 bg-zinc-900 hover:bg-black disabled:opacity-60 text-white px-4 py-2.5 rounded-xl text-sm font-medium"
        >
          <DownloadSimple className="w-4 h-4" />
          {exporting ? 'Exporting…' : 'Export CSV'}
        </button>
      </div>

      <div className="bg-white border border-slate-200/60 rounded-2xl p-4 grid grid-cols-1 md:grid-cols-6 gap-3">
        <form
          className="md:col-span-2 relative"
          onSubmit={(e) => { e.preventDefault(); update({ q: search.trim() || undefined }); }}
        >
          <MagnifyingGlass className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            aria-label="Search the audit log"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search values, comments, sections…"
            className="w-full pl-9 pr-3 py-2 text-sm border border-zinc-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-sage-500"
          />
        </form>
        <select
          aria-label="Action"
          value={filters.action ?? ''}
          onChange={(e) => update({ action: e.target.value || undefined })}
          className="px-3 py-2 text-sm border border-zinc-200 rounded-xl bg-white"
        >
          <option value="">All actions</option>
          {(data?.actions ?? []).map((a) => <option key={a} value={a}>{a.replace(/_/g, ' ')}</option>)}
        </select>
        <select
          aria-label="Actor type"
          value={filters.actorType ?? ''}
          onChange={(e) => update({ actorType: e.target.value || undefined })}
          className="px-3 py-2 text-sm border border-zinc-200 rounded-xl bg-white"
        >
          <option value="">All actors</option>
          <option value="OFFICER">Nodal officers</option>
          <option value="ADMIN">DORA staff</option>
          <option value="SYSTEM">System</option>
        </select>
        <input
          aria-label="From date"
          type="date"
          value={filters.from ?? ''}
          onChange={(e) => update({ from: e.target.value || undefined })}
          className="px-3 py-2 text-sm border border-zinc-200 rounded-xl"
        />
        <input
          aria-label="To date"
          type="date"
          value={filters.to ?? ''}
          onChange={(e) => update({ to: e.target.value || undefined })}
          className="px-3 py-2 text-sm border border-zinc-200 rounded-xl"
        />
      </div>

      <div className="bg-white border border-slate-200/60 rounded-2xl overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 text-xs text-zinc-500 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-sage-600" />
          {loading ? 'Loading…' : `${data?.count ?? 0} entr${data?.count === 1 ? 'y' : 'ies'}`}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50/80 text-[11px] uppercase tracking-wider text-zinc-500">
              <tr>
                <th className="py-2.5 px-4 w-8" />
                <th className="py-2.5 px-4">When</th>
                <th className="py-2.5 px-4">Action</th>
                <th className="py-2.5 px-4">Actor</th>
                <th className="py-2.5 px-4">Section</th>
                <th className="py-2.5 px-4">Unit</th>
                <th className="py-2.5 px-4">Detail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(data?.results ?? []).map((row) => (
                <AuditRow
                  key={row.id}
                  row={row}
                  open={expanded === row.id}
                  onToggle={() => setExpanded(expanded === row.id ? null : row.id)}
                />
              ))}
              {!loading && !data?.results?.length && (
                <tr><td colSpan={7} className="py-10 text-center text-zinc-400 text-sm">No entries match these filters.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        {pages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 text-xs text-zinc-600">
            <span>Page {data?.page} of {pages}</span>
            <div className="flex gap-2">
              <button
                disabled={(filters.page ?? 1) <= 1}
                onClick={() => setFilters((f) => ({ ...f, page: (f.page ?? 1) - 1 }))}
                className="px-3 py-1.5 rounded-lg border border-zinc-200 disabled:opacity-40"
              >Previous</button>
              <button
                disabled={(filters.page ?? 1) >= pages}
                onClick={() => setFilters((f) => ({ ...f, page: (f.page ?? 1) + 1 }))}
                className="px-3 py-1.5 rounded-lg border border-zinc-200 disabled:opacity-40"
              >Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function summary(row: AuditLogEntry): string {
  const d = row.delta || {};
  if (row.action === 'EXPORT') return `${d.kind ?? 'export'}${d.category ? ` · ${d.category}` : ''}`;
  if (d.fromStatus && d.toStatus) return `${d.fromStatus} → ${d.toStatus}${d.comment ? ` · “${d.comment}”` : ''}`;
  if (row.action === 'IMPORT') return `${d.createdCount ?? 0} created · ${d.updatedCount ?? 0} updated · ${d.errorCount ?? 0} flagged`;
  if (row.changeCount) return `${row.changeCount} value change${row.changeCount === 1 ? '' : 's'}`;
  return d.comment ?? '';
}

function AuditRow({ row, open, onToggle }: { row: AuditLogEntry; open: boolean; onToggle: () => void }) {
  const changes: AuditChange[] = row.delta?.changes ?? [];
  const records = row.delta?.records ?? [];
  const expandable = changes.length > 0 || records.length > 0 || row.action === 'EXPORT';
  return (
    <>
      <tr className="hover:bg-zinc-50/60 align-top">
        <td className="py-2.5 px-4">
          {expandable && (
            <button onClick={onToggle} aria-label={open ? 'Collapse' : 'Expand'} className="text-zinc-400 hover:text-zinc-700">
              {open ? <CaretDown className="w-4 h-4" /> : <CaretRight className="w-4 h-4" />}
            </button>
          )}
        </td>
        <td className="py-2.5 px-4 whitespace-nowrap text-xs text-zinc-600">
          {new Date(row.timestamp).toLocaleString('en-IN')}
        </td>
        <td className="py-2.5 px-4">
          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-md ${ACTION_STYLES[row.action] ?? 'bg-zinc-100 text-zinc-700'}`}>
            {row.action.replace(/_/g, ' ')}
          </span>
        </td>
        <td className="py-2.5 px-4 text-xs">
          <div className="font-medium text-zinc-900">{row.actorName ?? row.actorId}</div>
          <div className="text-zinc-400">{row.actorType}</div>
        </td>
        <td className="py-2.5 px-4 text-xs text-zinc-700">{row.sectionId ?? '—'}</td>
        <td className="py-2.5 px-4 text-xs text-zinc-700">{row.unitName ?? '—'}</td>
        <td className="py-2.5 px-4 text-xs text-zinc-600 max-w-[360px]">{summary(row)}</td>
      </tr>
      {open && (
        <tr className="bg-zinc-50/50">
          <td />
          <td colSpan={6} className="py-3 px-4">
            {row.action === 'EXPORT' && (
              <div className="text-xs text-zinc-600 font-mono break-all">SHA-256 {row.delta.sha256}</div>
            )}
            {changes.length > 0 && <ChangeTable changes={changes} />}
            {records.map((rec, i) => (
              <div key={i} className="mt-2">
                <div className="text-[11px] font-semibold text-zinc-500 mb-1">
                  Record {rec.rowKey} {rec.created ? '(new)' : '(updated)'}
                </div>
                <ChangeTable changes={rec.changes} />
              </div>
            ))}
            {row.delta?.truncated && (
              <div className="text-[11px] text-zinc-500 mt-2">
                Showing the first {changes.length} of {row.changeCount} changes.
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

function ChangeTable({ changes }: { changes: AuditChange[] }) {
  return (
    <table className="w-full text-xs">
      <thead className="text-zinc-500">
        <tr>
          <th className="text-left py-1 pr-3 font-medium">Field</th>
          <th className="text-left py-1 pr-3 font-medium">Old</th>
          <th className="text-left py-1 font-medium">New</th>
        </tr>
      </thead>
      <tbody>
        {changes.map((c, i) => (
          <tr key={i} className="border-t border-slate-100">
            <td className="py-1 pr-3 text-zinc-700">
              {[c.block, c.row, c.field].filter(Boolean).join(' / ')}
            </td>
            <td className="py-1 pr-3 text-dusty-rose-700 font-mono">{display(c.old)}</td>
            <td className="py-1 text-sage-700 font-mono">{display(c.new)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
