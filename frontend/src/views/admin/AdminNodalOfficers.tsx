"use client";

import React, { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowCounterClockwise,
  EnvelopeSimple,
  MagnifyingGlass,
  PaperPlaneTilt,
  PencilSimple,
  Phone,
  Prohibit,
  TrashSimple,
  TreeStructure,
  UserPlus,
  Warning,
  X,
} from '@phosphor-icons/react';

import OrgTree, { ORG_TYPE_STYLES } from '../../components/organogram/OrgTree';
import { useToast } from '../../components/ToastProvider';
import { ORG_UNITS, getUnit, unitLabel } from '../../lib/organogram';
import type { NodalOfficer, OfficerStatus, UnitCoverage } from '../../lib/types';

const spring = { type: 'spring' as const, stiffness: 100, damping: 20 };

interface RosterPayload {
  officers: NodalOfficer[];
  coverage: Record<string, UnitCoverage>;
}

interface OfficerForm {
  name: string;
  designation: string;
  email: string;
  phone: string;
  unitIds: string[];
  notes: string;
}

const EMPTY_FORM: OfficerForm = {
  name: '',
  designation: '',
  email: '',
  phone: '',
  unitIds: [],
  notes: '',
};

const STATUS_STYLES: Record<OfficerStatus, string> = {
  ACTIVE: 'bg-sage-50 text-sage-700 ring-sage-500/20',
  INVITED: 'bg-soft-gold-50 text-soft-gold-700 ring-soft-gold-500/20',
  REVOKED: 'bg-zinc-100 text-zinc-500 ring-zinc-400/20',
};

export default function NodalOfficersPage() {
  return (
    <Suspense fallback={<div className="h-64 rounded-[2rem] bg-white/60 animate-pulse" />}>
      <NodalOfficers />
    </Suspense>
  );
}

