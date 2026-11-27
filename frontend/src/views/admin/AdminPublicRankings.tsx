import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, ArrowSquareOut, Trash, Eye, EyeSlash } from '@phosphor-icons/react';
import { publicRankingService, type ExternalRankingRow } from '../../services/api';
import { useToast } from '../../components/ToastProvider';
import { canWriteNow } from '../../lib/rbac';

const EMPTY = { system: 'QS_WORLD', systemLabel: '', year: String(new Date().getFullYear()), rankText: '', score: '', source: '', notes: '' };

function firstError(err: any, fallback: string) {
  const data = err?.response?.data;
  if (!data) return fallback;
  if (typeof data.error === 'string') return data.error;
  const first = Object.values(data)[0];
  return Array.isArray(first) ? String(first[0]) : String(first ?? fallback);
}

/**
 * Results for ranking systems other than NIRF (QS, THE, MDRA ...), which
 * publish no feed the portal can fetch. What is published here appears on the
 * public portal's Ranking Systems tab beside the NIRF series.
 */
export default function AdminPublicRankings() {
  const { showToast } = useToast();
  const writable = canWriteNow();
  const [rows, setRows] = useState<ExternalRankingRow[]>([]);
  const [systems, setSystems] = useState<{ value: string; label: string }[]>([]);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const res = await publicRankingService.listExternal();
      setRows(res.results);
      setSystems(res.systems);
    } catch {
      showToast('Could not load ranking results.', 'error');
    }
  };

  useEffect(() => { load(); }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await publicRankingService.saveExternal({
        system: form.system,
        systemLabel: form.systemLabel,
        year: Number(form.year),
        rankText: form.rankText,
        score: form.score === '' ? null : Number(form.score),
        source: form.source,
        notes: form.notes,
      });
      showToast('Result saved and published.', 'success');
      setForm({ ...EMPTY, system: form.system });
      await load();
    } catch (err) {
      showToast(firstError(err, 'Could not save the result.'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const togglePublished = async (row: ExternalRankingRow) => {
    try {
      await publicRankingService.saveExternal({ id: row.id, published: !row.published });
      await load();
    } catch (err) {
      showToast(firstError(err, 'Could not update the result.'), 'error');
    }
  };

  const remove = async (row: ExternalRankingRow) => {
    try {
      await publicRankingService.deleteExternal(row.id);
      setRows((r) => r.filter((x) => x.id !== row.id));
      showToast('Result removed.', 'success');
    } catch {
      showToast('Could not remove the result.', 'error');
    }
  };

  const input = 'w-full px-3 py-2 text-sm border border-zinc-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-sage-500';

  return (
    <div className="max-w-[1400px] mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-zinc-900">Public Rankings</h1>
          <p className="text-zinc-500 mt-2 max-w-[70ch] text-sm leading-relaxed">
            IIT Mandi&rsquo;s results in rankings other than NIRF. NIRF results are fetched automatically; these are
            entered from each ranking&rsquo;s own publication and shown on the public portal when published.
          </p>
        </div>
        <Link to="/?tab=systems" className="inline-flex items-center gap-1.5 text-sm font-semibold text-sage-700 hover:underline">
          View on public portal <ArrowSquareOut className="w-4 h-4" />
        </Link>
      </div>

      {rows.some((r) => r.demo) && (
        <p className="text-sm p-3 rounded-xl bg-orange-50 border border-orange-200 text-orange-900">
          Some results are illustrative demo data from <code>seed_demo_rankings</code>. Editing one makes it a real
          result; remove the rest with <code>manage.py seed_demo_rankings --clear</code> before going live.
        </p>
      )}

      {writable && (
        <form onSubmit={save} className="bg-white border border-slate-200/60 rounded-2xl p-5 grid grid-cols-1 md:grid-cols-6 gap-3 items-end" aria-label="Add a ranking result">
          <label className="md:col-span-2">
            <span className="block text-xs font-semibold text-zinc-600 mb-1">Ranking</span>
            <select value={form.system} onChange={(e) => setForm({ ...form, system: e.target.value })} className={`${input} bg-white`}>
              {systems.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </label>
          {form.system === 'OTHER' && (
            <label className="md:col-span-2">
              <span className="block text-xs font-semibold text-zinc-600 mb-1">Ranking name</span>
              <input value={form.systemLabel} onChange={(e) => setForm({ ...form, systemLabel: e.target.value })} className={input} />
            </label>
          )}
          <label>
            <span className="block text-xs font-semibold text-zinc-600 mb-1">Edition year</span>
            <input type="number" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} className={input} required />
          </label>
          <label>
            <span className="block text-xs font-semibold text-zinc-600 mb-1">Rank as published</span>
            <input value={form.rankText} placeholder="e.g. 601-650" onChange={(e) => setForm({ ...form, rankText: e.target.value })} className={input} required />
          </label>
          <label>
            <span className="block text-xs font-semibold text-zinc-600 mb-1">Score (optional)</span>
            <input type="number" step="any" value={form.score} onChange={(e) => setForm({ ...form, score: e.target.value })} className={input} />
          </label>
          <label className="md:col-span-3">
            <span className="block text-xs font-semibold text-zinc-600 mb-1">Source link</span>
            <input type="url" value={form.source} placeholder="https://" onChange={(e) => setForm({ ...form, source: e.target.value })} className={input} />
          </label>
          <label className="md:col-span-2">
            <span className="block text-xs font-semibold text-zinc-600 mb-1">Note</span>
            <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className={input} />
          </label>
          <button type="submit" disabled={saving} className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-zinc-900 text-white text-sm font-semibold disabled:opacity-50">
            <Plus weight="bold" className="w-4 h-4" /> Add result
          </button>
        </form>
      )}

      <div className="bg-white border border-slate-200/60 rounded-2xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wider text-zinc-500">
            <tr>
              <th className="px-4 py-2">Ranking</th><th className="px-4 py-2">Year</th><th className="px-4 py-2">Rank</th>
              <th className="px-4 py-2">Score</th><th className="px-4 py-2">Source</th><th className="px-4 py-2">Public</th>
              {writable && <th className="px-4 py-2" />}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-zinc-500">No results entered yet.</td></tr>
            ) : rows.map((r) => (
              <tr key={r.id} className="border-t border-slate-100">
                <td className="px-4 py-2 font-medium text-zinc-900">
                  {r.label}{r.demo && <span className="ml-2 text-[10px] uppercase text-orange-700">demo</span>}
                </td>
                <td className="px-4 py-2 tabular-nums">{r.year}</td>
                <td className="px-4 py-2 tabular-nums">{r.rankText}</td>
                <td className="px-4 py-2 tabular-nums">{r.score ?? '—'}</td>
                <td className="px-4 py-2 text-xs">{r.source ? <a href={r.source} target="_blank" rel="noreferrer noopener" className="text-sage-700 hover:underline">link</a> : '—'}</td>
                <td className="px-4 py-2 text-xs">{r.published ? 'Published' : 'Hidden'}</td>
                {writable && (
                  <td className="px-4 py-2 text-right whitespace-nowrap">
                    <button onClick={() => togglePublished(r)} title={r.published ? 'Hide from public portal' : 'Publish'} aria-label={r.published ? `Hide ${r.label} ${r.year}` : `Publish ${r.label} ${r.year}`} className="p-1.5 text-zinc-500 hover:text-zinc-900">
                      {r.published ? <EyeSlash className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                    <button onClick={() => remove(r)} aria-label={`Remove ${r.label} ${r.year}`} className="p-1.5 text-zinc-500 hover:text-dusty-rose-700">
                      <Trash className="w-4 h-4" />
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
