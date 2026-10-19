import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  ArrowRight,
  EnvelopeSimple,
  MagnifyingGlass,
  PaperPlaneTilt,
  TreeStructure,
  UserPlus,
  Users,
  X,
} from '@phosphor-icons/react';

import OrgTree, { ORG_TYPE_STYLES } from '../../components/organogram/OrgTree';
import { useToast } from '../../components/ToastProvider';
import { dataItemLabel } from '../../lib/data-catalogue';
import {
  ORG_UNIT_TYPES,
  ORG_UNIT_TYPE_LABELS,
  getUnit,
  unitBreadcrumb,
  type OrgUnitType,
} from '../../lib/organogram';
import type { NodalOfficer, UnitCoverage } from '../../lib/types';

const spring = { type: 'spring' as const, stiffness: 100, damping: 20 };

interface OrganogramPayload {
  officers: NodalOfficer[];
  coverage: Record<string, UnitCoverage>;
  stats: {
    units: number;
    covered: number;
    uncovered: number;
    officers: number;
    openRequests: number;
  };
}

export default function AdminOrganogram() {
  const { showToast } = useToast();
  const [data, setData] = useState<OrganogramPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<OrgUnitType[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [activeId, setActiveId] = useState<string | null>('director');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch('/api/organogram/');
        if (!response.ok) throw new Error('Unable to load the organogram.');
        const payload = (await response.json()) as OrganogramPayload;
        if (!cancelled) setData(payload);
      } catch (error) {
        if (!cancelled) showToast((error as Error).message, 'error');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [showToast]);

  const officersById = useMemo(
    () => new Map((data?.officers ?? []).map((officer) => [officer.id, officer])),
    [data],
  );

  const activeUnit = activeId ? getUnit(activeId) : undefined;
  const activeCoverage = activeId ? data?.coverage?.[activeId] : undefined;
  const activeOfficers = (activeCoverage?.officerIds ?? [])
    .map((id) => officersById.get(id))
    .filter((officer): officer is NodalOfficer => Boolean(officer));

  const toggleType = (type: OrgUnitType) =>
    setTypeFilter((prev) =>
      prev.includes(type) ? prev.filter((value) => value !== type) : [...prev, type],
    );

  const composerHref = selectedIds.length
    ? `/admin/data-requests/new?units=${encodeURIComponent(selectedIds.join(','))}`
    : '/admin/data-requests/new';

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
            Institute Organogram
          </h1>
          <p className="text-zinc-500 mt-2 max-w-[65ch] leading-relaxed">
            The academic, administrative and functional hierarchy of IIT Mandi. Select the sections
            that hold the evidence, then dispatch a targeted data request to their nodal officers.
          </p>
        </div>
        <Link
          to={composerHref}
          className="bg-sage-600 hover:bg-sage-700 active:scale-[0.98] text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-all shadow-[0_8px_16px_-4px_rgba(90,115,89,0.3)] flex items-center gap-2 shrink-0"
        >
          <PaperPlaneTilt weight="bold" className="w-4 h-4" />
          New Data Request
        </Link>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Mapped sections" value={data?.stats?.units ?? 57} loading={loading} />
        <StatCard label="Sections covered" value={data?.stats?.covered ?? 16} loading={loading} tone="sage" />
        <StatCard
          label="Without an officer"
          value={data?.stats?.uncovered ?? 41}
          loading={loading}
          tone="warn"
        />
        <StatCard label="Open requests" value={data?.stats?.openRequests ?? 0} loading={loading} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-6">
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
                placeholder="Search a school, office or functional section..."
                className="w-full pl-10 pr-4 py-2.5 bg-zinc-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sage-500/20 focus:border-sage-500/50 transition-all placeholder:text-zinc-400"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {ORG_UNIT_TYPES.map((type) => {
                const active = typeFilter.includes(type);
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => toggleType(type)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold ring-1 transition-all ${
                      active
                        ? 'bg-zinc-900 text-white ring-zinc-900'
                        : `${ORG_TYPE_STYLES[type].chip} hover:brightness-95`
                    }`}
                  >
                    {ORG_UNIT_TYPE_LABELS[type]}
                  </button>
                );
              })}
              {(typeFilter.length > 0 || query) && (
                <button
                  type="button"
                  onClick={() => {
                    setTypeFilter([]);
                    setQuery('');
                  }}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 transition-colors flex items-center gap-1"
                >
                  <X weight="bold" className="w-3 h-3" /> Clear
                </button>
              )}
            </div>
          </div>

          <div className="p-3 max-h-[640px] overflow-y-auto">
            {loading ? (
              <div className="space-y-2 p-3">
                {Array.from({ length: 8 }).map((_, index) => (
                  <div key={index} className="h-11 rounded-xl bg-zinc-100 animate-pulse" />
                ))}
              </div>
            ) : (
              <OrgTree
                selectable
                selectedIds={selectedIds}
                onSelectionChange={setSelectedIds}
                activeId={activeId}
                onActivate={setActiveId}
                coverage={data?.coverage}
                query={query}
                typeFilter={typeFilter}
              />
            )}
          </div>

          {selectedIds.length > 0 && (
            <div className="sticky bottom-0 border-t border-slate-100 bg-white/90 backdrop-blur-xl p-4 flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm text-zinc-600">
                <span className="font-semibold text-zinc-900">{selectedIds.length}</span> section
                {selectedIds.length === 1 ? '' : 's'} selected
                <button
                  type="button"
                  onClick={() => setSelectedIds([])}
                  className="ml-3 text-xs font-semibold text-zinc-400 hover:text-zinc-700"
                >
                  Clear selection
                </button>
              </div>
              <Link
                to={composerHref}
                className="bg-zinc-900 hover:bg-black active:scale-[0.98] text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center gap-2"
              >
                Request data from selection
                <ArrowRight weight="bold" className="w-4 h-4" />
              </Link>
            </div>
          )}
        </div>

        <aside className="bg-white border border-slate-200/50 rounded-[2rem] p-6 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)] h-fit xl:sticky xl:top-4">
          {activeUnit ? (
            <div className="space-y-6">
              <div>
                <div className="flex items-center gap-2 flex-wrap text-xs text-zinc-400 mb-3">
                  {unitBreadcrumb(activeUnit.id).map((crumb, index) => (
                    <span key={`${crumb}-${index}`} className="flex items-center gap-2">
                      {index > 0 && <span className="text-zinc-300">/</span>}
                      {crumb}
                    </span>
                  ))}
                </div>
                <h2 className="text-xl font-semibold tracking-tight text-zinc-900">
                  {activeUnit.name}
                </h2>
                <div className="flex items-center gap-2 mt-3">
                  <span
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold ring-1 ${ORG_TYPE_STYLES[activeUnit.type].chip}`}
                  >
                    {ORG_UNIT_TYPE_LABELS[activeUnit.type]}
                  </span>
                  {activeUnit.head && (
                    <span className="text-xs text-zinc-500 truncate">{activeUnit.head}</span>
                  )}
                </div>
                {activeUnit.description && (
                  <p className="text-sm text-zinc-500 leading-relaxed mt-4">
                    {activeUnit.description}
                  </p>
                )}
                {activeUnit.email && (
                  <a
                    href={`mailto:${activeUnit.email}`}
                    className="mt-4 flex items-center gap-2 text-sm text-slate-blue-600 hover:text-slate-blue-700"
                  >
                    <EnvelopeSimple weight="bold" className="w-4 h-4" />
                    {activeUnit.email}
                  </a>
                )}
              </div>

              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-3">
                  Data custodianship
                </h3>
                {activeUnit.dataScopes.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {activeUnit.dataScopes.map((scope) => (
                      <span
                        key={scope}
                        className="px-2.5 py-1 rounded-lg bg-zinc-100 text-zinc-600 text-xs font-medium"
                      >
                        {dataItemLabel(scope)}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-zinc-400">No ranking data is sourced from this node.</p>
                )}
              </div>

              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-3">
                  Nodal officers
                </h3>
                {activeOfficers.length > 0 ? (
                  <ul className="space-y-2">
                    {activeOfficers.map((officer) => (
                      <li
                        key={officer.id}
                        className="p-3 rounded-xl border border-slate-200/60 bg-zinc-50/50"
                      >
                        <p className="text-sm font-medium text-zinc-900">{officer.name}</p>
                        <p className="text-xs text-zinc-500 truncate">{officer.email}</p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="p-4 rounded-xl bg-orange-50 border border-orange-200/60 text-sm text-orange-700">
                    No nodal officer is assigned to this section yet.
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-slate-100 flex flex-col gap-2">
                <Link
                  to={`/admin/nodal-officers?unit=${encodeURIComponent(activeUnit.id)}`}
                  className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 transition-colors"
                >
                  <UserPlus weight="bold" className="w-4 h-4" /> Assign nodal officer
                </Link>
                <Link
                  to={`/admin/data-requests/new?units=${encodeURIComponent(activeUnit.id)}`}
                  className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-xl bg-sage-600 hover:bg-sage-700 text-white text-sm font-semibold transition-colors"
                >
                  <PaperPlaneTilt weight="bold" className="w-4 h-4" /> Request data
                </Link>
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-zinc-400">
              <TreeStructure weight="duotone" className="w-10 h-10 mx-auto mb-3" />
              <p className="text-sm">Select a section to inspect its custodianship and officers.</p>
            </div>
          )}
        </aside>
      </div>
    </motion.div>
  );
}

function StatCard({
  label,
  value,
  loading,
  tone = 'neutral',
}: {
  label: string;
  value: number;
  loading: boolean;
  tone?: 'neutral' | 'sage' | 'warn';
}) {
  const toneStyles =
    tone === 'sage' ? 'text-sage-700' : tone === 'warn' ? 'text-orange-600' : 'text-zinc-900';
  return (
    <div className="bg-white border border-slate-200/50 rounded-2xl p-5 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)]">
      <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 flex items-center gap-2">
        <Users weight="bold" className="w-3.5 h-3.5 text-zinc-300" />
        {label}
      </p>
      {loading ? (
        <div className="h-8 w-12 mt-2 rounded-lg bg-zinc-100 animate-pulse" />
      ) : (
        <p className={`text-3xl font-semibold tracking-tight mt-2 ${toneStyles}`}>{value}</p>
      )}
    </div>
  );
}
