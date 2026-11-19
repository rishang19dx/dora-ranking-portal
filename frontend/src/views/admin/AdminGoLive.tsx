import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle, XCircle, RocketLaunch, ArrowsClockwise, Database, Flask, Signature, ChalkboardTeacher } from '@phosphor-icons/react';
import { api } from '../../services/api';
import {
  goLiveService, apiError,
  type BackupInfo, type Drill, type FlagReview, type Gate, type Kpi, type Pilot, type Readiness,
  type SignOff, type TrainingSession, type UatResult, type UatScenario,
} from '../../services/golive';
import { useToast } from '../../components/ToastProvider';

type Tab = 'readiness' | 'pilot' | 'uat' | 'operations' | 'signoff';

const TABS: { id: Tab; label: string }[] = [
  { id: 'readiness', label: 'Readiness' },
  { id: 'pilot', label: 'Pilot & KPIs' },
  { id: 'uat', label: 'UAT' },
  { id: 'operations', label: 'Backups, DR & Training' },
  { id: 'signoff', label: 'Sign-off' },
];

const card = 'bg-white border border-slate-200/60 rounded-2xl';
const input = 'w-full px-3 py-2 text-sm border border-zinc-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-sage-500 bg-white';
const btn = 'inline-flex items-center gap-2 bg-zinc-900 hover:bg-black disabled:opacity-60 text-white px-4 py-2 rounded-xl text-sm font-medium';
const btnGhost = 'inline-flex items-center gap-1.5 border border-zinc-200 hover:bg-zinc-50 disabled:opacity-50 px-3 py-1.5 rounded-lg text-xs font-medium';

function fmtDate(iso: string | null | undefined) {
  return iso ? new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
}

function Pass({ ok }: { ok: boolean }) {
  return ok
    ? <CheckCircle weight="fill" className="w-5 h-5 text-sage-600 shrink-0" aria-label="passing" />
    : <XCircle weight="fill" className="w-5 h-5 text-dusty-rose-600 shrink-0" aria-label="failing" />;
}

/**
 * Phase 4 go-live control room: every production gate from the proposal
 * (controlled pilot KPIs, UAT, training, backups/DR, security configuration)
 * evaluated from live evidence, and the formal sign-offs that close it.
 */
export default function AdminGoLive() {
  const { showToast } = useToast();
  const [tab, setTab] = useState<Tab>('readiness');
  const [readiness, setReadiness] = useState<Readiness | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      setReadiness(await goLiveService.readiness());
    } catch (err) {
      showToast(apiError(err, 'Could not load go-live readiness.'), 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { refresh(); }, [refresh]);

  return (
    <div className="max-w-[1400px] mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-zinc-900">Go-Live Readiness</h1>
          <p className="text-zinc-500 mt-2 max-w-[75ch] text-sm leading-relaxed">
            Controlled pilot, KPI evidence, user acceptance testing, backups and disaster recovery, training and
            the formal go / no-go decision. Gates are computed from live data; decisions are signed and immutable.
          </p>
        </div>
        {readiness && <RecommendationBadge readiness={readiness} />}
      </div>

      <div role="tablist" className="flex flex-wrap gap-1 bg-zinc-100/70 p-1 rounded-xl w-fit">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`px-3.5 py-1.5 rounded-lg text-sm font-medium ${tab === t.id ? 'bg-white shadow-sm text-zinc-900' : 'text-zinc-500 hover:text-zinc-800'}`}
          >{t.label}</button>
        ))}
      </div>

      {loading && <div className="text-sm text-zinc-500">Loading…</div>}
      {!loading && readiness && tab === 'readiness' && <ReadinessPanel readiness={readiness} />}
      {!loading && tab === 'pilot' && <PilotPanel onChange={refresh} />}
      {!loading && tab === 'uat' && <UatPanel onChange={refresh} />}
      {!loading && tab === 'operations' && <OperationsPanel onChange={refresh} />}
      {!loading && readiness && tab === 'signoff' && <SignOffPanel readiness={readiness} onChange={refresh} />}
    </div>
  );
}

