import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowsClockwise, Robot, WarningOctagon, Warning, Info, CheckCircle } from '@phosphor-icons/react';
import {
  authService,
  discrepancyService,
  type AIRequestLogEntry,
  type DiscrepancyFlagView,
  type DiscrepancyListResponse,
} from '../../services/api';
import { useToast } from '../../components/ToastProvider';
import { canWriteNow, hasRole } from '../../lib/rbac';

const SEVERITY_STYLE: Record<DiscrepancyFlagView['severity'], string> = {
  CRITICAL: 'bg-dusty-rose-50 text-dusty-rose-800 ring-dusty-rose-500/30',
  WARNING: 'bg-orange-50 text-orange-800 ring-orange-400/30',
  INFO: 'bg-zinc-100 text-zinc-600 ring-zinc-300/40',
};

const SEVERITY_ICON = {
  CRITICAL: <WarningOctagon weight="fill" className="w-3.5 h-3.5" />,
  WARNING: <Warning weight="fill" className="w-3.5 h-3.5" />,
  INFO: <Info weight="fill" className="w-3.5 h-3.5" />,
};

const KIND_LABEL: Record<DiscrepancyFlagView['kind'], string> = {
  YOY_CHANGE: 'Year-on-year move',
  RESTATEMENT: 'Restated year',
  RECORD_COUNT: 'Record count',
  CROSS_CHECK: 'Cross-check',
};

const STATUS_FILTERS = ['OPEN', 'ESCALATED', 'DISMISSED', 'RESOLVED', 'ALL'] as const;

function errorText(err: any, fallback: string) {
  return err?.response?.data?.error ?? fallback;
}

/**
 * Discrepancy review (spec 2.9). Rule-based flags compare each return with the
 * department's previously approved figures; the optional AI review adds a
 * second opinion and a question for the department, never new numbers.
 */
