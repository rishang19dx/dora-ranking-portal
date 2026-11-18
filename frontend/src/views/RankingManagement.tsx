import React, { useEffect, useState } from 'react';
import { api, authService } from '../services/api';
import { useToast } from '../components/ToastProvider';

const AGENCIES = ['NIRF', 'QS', 'THE', 'INDIA_TODAY_MDRA', 'OTHER'];

export default function RankingManagement() {
  const { showToast } = useToast();
  const user = authService.getCurrentUser();
  const role = user?.role || 'NODAL_OFFICER';
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ agency: 'NIRF', category: '', year: String(new Date().getFullYear()), rank: '', source_url: '', remarks: '' });
  const [evidence, setEvidence] = useState<File | null>(null);

  const load = async () => {
    try { setRecords((await api.get('/api/ranking-records/')).data); }
    catch { showToast('Unable to load ranking workflow records.', 'error'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const create = async (event: React.FormEvent) => {
    event.preventDefault();
    const data = new FormData();
    Object.entries(form).forEach(([key, value]) => data.append(key, value));
    if (evidence) data.append('evidence', evidence);
    try {
      await api.post('/api/ranking-records/', data, { headers: { 'Content-Type': 'multipart/form-data' } });
      showToast('Ranking saved as a draft.', 'success');
      setForm({ agency: 'NIRF', category: '', year: String(new Date().getFullYear()), rank: '', source_url: '', remarks: '' }); setEvidence(null); load();
    } catch { showToast('Could not save the ranking record.', 'error'); }
  };
  const action = async (id: string, name: string) => {
    const comment = name === 'reject' ? window.prompt('Reason for rejection:') || '' : '';
    try { await api.post(`/api/ranking-records/${id}/actions/${name}/`, { comment }); showToast(`Ranking ${name}ed.`, 'success'); load(); }
    catch { showToast(`Could not ${name} this ranking in its current state.`, 'error'); }
  };
  const privileged = ['ADMIN', 'DIRECTOR'].includes(role);

  return <div className="max-w-6xl mx-auto space-y-6">
    <div><p className="text-xs font-bold tracking-wider uppercase text-sage-700">Ranking Cell workflow</p><h1 className="text-3xl font-serif font-bold">Manage Ranking Results</h1><p className="text-sm text-zinc-500 mt-1">Add official results for any agency, attach proof, and move them through review before public release.</p></div>
    <form onSubmit={create} className="bg-white border border-slate-200 rounded-2xl p-6 grid md:grid-cols-2 gap-4">
      <select value={form.agency} onChange={e => setForm({...form, agency: e.target.value})} className="border rounded-xl p-3">{AGENCIES.map(x => <option key={x}>{x}</option>)}</select>
      <input required placeholder="Ranking category (e.g. Asia University Rankings)" value={form.category} onChange={e => setForm({...form, category: e.target.value})} className="border rounded-xl p-3" />
      <input required type="number" placeholder="Year" value={form.year} onChange={e => setForm({...form, year: e.target.value})} className="border rounded-xl p-3" />
      <input required placeholder="Rank or band (e.g. 401–500)" value={form.rank} onChange={e => setForm({...form, rank: e.target.value})} className="border rounded-xl p-3" />
      <input type="url" placeholder="Official result URL" value={form.source_url} onChange={e => setForm({...form, source_url: e.target.value})} className="border rounded-xl p-3" />
      <input type="file" accept=".pdf,image/*" onChange={e => setEvidence(e.target.files?.[0] || null)} className="border rounded-xl p-2.5" />
      <textarea placeholder="Notes for reviewer" value={form.remarks} onChange={e => setForm({...form, remarks: e.target.value})} className="border rounded-xl p-3 md:col-span-2" rows={3} />
      <button className="bg-sage-700 text-white font-semibold rounded-xl px-5 py-3 w-fit">Save draft</button>
    </form>
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden"><div className="p-5 border-b"><h2 className="font-bold">Ranking workflow records</h2></div>
      {loading ? <p className="p-6 text-sm text-zinc-500">Loading…</p> : <div className="divide-y">{records.map(r => <div key={r.id} className="p-4 flex flex-col md:flex-row md:items-center gap-3 justify-between"><div><p className="font-semibold">{r.agency} · {r.category} · {r.year}</p><p className="text-sm text-zinc-500">Rank {r.rank} · <span className="font-medium">{r.status.replace('_', ' ')}</span>{r.evidence_url && <> · <a className="text-blue-700 underline" href={r.evidence_url} target="_blank" rel="noreferrer">proof</a></>}</p></div><div className="flex gap-2">{r.status === 'DRAFT' || r.status === 'REJECTED' ? <button onClick={() => action(r.id, 'submit')} className="text-xs border rounded-lg px-3 py-2">Submit</button> : null}{role === 'AUDITOR' && r.status === 'PENDING_REVIEW' ? <><button onClick={() => action(r.id, 'verify')} className="text-xs bg-emerald-700 text-white rounded-lg px-3 py-2">Verify</button><button onClick={() => action(r.id, 'reject')} className="text-xs border rounded-lg px-3 py-2">Reject</button></> : null}{privileged && r.status === 'VERIFIED' ? <button onClick={() => action(r.id, 'publish')} className="text-xs bg-sage-700 text-white rounded-lg px-3 py-2">Publish</button> : null}{privileged && r.status === 'PUBLISHED' ? <button onClick={() => action(r.id, 'unpublish')} className="text-xs border rounded-lg px-3 py-2">Unpublish</button> : null}</div></div>)}</div>}
    </div>
  </div>;
}