function RecommendationBadge({ readiness }: { readiness: Readiness }) {
  const go = readiness.recommendation === 'GO';
  return (
    <div className={`${card} px-5 py-3 flex items-center gap-3`}>
      <RocketLaunch weight="duotone" className={`w-7 h-7 ${go ? 'text-sage-600' : 'text-dusty-rose-600'}`} />
      <div>
        <div className="text-[11px] uppercase tracking-wider text-zinc-500">Recommendation</div>
        <div className={`text-lg font-semibold ${go ? 'text-sage-700' : 'text-dusty-rose-700'}`}>
          {go ? 'GO' : 'NO-GO'}
        </div>
        <div className="text-[11px] text-zinc-500">
          {readiness.decision
            ? `Decision: ${readiness.decision.decision === 'APPROVE' ? 'Go' : 'No-go'} · ${readiness.decision.signatoryName}`
            : 'No decision signed yet'}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Readiness
// ---------------------------------------------------------------------------

function ReadinessPanel({ readiness }: { readiness: Readiness }) {
  const passed = readiness.gates.filter((g) => g.passed).length;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {readiness.kpis.kpis.map((k) => <KpiCard key={k.key} kpi={k} />)}
      </div>
      <div className={card}>
        <div className="px-5 py-3 border-b border-slate-100 text-xs text-zinc-500">
          {passed} of {readiness.gates.length} gates passing · generated {fmtDate(readiness.generatedAt)} · v{readiness.appVersion}
        </div>
        <ul className="divide-y divide-slate-100">
          {readiness.gates.map((g) => <GateRow key={g.key} gate={g} />)}
        </ul>
      </div>
    </div>
  );
}

function kpiValue(k: Kpi): string {
  if (k.key === 'system_resilience') {
    const w = (k.evidence.latestWitnessed ?? null) as { rpoHours: number; rtoHours: number } | null;
    return w ? `RPO ${w.rpoHours.toFixed(1)}h · RTO ${w.rtoHours.toFixed(1)}h` : '—';
  }
  return k.value === null ? '—' : `${(k.value * 100).toFixed(1)}%`;
}

function kpiTarget(k: Kpi): string {
  if (typeof k.target === 'number') {
    return k.key === 'ai_reliability' ? `> ${(k.target * 100).toFixed(0)}%, 0 critical false positives` : `${(k.target * 100).toFixed(0)}%`;
  }
  return `RPO ≤ ${k.target.rpoHours}h · RTO ≤ ${k.target.rtoHours}h, witnessed`;
}

function KpiCard({ kpi }: { kpi: Kpi }) {
  return (
    <div className={`${card} p-5`} data-testid={`kpi-${kpi.key}`}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-zinc-700">{kpi.label}</span>
        <Pass ok={kpi.passed} />
      </div>
      <div className="text-2xl font-semibold text-zinc-900 mt-2">{kpiValue(kpi)}</div>
      <div className="text-[11px] text-zinc-500 mt-1">Target: {kpiTarget(kpi)}</div>
      <p className="text-xs text-zinc-600 mt-3 leading-relaxed">{kpi.summary}</p>
    </div>
  );
}

function GateRow({ gate }: { gate: Gate }) {
  return (
    <li className="px-5 py-3 flex items-start gap-3">
      <Pass ok={gate.passed} />
      <div>
        <div className="text-sm font-medium text-zinc-900">{gate.label}</div>
        <div className="text-xs text-zinc-600 mt-0.5">{gate.summary}</div>
      </div>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Pilot and flag reviews
// ---------------------------------------------------------------------------

interface RequestOption { id: string; reference: string; title: string; cycleYear: number; targets: { orgUnitId: string }[] }

function PilotPanel({ onChange }: { onChange: () => void }) {
  const { showToast } = useToast();
  const [pilots, setPilots] = useState<Pilot[]>([]);
  const [requests, setRequests] = useState<RequestOption[]>([]);
  const [reviews, setReviews] = useState<FlagReview[]>([]);
  const [form, setForm] = useState({ name: '', requestId: '' });
  const [busy, setBusy] = useState(false);

  const pilot = pilots[0];

  const load = useCallback(async () => {
    try {
      const [p, r] = await Promise.all([goLiveService.pilots(), api.get('/api/data-requests/')]);
      setPilots(p);
      const raw = r.data;
      setRequests(Array.isArray(raw) ? raw : (raw.requests ?? []));
      if (p[0]) setReviews(await goLiveService.flagReviews(p[0].id));
    } catch (err) {
      showToast(apiError(err, 'Could not load the pilot.'), 'error');
    }
  }, [showToast]);

  useEffect(() => { load(); }, [load]);

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try {
      await fn();
      showToast(ok, 'success');
      await load();
      onChange();
    } catch (err) {
      showToast(apiError(err, 'The change was not saved.'), 'error');
    } finally {
      setBusy(false);
    }
  };

  const createPilot = () => {
    const req = requests.find((r) => r.id === form.requestId);
    if (!form.name.trim() || !req) {
      showToast('Name the pilot and choose the data request it runs on.', 'error');
      return;
    }
    run(() => goLiveService.createPilot({
      name: form.name.trim(), cycleYear: req.cycleYear, requestIds: [req.id],
      unitIds: Array.from(new Set((req.targets ?? []).map((t) => t.orgUnitId))),
    }), 'Pilot created.');
  };

  const review = (r: FlagReview, verdict: 'AGREE' | 'DISAGREE') => {
    let comment = '';
    if (verdict === 'DISAGREE') {
      comment = window.prompt(r.systemFlagged
        ? 'Why is this flag a false alarm?'
        : 'Which discrepancy did the system miss?') ?? '';
      if (!comment.trim()) return;
    }
    run(() => goLiveService.reviewFlag(r.id, verdict, comment), 'Verdict recorded.');
  };

  if (!pilot) {
    return (
      <div className={`${card} p-5 space-y-3 max-w-xl`}>
        <h2 className="font-semibold text-zinc-900">Set up the controlled pilot</h2>
        <p className="text-xs text-zinc-500">Choose the data request dispatched to the pilot departments. Its target sections become the pilot scope.</p>
        <input aria-label="Pilot name" className={input} placeholder="e.g. NIRF 2027 pilot: SCEE and SMME"
          value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <select aria-label="Pilot data request" className={input} value={form.requestId}
          onChange={(e) => setForm({ ...form, requestId: e.target.value })}>
          <option value="">Choose a data request…</option>
          {requests.map((r) => <option key={r.id} value={r.id}>{r.reference} · {r.title}</option>)}
        </select>
        <button className={btn} disabled={busy} onClick={createPilot}>Create pilot</button>
      </div>
    );
  }

  const pending = reviews.filter((r) => r.verdict === 'PENDING').length;
  const frozen = pilot.status === 'COMPLETED';

  return (
    <div className="space-y-6">
      <div className={`${card} p-5 flex flex-col md:flex-row md:items-center justify-between gap-4`}>
        <div>
          <div className="text-[11px] uppercase tracking-wider text-zinc-500">{pilot.status}</div>
          <h2 className="text-lg font-semibold text-zinc-900">{pilot.name}</h2>
          <div className="text-xs text-zinc-500 mt-1">
            Cycle {pilot.cycleYear} · {pilot.units.length} department(s) · started {fmtDate(pilot.startedAt)} · ended {fmtDate(pilot.endedAt)}
          </div>
          <div className="text-xs text-zinc-600 mt-1">{pilot.units.map((u) => u.name).join(', ')}</div>
        </div>
        <div className="flex gap-2">
          {pilot.status === 'PLANNED' && (
            <button className={btn} disabled={busy} onClick={() => run(() => goLiveService.setPilotStatus(pilot.id, 'RUNNING'), 'Pilot started.')}>Start pilot</button>
          )}
          {pilot.status === 'RUNNING' && (
            <button className={btn} disabled={busy} onClick={() => {
              if (window.confirm('Completing the pilot freezes its evidence. Continue?')) {
                run(() => goLiveService.setPilotStatus(pilot.id, 'COMPLETED'), 'Pilot completed.');
              }
            }}>Complete pilot</button>
          )}
        </div>
      </div>

      <div className={card}>
        <div className="px-5 py-3 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-zinc-900">Discrepancy-flag ground truth</h3>
            <p className="text-xs text-zinc-500">
              Confirm or overrule each automated check. These verdicts are the evidence for the AI-reliability KPI. {pending} pending.
            </p>
          </div>
          {!frozen && pilot.requests.map((r) => (
            <button key={r.id} className={btnGhost} disabled={busy}
              onClick={() => run(() => goLiveService.syncFlags(pilot.id, r.id), 'Checks re-run and queued for review.')}>
              <ArrowsClockwise className="w-3.5 h-3.5" /> Run checks · {r.reference}
            </button>
          ))}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50/80 text-[11px] uppercase tracking-wider text-zinc-500">
              <tr>
                <th className="py-2.5 px-4">Check</th>
                <th className="py-2.5 px-4">System said</th>
                <th className="py-2.5 px-4">Message</th>
                <th className="py-2.5 px-4">Verdict</th>
                <th className="py-2.5 px-4" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {reviews.map((r) => (
                <tr key={r.id} className="align-top">
                  <td className="py-2.5 px-4 text-xs">
                    <div className="font-medium text-zinc-900">{r.checkId}</div>
                    <div className="text-zinc-400">{r.severity}{r.critical ? ' · critical' : ''}</div>
                  </td>
                  <td className="py-2.5 px-4 text-xs">{r.systemFlagged ? 'Flagged' : 'Passed'}</td>
                  <td className="py-2.5 px-4 text-xs text-zinc-600 max-w-[420px]">{r.message}</td>
                  <td className="py-2.5 px-4 text-xs">
                    {r.verdict === 'PENDING' ? <span className="text-amber-700">Pending</span>
                      : <span>{r.verdict === 'AGREE' ? 'Correct' : 'System wrong'}{r.reviewer ? ` · ${r.reviewer}` : ''}</span>}
                    {r.comment && <div className="text-zinc-400 mt-0.5">“{r.comment}”</div>}
                  </td>
                  <td className="py-2.5 px-4 whitespace-nowrap">
                    {!frozen && (
                      <div className="flex gap-1.5">
                        <button className={btnGhost} disabled={busy} onClick={() => review(r, 'AGREE')}>System correct</button>
                        <button className={btnGhost} disabled={busy} onClick={() => review(r, 'DISAGREE')}>System wrong</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {!reviews.length && (
                <tr><td colSpan={5} className="py-8 text-center text-xs text-zinc-400">Run the checks to queue them for review.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// UAT
// ---------------------------------------------------------------------------

const RESULT_STYLE: Record<UatResult, string> = {
  PASS: 'bg-sage-50 text-sage-700',
  FAIL: 'bg-dusty-rose-50 text-dusty-rose-700',
  BLOCKED: 'bg-amber-50 text-amber-700',
};

function UatPanel({ onChange }: { onChange: () => void }) {
  const { showToast } = useToast();
  const [scenarios, setScenarios] = useState<UatScenario[]>([]);
  const [open, setOpen] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setScenarios(await goLiveService.uatScenarios());
    } catch (err) {
      showToast(apiError(err, 'Could not load UAT scenarios.'), 'error');
    }
  }, [showToast]);

  useEffect(() => { load(); }, [load]);

  const record = async (s: UatScenario, status: UatResult) => {
    let notes = '';
    let defectRef = '';
    if (status !== 'PASS') {
      notes = window.prompt(`What went wrong in ${s.code}?`) ?? '';
      if (!notes.trim()) return;
      defectRef = window.prompt('Defect / issue reference (optional)') ?? '';
    }
    try {
      await goLiveService.recordUat(s.code, { status, notes, defectRef });
      showToast(`${s.code} recorded as ${status}.`, 'success');
      await load();
      onChange();
    } catch (err) {
      showToast(apiError(err, 'The result was not saved.'), 'error');
    }
  };

  const passed = scenarios.filter((s) => s.latest?.status === 'PASS').length;

  return (
    <div className={card}>
      <div className="px-5 py-3 border-b border-slate-100 text-xs text-zinc-500 flex items-center gap-2">
        <Flask className="w-4 h-4 text-sage-600" /> {passed} of {scenarios.length} scenarios passing
      </div>
      <ul className="divide-y divide-slate-100">
        {scenarios.map((s) => (
          <li key={s.code} className="px-5 py-3">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <button className="text-left" onClick={() => setOpen(open === s.code ? null : s.code)}>
                <div className="text-sm font-medium text-zinc-900">
                  <span className="text-zinc-400 font-mono mr-2">{s.code}</span>{s.title}
                </div>
                <div className="text-[11px] text-zinc-500 mt-0.5">{s.area} · {s.role.replace('_', ' ')} · {s.priority}</div>
              </button>
              <div className="flex items-center gap-2">
                {s.latest
                  ? <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-md ${RESULT_STYLE[s.latest.status]}`}>{s.latest.status}</span>
                  : <span className="text-[11px] text-zinc-400">Not run</span>}
                {(['PASS', 'FAIL', 'BLOCKED'] as UatResult[]).map((r) => (
                  <button key={r} className={btnGhost} aria-label={`Record ${s.code} ${r}`} onClick={() => record(s, r)}>{r}</button>
                ))}
              </div>
            </div>
            {open === s.code && (
              <div className="mt-3 grid md:grid-cols-2 gap-4 text-xs">
                <div>
                  <div className="font-semibold text-zinc-600 mb-1">Steps</div>
                  <ol className="list-decimal pl-4 space-y-0.5 text-zinc-700">{s.steps.map((st, i) => <li key={i}>{st}</li>)}</ol>
                  <div className="font-semibold text-zinc-600 mt-3 mb-1">Expected</div>
                  <p className="text-zinc-700">{s.expected}</p>
                </div>
                <div>
                  <div className="font-semibold text-zinc-600 mb-1">History</div>
                  {s.history.length ? (
                    <ul className="space-y-1">
                      {s.history.map((h) => (
                        <li key={h.id} className="text-zinc-700">
                          <span className={`font-semibold px-1.5 rounded ${RESULT_STYLE[h.status]}`}>{h.status}</span>{' '}
                          {h.testerName} · {fmtDate(h.executedAt)}{h.defectRef ? ` · ${h.defectRef}` : ''}
                          {h.notes && <div className="text-zinc-500">{h.notes}</div>}
                        </li>
                      ))}
                    </ul>
                  ) : <div className="text-zinc-400">No executions yet.</div>}
                </div>
              </div>
            )}
          </li>
        ))}
        {!scenarios.length && (
          <li className="py-8 text-center text-xs text-zinc-400">No scenarios loaded. Run <code>manage.py seed_uat_scenarios</code>.</li>
        )}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Backups, DR drills and training
// ---------------------------------------------------------------------------

const AUDIENCES = [
  ['NODAL_OFFICER', 'Nodal officers'], ['ADMIN', 'DORA staff (admin)'], ['LEADERSHIP', 'Leadership'],
  ['AUDITOR', 'Auditors'], ['IT_OPERATIONS', 'IT Services (operations)'],
] as const;

function OperationsPanel({ onChange }: { onChange: () => void }) {
  const { showToast } = useToast();
  const [backups, setBackups] = useState<BackupInfo[]>([]);
  const [drills, setDrills] = useState<Drill[]>([]);
  const [training, setTraining] = useState<TrainingSession[]>([]);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ title: '', audience: 'NODAL_OFFICER', heldOn: '', trainer: '', attendees: '' });

  const load = useCallback(async () => {
    try {
      const [b, d, t] = await Promise.all([goLiveService.backups(), goLiveService.drills(), goLiveService.training()]);
      setBackups(b); setDrills(d); setTraining(t);
    } catch (err) {
      showToast(apiError(err, 'Could not load operations data.'), 'error');
    }
  }, [showToast]);

  useEffect(() => { load(); }, [load]);

  const backupNow = async () => {
    setBusy(true);
    try {
      const res = await goLiveService.createBackup('manual');
      showToast(`Backup ${res.name} written and verified.`, 'success');
      await load();
      onChange();
    } catch (err) {
      showToast(apiError(err, 'Backup failed.'), 'error');
    } finally {
      setBusy(false);
    }
  };

  const addTraining = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await goLiveService.recordTraining({ ...form, attendees: Number(form.attendees || 0) });
      showToast('Training session recorded.', 'success');
      setForm({ title: '', audience: 'NODAL_OFFICER', heldOn: '', trainer: '', attendees: '' });
      await load();
      onChange();
    } catch (err) {
      showToast(apiError(err, 'The session was not saved.'), 'error');
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className={card}>
        <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-zinc-900 flex items-center gap-2"><Database className="w-4 h-4" /> Backups</h3>
          <button className={btnGhost} disabled={busy} onClick={backupNow}>{busy ? 'Backing up…' : 'Back up now'}</button>
        </div>
        <ul className="divide-y divide-slate-100 text-xs">
          {backups.slice(0, 8).map((b) => (
            <li key={b.name} className="px-5 py-2 flex justify-between gap-3">
              <span className="font-mono text-zinc-700 truncate">{b.name}</span>
              <span className="text-zinc-500 whitespace-nowrap">{(b.size / 1024).toFixed(0)} KB · {fmtDate(b.createdAt)}</span>
            </li>
          ))}
          {!backups.length && <li className="px-5 py-6 text-center text-zinc-400">No backups yet. Schedule <code>manage.py backup_portal</code> nightly.</li>}
        </ul>
      </div>

      <div className={card}>
        <div className="px-5 py-3 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-zinc-900">Disaster-recovery drills</h3>
          <p className="text-[11px] text-zinc-500">Run by IT Services with <code>manage.py dr_drill --witness "Name, Designation"</code>.</p>
        </div>
        <ul className="divide-y divide-slate-100 text-xs">
          {drills.slice(0, 8).map((d) => (
            <li key={d.id} className="px-5 py-2 flex items-center gap-3">
              <Pass ok={d.meetsTargets} />
              <div className="flex-1">
                <div className="text-zinc-800">{fmtDate(d.failureDeclaredAt)} · {d.kind === 'WITNESSED' ? `witnessed by ${d.witnessedBy}` : 'automated'}</div>
                <div className="text-zinc-500">RPO {d.rpoHours.toFixed(2)} h · RTO {(d.rtoHours * 60).toFixed(1)} min · integrity {d.integrityOk ? 'verified' : 'FAILED'}</div>
              </div>
            </li>
          ))}
          {!drills.length && <li className="px-5 py-6 text-center text-zinc-400">No drills recorded yet.</li>}
        </ul>
      </div>

      <div className={`${card} lg:col-span-2`}>
        <div className="px-5 py-3 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-zinc-900 flex items-center gap-2"><ChalkboardTeacher className="w-4 h-4" /> Training sessions</h3>
        </div>
        <form onSubmit={addTraining} className="p-4 grid grid-cols-1 md:grid-cols-6 gap-2 border-b border-slate-100">
          <input aria-label="Session title" required className={`${input} md:col-span-2`} placeholder="Session title"
            value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <select aria-label="Audience" className={input} value={form.audience} onChange={(e) => setForm({ ...form, audience: e.target.value })}>
            {AUDIENCES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <input aria-label="Date held" required type="date" className={input} value={form.heldOn}
            onChange={(e) => setForm({ ...form, heldOn: e.target.value })} />
          <input aria-label="Trainer" required className={input} placeholder="Trainer" value={form.trainer}
            onChange={(e) => setForm({ ...form, trainer: e.target.value })} />
          <div className="flex gap-2">
            <input aria-label="Attendees" type="number" min={0} className={input} placeholder="Attendees" value={form.attendees}
              onChange={(e) => setForm({ ...form, attendees: e.target.value })} />
            <button type="submit" className={btn}>Add</button>
          </div>
        </form>
        <ul className="divide-y divide-slate-100 text-xs">
          {training.map((t) => (
            <li key={t.id} className="px-5 py-2 flex justify-between gap-3">
              <span className="text-zinc-800">{t.title} <span className="text-zinc-400">· {AUDIENCES.find(([v]) => v === t.audience)?.[1] ?? t.audience}</span></span>
              <span className="text-zinc-500 whitespace-nowrap">{t.heldOn} · {t.trainer} · {t.attendees} attendees</span>
            </li>
          ))}
          {!training.length && <li className="px-5 py-6 text-center text-zinc-400">No sessions recorded yet.</li>}
        </ul>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sign-off
// ---------------------------------------------------------------------------

const KIND_LABEL: Record<SignOff['kind'], string> = {
  UAT: 'UAT sign-off', GO_NO_GO: 'Go / no-go decision', HANDOVER: 'Handover acceptance',
};

function SignOffPanel({ readiness, onChange }: { readiness: Readiness; onChange: () => void }) {
  const { showToast } = useToast();
  const [history, setHistory] = useState<SignOff[]>([]);
  const [form, setForm] = useState({
    kind: 'UAT' as SignOff['kind'], decision: 'APPROVE' as SignOff['decision'],
    signatoryName: '', designation: '', comment: '',
  });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setHistory(await goLiveService.signoffs());
    } catch (err) {
      showToast(apiError(err, 'Could not load sign-offs.'), 'error');
    }
  }, [showToast]);

  useEffect(() => { load(); }, [load]);

  const overriding = form.kind === 'GO_NO_GO' && form.decision === 'APPROVE' && readiness.recommendation !== 'GO';

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!window.confirm(`Record "${KIND_LABEL[form.kind]}: ${form.decision === 'APPROVE' ? 'approve' : 'reject'}"? Sign-offs cannot be edited or deleted.`)) return;
    setBusy(true);
    try {
      await goLiveService.signOff({ ...form, pilotId: readiness.pilot?.id });
      showToast('Sign-off recorded.', 'success');
      setForm({ ...form, comment: '' });
      await load();
      onChange();
    } catch (err) {
      showToast(apiError(err, 'The sign-off was not recorded.'), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
      <form onSubmit={submit} className={`${card} p-5 space-y-3 lg:col-span-2`}>
        <h3 className="text-sm font-semibold text-zinc-900 flex items-center gap-2"><Signature className="w-4 h-4" /> Record a sign-off</h3>
        <select aria-label="Sign-off kind" className={input} value={form.kind}
          onChange={(e) => setForm({ ...form, kind: e.target.value as SignOff['kind'] })}>
          {Object.entries(KIND_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select aria-label="Decision" className={input} value={form.decision}
          onChange={(e) => setForm({ ...form, decision: e.target.value as SignOff['decision'] })}>
          <option value="APPROVE">{form.kind === 'GO_NO_GO' ? 'Go' : 'Approve'}</option>
          <option value="REJECT">{form.kind === 'GO_NO_GO' ? 'No-go' : 'Reject'}</option>
        </select>
        <input aria-label="Signatory name" required className={input} placeholder="Signatory name"
          value={form.signatoryName} onChange={(e) => setForm({ ...form, signatoryName: e.target.value })} />
        <input aria-label="Designation" required className={input} placeholder="Designation"
          value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} />
        <textarea aria-label="Comment" className={input} rows={3}
          placeholder={overriding ? 'Required: justification for going live against a NO-GO recommendation' : 'Comment'}
          value={form.comment} onChange={(e) => setForm({ ...form, comment: e.target.value })} />
        {overriding && (
          <p className="text-xs text-dusty-rose-700">
            Blocking gates: {readiness.blockingFailures.join(', ')}. A written justification is required.
          </p>
        )}
        <button type="submit" className={btn} disabled={busy}>Sign</button>
        <p className="text-[11px] text-zinc-500">The current readiness evidence is stored with the sign-off.</p>
      </form>

      <div className={`${card} lg:col-span-3`}>
        <div className="px-5 py-3 border-b border-slate-100 text-sm font-semibold text-zinc-900">History</div>
        <ul className="divide-y divide-slate-100 text-xs">
          {history.map((s) => (
            <li key={s.id} className="px-5 py-3">
              <div className="flex items-center gap-2">
                <Pass ok={s.decision === 'APPROVE'} />
                <span className="font-medium text-zinc-900">{KIND_LABEL[s.kind]}: {s.decision === 'APPROVE' ? (s.kind === 'GO_NO_GO' ? 'Go' : 'Approved') : (s.kind === 'GO_NO_GO' ? 'No-go' : 'Rejected')}</span>
              </div>
              <div className="text-zinc-600 mt-1">{s.signatoryName}, {s.designation} · {fmtDate(s.createdAt)} · recommendation then: {s.recommendationAtSigning ?? '—'}</div>
              {s.comment && <div className="text-zinc-500 mt-0.5">“{s.comment}”</div>}
            </li>
          ))}
          {!history.length && <li className="px-5 py-6 text-center text-zinc-400">No sign-offs yet.</li>}
        </ul>
      </div>
    </div>
  );
}
