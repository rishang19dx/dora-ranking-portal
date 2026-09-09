"use client";

import React, { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'motion/react';
import {
  ArrowLeft,
  ArrowRight,
  CalendarBlank,
  Check,
  Envelope,
  Lightning,
  MagnifyingGlass,
  PaperPlaneTilt,
  Sparkle,
  Users,
  Warning,
} from '@phosphor-icons/react';

import OrgTree, { ORG_TYPE_STYLES } from '@/components/organogram/OrgTree';
import { useToast } from '@/components/ToastProvider';
import {
  DATA_CATALOGUE,
  PARAMETER_GROUP_LABELS,
  PARAMETER_GROUP_ORDER,
  getDataItem,
  suggestedDataItemIds,
  type ParameterGroup,
  type RankingFramework,
} from '@/lib/data-catalogue';
import {
  DEAN_UNIT_IDS,
  ORG_UNITS,
  SCHOOL_UNIT_IDS,
  getUnit,
  unitLabel,
} from '@/lib/organogram';
import type { NodalOfficer } from '@/lib/types';

const spring = { type: 'spring' as const, stiffness: 100, damping: 20 };

const DEFAULT_MESSAGE = `Dear {{officer}},

The DORA office is compiling the institute's {{framework}} {{cycle}} submission. As the nodal officer for {{section}}, you are requested to provide the following data along with verifiable supporting proof:

{{dataItems}}

Please upload the data and proof documents through your restricted portal link below. The link is personal to you and scoped to {{section}} only:

{{portalLink}}

Submission deadline: {{deadline}}
Request reference: {{reference}}

Regards,
DORA Office
Indian Institute of Technology Mandi`;

const PLACEHOLDERS = [
  'officer',
  'section',
  'framework',
  'cycle',
  'deadline',
  'dataItems',
  'portalLink',
  'reference',
  'title',
];

const STEPS = ['Select sections', 'Identify required data', 'Compose & dispatch'];

export default function NewDataRequestPage() {
  return (
    <Suspense fallback={<div className="h-64 rounded-[2rem] bg-white/60 animate-pulse" />}>
      <NewDataRequest />
    </Suspense>
  );
}

function NewDataRequest() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showToast } = useToast();

  const [step, setStep] = useState(0);
  const [officers, setOfficers] = useState<NodalOfficer[]>([]);
  const [unitIds, setUnitIds] = useState<string[]>(() =>
    (searchParams.get('units') ?? '')
      .split(',')
      .map((id) => id.trim())
      .filter((id) => Boolean(getUnit(id))),
  );
  const [dataItemIds, setDataItemIds] = useState<string[]>([]);
  const [touchedItems, setTouchedItems] = useState(false);
  const [query, setQuery] = useState('');

  const nextYear = new Date().getFullYear() + 1;
  const [framework, setFramework] = useState<RankingFramework>('NIRF');
  const [cycleYear, setCycleYear] = useState(nextYear);
  const [deadline, setDeadline] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() + 21);
    return date.toISOString().slice(0, 10);
  });
  const [title, setTitle] = useState(`NIRF ${nextYear} Institutional Data Call`);
  const [subject, setSubject] = useState('{{reference}} - Data required from {{section}}');
  const [message, setMessage] = useState(DEFAULT_MESSAGE);
  const [dispatching, setDispatching] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const response = await fetch('/api/nodal-officers');
        if (!response.ok) throw new Error('Unable to load nodal officers.');
        const body = (await response.json()) as { officers: NodalOfficer[] };
        setOfficers(body.officers);
      } catch (error) {
        showToast((error as Error).message, 'error');
      }
    })();
  }, [showToast]);

  const suggested = useMemo(() => suggestedDataItemIds(unitIds), [unitIds]);

  // Until the administrator edits the list, it tracks the selected sections.
  useEffect(() => {
    if (!touchedItems) setDataItemIds(suggested);
  }, [suggested, touchedItems]);

  const recipients = useMemo(() => {
    const rows: { unitId: string; officers: NodalOfficer[] }[] = unitIds.map((unitId) => ({
      unitId,
      officers: officers.filter(
        (officer) => officer.status !== 'REVOKED' && officer.unitIds.includes(unitId),
      ),
    }));
    return rows;
  }, [officers, unitIds]);

  const uncovered = recipients.filter((row) => row.officers.length === 0);
  const mailCount = recipients.reduce((total, row) => total + row.officers.length, 0);

  const toggleItem = (id: string) => {
    setTouchedItems(true);
    setDataItemIds((prev) =>
      prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id],
    );
  };

  const toggleGroup = (group: ParameterGroup) => {
    setTouchedItems(true);
    const groupIds = DATA_CATALOGUE.filter((item) => item.group === group).map((item) => item.id);
    const allSelected = groupIds.every((id) => dataItemIds.includes(id));
    setDataItemIds((prev) =>
      allSelected
        ? prev.filter((id) => !groupIds.includes(id))
        : Array.from(new Set([...prev, ...groupIds])),
    );
  };

  const quickPick = (ids: string[], label: string) => {
    setUnitIds((prev) => {
      const allSelected = ids.every((id) => prev.includes(id));
      const next = allSelected
        ? prev.filter((id) => !ids.includes(id))
        : Array.from(new Set([...prev, ...ids]));
      showToast(
        allSelected ? `${label} removed from the selection.` : `${label} added to the selection.`,
        'info',
      );
      return next;
    });
  };

  const preview = useMemo(() => {
    const first = recipients.find((row) => row.officers.length > 0);
    const unitId = first?.unitId ?? unitIds[0];
    const officer = first?.officers[0];
    const vars: Record<string, string> = {
      officer: officer?.name ?? 'Nodal Officer',
      section: unitId ? unitLabel(unitId) : 'Section',
      framework,
      cycle: String(cycleYear),
      deadline: deadline
        ? new Date(deadline).toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })
        : 'Deadline',
      dataItems: dataItemIds
        .map((id) => {
          const item = getDataItem(id);
          return item ? `  - ${item.label} (proof: ${item.proofFormats.join(', ')})` : `  - ${id}`;
        })
        .join('\n'),
      portalLink: `${typeof window === 'undefined' ? '' : window.location.origin}/portal/<personal-token>`,
      reference: `DORA/${cycleYear}/${framework}/NNN`,
      title,
    };
    const render = (template: string) =>
      template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (match, key: string) => vars[key] ?? match);
    return { subject: render(subject), body: render(message), officer, unitId };
  }, [cycleYear, dataItemIds, deadline, framework, message, recipients, subject, title, unitIds]);

  const canContinue = step === 0 ? unitIds.length > 0 : step === 1 ? dataItemIds.length > 0 : true;

  const dispatch = async () => {
    setDispatching(true);
    try {
      const response = await fetch('/api/data-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          subject,
          message,
          framework,
          cycleYear,
          deadline,
          unitIds,
          dataItemIds,
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? 'The request could not be dispatched.');

      const delivered = (body.sent ?? 0) + (body.simulated ?? 0);
      showToast(
        body.transport === 'outbox'
          ? `${body.request.reference} dispatched. ${delivered} message(s) written to the local outbox.`
          : `${body.request.reference} dispatched to ${delivered} nodal officer(s).`,
        'success',
      );
      router.push(`/admin/data-requests/${body.request.id}`);
    } catch (error) {
      showToast((error as Error).message, 'error');
      setDispatching(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={spring}
      className="max-w-[1400px] mx-auto space-y-8"
    >
      <div>
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-zinc-900">
          New Data Request
        </h1>
        <p className="text-zinc-500 mt-2 max-w-[70ch] leading-relaxed">
          Target the exact sections of the organogram that hold the evidence, state the data you
          need, and dispatch the request. Every recipient receives a restricted upload link scoped
          to their own section.
        </p>
      </div>

      <ol className="flex flex-col sm:flex-row gap-3">
        {STEPS.map((label, index) => (
          <li key={label} className="flex-1">
            <button
              type="button"
              onClick={() => index < step && setStep(index)}
              className={`w-full text-left px-5 py-4 rounded-2xl border transition-all ${
                index === step
                  ? 'bg-white border-sage-500/40 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.06)]'
                  : index < step
                    ? 'bg-white/60 border-slate-200/60 hover:border-sage-500/30'
                    : 'bg-white/40 border-slate-200/50'
              }`}
            >
              <span className="flex items-center gap-3">
                <span
                  className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
                    index < step
                      ? 'bg-sage-600 text-white'
                      : index === step
                        ? 'bg-zinc-900 text-white'
                        : 'bg-zinc-100 text-zinc-400'
                  }`}
                >
                  {index < step ? <Check weight="bold" className="w-4 h-4" /> : index + 1}
                </span>
                <span
                  className={`text-sm font-semibold ${index <= step ? 'text-zinc-900' : 'text-zinc-400'}`}
                >
                  {label}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ol>

      {step === 0 && (
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_340px] gap-6">
          <div className="bg-white border border-slate-200/50 rounded-[2rem] shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)] overflow-hidden">
            <div className="p-6 border-b border-slate-100 space-y-4">
              <div className="relative">
                <MagnifyingGlass
                  weight="bold"
                  className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400"
                />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search sections..."
                  className="w-full pl-10 pr-4 py-2.5 bg-zinc-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sage-500/20 focus:border-sage-500/50 transition-all"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <QuickPick
                  label="All schools & centres"
                  onClick={() => quickPick(SCHOOL_UNIT_IDS, 'Schools and centres')}
                />
                <QuickPick
                  label="Deans & Registrar"
                  onClick={() => quickPick(DEAN_UNIT_IDS, 'Deans and Registrar')}
                />
                <QuickPick
                  label="Administrative sections"
                  onClick={() =>
                    quickPick(
                      ORG_UNITS.filter(
                        (unit) => unit.type === 'ADMINISTRATIVE' && unit.dataScopes.length > 0,
                      ).map((unit) => unit.id),
                      'Administrative sections',
                    )
                  }
                />
                <QuickPick
                  label="Functional sections"
                  onClick={() =>
                    quickPick(
                      ORG_UNITS.filter(
                        (unit) => unit.type === 'FUNCTIONAL' && unit.dataScopes.length > 0,
                      ).map((unit) => unit.id),
                      'Functional sections',
                    )
                  }
                />
                {unitIds.length > 0 && (
                  <button
                    onClick={() => setUnitIds([])}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 transition-colors"
                  >
                    Clear all
                  </button>
                )}
              </div>
            </div>
            <div className="p-3 max-h-[560px] overflow-y-auto">
              <OrgTree
                selectable
                selectedIds={unitIds}
                onSelectionChange={setUnitIds}
                query={query}
              />
            </div>
          </div>

          <aside className="space-y-4 h-fit xl:sticky xl:top-4">
            <div className="bg-white border border-slate-200/50 rounded-[2rem] p-6 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)]">
              <h3 className="text-sm font-semibold text-zinc-900 flex items-center gap-2">
                <Users weight="duotone" className="w-5 h-5 text-sage-600" />
                Recipients
              </h3>
              <p className="text-3xl font-semibold tracking-tight text-zinc-900 mt-3">
                {mailCount}
              </p>
              <p className="text-sm text-zinc-500">
                nodal officer{mailCount === 1 ? '' : 's'} across {unitIds.length} section
                {unitIds.length === 1 ? '' : 's'}
              </p>

              {unitIds.length > 0 && (
                <ul className="mt-5 space-y-2 max-h-64 overflow-y-auto pr-1">
                  {recipients.map((row) => {
                    const unit = getUnit(row.unitId);
                    return (
                      <li
                        key={row.unitId}
                        className="p-3 rounded-xl border border-slate-200/60 bg-zinc-50/50"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium text-zinc-900 truncate">
                            {unitLabel(row.unitId)}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-md text-[11px] font-semibold ring-1 ${
                              unit ? ORG_TYPE_STYLES[unit.type].chip : ''
                            }`}
                          >
                            {row.officers.length}
                          </span>
                        </div>
                        <p className="text-xs text-zinc-500 mt-1 truncate">
                          {row.officers.length > 0
                            ? row.officers.map((officer) => officer.name).join(', ')
                            : 'No nodal officer assigned'}
                        </p>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {uncovered.length > 0 && (
              <div className="bg-orange-50/70 border border-orange-200/60 rounded-[2rem] p-6">
                <h3 className="text-sm font-semibold text-zinc-900 flex items-center gap-2">
                  <Warning weight="duotone" className="w-5 h-5 text-orange-600" />
                  {uncovered.length} section{uncovered.length === 1 ? '' : 's'} without an officer
                </h3>
                <p className="text-xs text-orange-700/80 mt-2 leading-relaxed">
                  These sections will be tracked on the request but no email can be delivered until
                  an officer is assigned.
                </p>
              </div>
            )}
          </aside>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200/50 rounded-[2rem] p-6 md:p-8 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)]">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <label className="block">
                <span className="block text-sm font-semibold text-zinc-700 mb-2">Framework</span>
                <select
                  value={framework}
                  onChange={(event) => setFramework(event.target.value as RankingFramework)}
                  className={inputClass}
                >
                  {(['NIRF', 'QS', 'THE', 'NAAC'] as RankingFramework[]).map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="block text-sm font-semibold text-zinc-700 mb-2">Cycle year</span>
                <input
                  type="number"
                  value={cycleYear}
                  onChange={(event) => setCycleYear(Number(event.target.value))}
                  className={inputClass}
                />
              </label>
              <label className="block">
                <span className="block text-sm font-semibold text-zinc-700 mb-2">
                  Submission deadline
                </span>
                <div className="relative">
                  <CalendarBlank
                    weight="bold"
                    className="w-4 h-4 absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none"
                  />
                  <input
                    type="date"
                    value={deadline}
                    onChange={(event) => setDeadline(event.target.value)}
                    className={inputClass}
                  />
                </div>
              </label>
            </div>
          </div>

          <div className="bg-white border border-slate-200/50 rounded-[2rem] p-6 md:p-8 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
              <div>
                <h3 className="text-xl font-semibold tracking-tight text-zinc-900">
                  Required data
                </h3>
                <p className="text-sm text-zinc-500 mt-1">
                  {dataItemIds.length} item{dataItemIds.length === 1 ? '' : 's'} selected. Items
                  marked{' '}
                  <span className="inline-flex items-center gap-1 text-sage-700 font-semibold">
                    <Sparkle weight="fill" className="w-3 h-3" /> suggested
                  </span>{' '}
                  are owned by the sections you selected.
                </p>
              </div>
              <button
                onClick={() => {
                  setTouchedItems(false);
                  setDataItemIds(suggested);
                }}
                className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-zinc-600 hover:bg-zinc-50 transition-colors flex items-center gap-2 shrink-0"
              >
                <Lightning weight="bold" className="w-4 h-4" /> Reset to suggested
              </button>
            </div>

            <div className="space-y-6">
              {PARAMETER_GROUP_ORDER.map((group) => {
                const items = DATA_CATALOGUE.filter((item) => item.group === group);
                if (items.length === 0) return null;
                const allSelected = items.every((item) => dataItemIds.includes(item.id));
                return (
                  <div key={group}>
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                        {PARAMETER_GROUP_LABELS[group]}
                      </h4>
                      <button
                        onClick={() => toggleGroup(group)}
                        className="text-xs font-semibold text-sage-700 hover:text-sage-800"
                      >
                        {allSelected ? 'Deselect all' : 'Select all'}
                      </button>
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                      {items.map((item) => {
                        const selected = dataItemIds.includes(item.id);
                        const isSuggested = suggested.includes(item.id);
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => toggleItem(item.id)}
                            className={`text-left p-4 rounded-2xl border transition-all ${
                              selected
                                ? 'border-sage-500/40 bg-sage-50/50 ring-1 ring-sage-500/20'
                                : 'border-slate-200/60 hover:border-sage-500/30 bg-white'
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              <span
                                className={`mt-0.5 w-[18px] h-[18px] rounded-md border flex items-center justify-center shrink-0 ${
                                  selected
                                    ? 'bg-sage-600 border-sage-600 text-white'
                                    : 'border-slate-300 bg-white'
                                }`}
                              >
                                {selected && <Check weight="bold" className="w-3 h-3" />}
                              </span>
                              <span className="min-w-0">
                                <span className="flex items-center gap-2 flex-wrap">
                                  <span className="text-sm font-medium text-zinc-900">
                                    {item.label}
                                  </span>
                                  {isSuggested && (
                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-sage-100 text-sage-700 text-[10px] font-bold uppercase tracking-wide">
                                      <Sparkle weight="fill" className="w-2.5 h-2.5" /> Suggested
                                    </span>
                                  )}
                                </span>
                                <span className="block text-xs text-zinc-500 mt-1 leading-relaxed">
                                  {item.description}
                                </span>
                                <span className="block text-[11px] text-zinc-400 mt-2">
                                  Proof: {item.proofFormats.join(', ')} &middot;{' '}
                                  {item.frameworks.join(' / ')}
                                </span>
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_400px] gap-6">
          <div className="bg-white border border-slate-200/50 rounded-[2rem] p-6 md:p-8 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)] space-y-5">
            <label className="block">
              <span className="block text-sm font-semibold text-zinc-700 mb-2">Request title</span>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className={inputClass}
              />
            </label>
            <label className="block">
              <span className="block text-sm font-semibold text-zinc-700 mb-2">Email subject</span>
              <input
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                className={inputClass}
              />
            </label>
            <label className="block">
              <span className="block text-sm font-semibold text-zinc-700 mb-2">Message</span>
              <textarea
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                rows={16}
                className={`${inputClass} font-mono text-[13px] leading-relaxed`}
              />
            </label>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2">
                Placeholders
              </p>
              <div className="flex flex-wrap gap-2">
                {PLACEHOLDERS.map((placeholder) => (
                  <button
                    key={placeholder}
                    type="button"
                    onClick={() => setMessage((prev) => `${prev}{{${placeholder}}}`)}
                    className="px-2.5 py-1 rounded-lg bg-zinc-100 text-zinc-600 text-xs font-mono hover:bg-sage-50 hover:text-sage-700 transition-colors"
                  >
                    {`{{${placeholder}}}`}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <aside className="space-y-4 h-fit xl:sticky xl:top-4">
            <div className="bg-white border border-slate-200/50 rounded-[2rem] p-6 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)]">
              <h3 className="text-sm font-semibold text-zinc-900 flex items-center gap-2 mb-4">
                <Envelope weight="duotone" className="w-5 h-5 text-slate-blue-600" />
                Preview
                {preview.officer && (
                  <span className="text-xs font-normal text-zinc-500 truncate">
                    for {preview.officer.name}
                  </span>
                )}
              </h3>
              <p className="text-xs font-semibold text-zinc-900 border-b border-slate-100 pb-3">
                {preview.subject}
              </p>
              <pre className="text-[12px] text-zinc-600 whitespace-pre-wrap font-sans leading-relaxed mt-3 max-h-80 overflow-y-auto">
                {preview.body}
              </pre>
            </div>

            <div className="bg-zinc-900 text-white rounded-[2rem] p-6">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <PaperPlaneTilt weight="duotone" className="w-5 h-5" /> Dispatch summary
              </h3>
              <dl className="mt-4 space-y-2 text-sm">
                <SummaryRow label="Sections" value={String(unitIds.length)} />
                <SummaryRow label="Recipients" value={String(mailCount)} />
                <SummaryRow label="Data items" value={String(dataItemIds.length)} />
                <SummaryRow
                  label="Deadline"
                  value={
                    deadline
                      ? new Date(deadline).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })
                      : '-'
                  }
                />
              </dl>
              {uncovered.length > 0 && (
                <p className="mt-4 text-xs text-orange-300 leading-relaxed">
                  {uncovered.length} selected section{uncovered.length === 1 ? '' : 's'} have no
                  officer and will receive no email.
                </p>
              )}
              <button
                onClick={dispatch}
                disabled={dispatching || mailCount === 0}
                className="mt-5 w-full bg-white text-zinc-900 hover:bg-zinc-100 disabled:opacity-50 disabled:cursor-not-allowed px-5 py-3 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2"
              >
                {dispatching ? 'Dispatching...' : 'Dispatch request & provision access'}
              </button>
              {mailCount === 0 && (
                <p className="mt-3 text-xs text-zinc-400">
                  Assign a nodal officer to at least one selected section first.
                </p>
              )}
            </div>
          </aside>
        </div>
      )}

      <div className="flex items-center justify-between gap-4">
        <button
          onClick={() => setStep((prev) => Math.max(0, prev - 1))}
          disabled={step === 0}
          className="px-5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-zinc-600 hover:bg-white disabled:opacity-40 transition-all flex items-center gap-2"
        >
          <ArrowLeft weight="bold" className="w-4 h-4" /> Back
        </button>
        {step < 2 && (
          <button
            onClick={() => canContinue && setStep((prev) => prev + 1)}
            disabled={!canContinue}
            className="bg-zinc-900 hover:bg-black active:scale-[0.98] disabled:opacity-40 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center gap-2"
          >
            Continue <ArrowRight weight="bold" className="w-4 h-4" />
          </button>
        )}
      </div>
    </motion.div>
  );
}

const inputClass =
  'w-full bg-zinc-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sage-500/20 focus:border-sage-500/50 transition-all placeholder:text-zinc-400';

function QuickPick({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-3 py-1.5 rounded-lg bg-zinc-100 text-zinc-700 text-xs font-semibold hover:bg-sage-50 hover:text-sage-700 transition-colors"
    >
      {label}
    </button>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-zinc-400">{label}</dt>
      <dd className="font-semibold">{value}</dd>
    </div>
  );
}
