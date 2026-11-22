import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BellRinging, PauseCircle, PlayCircle, Eye, PaperPlaneTilt, Warning } from '@phosphor-icons/react';
import {
  reminderService,
  type ReminderRunReport,
  type ReminderScheduleResponse,
  type ReminderTimelineEntry,
} from '../../services/api';
import { useToast } from '../../components/ToastProvider';
import { canWriteNow } from '../../lib/rbac';

const STATE_STYLE: Record<ReminderTimelineEntry['state'], string> = {
  SENT: 'bg-sage-50 text-sage-800 ring-sage-500/20',
  SKIPPED: 'bg-zinc-100 text-zinc-500 ring-zinc-300/40',
  UPCOMING: 'bg-white text-slate-blue-700 ring-slate-blue-500/20',
  DUE: 'bg-orange-50 text-orange-700 ring-orange-400/30',
};

function milestoneLabel(key: string): string {
  if (key.startsWith('T-')) return `${key.slice(2)}d before`;
  if (key.startsWith('OVERDUE-')) return `Overdue #${key.slice(8)}`;
  return key;
}

function fmt(date: string) {
  return new Date(date).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

/**
 * Deadline-driven reminder schedule (spec 2.5). Every open request shows its
 * milestones and what happened at each; the scheduler itself runs hourly
 * (`manage.py send_reminders`), and an admin can preview or run it now.
 */
export default function AdminReminders() {
  const { showToast } = useToast();
  const writable = canWriteNow();
  const [data, setData] = useState<ReminderScheduleResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState<ReminderRunReport | null>(null);
  const [running, setRunning] = useState(false);

  const load = async () => {
    try {
      setData(await reminderService.schedule());
    } catch {
      showToast('Could not load the reminder schedule.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const run = async (dryRun: boolean) => {
    setRunning(true);
    try {
      const res = await reminderService.run(dryRun);
      setReport(res);
      showToast(
        dryRun
          ? `${res.sent.length} reminder(s) are due now.`
          : `${res.sent.length} reminder(s) sent, ${res.skipped.length} skipped.`,
        'success',
      );
      if (!dryRun) await load();
    } catch {
      showToast('Could not run the reminder scheduler.', 'error');
    } finally {
      setRunning(false);
    }
  };

  const toggle = async (id: string, enabled: boolean) => {
    try {
      const res = await reminderService.setAutoRemind(id, enabled);
      showToast(res.message, 'success');
      setData((d) => d && { ...d, requests: d.requests.map((r) => (r.id === id ? { ...r, autoRemind: enabled } : r)) });
    } catch {
      showToast('Could not change the reminder setting.', 'error');
    }
  };

  const policy = data?.policy;

  return (
    <div className="max-w-[1400px] mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-zinc-900">Automated Reminders</h1>
          <p className="text-zinc-500 mt-2 max-w-[70ch] text-sm leading-relaxed">
            Sections that have not submitted are reminded on a fixed schedule around each request&rsquo;s deadline.
            Every reminder carries a fresh upload link, and no section is mailed twice for the same milestone.
          </p>
        </div>
        {writable && (
          <div className="flex gap-2">
            <button
              onClick={() => run(true)}
              disabled={running}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-zinc-200 bg-white text-sm font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
            >
              <Eye weight="bold" className="w-4 h-4" /> Preview due
            </button>
            <button
              onClick={() => run(false)}
              disabled={running}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-900 text-white text-sm font-semibold hover:bg-black disabled:opacity-50"
            >
              <PaperPlaneTilt weight="bold" className="w-4 h-4" /> Send due now
            </button>
          </div>
        )}
      </div>

      {policy && (
        <div className="bg-white border border-slate-200/60 rounded-2xl p-4 text-sm text-zinc-600 flex flex-wrap gap-x-6 gap-y-1">
          <span><strong className="text-zinc-900">Before deadline:</strong> {policy.daysBefore.map((d) => `${d}d`).join(', ')}</span>
          <span><strong className="text-zinc-900">After deadline:</strong> every {policy.overdueIntervalDays}d, up to {policy.overdueMax}×</span>
          <span><strong className="text-zinc-900">Manual reminder cooldown:</strong> {policy.manualCooldownHours}h</span>
          <span className="text-zinc-400">Configured with REMINDER_* environment variables.</span>
        </div>
      )}

      {report && (
        <div className="bg-slate-blue-50/60 border border-slate-blue-500/20 rounded-2xl p-4 text-sm" role="status">
          <p className="font-semibold text-zinc-900">
            {report.dryRun ? 'Preview' : 'Run'} at {fmt(report.ranAt)}: {report.sent.length} {report.dryRun ? 'due' : 'sent'}, {report.skipped.length} skipped
          </p>
          <ul className="mt-2 space-y-1 text-xs text-zinc-600">
            {report.sent.map((s) => (
              <li key={`s-${s.requestId}-${s.unitId}`}>{s.reference} · {s.unitId} · {milestoneLabel(s.milestone)}</li>
            ))}
            {report.skipped.map((s) => (
              <li key={`k-${s.requestId}-${s.unitId}`} className="text-zinc-400">
                Skipped {s.reference} · {s.unitId} · {milestoneLabel(s.milestone)}: {s.reason}
              </li>
            ))}
          </ul>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-zinc-400">Loading schedule…</p>
      ) : !data || data.requests.length === 0 ? (
        <div className="bg-white border border-dashed border-zinc-200 rounded-2xl p-10 text-center text-sm text-zinc-500">
          <BellRinging className="w-7 h-7 mx-auto mb-2 text-zinc-300" />
          No open data requests, so nothing is scheduled.
        </div>
      ) : (
        <div className="space-y-4">
          {data.requests.map((req) => (
            <div key={req.id} className="bg-white border border-slate-200/60 rounded-2xl p-5">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div>
                  <Link to={`/admin/data-requests/${req.id}`} className="font-semibold text-zinc-900 hover:text-sage-700">
                    {req.title}
                  </Link>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    {req.reference} · due {fmt(req.deadline)} · {req.sectionsAwaiting} of {req.sections} sections awaiting
                    {req.overdue && (
                      <span className="ml-2 inline-flex items-center gap-1 text-orange-700 font-semibold">
                        <Warning weight="fill" className="w-3 h-3" /> overdue
                      </span>
                    )}
                  </p>
                </div>
                {writable ? (
                  <button
                    onClick={() => toggle(req.id, !req.autoRemind)}
                    className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg ${
                      req.autoRemind ? 'bg-sage-50 text-sage-800 hover:bg-sage-100' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                    }`}
                  >
                    {req.autoRemind ? <PauseCircle className="w-4 h-4" /> : <PlayCircle className="w-4 h-4" />}
                    {req.autoRemind ? 'Reminders on · pause' : 'Paused · resume'}
                  </button>
                ) : (
                  <span className="text-xs text-zinc-500">{req.autoRemind ? 'Reminders on' : 'Reminders paused'}</span>
                )}
              </div>

              <ol className="mt-4 flex flex-wrap gap-2" aria-label={`Reminder timeline for ${req.reference}`}>
                {req.timeline.map((m) => (
                  <li
                    key={m.milestone}
                    title={m.sections.map((s) => `${s.unitId}: ${s.outcome} — ${s.detail}`).join('\n') || undefined}
                    className={`px-3 py-2 rounded-xl ring-1 text-xs ${STATE_STYLE[m.state]}`}
                  >
                    <div className="font-semibold">{milestoneLabel(m.milestone)}</div>
                    <div className="opacity-80">{fmt(m.dueAt)}</div>
                    <div className="uppercase tracking-wider text-[10px] mt-0.5">
                      {m.state === 'SENT'
                        ? `sent · ${m.sections.filter((s) => s.outcome === 'SENT').length} section(s)`
                        : m.state.toLowerCase()}
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      )}

      {data && data.recent.length > 0 && (
        <div className="bg-white border border-slate-200/60 rounded-2xl overflow-x-auto">
          <h2 className="px-5 pt-4 text-sm font-semibold text-zinc-900">Recent automated reminders</h2>
          <table className="w-full text-sm mt-2">
            <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wider text-zinc-500">
              <tr>
                <th className="px-5 py-2">When</th>
                <th className="px-5 py-2">Request</th>
                <th className="px-5 py-2">Section</th>
                <th className="px-5 py-2">Milestone</th>
                <th className="px-5 py-2">Outcome</th>
              </tr>
            </thead>
            <tbody>
              {data.recent.map((r) => (
                <tr key={r.id} className="border-t border-slate-100">
                  <td className="px-5 py-2 text-xs text-zinc-500">{fmt(r.at)}</td>
                  <td className="px-5 py-2">{r.reference}</td>
                  <td className="px-5 py-2">{r.unitName}</td>
                  <td className="px-5 py-2">{milestoneLabel(r.milestone)}</td>
                  <td className="px-5 py-2 text-xs">
                    <span className={r.outcome === 'SENT' ? 'text-sage-700 font-semibold' : 'text-zinc-400'}>{r.outcome}</span>
                    <span className="text-zinc-400"> · {r.detail}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
