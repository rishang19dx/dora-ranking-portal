"use client";

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  GraduationCap,
  Plus,
  PencilSimple,
  TrashSimple,
  MagnifyingGlass,
  X,
  UploadSimple,
  CheckCircle,
} from '@phosphor-icons/react';
import { FileSpreadsheet } from 'lucide-react';
import { useToast } from '../../components/ToastProvider';
import { ORG_UNITS, getUnit, unitLabel } from '../../lib/organogram';

const spring = { type: 'spring' as const, stiffness: 100, damping: 20 };

export interface Programme {
  id: string;
  unit: string;
  unitName?: string;
  name: string;
  nirfLevel: 'UG4' | 'UG5' | 'PG2' | 'PG3' | 'PG6' | 'DOC';
  active: boolean;
  startAcademicYear?: string;
  endAcademicYear?: string;
}

const NIRF_LEVELS = [
  { value: 'UG4', label: 'UG 4-Year (e.g. B.Tech)' },
  { value: 'UG5', label: 'UG 5-Year (e.g. Dual Degree)' },
  { value: 'PG2', label: 'PG 2-Year (e.g. M.Tech, M.Sc, MBA)' },
  { value: 'PG3', label: 'PG 3-Year' },
  { value: 'PG6', label: 'PG 6-Year Integrated' },
  { value: 'DOC', label: 'Doctoral / Ph.D.' },
];

