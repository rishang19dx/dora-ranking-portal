import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ShieldCheck,
  ArrowRight,
  Key,
  Buildings,
} from '@phosphor-icons/react';
import { FileSpreadsheet } from 'lucide-react';
import { useToast } from '../../components/ToastProvider';
import { ORG_UNITS } from '../../lib/organogram';

export default function NodalOfficerSubmission() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [tokenInput, setTokenInput] = useState('');
  const [activeRequests, setActiveRequests] = useState<any[]>([]);
  const [selectedUnit, setSelectedUnit] = useState<string>('');
  const [loading, setLoading] = useState(true);

  const academicUnits = ORG_UNITS.filter(
    (u) => u.kind === 'SCHOOL' || u.kind === 'CENTRE' || u.type === 'ACADEMIC'
  );

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/data-requests/');
        if (res.ok) {
          const raw = await res.json();
          const reqs = Array.isArray(raw) ? raw : (raw.requests || []);
          setActiveRequests(reqs.filter((r: any) => r.status !== 'CLOSED'));
        }
      } catch {
        // Fallback
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleOpenToken = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = tokenInput.trim();
    if (!trimmed) {
      showToast('Please enter your portal access token', 'error');
      return;
    }
    navigate(`/portal/${trimmed}`);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-sage-700">
          <ShieldCheck weight="duotone" className="w-4 h-4" />
          Restricted Submission Access
        </div>
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 mt-2">
          NIRF Institutional Data Entry
        </h1>
        <p className="text-zinc-500 mt-1 max-w-[65ch] leading-relaxed text-sm">
          Access your department-scoped data entry forms using your personal access grant token or choose from open data collection cycles.
        </p>
      </div>

      {/* Access via Token */}
      <div className="bg-white border border-slate-200/60 rounded-[2rem] p-6 sm:p-8 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)] space-y-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-sage-50 text-sage-600 flex items-center justify-center shrink-0">
            <Key weight="duotone" className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight text-zinc-900">
              Access via Personal Grant Link
            </h2>
            <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
              Enter the access token delivered to your official email mailbox by the DORA Office.
            </p>
          </div>
        </div>

        <form onSubmit={handleOpenToken} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-600 mb-1.5">
              Portal Access Token / Link
            </label>
            <div className="relative">
              <input
                type="text"
                value={tokenInput}
                onChange={(e) => {
                  let val = e.target.value.trim();
                  if (val.includes('/portal/')) {
                    val = val.split('/portal/')[1].split('/')[0];
                  }
                  setTokenInput(val);
                }}
                placeholder="Paste token or link (e.g. 48f9a2e...)"
                className="w-full px-4 py-3 text-sm border border-zinc-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-sage-500 font-mono"
              />
            </div>
            <p className="text-[11px] text-zinc-400 mt-1">
              Links sent in official DORA emails contain this token automatically.
            </p>
          </div>

          <button
            type="submit"
            disabled={!tokenInput.trim()}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 bg-sage-600 hover:bg-sage-700 disabled:opacity-50 text-white text-xs font-semibold rounded-xl transition-all shadow-sm"
          >
            Open Data Entry Portal
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>
      </div>

      {/* Active Requests Overview */}
      <div className="bg-white border border-slate-200/60 rounded-[2rem] p-6 sm:p-8 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)] space-y-4">
        <div className="flex items-center gap-3">
          <Buildings weight="duotone" className="w-6 h-6 text-slate-blue-600" />
          <h2 className="text-xl font-bold tracking-tight text-zinc-900">
            Open Institutional Data Cycles
          </h2>
        </div>

        {loading ? (
          <p className="text-xs text-zinc-400">Loading open data requests...</p>
        ) : activeRequests.length === 0 ? (
          <p className="text-xs text-zinc-500">No active institutional requests found.</p>
        ) : (
          <div className="space-y-3 pt-2">
            {activeRequests.map((req) => (
              <div
                key={req.id}
                className="p-4 border border-slate-200/50 rounded-2xl bg-zinc-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-sage-100 text-sage-800 font-mono">
                    {req.framework} {req.cycleYear}
                  </span>
                  <h3 className="font-semibold text-zinc-900 text-sm mt-1">{req.title}</h3>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    Deadline: {new Date(req.deadline).toLocaleDateString('en-IN')} &middot;{' '}
                    {req.targets?.length || 0} unit sections
                  </p>
                </div>
                <span className="text-xs text-zinc-400 italic">
                  Check your inbox for your scoped access link
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
