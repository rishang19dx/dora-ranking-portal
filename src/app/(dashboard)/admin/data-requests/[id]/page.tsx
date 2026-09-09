"use client";

import React, { use, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { motion } from 'motion/react';
import {
  ArrowLeft,
  BellRinging,
  CheckCircle,
  ClockCounterClockwise,
  Copy,
  FileArrowUp,
  Lock,
  LockOpen,
  PaperPlaneTilt,
  Warning,
} from '@phosphor-icons/react';

import { ORG_TYPE_STYLES } from '@/components/organogram/OrgTree';
import { useToast } from '@/components/ToastProvider';
import { dataItemLabel } from '@/lib/data-catalogue';
import { getUnit, unitLabel } from '@/lib/organogram';
import type { DataRequest, NodalOfficer, ProofUpload, TargetStatus } from '@/lib/types';

const spring = { type: 'spring' as const, stiffness: 100, damping: 20 };

const TARGET_STATUS_STYLES: Record<TargetStatus, string> = {
  PENDING: 'bg-orange-50 text-orange-700 ring-orange-500/20',
  PARTIAL: 'bg-soft-gold-50 text-soft-gold-700 ring-soft-gold-500/20',
  SUBMITTED: 'bg-sage-50 text-sage-700 ring-sage-500/20',
};

interface DetailPayload {
  request: DataRequest;
  officers: NodalOfficer[];
  uploads: ProofUpload[];
}

export default function DataRequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { showToast } = useToast();
  const [data, setData] = useState<DetailPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/data-requests/${id}`);
      if (!response.ok) throw new Error('This data request could not be loaded.');
      setData((await response.json()) as DetailPayload);
    } catch (error) {
      showToast((error as Error).message, 'error');
    } finally {
      setLoading(false);
    }
  }, [id, showToast]);

  useEffect(() => {
    load();
  }, [load]);

  const officersById = useMemo(
    () => new Map((data?.officers ?? []).map((officer) => [officer.id, officer])),
    [data],
  );

  const uploadsByUnit = useMemo(() => {
    const map = new Map<string, ProofUpload[]>();
    (data?.uploads ?? []).forEach((upload) => {
      const list = map.get(upload.unitId) ?? [];
      list.push(upload);
      map.set(upload.unitId, list);
    });
    return map;
  }, [data]);

  const act = async (body: Record<string, unknown>, key: string) => {
    setBusy(key);
    try {
      const response = await fetch(`/api/data-requests/${id}/actions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? 'The action failed.');

      if (payload.url) {
        try {
          await navigator.clipboard.writeText(payload.url);
          showToast('A fresh upload link was provisioned and copied to your clipboard.', 'success');
        } catch {
          showToast(`Fresh upload link: ${payload.url}`, 'info');
        }
      } else {
        showToast(payload.message ?? 'Done.', 'success');
      }
      await load();
    } catch (error) {
      showToast((error as Error).message, 'error');
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return <div className="max-w-[1400px] mx-auto h-64 rounded-[2rem] bg-white/60 animate-pulse" />;
  }

  if (!data) {
    return (
      <div className="max-w-[1400px] mx-auto text-center py-20">
        <p className="text-zinc-500">This data request is no longer available.</p>
        <Link href="/admin/data-collection" className="text-sage-700 font-semibold hover:underline">
          Back to data collection
        </Link>
      </div>
    );
  }

  const { request } = data;
  const submitted = request.targets.filter((target) => target.status === 'SUBMITTED').length;
  const progress = request.targets.length
    ? Math.round((submitted / request.targets.length) * 100)
    : 0;
  const overdue = new Date(request.deadline).getTime() < Date.now() && request.status !== 'CLOSED';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={spring}
      className="max-w-[1400px] mx-auto space-y-8"
    >
      <Link
        href="/admin/data-collection"
        className="inline-flex items-center gap-2 text-sm font-semibold text-zinc-500 hover:text-zinc-900 transition-colors"
      >
        <ArrowLeft weight="bold" className="w-4 h-4" /> Data collection
      </Link>

      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sage-700">
            {request.reference}
          </p>
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-zinc-900 mt-2">
            {request.title}
          </h1>
          <div className="flex flex-wrap items-center gap-3 mt-4 text-sm text-zinc-500">
            <span className="px-3 py-1.5 rounded-lg bg-zinc-100 text-zinc-700 text-xs font-semibold">
              {request.framework} {request.cycleYear}
            </span>
            <span className={overdue ? 'text-dusty-rose-700 font-semibold' : ''}>
              Deadline {formatDate(request.deadline)}
              {overdue ? ' (overdue)' : ''}
            </span>
            <span>Dispatched {formatDate(request.dispatchedAt)}</span>
            <span
              className={`px-3 py-1.5 rounded-full text-xs font-semibold ring-1 ${
                request.status === 'CLOSED'
                  ? 'bg-zinc-100 text-zinc-500 ring-zinc-400/20'
                  : 'bg-sage-50 text-sage-700 ring-sage-500/20'
              }`}
            >
              {request.status === 'CLOSED' ? 'Closed' : 'Collecting'}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 shrink-0">
          <button
            onClick={() => act({ action: 'REMIND' }, 'remind')}
            disabled={busy !== null || request.status === 'CLOSED'}
            className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 transition-colors flex items-center gap-2"
          >
            <BellRinging weight="bold" className="w-4 h-4" /> Remind pending
          </button>
          {request.status === 'CLOSED' ? (
            <button
              onClick={() => act({ action: 'REOPEN' }, 'reopen')}
              disabled={busy !== null}
              className="px-4 py-2.5 rounded-xl bg-zinc-900 hover:bg-black text-white text-sm font-semibold disabled:opacity-50 transition-colors flex items-center gap-2"
            >
              <LockOpen weight="bold" className="w-4 h-4" /> Reopen
            </button>
          ) : (
            <button
              onClick={() => act({ action: 'CLOSE' }, 'close')}
              disabled={busy !== null}
              className="px-4 py-2.5 rounded-xl bg-zinc-900 hover:bg-black text-white text-sm font-semibold disabled:opacity-50 transition-colors flex items-center gap-2"
            >
              <Lock weight="bold" className="w-4 h-4" /> Close & revoke links
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="md:col-span-2 bg-white border border-slate-200/50 rounded-[2rem] p-6 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)]">
          <div className="flex items-center justify-between text-sm">
            <span className="font-semibold text-zinc-900">Collection progress</span>
            <span className="text-zinc-500">
              {submitted} of {request.targets.length} sections complete
            </span>
          </div>
          <div className="h-2.5 w-full bg-slate-200/70 rounded-full overflow-hidden mt-4">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ ...spring, delay: 0.1 }}
              className="h-full bg-sage-500 rounded-full"
            />
          </div>
        </div>
        <MetricCard label="Emails delivered" value={request.deliveries.length} />
        <MetricCard label="Proof files received" value={data.uploads.length} />
      </div>

      <div className="bg-white border border-slate-200/50 rounded-[2rem] shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)] overflow-hidden">
        <div className="p-6 border-b border-slate-100">
          <h2 className="text-xl font-semibold tracking-tight text-zinc-900">Targeted sections</h2>
          <p className="text-sm text-zinc-500 mt-1">
            Each recipient holds a restricted upload link scoped to their own section.
          </p>
        </div>
        <div className="divide-y divide-slate-100">
          {request.targets.map((target) => {
            const unit = getUnit(target.unitId);
            const uploads = uploadsByUnit.get(target.unitId) ?? [];
            const coveredItems = new Set(uploads.map((upload) => upload.dataItemId));
            return (
              <div key={target.unitId} className="p-6 hover:bg-zinc-50/40 transition-colors">
                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-zinc-900">{unitLabel(target.unitId)}</h3>
                      {unit && (
                        <span
                          className={`px-2 py-0.5 rounded-md text-[11px] font-semibold ring-1 ${ORG_TYPE_STYLES[unit.type].chip}`}
                        >
                          {unit.type.toLowerCase()}
                        </span>
                      )}
                      <span
                        className={`px-2.5 py-1 rounded-full text-xs font-semibold ring-1 ${TARGET_STATUS_STYLES[target.status]}`}
                      >
                        {target.status === 'SUBMITTED'
                          ? 'Submitted'
                          : target.status === 'PARTIAL'
                            ? 'Partially received'
                            : 'Awaiting upload'}
                      </span>
                    </div>

                    <p className="text-sm text-zinc-500 mt-2">
                      {target.officerIds.length > 0 ? (
                        target.officerIds
                          .map((officerId) => officersById.get(officerId)?.name ?? officerId)
                          .join(', ')
                      ) : (
                        <span className="text-orange-600 font-medium inline-flex items-center gap-1.5">
                          <Warning weight="bold" className="w-4 h-4" /> No nodal officer assigned
                        </span>
                      )}
                    </p>

                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {target.dataItemIds.map((itemId) => (
                        <span
                          key={itemId}
                          className={`px-2.5 py-1 rounded-lg text-xs font-medium ring-1 ${
                            coveredItems.has(itemId)
                              ? 'bg-sage-50 text-sage-700 ring-sage-500/20'
                              : 'bg-zinc-100 text-zinc-600 ring-zinc-300/40'
                          }`}
                        >
                          {coveredItems.has(itemId) && (
                            <CheckCircle weight="fill" className="w-3 h-3 inline mr-1 -mt-0.5" />
                          )}
                          {dataItemLabel(itemId)}
                        </span>
                      ))}
                    </div>

                    {target.lastReminderAt && (
                      <p className="text-[11px] text-zinc-400 mt-3 flex items-center gap-1.5">
                        <ClockCounterClockwise weight="bold" className="w-3.5 h-3.5" />
                        {target.remindersSent} reminder{target.remindersSent === 1 ? '' : 's'}, last
                        on {formatDate(target.lastReminderAt)}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {target.officerIds.length === 0 ? (
                      <Link
                        href={`/admin/nodal-officers?unit=${encodeURIComponent(target.unitId)}`}
                        className="px-3 py-2 rounded-xl border border-orange-200 text-xs font-semibold text-orange-700 hover:bg-orange-50 transition-colors"
                      >
                        Assign officer
                      </Link>
                    ) : (
                      <>
                        <button
                          onClick={() =>
                            act(
                              {
                                action: 'REISSUE',
                                unitId: target.unitId,
                                officerId: target.officerIds[0],
                              },
                              `reissue-${target.unitId}`,
                            )
                          }
                          disabled={busy !== null || request.status === 'CLOSED'}
                          title="Provision a fresh link and copy it"
                          className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-zinc-600 hover:bg-zinc-50 disabled:opacity-50 transition-colors flex items-center gap-1.5"
                        >
                          <Copy weight="bold" className="w-3.5 h-3.5" /> Copy link
                        </button>
                        <button
                          onClick={() =>
                            act(
                              { action: 'REMIND', unitIds: [target.unitId] },
                              `remind-${target.unitId}`,
                            )
                          }
                          disabled={
                            busy !== null ||
                            request.status === 'CLOSED' ||
                            target.status === 'SUBMITTED'
                          }
                          className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-zinc-600 hover:bg-zinc-50 disabled:opacity-50 transition-colors flex items-center gap-1.5"
                        >
                          <PaperPlaneTilt weight="bold" className="w-3.5 h-3.5" /> Remind
                        </button>
                      </>
                    )}
                    {target.status !== 'SUBMITTED' && (
                      <button
                        onClick={() =>
                          act(
                            {
                              action: 'SET_TARGET_STATUS',
                              unitId: target.unitId,
                              status: 'SUBMITTED',
                            },
                            `close-${target.unitId}`,
                          )
                        }
                        disabled={busy !== null || request.status === 'CLOSED'}
                        className="px-3 py-2 rounded-xl bg-sage-50 text-xs font-semibold text-sage-700 hover:bg-sage-100 disabled:opacity-50 transition-colors"
                      >
                        Mark received
                      </button>
                    )}
                  </div>
                </div>

                {uploads.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-slate-100 space-y-2">
                    {uploads.map((upload) => (
                      <div
                        key={upload.id}
                        className="flex flex-wrap items-center gap-3 text-xs text-zinc-500"
                      >
                        <FileArrowUp weight="bold" className="w-4 h-4 text-sage-600 shrink-0" />
                        <span className="font-medium text-zinc-900">{upload.fileName}</span>
                        <span>{dataItemLabel(upload.dataItemId)}</span>
                        <span>{formatSize(upload.size)}</span>
                        <span className="font-mono text-[10px] text-zinc-400">
                          sha256:{upload.checksum.slice(0, 12)}
                        </span>
                        <span>{formatDate(upload.uploadedAt)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-white border border-slate-200/50 rounded-[2rem] shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)] overflow-hidden">
        <div className="p-6 border-b border-slate-100">
          <h2 className="text-xl font-semibold tracking-tight text-zinc-900">Delivery log</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 border-b border-slate-200/50">
              <tr>
                <th className="px-6 py-4 font-semibold text-zinc-500 uppercase tracking-wider text-xs">Recipient</th>
                <th className="px-6 py-4 font-semibold text-zinc-500 uppercase tracking-wider text-xs">Section</th>
                <th className="px-6 py-4 font-semibold text-zinc-500 uppercase tracking-wider text-xs">Type</th>
                <th className="px-6 py-4 font-semibold text-zinc-500 uppercase tracking-wider text-xs">Status</th>
                <th className="px-6 py-4 font-semibold text-zinc-500 uppercase tracking-wider text-xs">Sent</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {request.deliveries.map((delivery) => (
                <tr key={delivery.id} className="hover:bg-zinc-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <p className="font-medium text-zinc-900">{delivery.officerName}</p>
                    <p className="text-xs text-zinc-500">{delivery.email}</p>
                  </td>
                  <td className="px-6 py-4 text-zinc-600">{unitLabel(delivery.unitId)}</td>
                  <td className="px-6 py-4 text-zinc-500 text-xs uppercase tracking-wide">
                    {delivery.kind === 'REMINDER' ? 'Reminder' : 'Dispatch'}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`px-2.5 py-1 rounded-full text-xs font-semibold ring-1 ${
                        delivery.status === 'SENT'
                          ? 'bg-sage-50 text-sage-700 ring-sage-500/20'
                          : delivery.status === 'SIMULATED'
                            ? 'bg-slate-blue-50 text-slate-blue-700 ring-slate-blue-500/20'
                            : 'bg-red-50 text-red-700 ring-red-500/20'
                      }`}
                      title={delivery.error}
                    >
                      {delivery.status === 'SIMULATED' ? 'Local outbox' : delivery.status.toLowerCase()}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-zinc-500 text-xs">{formatDate(delivery.sentAt)}</td>
                </tr>
              ))}
              {request.deliveries.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-sm text-zinc-500">
                    No email was delivered for this request.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>
  );
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white border border-slate-200/50 rounded-[2rem] p-6 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)]">
      <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">{label}</p>
      <p className="text-3xl font-semibold tracking-tight text-zinc-900 mt-2">{value}</p>
    </div>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