function NodalOfficers() {
  const { showToast } = useToast();
  const [searchParams] = useSearchParams();
  const unitParam = searchParams.get('unit');

  const [data, setData] = useState<RosterPayload>({ officers: [], coverage: {} });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [unitFilter, setUnitFilter] = useState<string | null>(unitParam);
  const [editing, setEditing] = useState<NodalOfficer | null>(null);
  const [form, setForm] = useState<OfficerForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/nodal-officers');
      if (!response.ok) throw new Error('Unable to load the nodal officer roster.');
      setData((await response.json()) as RosterPayload);
    } catch (error) {
      showToast((error as Error).message, 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setUnitFilter(unitParam);
  }, [unitParam]);

  const uncoveredUnits = useMemo(
    () =>
      ORG_UNITS.filter(
        (unit) =>
          unit.id !== 'iit-mandi' &&
          unit.dataScopes.length > 0 &&
          (data.coverage[unit.id]?.officerIds.length ?? 0) === 0,
      ),
    [data.coverage],
  );

  const visibleOfficers = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return data.officers.filter((officer) => {
      if (unitFilter && !officer.unitIds.includes(unitFilter)) return false;
      if (!needle) return true;
      return [officer.name, officer.email, officer.designation, ...officer.unitIds.map(unitLabel)]
        .filter(Boolean)
        .some((field) => field!.toLowerCase().includes(needle));
    });
  }, [data.officers, search, unitFilter]);

  const openCreate = (unitIds: string[] = []) => {
    setEditing(null);
    setForm({ ...EMPTY_FORM, unitIds });
  };

  const openEdit = (officer: NodalOfficer) => {
    setEditing(officer);
    setForm({
      name: officer.name,
      designation: officer.designation ?? '',
      email: officer.email,
      phone: officer.phone ?? '',
      unitIds: officer.unitIds,
      notes: officer.notes ?? '',
    });
  };

  const submitForm = async () => {
    if (!form) return;
    if (!form.name.trim()) return showToast('Enter the officer name.', 'error');
    if (!form.email.trim()) return showToast('Enter the official email address.', 'error');
    if (form.unitIds.length === 0)
      return showToast('Assign at least one organogram section.', 'error');

    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        designation: form.designation.trim() || undefined,
        email: form.email.trim(),
        phone: form.phone.trim() || undefined,
        notes: form.notes.trim() || undefined,
        unitIds: form.unitIds,
      };
      const response = await fetch(
        editing ? `/api/nodal-officers/${editing.id}` : '/api/nodal-officers',
        {
          method: editing ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
      );
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? 'The officer could not be saved.');

      showToast(
        editing ? 'Nodal officer updated.' : `${payload.name} added to the roster.`,
        'success',
      );
      setForm(null);
      setEditing(null);
      await load();
    } catch (error) {
      showToast((error as Error).message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const runAccessAction = async (officer: NodalOfficer, action: 'INVITE' | 'REVOKE' | 'RESTORE') => {
    setBusyId(officer.id);
    try {
      const response = await fetch(`/api/nodal-officers/${officer.id}/access`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message ?? body.error ?? 'The action failed.');
      showToast(body.message ?? 'Done.', action === 'REVOKE' ? 'info' : 'success');
      await load();
    } catch (error) {
      showToast((error as Error).message, 'error');
    } finally {
      setBusyId(null);
    }
  };

  const removeOfficer = async (officer: NodalOfficer) => {
    setBusyId(officer.id);
    try {
      const response = await fetch(`/api/nodal-officers/${officer.id}`, { method: 'DELETE' });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error ?? 'The officer could not be removed.');
      }
      showToast(`${officer.name} removed and all portal links invalidated.`, 'info');
      await load();
    } catch (error) {
      showToast((error as Error).message, 'error');
    } finally {
      setBusyId(null);
    }
  };

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
            Nodal Officers
          </h1>
          <p className="text-zinc-500 mt-2 max-w-[65ch] leading-relaxed">
            The roster of designated officers for every department and section of the organogram.
            Assignments here decide who receives a targeted data request.
          </p>
        </div>
        <button
          onClick={() => openCreate()}
          className="bg-sage-600 hover:bg-sage-700 active:scale-[0.98] text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-all shadow-[0_8px_16px_-4px_rgba(90,115,89,0.3)] flex items-center gap-2 shrink-0"
        >
          <UserPlus weight="bold" className="w-4 h-4" /> Add Officer
        </button>
      </div>

      {uncoveredUnits.length > 0 && (
        <div className="bg-orange-50/70 border border-orange-200/60 rounded-[2rem] p-6">
          <div className="flex items-start gap-4">
            <span className="p-2.5 rounded-xl bg-white text-orange-600 shadow-sm shrink-0">
              <Warning weight="duotone" className="w-5 h-5" />
            </span>
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold text-zinc-900">
                {uncoveredUnits.length} data-owning section
                {uncoveredUnits.length === 1 ? ' has' : 's have'} no nodal officer
              </h3>
              <p className="text-sm text-orange-700/80 mt-1">
                Requests sent to these sections will have no recipient until an officer is assigned.
              </p>
              <div className="flex flex-wrap gap-2 mt-4">
                {uncoveredUnits.slice(0, 10).map((unit) => (
                  <button
                    key={unit.id}
                    onClick={() => openCreate([unit.id])}
                    className="px-3 py-1.5 rounded-lg bg-white border border-orange-200/60 text-xs font-semibold text-zinc-700 hover:border-orange-400 hover:text-orange-700 transition-colors"
                  >
                    {unit.shortName ?? unit.name}
                  </button>
                ))}
                {uncoveredUnits.length > 10 && (
                  <span className="px-3 py-1.5 text-xs font-semibold text-orange-700/70">
                    +{uncoveredUnits.length - 10} more
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white border border-slate-200/50 rounded-[2rem] shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)] overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
          <div className="relative flex-1 max-w-md">
            <MagnifyingGlass
              weight="bold"
              className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400"
            />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by name, email or section..."
              className="w-full pl-10 pr-4 py-2.5 bg-zinc-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sage-500/20 focus:border-sage-500/50 transition-all placeholder:text-zinc-400"
            />
          </div>
          {unitFilter && (
            <div className="flex items-center gap-2 text-sm text-zinc-600">
              <span className="px-3 py-1.5 rounded-lg bg-sage-50 text-sage-700 text-xs font-semibold ring-1 ring-sage-500/20">
                Section: {unitLabel(unitFilter)}
              </span>
              <button
                onClick={() => setUnitFilter(null)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100"
                aria-label="Clear section filter"
              >
                <X weight="bold" className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {loading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-16 rounded-2xl bg-zinc-100 animate-pulse" />
            ))}
          </div>
        ) : visibleOfficers.length === 0 ? (
          <div className="p-12 text-center text-zinc-500">
            <TreeStructure weight="duotone" className="w-10 h-10 mx-auto mb-3 text-zinc-300" />
            <p className="text-sm">No officer matches the current filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-zinc-50 border-b border-slate-200/50">
                <tr>
                  <th className="px-6 py-4 font-semibold text-zinc-500 uppercase tracking-wider text-xs">Officer</th>
                  <th className="px-6 py-4 font-semibold text-zinc-500 uppercase tracking-wider text-xs">Sections</th>
                  <th className="px-6 py-4 font-semibold text-zinc-500 uppercase tracking-wider text-xs">Contact</th>
                  <th className="px-6 py-4 font-semibold text-zinc-500 uppercase tracking-wider text-xs">Access</th>
                  <th className="px-6 py-4 font-semibold text-zinc-500 uppercase tracking-wider text-xs text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visibleOfficers.map((officer) => (
                  <tr key={officer.id} className="hover:bg-zinc-50/50 transition-colors align-top">
                    <td className="px-6 py-5">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-xl bg-sage-50 text-sage-700 flex items-center justify-center font-bold text-sm shadow-sm shrink-0">
                          {initials(officer.name)}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-zinc-900">{officer.name}</p>
                          {officer.designation && (
                            <p className="text-xs text-zinc-500 mt-0.5">{officer.designation}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex flex-wrap gap-1.5 max-w-xs">
                        {officer.unitIds.map((unitId) => {
                          const unit = getUnit(unitId);
                          return (
                            <span
                              key={unitId}
                              className={`px-2.5 py-1 rounded-lg text-xs font-semibold ring-1 ${
                                unit ? ORG_TYPE_STYLES[unit.type].chip : 'bg-zinc-100 text-zinc-500 ring-zinc-300'
                              }`}
                            >
                              {unitLabel(unitId)}
                            </span>
                          );
                        })}
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex flex-col gap-1.5 text-zinc-500 text-xs">
                        <span className="flex items-center gap-2">
                          <EnvelopeSimple weight="bold" className="w-3.5 h-3.5 text-zinc-400" />
                          {officer.email}
                        </span>
                        {officer.phone && (
                          <span className="flex items-center gap-2">
                            <Phone weight="bold" className="w-3.5 h-3.5 text-zinc-400" />
                            {officer.phone}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <span
                        className={`px-3 py-1.5 rounded-full text-xs font-semibold ring-1 ${STATUS_STYLES[officer.status]}`}
                      >
                        {officer.status === 'ACTIVE'
                          ? 'Portal active'
                          : officer.status === 'INVITED'
                            ? 'Invited'
                            : 'Access revoked'}
                      </span>
                      {officer.lastInvitedAt && (
                        <p className="text-[11px] text-zinc-400 mt-2">
                          Invited {formatDate(officer.lastInvitedAt)}
                        </p>
                      )}
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex items-center justify-end gap-1">
                        <IconButton
                          title="Send invitation"
                          disabled={busyId === officer.id}
                          onClick={() => runAccessAction(officer, 'INVITE')}
                        >
                          <PaperPlaneTilt weight="bold" className="w-4 h-4" />
                        </IconButton>
                        <IconButton title="Edit officer" onClick={() => openEdit(officer)}>
                          <PencilSimple weight="bold" className="w-4 h-4" />
                        </IconButton>
                        {officer.status === 'REVOKED' ? (
                          <IconButton
                            title="Restore access"
                            disabled={busyId === officer.id}
                            onClick={() => runAccessAction(officer, 'RESTORE')}
                          >
                            <ArrowCounterClockwise weight="bold" className="w-4 h-4" />
                          </IconButton>
                        ) : (
                          <IconButton
                            title="Revoke portal access"
                            tone="warn"
                            disabled={busyId === officer.id}
                            onClick={() => runAccessAction(officer, 'REVOKE')}
                          >
                            <Prohibit weight="bold" className="w-4 h-4" />
                          </IconButton>
                        )}
                        <IconButton
                          title="Remove from roster"
                          tone="danger"
                          disabled={busyId === officer.id}
                          onClick={() => removeOfficer(officer)}
                        >
                          <TrashSimple weight="bold" className="w-4 h-4" />
                        </IconButton>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-sm text-zinc-500">
        Upload links are provisioned automatically when a data request is dispatched from the{' '}
        <Link to="/admin/data-requests/new" className="text-sage-700 font-semibold hover:underline">
          request composer
        </Link>
        .
      </p>

      <AnimatePresence>
        {form && (
          <OfficerModal
            form={form}
            setForm={setForm}
            editing={editing}
            saving={saving}
            onClose={() => {
              setForm(null);
              setEditing(null);
            }}
            onSubmit={submitForm}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function OfficerModal({
  form,
  setForm,
  editing,
  saving,
  onClose,
  onSubmit,
}: {
  form: OfficerForm;
  setForm: (form: OfficerForm) => void;
  editing: NodalOfficer | null;
  saving: boolean;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const [pickerQuery, setPickerQuery] = useState('');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-zinc-950/20 backdrop-blur-sm"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={spring}
        className="relative w-full max-w-3xl max-h-[90dvh] overflow-y-auto bg-white border border-slate-200/50 rounded-[2rem] p-8 shadow-[0_40px_80px_-20px_rgba(0,0,0,0.1)] z-10"
      >
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-xl font-semibold tracking-tight text-zinc-900">
            {editing ? 'Edit Nodal Officer' : 'Add Nodal Officer'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 rounded-xl transition-colors"
          >
            <X weight="bold" className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <Field label="Full name" required>
            <input
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              placeholder="e.g. Dr. John Doe"
              className={inputClass}
            />
          </Field>
          <Field label="Designation">
            <input
              value={form.designation}
              onChange={(event) => setForm({ ...form, designation: event.target.value })}
              placeholder="e.g. Chairperson, SCEE"
              className={inputClass}
            />
          </Field>
          <Field label="Official email" required>
            <input
              type="email"
              value={form.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
              placeholder="officer@iitmandi.ac.in"
              className={inputClass}
            />
          </Field>
          <Field label="Phone">
            <input
              value={form.phone}
              onChange={(event) => setForm({ ...form, phone: event.target.value })}
              placeholder="+91 98765 43210"
              className={inputClass}
            />
          </Field>
        </div>

        <div className="mt-6">
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-semibold text-zinc-700">
              Organogram sections <span className="text-dusty-rose-600">*</span>
            </label>
            <span className="text-xs text-zinc-500">{form.unitIds.length} selected</span>
          </div>
          <div className="border border-slate-200 rounded-2xl overflow-hidden">
            <div className="p-3 border-b border-slate-100 bg-zinc-50/50">
              <input
                value={pickerQuery}
                onChange={(event) => setPickerQuery(event.target.value)}
                placeholder="Filter sections..."
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sage-500/20"
              />
            </div>
            <div className="max-h-64 overflow-y-auto p-2">
              <OrgTree
                selectable
                selectedIds={form.unitIds}
                onSelectionChange={(unitIds) => setForm({ ...form, unitIds })}
                query={pickerQuery}
              />
            </div>
          </div>
          {form.unitIds.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {form.unitIds.map((unitId) => (
                <span
                  key={unitId}
                  className="px-2.5 py-1 rounded-lg bg-sage-50 text-sage-700 text-xs font-semibold ring-1 ring-sage-500/20 flex items-center gap-1.5"
                >
                  {unitLabel(unitId)}
                  <button
                    onClick={() =>
                      setForm({ ...form, unitIds: form.unitIds.filter((id) => id !== unitId) })
                    }
                    className="hover:text-sage-900"
                    aria-label={`Remove ${unitLabel(unitId)}`}
                  >
                    <X weight="bold" className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="mt-6">
          <Field label="Internal note">
            <textarea
              value={form.notes}
              onChange={(event) => setForm({ ...form, notes: event.target.value })}
              rows={2}
              placeholder="Optional context for the DORA office."
              className={inputClass}
            />
          </Field>
        </div>

        <div className="pt-6 mt-6 border-t border-slate-100 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold text-zinc-600 hover:bg-zinc-100 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onSubmit}
            disabled={saving}
            className="bg-sage-600 hover:bg-sage-700 active:scale-[0.98] disabled:opacity-60 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-[0_8px_16px_-4px_rgba(90,115,89,0.3)]"
          >
            {saving ? 'Saving...' : editing ? 'Save changes' : 'Add to roster'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

const inputClass =
  'w-full bg-zinc-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sage-500/20 focus:border-sage-500/50 transition-all placeholder:text-zinc-400';

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-sm font-semibold text-zinc-700 mb-2">
        {label} {required && <span className="text-dusty-rose-600">*</span>}
      </span>
      {children}
    </label>
  );
}

function IconButton({
  title,
  onClick,
  children,
  disabled,
  tone = 'neutral',
}: {
  title: string;
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
  tone?: 'neutral' | 'warn' | 'danger';
}) {
  const toneClass =
    tone === 'danger'
      ? 'hover:text-red-600 hover:bg-red-50'
      : tone === 'warn'
        ? 'hover:text-orange-600 hover:bg-orange-50'
        : 'hover:text-sage-700 hover:bg-sage-50';
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      disabled={disabled}
      className={`p-2 rounded-xl text-zinc-400 transition-all disabled:opacity-40 ${toneClass}`}
    >
      {children}
    </button>
  );
}

function initials(name: string): string {
  const parts = name.replace(/^(Dr\.?|Prof\.?|Mr\.?|Ms\.?|Mrs\.?)\s+/i, '').split(/\s+/);
  return parts
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}