export default function AdminProgrammes() {
  const { showToast } = useToast();
  const [programmes, setProgrammes] = useState<Programme[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [unitFilter, setUnitFilter] = useState('');
  const [levelFilter, setLevelFilter] = useState('');
  const [editingProg, setEditingProg] = useState<Programme | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    unit: '',
    name: '',
    nirfLevel: 'UG4',
    active: true,
    startAcademicYear: '',
    endAcademicYear: '',
  });

  const academicSchools = useMemo(() => {
    return ORG_UNITS.filter((u) => u.kind === 'SCHOOL' || u.kind === 'CENTRE' || u.type === 'ACADEMIC');
  }, []);

  const loadProgrammes = useCallback(async () => {
    try {
      const res = await fetch('/api/programmes/');
      if (!res.ok) throw new Error('Failed to load programmes');
      const data = await res.json();
      setProgrammes(Array.isArray(data) ? data : data.results || []);
    } catch (err: any) {
      showToast(err.message || 'Error fetching programmes', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadProgrammes();
  }, [loadProgrammes]);

  const filteredProgrammes = useMemo(() => {
    return programmes.filter((p) => {
      const matchesSearch =
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.id.toLowerCase().includes(search.toLowerCase()) ||
        (p.unitName || '').toLowerCase().includes(search.toLowerCase());
      const matchesUnit = !unitFilter || p.unit === unitFilter;
      const matchesLevel = !levelFilter || p.nirfLevel === levelFilter;
      return matchesSearch && matchesUnit && matchesLevel;
    });
  }, [programmes, search, unitFilter, levelFilter]);

  const handleOpenAdd = () => {
    setFormData({
      unit: academicSchools[0]?.id || '',
      name: '',
      nirfLevel: 'UG4',
      active: true,
      startAcademicYear: '',
      endAcademicYear: '',
    });
    setEditingProg(null);
    setIsAddModalOpen(true);
  };

  const handleOpenEdit = (prog: Programme) => {
    setEditingProg(prog);
    setFormData({
      unit: prog.unit,
      name: prog.name,
      nirfLevel: prog.nirfLevel,
      active: prog.active,
      startAcademicYear: prog.startAcademicYear || '',
      endAcademicYear: prog.endAcademicYear || '',
    });
    setIsAddModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.unit) {
      showToast('Programme name and offering school/centre are required', 'error');
      return;
    }

    setSaving(true);
    try {
      const url = editingProg ? `/api/programmes/${editingProg.id}/` : '/api/programmes/';
      const method = editingProg ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('dora_access_token') || ''}`,
        },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to save programme');
      }

      showToast(`Programme ${editingProg ? 'updated' : 'created'} successfully`, 'success');
      setIsAddModalOpen(false);
      loadProgrammes();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete programme "${name}"?`)) return;

    try {
      const res = await fetch(`/api/programmes/${id}/`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('dora_access_token') || ''}`,
        },
      });

      if (!res.ok) throw new Error('Failed to delete programme');

      showToast(`Programme "${name}" deleted`, 'info');
      setProgrammes((prev) => prev.filter((p) => p.id !== id));
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleBulkImport = async (file: File) => {
    setImporting(true);
    try {
      const fd = new FormData();
      fd.append('file', file);

      const res = await fetch('/api/programmes/import/', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('dora_access_token') || ''}`,
        },
        body: fd,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Import failed');

      showToast(
        `Import complete: ${data.createdCount ?? 0} created, ${data.updatedCount ?? 0} updated`,
        'success'
      );
      setIsImportModalOpen(false);
      loadProgrammes();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setImporting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={spring}
      className="max-w-[1400px] mx-auto space-y-8"
    >
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-sage-700">
            <GraduationCap weight="duotone" className="w-4 h-4" />
            Registry
          </div>
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-zinc-900 mt-2">
            Academic Programmes
          </h1>
          <p className="text-zinc-500 mt-1 max-w-[65ch] leading-relaxed text-sm">
            Official degree programmes mapped to academic schools and centres, driving NIRF intake and placement breakdowns.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setIsImportModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-zinc-200 hover:bg-zinc-50 text-zinc-700 text-sm font-semibold rounded-xl transition-all shadow-sm"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            Bulk Import
          </button>
          <button
            type="button"
            onClick={handleOpenAdd}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-sage-600 hover:bg-sage-700 text-white text-sm font-semibold rounded-xl transition-all shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Add Programme
          </button>
        </div>
      </div>

      {/* Filters bar */}
      <div className="bg-white border border-slate-200/60 rounded-2xl p-4 flex flex-col md:flex-row gap-4 items-center justify-between shadow-sm">
        <div className="relative w-full md:w-80">
          <MagnifyingGlass className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search programmes or schools..."
            className="w-full pl-9 pr-3 py-1.5 text-xs border border-zinc-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-sage-500"
          />
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <select
            value={unitFilter}
            onChange={(e) => setUnitFilter(e.target.value)}
            className="text-xs border border-zinc-200 rounded-xl px-3 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-sage-500"
          >
            <option value="">All Schools & Centres</option>
            {academicSchools.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} ({u.shortName || u.id})
              </option>
            ))}
          </select>

          <select
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value)}
            className="text-xs border border-zinc-200 rounded-xl px-3 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-sage-500"
          >
            <option value="">All NIRF Levels</option>
            {NIRF_LEVELS.map((lvl) => (
              <option key={lvl.value} value={lvl.value}>
                {lvl.value} - {lvl.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Programmes Table */}
      <div className="bg-white border border-slate-200/60 rounded-[2rem] overflow-hidden shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)]">
        {loading ? (
          <div className="p-12 text-center text-zinc-400">Loading programmes...</div>
        ) : filteredProgrammes.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <GraduationCap className="w-10 h-10 text-zinc-300 mx-auto" />
            <p className="text-zinc-600 font-medium">No programmes registered yet.</p>
            <p className="text-xs text-zinc-400">
              Add degree programmes offered by schools or import from the Academic Section spreadsheet.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm divide-y divide-slate-100">
              <thead className="bg-zinc-50/80 text-zinc-600 font-semibold text-xs uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-5">ID & Programme Name</th>
                  <th className="py-3 px-4">Offering School / Centre</th>
                  <th className="py-3 px-4">NIRF Level</th>
                  <th className="py-3 px-4">Academic Years</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {filteredProgrammes.map((prog) => {
                  const offeringUnit = getUnit(prog.unit);

                  return (
                    <tr key={prog.id} className="hover:bg-zinc-50/60 transition-colors">
                      <td className="py-3.5 px-5">
                        <div className="font-semibold text-zinc-900">{prog.name}</div>
                        <div className="text-xs text-zinc-400 font-mono mt-0.5">{prog.id}</div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="text-xs font-medium text-zinc-800">
                          {offeringUnit?.name || prog.unitName || prog.unit}
                        </div>
                        <div className="text-[11px] text-zinc-400">
                          {offeringUnit?.shortName || prog.unit}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-zinc-100 text-zinc-700 font-mono">
                          {prog.nirfLevel}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-xs text-zinc-600">
                        {prog.startAcademicYear ? (
                          <span>
                            {prog.startAcademicYear} &ndash; {prog.endAcademicYear || 'Present'}
                          </span>
                        ) : (
                          <span className="text-zinc-400">Continuous</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`text-xs font-semibold px-2.5 py-1 rounded-md ${
                            prog.active
                              ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-500/20'
                              : 'bg-zinc-100 text-zinc-500'
                          }`}
                        >
                          {prog.active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="py-3.5 px-5 text-right">
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(prog)}
                            className="p-1.5 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 rounded-lg transition-colors"
                            title="Edit Programme"
                          >
                            <PencilSimple className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(prog.id, prog.name)}
                            className="p-1.5 text-zinc-400 hover:text-dusty-rose-600 hover:bg-dusty-rose-50 rounded-lg transition-colors"
                            title="Delete Programme"
                          >
                            <TrashSimple className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Modal */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-[2rem] max-w-lg w-full p-6 sm:p-8 space-y-6 shadow-xl"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold tracking-tight text-zinc-900">
                  {editingProg ? 'Edit Academic Programme' : 'Add New Academic Programme'}
                </h3>
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="p-1.5 text-zinc-400 hover:text-zinc-600 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSave} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-600 mb-1.5">
                    Offering School / Centre *
                  </label>
                  <select
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-xl focus:ring-1 focus:ring-sage-500 bg-white"
                    required
                  >
                    {academicSchools.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.shortName || u.id})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-600 mb-1.5">
                    Programme Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. B.Tech in Computer Science and Engineering"
                    className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-xl focus:ring-1 focus:ring-sage-500"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-600 mb-1.5">
                      NIRF Level *
                    </label>
                    <select
                      value={formData.nirfLevel}
                      onChange={(e) => setFormData({ ...formData, nirfLevel: e.target.value as any })}
                      className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-xl focus:ring-1 focus:ring-sage-500 bg-white"
                    >
                      {NIRF_LEVELS.map((lvl) => (
                        <option key={lvl.value} value={lvl.value}>
                          {lvl.value} ({lvl.label})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-600 mb-1.5">
                      Status
                    </label>
                    <label className="flex items-center gap-2 mt-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.active}
                        onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                        className="rounded text-sage-600 focus:ring-sage-500 w-4 h-4 cursor-pointer"
                      />
                      <span className="text-xs text-zinc-700 font-medium">Currently active</span>
                    </label>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-600 mb-1.5">
                      Start Academic Year
                    </label>
                    <input
                      type="text"
                      value={formData.startAcademicYear}
                      onChange={(e) => setFormData({ ...formData, startAcademicYear: e.target.value })}
                      placeholder="e.g. 2018-19"
                      className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-xl focus:ring-1 focus:ring-sage-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-600 mb-1.5">
                      End Academic Year (if discontinued)
                    </label>
                    <input
                      type="text"
                      value={formData.endAcademicYear}
                      onChange={(e) => setFormData({ ...formData, endAcademicYear: e.target.value })}
                      placeholder="e.g. 2024-25"
                      className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-xl focus:ring-1 focus:ring-sage-500"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsAddModalOpen(false)}
                    className="px-4 py-2 text-xs font-semibold text-zinc-600 hover:bg-zinc-100 rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-5 py-2 text-xs font-semibold text-white bg-sage-600 hover:bg-sage-700 disabled:opacity-50 rounded-xl"
                  >
                    {saving ? 'Saving...' : editingProg ? 'Update Programme' : 'Add Programme'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Bulk Import Modal */}
      <AnimatePresence>
        {isImportModalOpen && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-[2rem] max-w-md w-full p-6 space-y-4 shadow-xl"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-zinc-900">
                  <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                  <h3 className="font-semibold">Import Programmes (.xlsx / .csv)</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsImportModalOpen(false)}
                  className="text-zinc-400 hover:text-zinc-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <p className="text-xs text-zinc-500 leading-relaxed">
                Upload a spreadsheet with headers: <code className="bg-zinc-100 px-1 py-0.5 rounded">unit</code>,{' '}
                <code className="bg-zinc-100 px-1 py-0.5 rounded">name</code>,{' '}
                <code className="bg-zinc-100 px-1 py-0.5 rounded">nirfLevel</code> (UG4, UG5, PG2, PG3, PG6, DOC).
              </p>

              <div className="border-2 border-dashed border-zinc-200 hover:border-sage-400 rounded-2xl p-6 text-center relative cursor-pointer">
                <UploadSimple className="w-8 h-8 text-zinc-400 mx-auto mb-2" />
                <p className="text-xs font-medium text-zinc-700">Choose .xlsx or .csv file</p>
                <input
                  type="file"
                  accept=".xlsx,.csv"
                  disabled={importing}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleBulkImport(f);
                  }}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setIsImportModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-zinc-600 hover:bg-zinc-100 rounded-xl"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
