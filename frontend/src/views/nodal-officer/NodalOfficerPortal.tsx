import React, { useEffect, useState } from 'react';
import { Clock, CheckCircle, FileText, ArrowRight, ShieldCheck, Warning } from '@phosphor-icons/react';
import { Link } from 'react-router-dom';
import { authService } from '../../services/api';
import { unitLabel } from '../../lib/organogram';

interface AssignedTask {
  requestId: string;
  requestTitle: string;
  reference: string;
  framework: string;
  cycleYear: number;
  deadline: string;
  unitId: string;
  unitName: string;
  status: string;
  portalUrl?: string;
  token?: string;
}

export default function NodalOfficerPortal() {
  const [tasks, setTasks] = useState<AssignedTask[]>([]);
  const [loading, setLoading] = useState(true);
  const currentUser = authService.getCurrentUser();

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/data-requests/');
        if (!res.ok) throw new Error('Could not load data requests');
        const raw = await res.json();
        const requests = Array.isArray(raw) ? raw : (raw.requests || []);

        const pendingList: AssignedTask[] = [];
        requests.forEach((req: any) => {
          (req.targets || []).forEach((tgt: any) => {
            const uId = tgt.unitId || tgt.orgUnitId || tgt.orgUnit?.id || '';
            pendingList.push({
              requestId: req.id,
              requestTitle: req.title,
              reference: req.reference || `DORA/${req.cycleYear}/${req.framework}`,
              framework: req.framework,
              cycleYear: req.cycleYear,
              deadline: req.deadline,
              unitId: uId,
              unitName: tgt.unitName || unitLabel(uId) || uId,
              status: tgt.status,
            });
          });
        });
        setTasks(pendingList);
      } catch {
        // Fallback or empty
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const activeTasks = tasks.filter((t) => t.status !== 'SUBMITTED');
  const completedTasks = tasks.filter((t) => t.status === 'SUBMITTED');

  return (
    <div className="max-w-[1400px] mx-auto space-y-8">
      <div>
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-sage-700">
          <ShieldCheck weight="duotone" className="w-4 h-4" />
          Nodal Officer Dashboard
        </div>
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-zinc-900 mt-2">
          {currentUser?.first_name ? `Welcome, ${currentUser.first_name}` : 'Officer Overview'}
        </h1>
        <p className="text-zinc-500 mt-1 max-w-[65ch] leading-relaxed text-sm">
          Track institutional ranking data collection cycles and submit structured metrics with verifiable documentary evidence.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Pending Submissions */}
        <div className="bg-white border border-slate-200/50 rounded-[2rem] p-8 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)] relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-orange-400" />
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-semibold tracking-tight text-zinc-900 flex items-center gap-2">
              <Clock className="w-6 h-6 text-orange-500" /> Action Required
            </h3>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-orange-50 text-orange-700">
              {activeTasks.length} pending
            </span>
          </div>

          {loading ? (
            <div className="text-center py-8 text-zinc-400 text-sm">Loading assigned tasks...</div>
          ) : activeTasks.length === 0 ? (
            <div className="p-6 border border-dashed border-zinc-200 rounded-2xl text-center bg-zinc-50/50">
              <p className="text-sm font-medium text-zinc-700">All submissions up to date</p>
              <p className="text-xs text-zinc-400 mt-1">
                No outstanding data requests for your assigned units.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {activeTasks.slice(0, 3).map((task, idx) => {
                const daysLeft = Math.ceil(
                  (new Date(task.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
                );

                return (
                  <div
                    key={idx}
                    className="p-5 border border-slate-200/60 rounded-2xl bg-zinc-50/50 hover:border-sage-500/30 transition-all"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider font-mono">
                        {task.framework} {task.cycleYear}
                      </span>
                      <span
                        className={`text-xs font-semibold px-2 py-0.5 rounded-md ${
                          daysLeft <= 7 ? 'text-red-600 bg-red-50' : 'text-orange-600 bg-orange-50'
                        }`}
                      >
                        {daysLeft > 0 ? `Due in ${daysLeft} days` : 'Due today'}
                      </span>
                    </div>

                    <h4 className="font-semibold text-zinc-900 text-base mt-2">{task.requestTitle}</h4>
                    <p className="text-xs text-zinc-500 mt-1 mb-4">
                      Assigned Unit: <span className="font-medium text-zinc-800">{task.unitName}</span>
                    </p>

                    <div className="flex items-center justify-between pt-3 border-t border-slate-200/50">
                      <span className="text-xs font-medium text-zinc-500">
                        Status: <span className="font-semibold text-orange-700">{task.status}</span>
                      </span>
                      <Link
                        to="/nodal-officer/submissions/new"
                        className="bg-zinc-900 hover:bg-black active:scale-[0.98] text-white px-4 py-2 rounded-xl text-xs font-semibold transition-all inline-flex items-center gap-1.5"
                      >
                        Submit Data
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Previous Submissions */}
        <div className="bg-white border border-slate-200/50 rounded-[2rem] p-8 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)]">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-semibold tracking-tight text-zinc-900 flex items-center gap-2">
              <CheckCircle className="w-6 h-6 text-sage-600" /> Completed Submissions
            </h3>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-sage-50 text-sage-700">
              {completedTasks.length} received
            </span>
          </div>

          {loading ? (
            <div className="text-center py-8 text-zinc-400 text-sm">Loading history...</div>
          ) : completedTasks.length === 0 ? (
            <div className="p-6 border border-dashed border-zinc-200 rounded-2xl text-center bg-zinc-50/50">
              <p className="text-sm font-medium text-zinc-700">No completed submissions yet</p>
              <p className="text-xs text-zinc-400 mt-1">
                Submitted data approved by DORA will appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {completedTasks.slice(0, 4).map((task, idx) => (
                <div
                  key={idx}
                  className="p-4 border border-slate-200/50 rounded-2xl flex items-center justify-between hover:bg-zinc-50/50 transition-colors"
                >
                  <div>
                    <p className="font-semibold text-zinc-900 text-sm">{task.requestTitle}</p>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      {task.unitName} &middot; Received by DORA
                    </p>
                  </div>
                  <FileText className="w-5 h-5 text-sage-600" />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
