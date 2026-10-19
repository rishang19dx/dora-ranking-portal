"use client";

import React, { useCallback, useMemo, useState } from 'react';
import {
  Bank,
  Briefcase,
  Buildings,
  CaretRight,
  Check,
  GearSix,
  GraduationCap,
  Minus,
  TreeStructure,
  UserCheck,
  Warning,
} from '@phosphor-icons/react';

import {
  ORGANOGRAM,
  ORG_UNIT_TYPE_LABELS,
  getAncestorIds,
  getDescendantIds,
  type OrgUnit,
  type OrgUnitType,
} from '@/lib/organogram';
import type { UnitCoverage } from '@/lib/types';

export const ORG_TYPE_STYLES: Record<OrgUnitType, { chip: string; icon: React.ReactNode }> = {
  GOVERNANCE: {
    chip: 'bg-slate-blue-50 text-slate-blue-700 ring-slate-blue-500/20',
    icon: <Bank weight="duotone" className="w-4 h-4" />,
  },
  EXECUTIVE: {
    chip: 'bg-soft-gold-50 text-soft-gold-700 ring-soft-gold-500/20',
    icon: <Buildings weight="duotone" className="w-4 h-4" />,
  },
  ACADEMIC: {
    chip: 'bg-sage-50 text-sage-700 ring-sage-500/20',
    icon: <GraduationCap weight="duotone" className="w-4 h-4" />,
  },
  ADMINISTRATIVE: {
    chip: 'bg-dusty-rose-50 text-dusty-rose-700 ring-dusty-rose-500/20',
    icon: <Briefcase weight="duotone" className="w-4 h-4" />,
  },
  FUNCTIONAL: {
    chip: 'bg-zinc-100 text-zinc-600 ring-zinc-400/20',
    icon: <GearSix weight="duotone" className="w-4 h-4" />,
  },
};

export type SelectionState = 'checked' | 'partial' | 'none';

interface OrgTreeProps {
  /** Show checkboxes and emit selection changes. */
  selectable?: boolean;
  selectedIds?: string[];
  onSelectionChange?: (ids: string[]) => void;
  activeId?: string | null;
  onActivate?: (id: string) => void;
  /** Officer/request coverage keyed by unit id. */
  coverage?: Record<string, UnitCoverage>;
  query?: string;
  typeFilter?: OrgUnitType[];
  /** Units that cannot be selected (for example, the institute root). */
  lockedIds?: string[];
  className?: string;
}

function matchesQuery(unit: OrgUnit, needle: string): boolean {
  if (!needle) return true;
  return [unit.name, unit.shortName, unit.head, unit.email, unit.description]
    .filter(Boolean)
    .some((field) => field!.toLowerCase().includes(needle));
}

