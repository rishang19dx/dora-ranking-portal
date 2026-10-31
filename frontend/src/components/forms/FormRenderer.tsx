import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  FloppyDisk,
  Warning,
  CheckCircle,
  Plus,
  Trash,
  UploadSimple,
  ArrowsClockwise,
  Lock,
  Info,
  X,
} from '@phosphor-icons/react';
import { FileSpreadsheet } from 'lucide-react';
import {
  parseNumber,
  formatIndianCurrency,
  amountInWordsInr,
  evaluateDerive,
  validateBlockData,
} from '../../lib/nirfUtils';
import { useToast } from '../ToastProvider';

export interface FormRendererProps {
  token: string;
  section: any; // Resolved section schema
  initialData?: {
    id?: string;
    payload?: Record<string, any>;
    notApplicable?: boolean;
    revision?: number;
    status?: string;
    warningNote?: string;
    isCarryForward?: boolean;
    records?: Record<string, any[]>;
  };
  onSave?: (savedData: any) => void;
  onSubmitSuccess?: () => void;
  readOnly?: boolean;
  onClose?: () => void;
}

type SaveState = 'saved' | 'saving' | 'dirty' | 'error';

export default function FormRenderer({
  token,
  section,
  initialData,
  onSave,
  onSubmitSuccess,
  readOnly: forceReadOnly = false,
  onClose,
}: FormRendererProps) {
  const { showToast } = useToast();

  const isLocked = forceReadOnly || initialData?.status === 'SUBMITTED' || initialData?.status === 'APPROVED';
  const [notApplicable, setNotApplicable] = useState<boolean>(initialData?.notApplicable ?? false);
  const [payload, setPayload] = useState<Record<string, any>>(() => initialData?.payload || {});
  const [records, setRecords] = useState<Record<string, any[]>>(() => initialData?.records || {});
  const [revision, setRevision] = useState<number>(initialData?.revision ?? 0);
  const [warningNote, setWarningNote] = useState<string>(initialData?.warningNote ?? '');
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const [showWarningModal, setShowWarningModal] = useState<boolean>(false);
  const [importModalBlockId, setImportModalBlockId] = useState<string | null>(null);
  const [importing, setImporting] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);

  const isDirtyRef = useRef(false);
  const payloadRef = useRef(payload);
  const notApplicableRef = useRef(notApplicable);
  const revisionRef = useRef(revision);
  payloadRef.current = payload;
  notApplicableRef.current = notApplicable;
  revisionRef.current = revision;

  // Initialize blocks with defaults if missing
  useEffect(() => {
    if (!section?.blocks) return;
    setPayload((prev) => {
      const next = { ...prev };
      let changed = false;
      section.blocks.forEach((block: any) => {
        if (block.kind === 'grid') {
          if (!next[block.id]) {
            next[block.id] = {};
            changed = true;
          }
          const rows = block.resolvedRows || block.rows || [];
          const cols = block.resolvedColumns || block.columns || [];
          rows.forEach((r: any) => {
            if (!next[block.id][r.id]) {
              next[block.id][r.id] = {};
              changed = true;
            }
            // Populate live derived fields
            cols.forEach((c: any) => {
              if (c.derive) {
                const derivedVal = evaluateDerive(c, next[block.id][r.id]);
                if (next[block.id][r.id][c.id] !== derivedVal) {
                  next[block.id][r.id][c.id] = derivedVal;
                  changed = true;
                }
              }
            });
          });
        } else if (block.kind === 'questionnaire') {
          if (!next[block.id]) {
            next[block.id] = {};
            changed = true;
          }
        }
      });
      return changed ? next : prev;
    });
  }, [section]);

  // Compute live validation results
  const { errors, warnings } = useMemo(() => {
    if (notApplicable) return { errors: [], warnings: [] };
    const allErrors: Array<{ blockId: string; message: string }> = [];
    const allWarnings: Array<{ blockId: string; message: string }> = [];

    (section?.blocks || []).forEach((block: any) => {
      const bData = block.kind === 'records' ? (records[block.id] || []) : payload[block.id];
      const { errors: bErr, warnings: bWarn } = validateBlockData(block, bData);
      allErrors.push(...bErr);
      allWarnings.push(...bWarn);
    });

    return { errors: allErrors, warnings: allWarnings };
  }, [section, payload, records, notApplicable]);

  // Perform save to server
  const performSave = useCallback(
    async (manual = false) => {
      if (isLocked) return;
      setSaveState('saving');
      try {
        const body = {
          revision: revisionRef.current,
          notApplicable: notApplicableRef.current,
          payload: payloadRef.current,
          warningNote,
        };

        const res = await fetch(`/api/portal/${token}/forms/${section.id}/`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || 'Failed to save form');
        }

        const data = await res.json();
        setRevision(data.revision);
        revisionRef.current = data.revision;
        isDirtyRef.current = false;
        setSaveState('saved');
        if (onSave) onSave(data);
        if (manual) {
          showToast('Progress saved successfully', 'success');
        }
      } catch (err: any) {
        setSaveState('error');
        if (manual) {
          showToast(err.message || 'Error saving progress', 'error');
        }
      }
    },
    [token, section?.id, isLocked, warningNote, onSave, showToast]
  );

  // Debounced Autosave (1500ms after changes)
  useEffect(() => {
    if (!isDirtyRef.current || isLocked) return;
    const timer = setTimeout(() => {
      performSave(false);
    }, 1500);
    return () => clearTimeout(timer);
  }, [payload, notApplicable, performSave, isLocked]);

  // Handle cell change for grid block
  const handleGridCellChange = (blockId: string, rowKey: string, colId: string, val: any) => {
    if (isLocked) return;
    isDirtyRef.current = true;
    setSaveState('dirty');

    setPayload((prev) => {
      const nextBlock = { ...(prev[blockId] || {}) };
      const nextRow = { ...(nextBlock[rowKey] || {}), [colId]: val };

      // Re-evaluate derived columns in the same row
      const blockDef = section.blocks?.find((b: any) => b.id === blockId);
      const cols = blockDef?.resolvedColumns || blockDef?.columns || [];
      cols.forEach((col: any) => {
        if (col.derive) {
          nextRow[col.id] = evaluateDerive(col, nextRow);
        }
      });

      nextBlock[rowKey] = nextRow;
      return { ...prev, [blockId]: nextBlock };
    });
  };

  // Handle question change for questionnaire
  const handleQuestionChange = (blockId: string, questionId: string, val: any) => {
    if (isLocked) return;
    isDirtyRef.current = true;
    setSaveState('dirty');

    setPayload((prev) => {
      const nextBlock = { ...(prev[blockId] || {}), [questionId]: val };
      return { ...prev, [blockId]: nextBlock };
    });
  };

  // Add record row
  const handleAddRecordRow = (blockId: string) => {
    if (isLocked) return;
    isDirtyRef.current = true;
    setSaveState('dirty');

    const blockDef = section.blocks?.find((b: any) => b.id === blockId);
    const newRow: Record<string, any> = {};
    (blockDef?.fields || []).forEach((f: any) => {
      newRow[f.id] = f.default ?? (f.type === 'integer' || f.type === 'decimal' || f.type === 'currencyInr' ? 0 : '');
    });

    setRecords((prev) => ({
      ...prev,
      [blockId]: [...(prev[blockId] || []), newRow],
    }));
  };

  // Delete record row
  const handleDeleteRecordRow = (blockId: string, index: number) => {
    if (isLocked) return;
    isDirtyRef.current = true;
    setSaveState('dirty');

    setRecords((prev) => ({
      ...prev,
      [blockId]: (prev[blockId] || []).filter((_, i) => i !== index),
    }));
  };

  // Change record field
  const handleRecordFieldChange = (blockId: string, index: number, fieldId: string, val: any) => {
    if (isLocked) return;
    isDirtyRef.current = true;
    setSaveState('dirty');

    setRecords((prev) => {
      const list = [...(prev[blockId] || [])];
      const updated = { ...(list[index] || {}), [fieldId]: val };
      list[index] = updated;
      return { ...prev, [blockId]: list };
    });
  };

  // Bulk records file import
  const handleFileImport = async (blockId: string, file: File) => {
    setImporting(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('blockId', blockId);

      const res = await fetch(`/api/portal/${token}/forms/${section.id}/records/import/`, {
        method: 'POST',
        body: formData,
      });

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.error || 'Import failed');
      }

      if (resData.records) {
        setRecords((prev) => ({
          ...prev,
          [blockId]: resData.records,
        }));
      }

      showToast(
        `Import complete: ${resData.importedCount ?? 0} rows imported${
          resData.errors?.length ? ` with ${resData.errors.length} warnings/errors` : ''
        }`,
        resData.errors?.length ? 'info' : 'success'
      );
      setImportModalBlockId(null);
    } catch (err: any) {
      showToast(err.message || 'Failed to import file', 'error');
    } finally {
      setImporting(false);
    }
  };

  // Handle final submission
  const handleSubmit = async () => {
    if (errors.length > 0) {
      showToast(`Cannot submit: please fix ${errors.length} validation errors.`, 'error');
      return;
    }

    if (warnings.length > 0 && !warningNote.trim()) {
      setShowWarningModal(true);
      return;
    }

    setSubmitting(true);
    try {
      // First save latest data
      await performSave(false);

      const res = await fetch(`/api/portal/${token}/forms/${section.id}/submit/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ warningNote: warningNote.trim() }),
      });

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.error || 'Failed to submit section');
      }

      showToast('Section submitted successfully for DORA review', 'success');
      if (onSubmitSuccess) onSubmitSuccess();
    } catch (err: any) {
      showToast(err.message || 'Submission failed', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-white border border-slate-200/60 rounded-[2rem] p-6 md:p-8 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)] space-y-8">
      {/* Top Header / Meta bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-sage-700 bg-sage-50 px-2.5 py-1 rounded-md ring-1 ring-sage-500/20">
              {section.id}
            </span>
            <span className="text-xs font-medium text-zinc-500">
              Scope: {section.ownership?.submitBy === 'central' ? 'Central Institute' : 'Unit School/Centre'}
            </span>
            {initialData?.status && (
              <span
                className={`text-xs font-semibold px-2.5 py-1 rounded-md ${
                  initialData.status === 'APPROVED'
                    ? 'bg-emerald-50 text-emerald-700'
                    : initialData.status === 'SUBMITTED'
                    ? 'bg-slate-blue-50 text-slate-blue-700'
                    : initialData.status === 'CORRECTION_REQUESTED'
                    ? 'bg-dusty-rose-50 text-dusty-rose-700'
                    : 'bg-zinc-100 text-zinc-600'
                }`}
              >
                {initialData.status}
              </span>
            )}
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-zinc-900 mt-2">{section.title}</h2>
          {section.description && (
            <p className="text-sm text-zinc-500 mt-1 max-w-3xl leading-relaxed">{section.description}</p>
          )}
        </div>

        {/* Right controls: save status & Not Applicable toggle */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-1.5 text-xs text-zinc-500 bg-zinc-50 px-3 py-1.5 rounded-lg border border-zinc-200/60">
            {saveState === 'saving' ? (
              <>
                <ArrowsClockwise className="w-3.5 h-3.5 text-sage-600 animate-spin" />
                <span>Saving...</span>
              </>
            ) : saveState === 'dirty' ? (
              <>
                <span className="w-2 h-2 rounded-full bg-soft-gold-500 animate-pulse" />
                <span>Unsaved</span>
              </>
            ) : saveState === 'error' ? (
              <>
                <Warning className="w-3.5 h-3.5 text-dusty-rose-600" />
                <span className="text-dusty-rose-600">Sync issue</span>
              </>
            ) : (
              <>
                <CheckCircle className="w-3.5 h-3.5 text-sage-600" />
                <span>Saved (rev {revision})</span>
              </>
            )}
          </div>

          <label className="flex items-center gap-2 cursor-pointer select-none bg-zinc-50 px-3 py-1.5 rounded-lg border border-zinc-200/60">
            <input
              type="checkbox"
              disabled={isLocked}
              checked={notApplicable}
              onChange={(e) => {
                setNotApplicable(e.target.checked);
                isDirtyRef.current = true;
                setSaveState('dirty');
              }}
              className="rounded text-sage-600 focus:ring-sage-500 w-4 h-4 cursor-pointer"
            />
            <span className="text-xs font-medium text-zinc-700">Not Applicable</span>
          </label>

          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 rounded-lg transition-colors"
              title="Close form"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Carry Forward Notice Banner */}
      {initialData?.isCarryForward && (
        <div className="bg-soft-gold-50/70 border border-soft-gold-200 rounded-2xl p-4 flex items-start gap-3">
          <Info className="w-5 h-5 text-soft-gold-700 mt-0.5 shrink-0" />
          <div className="text-sm">
            <span className="font-semibold text-soft-gold-900">Prefilled from previous cycle submission: </span>
            <span className="text-soft-gold-800">
              Please review values carefully. Any edits made will be saved and recorded in the audit log.
            </span>
          </div>
        </div>
      )}

      {/* Validation Errors & Warnings Summary */}
      {!notApplicable && (errors.length > 0 || warnings.length > 0) && (
        <div className="space-y-2">
          {errors.length > 0 && (
            <div className="bg-dusty-rose-50/80 border border-dusty-rose-200 rounded-2xl p-4 flex items-start gap-3">
              <Warning className="w-5 h-5 text-dusty-rose-700 mt-0.5 shrink-0" />
              <div className="text-sm text-dusty-rose-900">
                <p className="font-semibold">{errors.length} Required Field / Validation Issue(s):</p>
                <ul className="list-disc list-inside mt-1 space-y-0.5 text-xs text-dusty-rose-800">
                  {errors.slice(0, 5).map((e, idx) => (
                    <li key={idx}>{e.message}</li>
                  ))}
                  {errors.length > 5 && <li>...and {errors.length - 5} more issues</li>}
                </ul>
              </div>
            </div>
          )}

          {warnings.length > 0 && (
            <div className="bg-soft-gold-50/70 border border-soft-gold-200 rounded-2xl p-4 flex items-start gap-3">
              <Info className="w-5 h-5 text-soft-gold-700 mt-0.5 shrink-0" />
              <div className="text-sm text-soft-gold-900">
                <p className="font-semibold">{warnings.length} Advisory Warning(s):</p>
                <ul className="list-disc list-inside mt-1 space-y-0.5 text-xs text-soft-gold-800">
                  {warnings.map((w, idx) => (
                    <li key={idx}>{w.message}</li>
                  ))}
                </ul>
                <p className="text-xs text-soft-gold-700 mt-2 font-medium">
                  Note: A brief explanation is required upon submission for these warnings.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* When marked Not Applicable */}
      {notApplicable ? (
        <div className="text-center py-12 bg-zinc-50 border border-dashed border-zinc-200 rounded-2xl">
          <p className="text-zinc-600 font-medium">This section has been marked as Not Applicable for your unit.</p>
          <p className="text-xs text-zinc-400 mt-1">
            Toggle &quot;Not Applicable&quot; off above if you have data to report for this section.
          </p>
        </div>
      ) : (
        /* Form Blocks */
        <div className="space-y-10">
          {(section.blocks || []).map((block: any) => (
            <div key={block.id} className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-zinc-900">{block.title || block.id}</h3>
                  {block.description && (
                    <p className="text-xs text-zinc-500 mt-0.5">{block.description}</p>
                  )}
                </div>
                {block.kind === 'records' && !isLocked && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setImportModalBlockId(block.id)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-700 bg-white border border-zinc-200 hover:bg-zinc-50 rounded-xl transition-all shadow-sm"
                    >
                      <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                      Bulk Import
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddRecordRow(block.id)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-sage-600 hover:bg-sage-700 rounded-xl transition-all shadow-sm"
                    >
                      <Plus className="w-4 h-4" />
                      Add Row
                    </button>
                  </div>
                )}
              </div>

              {/* RENDER KIND: GRID */}
              {block.kind === 'grid' && (
                <div className="border border-slate-200/80 rounded-2xl overflow-hidden shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm divide-y divide-slate-200">
                      <thead className="bg-zinc-50/80 text-zinc-700 font-semibold text-xs tracking-wider">
                        <tr>
                          <th className="py-3 px-4 uppercase sticky left-0 bg-zinc-50 z-10 w-64">
                            Category / Item
                          </th>
                          {(block.resolvedColumns || block.columns || []).map((col: any) => (
                            <th key={col.id} className="py-3 px-4 min-w-[140px]">
                              {col.label}
                              {col.required && <span className="text-dusty-rose-600 ml-0.5">*</span>}
                              {col.unit && <span className="text-zinc-400 font-normal ml-1">({col.unit})</span>}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {(block.resolvedRows || block.rows || []).map((row: any) => {
                          const rowKey = row.id;
                          const rowData = payload[block.id]?.[rowKey] || {};

                          return (
                            <tr key={rowKey} className="hover:bg-zinc-50/50 transition-colors">
                              <td className="py-3 px-4 font-medium text-zinc-900 sticky left-0 bg-white shadow-[1px_0_0_0_rgba(0,0,0,0.05)]">
                                <div>{row.label}</div>
                                {row.subLabel && (
                                  <div className="text-[11px] text-zinc-400 font-normal">{row.subLabel}</div>
                                )}
                              </td>
                              {(block.resolvedColumns || block.columns || []).map((col: any) => {
                                const isDerived = Boolean(col.derive);
                                const val = rowData[col.id] ?? '';

                                if (isDerived) {
                                  return (
                                    <td key={col.id} className="py-2.5 px-4 bg-zinc-50/60">
                                      <div className="flex items-center justify-between text-zinc-700 font-medium px-2.5 py-1.5 rounded-lg bg-zinc-100/70 border border-zinc-200/60 text-xs">
                                        <span>
                                          {col.type === 'currencyInr'
                                            ? `₹ ${formatIndianCurrency(val)}`
                                            : val || 0}
                                        </span>
                                        <span title="Calculated automatically">
                                          <Lock className="w-3 h-3 text-zinc-400 ml-1 shrink-0" />
                                        </span>
                                      </div>
                                    </td>
                                  );
                                }

                                return (
                                  <td key={col.id} className="py-2.5 px-4">
                                    {col.type === 'currencyInr' ? (
                                      <div>
                                        <div className="relative">
                                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400 text-xs">
                                            ₹
                                          </span>
                                          <input
                                            type="text"
                                            disabled={isLocked}
                                            value={val}
                                            onChange={(e) =>
                                              handleGridCellChange(block.id, rowKey, col.id, e.target.value)
                                            }
                                            placeholder="0"
                                            className="w-full pl-6 pr-2.5 py-1.5 text-xs border border-zinc-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-sage-500 font-mono"
                                          />
                                        </div>
                                        {val ? (
                                          <div className="text-[10px] text-zinc-500 mt-1 truncate max-w-[180px]">
                                            {amountInWordsInr(val)}
                                          </div>
                                        ) : null}
                                      </div>
                                    ) : col.type === 'integer' || col.type === 'decimal' ? (
                                      <input
                                        type="number"
                                        disabled={isLocked}
                                        value={val}
                                        onChange={(e) =>
                                          handleGridCellChange(block.id, rowKey, col.id, e.target.value)
                                        }
                                        placeholder="0"
                                        className="w-full px-2.5 py-1.5 text-xs border border-zinc-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-sage-500 font-mono"
                                      />
                                    ) : (
                                      <input
                                        type="text"
                                        disabled={isLocked}
                                        value={val}
                                        onChange={(e) =>
                                          handleGridCellChange(block.id, rowKey, col.id, e.target.value)
                                        }
                                        className="w-full px-2.5 py-1.5 text-xs border border-zinc-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-sage-500"
                                      />
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* RENDER KIND: QUESTIONNAIRE */}
              {block.kind === 'questionnaire' && (
                <div className="border border-slate-200/80 rounded-2xl p-6 bg-white space-y-6 shadow-sm">
                  {(block.questions || []).map((q: any) => {
                    const val = payload[block.id]?.[q.id] ?? '';

                    return (
                      <div key={q.id} className="space-y-2 border-b border-zinc-100 last:border-b-0 pb-5 last:pb-0">
                        <label className="block text-sm font-medium text-zinc-900">
                          {q.label}
                          {q.required && <span className="text-dusty-rose-600 ml-1">*</span>}
                        </label>
                        {q.help && <p className="text-xs text-zinc-500">{q.help}</p>}

                        {/* Boolean question */}
                        {q.type === 'boolean' && (
                          <div className="flex items-center gap-3 mt-1">
                            <button
                              type="button"
                              disabled={isLocked}
                              onClick={() => handleQuestionChange(block.id, q.id, true)}
                              className={`px-4 py-1.5 text-xs font-semibold rounded-xl border transition-all ${
                                val === true
                                  ? 'bg-sage-600 text-white border-sage-600 shadow-sm'
                                  : 'bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-50'
                              }`}
                            >
                              Yes
                            </button>
                            <button
                              type="button"
                              disabled={isLocked}
                              onClick={() => handleQuestionChange(block.id, q.id, false)}
                              className={`px-4 py-1.5 text-xs font-semibold rounded-xl border transition-all ${
                                val === false
                                  ? 'bg-zinc-800 text-white border-zinc-800 shadow-sm'
                                  : 'bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-50'
                              }`}
                            >
                              No
                            </button>
                          </div>
                        )}

                        {/* Enum question */}
                        {q.type === 'enum' && (
                          <div className="space-y-2">
                            <select
                              disabled={isLocked}
                              value={val}
                              onChange={(e) => handleQuestionChange(block.id, q.id, e.target.value)}
                              className="w-full max-w-md px-3 py-2 text-sm border border-zinc-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-sage-500 bg-white"
                            >
                              <option value="">-- Select an option --</option>
                              {(q.options || []).map((opt: any) => (
                                <option key={opt.value ?? opt} value={opt.value ?? opt}>
                                  {opt.label ?? opt}
                                </option>
                              ))}
                              {q.allowOther && <option value="OTHER">Other (specify below)</option>}
                            </select>

                            {q.allowOther && val === 'OTHER' && (
                              <input
                                type="text"
                                disabled={isLocked}
                                value={payload[block.id]?.[`${q.id}_other`] || ''}
                                onChange={(e) =>
                                  handleQuestionChange(block.id, `${q.id}_other`, e.target.value)
                                }
                                placeholder="Please specify..."
                                className="w-full max-w-md px-3 py-2 text-sm border border-zinc-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-sage-500"
                              />
                            )}
                          </div>
                        )}

                        {/* Multi-Enum question */}
                        {q.type === 'multiEnum' && (
                          <div className="flex flex-wrap gap-2 mt-1">
                            {(q.options || []).map((opt: any) => {
                              const optVal = opt.value ?? opt;
                              const currentList = Array.isArray(val) ? val : [];
                              const isChecked = currentList.includes(optVal);

                              return (
                                <button
                                  key={optVal}
                                  type="button"
                                  disabled={isLocked}
                                  onClick={() => {
                                    const nextList = isChecked
                                      ? currentList.filter((x: any) => x !== optVal)
                                      : [...currentList, optVal];
                                    handleQuestionChange(block.id, q.id, nextList);
                                  }}
                                  className={`px-3 py-1.5 text-xs font-medium rounded-xl border transition-all ${
                                    isChecked
                                      ? 'bg-sage-100 text-sage-800 border-sage-300 ring-1 ring-sage-400'
                                      : 'bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50'
                                  }`}
                                >
                                  {opt.label ?? opt}
                                </button>
                              );
                            })}
                          </div>
                        )}

                        {/* Number / Percent / Currency */}
                        {(q.type === 'integer' || q.type === 'decimal' || q.type === 'percent') && (
                          <div className="flex items-center gap-2 max-w-xs">
                            <input
                              type="number"
                              disabled={isLocked}
                              value={val}
                              onChange={(e) => handleQuestionChange(block.id, q.id, e.target.value)}
                              placeholder="0"
                              className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-sage-500 font-mono"
                            />
                            {q.type === 'percent' && (
                              <span className="text-zinc-500 text-sm font-semibold">%</span>
                            )}
                            {q.unit && (
                              <span className="text-zinc-500 text-xs">{q.unit}</span>
                            )}
                          </div>
                        )}

                        {/* Long text / textarea */}
                        {q.type === 'longText' && (
                          <textarea
                            disabled={isLocked}
                            value={val}
                            rows={3}
                            onChange={(e) => handleQuestionChange(block.id, q.id, e.target.value)}
                            className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-sage-500"
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* RENDER KIND: RECORDS */}
              {block.kind === 'records' && (
                <div className="space-y-4">
                  {(records[block.id] || []).length === 0 ? (
                    <div className="text-center py-8 bg-zinc-50/80 border border-dashed border-zinc-200 rounded-2xl">
                      <p className="text-xs text-zinc-500">No records recorded yet.</p>
                      {!isLocked && (
                        <div className="flex justify-center gap-3 mt-3">
                          <button
                            type="button"
                            onClick={() => handleAddRecordRow(block.id)}
                            className="text-xs font-semibold text-sage-700 hover:text-sage-800"
                          >
                            + Add first row
                          </button>
                          <span className="text-zinc-300">&middot;</span>
                          <button
                            type="button"
                            onClick={() => setImportModalBlockId(block.id)}
                            className="text-xs font-semibold text-zinc-600 hover:text-zinc-800"
                          >
                            Import from CSV/XLSX
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="border border-slate-200/80 rounded-2xl overflow-hidden shadow-sm">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs divide-y divide-slate-200">
                          <thead className="bg-zinc-50 font-semibold text-zinc-700">
                            <tr>
                              <th className="py-2.5 px-3 w-10 text-center">#</th>
                              {(block.fields || []).map((f: any) => (
                                <th key={f.id} className="py-2.5 px-3 min-w-[130px]">
                                  {f.label}
                                  {f.required && <span className="text-dusty-rose-600 ml-0.5">*</span>}
                                </th>
                              ))}
                              {!isLocked && <th className="py-2.5 px-3 w-12 text-center">Action</th>}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 bg-white">
                            {(records[block.id] || []).map((row: any, rIdx: number) => (
                              <tr key={rIdx} className="hover:bg-zinc-50/50">
                                <td className="py-2 px-3 text-center text-zinc-400 font-mono">
                                  {rIdx + 1}
                                </td>
                                {(block.fields || []).map((f: any) => {
                                  const val = row[f.id] ?? '';

                                  return (
                                    <td key={f.id} className="py-2 px-3">
                                      {f.type === 'enum' ? (
                                        <select
                                          disabled={isLocked}
                                          value={val}
                                          onChange={(e) =>
                                            handleRecordFieldChange(block.id, rIdx, f.id, e.target.value)
                                          }
                                          className="w-full py-1 px-2 border border-zinc-200 rounded-lg text-xs"
                                        >
                                          <option value="">-- select --</option>
                                          {(f.options || []).map((opt: any) => (
                                            <option key={opt.value ?? opt} value={opt.value ?? opt}>
                                              {opt.label ?? opt}
                                            </option>
                                          ))}
                                        </select>
                                      ) : f.type === 'integer' || f.type === 'decimal' ? (
                                        <input
                                          type="number"
                                          disabled={isLocked}
                                          value={val}
                                          onChange={(e) =>
                                            handleRecordFieldChange(block.id, rIdx, f.id, e.target.value)
                                          }
                                          className="w-full py-1 px-2 border border-zinc-200 rounded-lg text-xs font-mono"
                                        />
                                      ) : (
                                        <input
                                          type="text"
                                          disabled={isLocked}
                                          value={val}
                                          onChange={(e) =>
                                            handleRecordFieldChange(block.id, rIdx, f.id, e.target.value)
                                          }
                                          className="w-full py-1 px-2 border border-zinc-200 rounded-lg text-xs"
                                        />
                                      )}
                                    </td>
                                  );
                                })}
                                {!isLocked && (
                                  <td className="py-2 px-3 text-center">
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteRecordRow(block.id, rIdx)}
                                      className="p-1 text-zinc-400 hover:text-dusty-rose-600 rounded-md hover:bg-dusty-rose-50"
                                      title="Delete record"
                                    >
                                      <Trash className="w-3.5 h-3.5" />
                                    </button>
                                  </td>
                                )}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Bottom Action Footer */}
      <div className="flex items-center justify-between pt-6 border-t border-slate-100">
        <button
          type="button"
          onClick={() => performSave(true)}
          disabled={isLocked || saveState === 'saving'}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-zinc-700 bg-white border border-zinc-300 hover:bg-zinc-50 rounded-xl transition-all shadow-sm"
        >
          <FloppyDisk className="w-4 h-4" />
          Save Draft
        </button>

        {!isLocked && (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || (!notApplicable && errors.length > 0)}
            className="inline-flex items-center gap-2 px-6 py-2.5 text-xs font-semibold text-white bg-sage-600 hover:bg-sage-700 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-all shadow-sm"
          >
            {submitting ? (
              <>
                <ArrowsClockwise className="w-4 h-4 animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4" />
                Submit Section
              </>
            )}
          </button>
        )}
      </div>

      {/* Warning Explanation Modal */}
      {showWarningModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-[2rem] max-w-lg w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-soft-gold-700">
                <Warning className="w-5 h-5" />
                <h3 className="font-semibold text-zinc-900">Explanation Note Required</h3>
              </div>
              <button
                onClick={() => setShowWarningModal(false)}
                className="text-zinc-400 hover:text-zinc-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-zinc-500 leading-relaxed">
              This submission contains {warnings.length} advisory validation warning(s). Please provide a brief note explaining the variance for the DORA audit trail.
            </p>
            <div className="bg-zinc-50 p-3 rounded-xl border border-zinc-200 text-xs text-zinc-700 space-y-1">
              {warnings.map((w, i) => (
                <div key={i}>&bull; {w.message}</div>
              ))}
            </div>
            <textarea
              value={warningNote}
              onChange={(e) => setWarningNote(e.target.value)}
              placeholder="e.g. Land area excludes leasehold forest tract; RWH pond construction completed in Oct 2025."
              rows={3}
              className="w-full p-3 text-xs border border-zinc-200 rounded-xl focus:ring-1 focus:ring-sage-500 focus:outline-none"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowWarningModal(false)}
                className="px-4 py-2 text-xs font-semibold text-zinc-600 hover:bg-zinc-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!warningNote.trim()}
                onClick={() => {
                  setShowWarningModal(false);
                  handleSubmit();
                }}
                className="px-5 py-2 text-xs font-semibold text-white bg-sage-600 hover:bg-sage-700 disabled:opacity-50 rounded-xl"
              >
                Confirm & Submit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Import Modal */}
      {importModalBlockId && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-[2rem] max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-zinc-900">
                <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                <h3 className="font-semibold">Import Records (CSV / XLSX)</h3>
              </div>
              <button
                onClick={() => setImportModalBlockId(null)}
                className="text-zinc-400 hover:text-zinc-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-zinc-500">
              Upload a spreadsheet matching the column names. Rows will be validated and imported into this section block.
            </p>
            <div className="border-2 border-dashed border-zinc-200 hover:border-sage-400 rounded-2xl p-6 text-center cursor-pointer relative">
              <UploadSimple className="w-8 h-8 text-zinc-400 mx-auto mb-2" />
              <p className="text-xs font-medium text-zinc-700">Choose .xlsx or .csv file</p>
              <p className="text-[11px] text-zinc-400 mt-0.5">Maximum size 25MB, up to 5,000 rows</p>
              <input
                type="file"
                accept=".xlsx,.csv"
                disabled={importing}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileImport(importModalBlockId, file);
                }}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
            </div>
            {importing && (
              <div className="flex items-center justify-center gap-2 text-xs text-zinc-500 py-2">
                <ArrowsClockwise className="w-4 h-4 animate-spin text-sage-600" />
                <span>Parsing and validating records...</span>
              </div>
            )}
            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setImportModalBlockId(null)}
                className="px-4 py-2 text-xs font-semibold text-zinc-600 hover:bg-zinc-100 rounded-xl"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