export default function AdminDiscrepancies() {
  const { showToast } = useToast();
  const writable = canWriteNow();
  const canSeeAiLog = hasRole(authService.getCurrentUser(), ['ADMIN', 'AUDITOR']);
  const [data, setData] = useState<DiscrepancyListResponse | null>(null);
  const [requestId, setRequestId] = useState<string | undefined>();
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_FILTERS)[number]>('OPEN');
  const [busy, setBusy] = useState(false);
  const [noteFor, setNoteFor] = useState<{ flag: DiscrepancyFlagView; action: 'dismiss' | 'escalate' } | null>(null);
  const [note, setNote] = useState('');
  const [tab, setTab] = useState<'flags' | 'ai-log'>('flags');
  const [aiLog, setAiLog] = useState<AIRequestLogEntry[] | null>(null);

  const load = async (id?: string) => {
    try {
      const res = await discrepancyService.list(id);
      setData(res);
      if (!id && res.requestId) setRequestId(res.requestId);
    } catch {
      showToast('Could not load discrepancy flags.', 'error');
    }
  };

  useEffect(() => { load(requestId); }, [requestId]);

  useEffect(() => {
    if (tab === 'ai-log' && aiLog === null) {
      discrepancyService.aiLog().then(setAiLog).catch(() => setAiLog([]));
    }
  }, [tab, aiLog]);

  const scan = async (useAi: boolean) => {
    if (!data?.requestId) return;
    setBusy(true);
    try {
      const res = await discrepancyService.scan(data.requestId, useAi);
      const s = res.scan;
      let msg = `Scan complete: ${s.opened} new, ${s.reopened} reopened, ${s.resolved} resolved.`;
      if (res.ai) msg += ` ${res.ai.message ?? ''}`;
      showToast(msg, res.ai?.error ? 'info' : 'success');
      setAiLog(null);
      await load(data.requestId);
    } catch (err) {
      showToast(errorText(err, 'The scan could not be run.'), 'error');
    } finally {
      setBusy(false);
    }
  };

  const act = async (flag: DiscrepancyFlagView, action: 'dismiss' | 'escalate' | 'reopen', text = '') => {
    try {
      const updated = await discrepancyService.act(flag.id, action, text);
      setData((d) => d && { ...d, flags: d.flags.map((f) => (f.id === updated.id ? updated : f)) });
      showToast(
        action === 'escalate' ? 'Correction request sent to the department.'
          : action === 'dismiss' ? 'Flag dismissed with your note.' : 'Flag reopened.',
        'success',
      );
      setNoteFor(null);
      setNote('');
    } catch (err) {
      showToast(errorText(err, 'Could not update the flag.'), 'error');
    }
  };

  const flags = (data?.flags ?? []).filter((f) => statusFilter === 'ALL' || f.status === statusFilter);
  const ai = data?.ai;

  return (
    <div className="max-w-[1400px] mx-auto space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-zinc-900">Discrepancy Flags</h1>
          <p className="text-zinc-500 mt-2 max-w-[75ch] text-sm leading-relaxed">
            Figures that moved sharply against the department&rsquo;s previously approved return, years that were
            restated, and failed cross-checks. Rules raise every flag; AI review, when configured, only adds an
            opinion and a question to ask, and never changes a figure.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <select
            aria-label="Data request"
            value={data?.requestId ?? ''}
            onChange={(e) => setRequestId(e.target.value)}
            className="px-3 py-2 text-sm border border-zinc-200 rounded-xl bg-white max-w-xs"
          >
            {(data?.requests ?? []).map((r) => (
              <option key={r.id} value={r.id}>{r.reference} · {r.title}</option>
            ))}
          </select>
          {writable && (
            <>
              <button
                onClick={() => scan(false)}
                disabled={busy || !data?.requestId}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-zinc-200 bg-white text-sm font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
              >
                <ArrowsClockwise weight="bold" className="w-4 h-4" /> Re-scan
              </button>
              <button
                onClick={() => scan(true)}
                disabled={busy || !data?.requestId || !ai?.configured}
                title={ai?.configured ? `Review open flags with ${ai.model}` : ai?.reason}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-900 text-white text-sm font-semibold hover:bg-black disabled:opacity-40"
              >
                <Robot weight="bold" className="w-4 h-4" /> Scan + AI review
              </button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          ['Open critical', data?.summary.openCritical, 'text-dusty-rose-700'],
          ['Open warnings', data?.summary.openWarning, 'text-orange-700'],
          ['With department', data?.summary.escalated, 'text-slate-blue-700'],
          ['Dismissed', data?.summary.dismissed, 'text-zinc-600'],
          ['Resolved', data?.summary.resolved, 'text-sage-700'],
        ].map(([label, value, tone]) => (
          <div key={label as string} className="bg-white border border-slate-200/60 rounded-2xl p-4">
            <p className="text-xs text-zinc-500">{label}</p>
            <p className={`text-2xl font-semibold mt-1 ${tone}`}>{value ?? '–'}</p>
          </div>
        ))}
      </div>

      <p className="text-xs text-zinc-500 flex items-center gap-1.5" data-testid="ai-status">
        <Robot className="w-4 h-4" />
        {ai?.configured
          ? <>AI review available via <strong>{ai.provider}</strong> ({ai.model}). Only aggregated figures are sent; every call is logged.</>
          : <>AI review is off ({ai?.reason ?? 'not configured'}). Rule-based flags work without it.</>}
      </p>

      <div className="flex gap-2 border-b border-slate-200">
        <button onClick={() => setTab('flags')} className={`px-3 py-2 text-sm font-semibold ${tab === 'flags' ? 'text-sage-700 border-b-2 border-sage-600' : 'text-zinc-500'}`}>
          Flags
        </button>
        {canSeeAiLog && (
          <button onClick={() => setTab('ai-log')} className={`px-3 py-2 text-sm font-semibold ${tab === 'ai-log' ? 'text-sage-700 border-b-2 border-sage-600' : 'text-zinc-500'}`}>
            AI request log
          </button>
        )}
      </div>

      {tab === 'flags' && (
        <>
          <div className="flex gap-1.5" role="group" aria-label="Status filter">
            {STATUS_FILTERS.map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${statusFilter === s ? 'bg-zinc-900 text-white' : 'bg-white border border-zinc-200 text-zinc-600'}`}
              >
                {s.charAt(0) + s.slice(1).toLowerCase()}
              </button>
            ))}
          </div>

          {flags.length === 0 ? (
            <div className="bg-white border border-dashed border-zinc-200 rounded-2xl p-10 text-center text-sm text-zinc-500">
              <CheckCircle className="w-7 h-7 mx-auto mb-2 text-sage-500" />
              No {statusFilter === 'ALL' ? '' : statusFilter.toLowerCase()} flags for this request.
            </div>
          ) : (
            <div className="space-y-3">
              {flags.map((f) => (
                <article key={f.id} className="bg-white border border-slate-200/60 rounded-2xl p-4" aria-label={f.label}>
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md ring-1 text-[11px] font-bold ${SEVERITY_STYLE[f.severity]}`}>
                          {SEVERITY_ICON[f.severity]} {f.severity}
                        </span>
                        <span className="text-[11px] uppercase tracking-wider text-zinc-400">{KIND_LABEL[f.kind]}</span>
                        {f.unitName && <span className="text-xs font-semibold text-zinc-700">{f.unitName}</span>}
                        {f.status !== 'OPEN' && (
                          <span className="text-[11px] px-2 py-0.5 rounded bg-zinc-100 text-zinc-600">{f.status.toLowerCase()}</span>
                        )}
                      </div>
                      <h3 className="text-sm font-semibold text-zinc-900 mt-1.5">{f.label}</h3>
                      <p className="text-sm text-zinc-600 mt-0.5">{f.message}</p>
                      {(f.previous || f.current) && (
                        <p className="text-xs text-zinc-500 mt-1 font-mono">
                          {f.previous || '—'} → {f.current || '—'}
                          {f.changePct !== null && ` (${f.changePct > 0 ? '+' : ''}${f.changePct}%)`}
                        </p>
                      )}
                      {f.ai && (
                        <div className="mt-2 p-2.5 rounded-xl bg-slate-blue-50/60 border border-slate-blue-500/15 text-xs text-zinc-700" data-testid="ai-note">
                          <span className="font-semibold text-slate-blue-800">AI review ({f.ai.model}) · {f.ai.severity}: </span>
                          {f.ai.rationale}
                          {f.ai.question && <div className="mt-1 italic">Ask: {f.ai.question}</div>}
                        </div>
                      )}
                      {f.resolutionNote && f.status !== 'OPEN' && (
                        <p className="text-xs text-zinc-500 mt-1.5">
                          {f.resolvedBy ? `${f.resolvedBy}: ` : ''}{f.resolutionNote}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2 shrink-0">
                      {f.submissionId && (
                        <Link to={`/admin/data-requests/${f.requestId}`} className="px-3 py-1.5 rounded-lg border border-zinc-200 text-xs font-semibold text-zinc-600 hover:bg-zinc-50">
                          Open return
                        </Link>
                      )}
                      {writable && f.status === 'OPEN' && (
                        <>
                          {f.submissionId && (
                            <button onClick={() => { setNoteFor({ flag: f, action: 'escalate' }); setNote(f.ai?.question ?? ''); }}
                              className="px-3 py-1.5 rounded-lg bg-dusty-rose-700 text-white text-xs font-semibold hover:bg-dusty-rose-800">
                              Ask department
                            </button>
                          )}
                          <button onClick={() => { setNoteFor({ flag: f, action: 'dismiss' }); setNote(''); }}
                            className="px-3 py-1.5 rounded-lg bg-zinc-100 text-zinc-700 text-xs font-semibold hover:bg-zinc-200">
                            Dismiss
                          </button>
                        </>
                      )}
                      {writable && (f.status === 'DISMISSED' || f.status === 'RESOLVED') && (
                        <button onClick={() => act(f, 'reopen')} className="px-3 py-1.5 rounded-lg bg-zinc-100 text-zinc-700 text-xs font-semibold">
                          Reopen
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </>
      )}

      {tab === 'ai-log' && (
        <div className="bg-white border border-slate-200/60 rounded-2xl overflow-x-auto">
          {aiLog === null ? (
            <p className="p-6 text-sm text-zinc-400">Loading…</p>
          ) : aiLog.length === 0 ? (
            <p className="p-6 text-sm text-zinc-500">No AI requests have been made.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wider text-zinc-500">
                <tr>
                  <th className="px-4 py-2">When</th><th className="px-4 py-2">Model</th><th className="px-4 py-2">By</th>
                  <th className="px-4 py-2">Result</th><th className="px-4 py-2">Prompt</th>
                </tr>
              </thead>
              <tbody>
                {aiLog.map((l) => (
                  <tr key={l.id} className="border-t border-slate-100 align-top">
                    <td className="px-4 py-2 text-xs text-zinc-500">{new Date(l.createdAt).toLocaleString('en-IN')}</td>
                    <td className="px-4 py-2 text-xs">{l.provider} · {l.model}<div className="text-zinc-400">{l.latencyMs} ms</div></td>
                    <td className="px-4 py-2 text-xs">{l.triggeredBy ?? '—'}</td>
                    <td className="px-4 py-2 text-xs">
                      <span className={l.status === 'OK' ? 'text-sage-700 font-semibold' : 'text-dusty-rose-700 font-semibold'}>{l.status}</span>
                      {' '}· {l.flagsAnnotated}/{l.flagsSent} annotated, {l.itemsRejected} rejected
                      {l.error && <div className="text-zinc-500 mt-0.5 max-w-md break-words">{l.error}</div>}
                    </td>
                    <td className="px-4 py-2 text-xs">
                      <details>
                        <summary className="cursor-pointer text-sage-700">sha256 {l.promptSha256.slice(0, 12)}…</summary>
                        <pre className="mt-1 max-w-xl max-h-64 overflow-auto bg-zinc-50 p-2 rounded text-[10px]">{JSON.stringify(l.prompt, null, 2)}</pre>
                        <pre className="mt-1 max-w-xl max-h-40 overflow-auto bg-zinc-50 p-2 rounded text-[10px]">{l.response || '(no response)'}</pre>
                      </details>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {noteFor && (
        <div className="fixed inset-0 z-50 bg-zinc-950/30 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Flag note">
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full space-y-3">
            <h2 className="text-lg font-semibold text-zinc-900">
              {noteFor.action === 'escalate' ? 'Ask the department to correct or confirm' : 'Dismiss this flag'}
            </h2>
            <p className="text-sm text-zinc-500">{noteFor.flag.label}: {noteFor.flag.message}</p>
            <textarea
              aria-label="Note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder={noteFor.action === 'escalate' ? 'Message to the nodal officer (defaults to the finding)' : 'Why the figure is acceptable (kept for the auditor)'}
              className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-xl"
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setNoteFor(null)} className="px-4 py-2 text-sm rounded-xl border border-zinc-200">Cancel</button>
              <button
                onClick={() => act(noteFor.flag, noteFor.action, note)}
                className="px-4 py-2 text-sm rounded-xl bg-zinc-900 text-white font-semibold"
              >
                {noteFor.action === 'escalate' ? 'Send correction request' : 'Dismiss'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
