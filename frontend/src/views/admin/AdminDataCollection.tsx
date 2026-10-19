"use client";

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  ArrowRight,
  Clock,
  Envelope,
  FileText,
  PaperPlaneTilt,
  TreeStructure,
  Warning,
} from '@phosphor-icons/react';

import { useToast } from '../../components/ToastProvider';
import { unitLabel } from '../../lib/organogram';
import type { DataRequest, ProofUpload } from '../../lib/types';

const spring = { type: 'spring' as const, stiffness: 100, damping: 20 };

interface RequestsPayload {
  requests: DataRequest[];
  uploads: ProofUpload[];
  transport: 'resend' | 'outbox';
}

export default function DataCollectionPage() {
  const { showToast } = useToast();
  const [data, setData] = useState<RequestsPayload | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/data-requests/');
      if (!response.ok) throw new Error('Unable to load data requests.');
      const raw = await response.json();
      const requests = Array.isArray(raw) ? raw : (raw.requests || []);
      setData({
        requests,
        uploads: raw.uploads || [],
        transport: raw.transport || 'outbox',
      });
    } catch (error) {
      showToast((error as Error).message, 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    load();
  }, [load]);

  const requests = useMemo(() => data?.requests ?? [], [data]);
  const active = requests.filter((request) => request.status !== 'CLOSED');
  const pendingSections = active.reduce(
    (total, request) =>
      total + request.targets.filter((target) => target.status !== 'SUBMITTED').length,
    0,
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={spring}
      className="max-w-[1400px] mx-auto space-y-8"
    >
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-zinc-900">
            Data Collection
          </h1>
          <p className="text-zinc-500 mt-2 max-w-[65ch] leading-relaxed">
            Targeted data requests dispatched to the organogram, with live submission status for
            every section.
          </p>
        </div>
        <Link
          to="/admin/data-requests/new"
          className="bg-sage-600 hover:bg-sage-700 active:scale-[0.98] text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-all shadow-[0_8px_16px_-4px_rgba(90,115,89,0.3)] flex items-center gap-2 shrink-0"
        >
          <PaperPlaneTilt weight="bold" className="w-4 h-4" /> New Data Request
        </Link>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard label="Active requests" value={active.length} icon={<FileText weight="duotone" className="w-5 h-5" />} />
        <SummaryCard label="Sections awaiting" value={pendingSections} icon={<Clock weight="duotone" className="w-5 h-5" />} tone="warn" />
        <SummaryCard label="Proof files received" value={data?.uploads.length ?? 0} icon={<FileText weight="duotone" className="w-5 h-5" />} />
        <SummaryCard
          label="Mail transport"
          text={data?.transport === 'resend' ? 'Resend API' : 'Local outbox'}
          icon={<Envelope weight="duotone" className="w-5 h-5" />}
        />
      </div>

      {data?.transport === 'outbox' && (
        <div className="bg-slate-blue-50/60 border border-slate-blue-200/50 rounded-2xl p-5 flex items-start gap-3">
          <Warning weight="duotone" className="w-5 h-5 text-slate-blue-600 shrink-0 mt-0.5" />
          <p className="text-sm text-slate-blue-900/80 leading-relaxed">
            No mail transport is configured, so dispatched messages are written to{' '}
            <code className="px-1.5 py-0.5 rounded bg-white/70 text-xs">.data/outbox/</code> instead
            of being emailed. Set <code className="px-1.5 py-0.5 rounded bg-white/70 text-xs">RESEND_API_KEY</code>{' '}
            and <code className="px-1.5 py-0.5 rounded bg-white/70 text-xs">MAIL_FROM</code> to send
            for real.
          </p>
        </div>
      )}

      <div className="bg-white border border-slate-200/50 rounded-[2rem] p-6 md:p-8 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)]">
        <h2 className="text-xl font-semibold tracking-tight text-zinc-900 mb-6">Request cycles</h2>

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="h-24 rounded-2xl bg-zinc-100 animate-pulse" />
            ))}
          </div>
        ) : requests.length === 0 ? (
          <div className="text-center py-14">
            <TreeStructure weight="duotone" className="w-12 h-12 mx-auto text-zinc-300 mb-4" />
            <h3 className="font-semibold text-zinc-900">No data request has been dispatched yet</h3>
            <p className="text-sm text-zinc-500 mt-2 max-w-md mx-auto leading-relaxed">
              Pick the sections that hold the evidence from the institute organogram, choose the
              data you need, and the portal will email each nodal officer a restricted upload link.
            </p>
            <Link
              to="/admin/data-requests/new"
              className="inline-flex items-center gap-2 mt-6 bg-sage-600 hover:bg-sage-700 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors"
            >
              Compose the first request <ArrowRight weight="bold" className="w-4 h-4" />
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {requests.map((request) => {
              const submitted = request.targets.filter(
                (target) => target.status === 'SUBMITTED',
              ).length;
              const progress = request.targets.length
                ? Math.round((submitted / request.targets.length) * 100)
                : 0;
              const days = daysUntil(request.deadline);
              const overdue = days < 0 && request.status !== 'CLOSED';

              return (
                <Link
                  key={request.id}
                  to={`/admin/data-requests/${request.id}`}
                  className="flex flex-col lg:flex-row lg:items-center justify-between p-6 border border-slate-200/50 rounded-2xl bg-zinc-50/50 group hover:border-sage-500/30 transition-colors gap-6"
                >
                  <div className="flex items-center gap-5 min-w-0">
                    <div className="w-12 h-12 rounded-2xl bg-sage-50 flex items-center justify-center text-sage-600 shadow-sm group-hover:scale-105 transition-transform shrink-0">
                      <FileText weight="duotone" className="w-6 h-6" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-semibold text-zinc-900 text-[15px] truncate">
                          {request.title}
                        </h4>
                        <span className="px-2 py-0.5 rounded-md bg-zinc-100 text-zinc-500 text-[11px] font-mono">
                          {request.reference}
                        </span>
                        {request.status === 'CLOSED' && (
                          <span className="px-2 py-0.5 rounded-md bg-zinc-100 text-zinc-500 text-[11px] font-semibold uppercase">
                            Closed
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-zinc-500 mt-1 truncate">
                        {request.targets.length} section
                        {request.targets.length === 1 ? '' : 's'} &middot;{' '}
                        {request.dataItemIds.length} data item
                        {request.dataItemIds.length === 1 ? '' : 's'} &middot;{' '}
                        {request.deliveries.length} email
                        {request.deliveries.length === 1 ? '' : 's'}
                      </p>
                      <p className="text-xs text-zinc-400 mt-1 truncate">
                        {request.targets
                          .slice(0, 4)
                          .map((target) => unitLabel(target.unitId))
                          .join(', ')}
                        {request.targets.length > 4 ? ` +${request.targets.length - 4} more` : ''}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-8 lg:gap-10 shrink-0">
                    <div className="text-right">
                      <div className="text-xs font-semibold text-zinc-500 flex items-center gap-1.5 justify-end uppercase tracking-wider mb-1">
                        <Clock weight="bold" className="w-3.5 h-3.5" /> Deadline
                      </div>
                      <div
                        className={`font-semibold ${
                          request.status === 'CLOSED'
                            ? 'text-zinc-400'
                            : overdue
                              ? 'text-dusty-rose-700'
                              : days <= 7
                                ? 'text-orange-600'
                                : 'text-zinc-700'
                        }`}
                      >
                        {request.status === 'CLOSED'
                          ? 'closed'
                          : overdue
                            ? `${Math.abs(days)}d overdue`
                            : `in ${days} days`}
                      </div>
                    </div>
                    <div className="w-40">
                      <div className="flex justify-between text-xs font-semibold mb-2">
                        <span className="text-zinc-700">{progress}%</span>
                        <span className="text-zinc-400">
                          {submitted}/{request.targets.length}
                        </span>
                      </div>
                      <div className="h-2.5 w-full bg-slate-200/70 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${progress}%` }}
                          transition={{ ...spring, delay: 0.15 }}
                          className="h-full bg-sage-500 rounded-full"
                        />
                      </div>
                    </div>
                    <ArrowRight
                      weight="bold"
                      className="w-5 h-5 text-zinc-300 group-hover:text-sage-600 transition-colors hidden sm:block"
                    />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </motion.div>
  );
}

function SummaryCard({
  label,
  value,
  text,
  icon,
  tone = 'neutral',
}: {
  label: string;
  value?: number;
  text?: string;
  icon: React.ReactNode;
  tone?: 'neutral' | 'warn';
}) {
  return (
    <div className="bg-white border border-slate-200/50 rounded-2xl p-5 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)]">
      <div className="flex items-center gap-2 text-zinc-400">
        {icon}
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">{label}</p>
      </div>
      <p
        className={`mt-2 tracking-tight ${
          text
            ? 'text-lg font-semibold text-zinc-700'
            : `text-3xl font-semibold ${tone === 'warn' ? 'text-orange-600' : 'text-zinc-900'}`
        }`}
      >
        {text ?? value}
      </p>
    </div>
  );
}

function daysUntil(iso: string): number {
  const diff = new Date(iso).getTime() - Date.now();
  return Math.ceil(diff / 86_400_000);
}