export default function OrgTree({
  selectable = false,
  selectedIds = [],
  onSelectionChange,
  activeId = null,
  onActivate,
  coverage,
  query = '',
  typeFilter,
  lockedIds = ['iit-mandi'],
  className = '',
}: OrgTreeProps) {
  const [collapsed, setCollapsed] = useState<Set<string>>(
    () => new Set(['standing-committee']),
  );

  const selected = useMemo(() => new Set(selectedIds), [selectedIds]);
  const locked = useMemo(() => new Set(lockedIds), [lockedIds]);
  const needle = query.trim().toLowerCase();
  const filtering = needle.length > 0 || (typeFilter !== undefined && typeFilter.length > 0);

  /** Ids to render: direct matches plus every ancestor that leads to one. */
  const visible = useMemo(() => {
    if (!filtering) return null;
    const ids = new Set<string>();
    const walk = (unit: OrgUnit) => {
      const typeOk = !typeFilter || typeFilter.length === 0 || typeFilter.includes(unit.type);
      if (typeOk && matchesQuery(unit, needle)) {
        ids.add(unit.id);
        getAncestorIds(unit.id).forEach((ancestorId) => ids.add(ancestorId));
      }
      unit.children?.forEach(walk);
    };
    walk(ORGANOGRAM);
    return ids;
  }, [filtering, needle, typeFilter]);

  const toggleCollapse = useCallback((id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectionState = useCallback(
    (unit: OrgUnit): SelectionState => {
      if (selected.has(unit.id)) return 'checked';
      const descendants = getDescendantIds(unit.id);
      return descendants.some((id) => selected.has(id)) ? 'partial' : 'none';
    },
    [selected],
  );

  const applySelection = useCallback(
    (ids: string[], shouldSelect: boolean) => {
      if (!onSelectionChange) return;
      const next = new Set(selected);
      ids.filter((id) => !locked.has(id)).forEach((id) => {
        if (shouldSelect) next.add(id);
        else next.delete(id);
      });
      onSelectionChange(Array.from(next));
    },
    [locked, onSelectionChange, selected],
  );

  const toggleUnit = useCallback(
    (unit: OrgUnit) => applySelection([unit.id], !selected.has(unit.id)),
    [applySelection, selected],
  );

  const toggleSubtree = useCallback(
    (unit: OrgUnit) => {
      const ids = getDescendantIds(unit.id, true);
      const allSelected = ids.filter((id) => !locked.has(id)).every((id) => selected.has(id));
      applySelection(ids, !allSelected);
    },
    [applySelection, locked, selected],
  );

  const renderNode = (unit: OrgUnit, depth: number): React.ReactNode => {
    if (visible && !visible.has(unit.id)) return null;

    const children = unit.children ?? [];
    const hasChildren = children.length > 0;
    const isCollapsed = !filtering && collapsed.has(unit.id);
    const state = selectable ? selectionState(unit) : 'none';
    const unitCoverage = coverage?.[unit.id];
    const officerCount = unitCoverage?.officerIds.length ?? 0;
    const isActive = activeId === unit.id;
    const style = ORG_TYPE_STYLES[unit.type];

    return (
      <li key={unit.id} className="relative">
        <div
          className={`group flex items-center gap-2 rounded-xl pr-3 transition-colors ${
            isActive ? 'bg-sage-50/80 ring-1 ring-sage-500/20' : 'hover:bg-zinc-50'
          }`}
          style={{ paddingLeft: `${depth * 18 + 4}px` }}
        >
          <button
            type="button"
            onClick={() => hasChildren && toggleCollapse(unit.id)}
            aria-label={hasChildren ? (isCollapsed ? 'Expand section' : 'Collapse section') : undefined}
            className={`shrink-0 p-1.5 rounded-lg text-zinc-400 transition-transform ${
              hasChildren ? 'hover:bg-zinc-100 hover:text-zinc-600' : 'invisible'
            } ${hasChildren && !isCollapsed ? 'rotate-90' : ''}`}
          >
            <CaretRight weight="bold" className="w-3.5 h-3.5" />
          </button>

          {selectable && (
            <button
              type="button"
              disabled={locked.has(unit.id)}
              onClick={() => toggleUnit(unit)}
              aria-pressed={state === 'checked'}
              aria-label={`Select ${unit.name}`}
              className={`shrink-0 w-[18px] h-[18px] rounded-md border flex items-center justify-center transition-all ${
                locked.has(unit.id)
                  ? 'border-slate-200 bg-slate-100 cursor-not-allowed'
                  : state === 'checked'
                    ? 'bg-sage-600 border-sage-600 text-white'
                    : state === 'partial'
                      ? 'bg-sage-50 border-sage-400 text-sage-600'
                      : 'border-slate-300 hover:border-sage-500 bg-white'
              }`}
            >
              {state === 'checked' && <Check weight="bold" className="w-3 h-3" />}
              {state === 'partial' && <Minus weight="bold" className="w-3 h-3" />}
            </button>
          )}

          <button
            type="button"
            onClick={() => onActivate?.(unit.id)}
            className="flex-1 min-w-0 flex items-center gap-2.5 py-2 text-left"
          >
            <span className={`shrink-0 rounded-lg p-1.5 ring-1 ${style.chip}`}>{style.icon}</span>
            <span className="min-w-0">
              <span className="flex items-center gap-2">
                <span className="text-sm font-medium text-zinc-900 truncate">
                  {unit.shortName ?? unit.name}
                </span>
                {unit.shortName && (
                  <span className="hidden lg:inline text-xs text-zinc-400 truncate">{unit.name}</span>
                )}
              </span>
              {unit.head && <span className="block text-xs text-zinc-500 truncate">{unit.head}</span>}
            </span>
          </button>

          <div className="shrink-0 flex items-center gap-1.5">
            {coverage && !locked.has(unit.id) && (
              officerCount > 0 ? (
                <span
                  title={`${officerCount} nodal officer${officerCount === 1 ? '' : 's'} assigned`}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg bg-sage-50 text-sage-700 text-xs font-semibold ring-1 ring-sage-500/20"
                >
                  <UserCheck weight="bold" className="w-3.5 h-3.5" /> {officerCount}
                </span>
              ) : (
                <span
                  title="No nodal officer assigned"
                  className="flex items-center gap-1 px-2 py-1 rounded-lg bg-orange-50 text-orange-600 text-xs font-semibold ring-1 ring-orange-500/20"
                >
                  <Warning weight="bold" className="w-3.5 h-3.5" />
                </span>
              )
            )}
            {unitCoverage && unitCoverage.pendingRequests > 0 && (
              <span
                title={`${unitCoverage.pendingRequests} pending data request(s)`}
                className="px-2 py-1 rounded-lg bg-soft-gold-50 text-soft-gold-700 text-xs font-semibold ring-1 ring-soft-gold-500/20"
              >
                {unitCoverage.pendingRequests} due
              </span>
            )}
            {selectable && hasChildren && (
              <button
                type="button"
                onClick={() => toggleSubtree(unit)}
                title="Select this section and everything under it"
                className="p-1.5 rounded-lg text-zinc-300 hover:text-sage-600 hover:bg-sage-50 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
              >
                <TreeStructure weight="bold" className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {hasChildren && !isCollapsed && (
          <ul className="relative">
            <span
              aria-hidden
              className="absolute top-0 bottom-2 w-px bg-slate-200"
              style={{ left: `${depth * 18 + 13}px` }}
            />
            {children.map((child) => renderNode(child, depth + 1))}
          </ul>
        )}
      </li>
    );
  };

  const rendered = renderNode(ORGANOGRAM, 0);

  return (
    <div className={className}>
      {rendered ? (
        <ul>{rendered}</ul>
      ) : (
        <p className="px-4 py-10 text-center text-sm text-zinc-500">
          No section matches the current filters.
        </p>
      )}
    </div>
  );
}

export function typeLabel(type: OrgUnitType): string {
  return ORG_UNIT_TYPE_LABELS[type];
}
