import React, { useEffect, useState } from 'react';
import { UserPlus, UsersThree, ShieldCheck } from '@phosphor-icons/react';
import { authService, userService, type ManagedUser } from '../../services/api';
import { useToast } from '../../components/ToastProvider';
import { ROLE_LABELS, ROLE_SUMMARIES, type PortalRole } from '../../lib/rbac';

const ROLES: PortalRole[] = ['ADMIN', 'DIRECTOR', 'AUDITOR', 'NODAL_OFFICER'];

const EMPTY_FORM = { username: '', email: '', first_name: '', last_name: '', role: 'NODAL_OFFICER' as PortalRole, password: '' };

function errorText(err: any, fallback: string): string {
  const data = err?.response?.data;
  if (!data) return fallback;
  if (typeof data.error === 'string') return data.error;
  const first = Object.entries(data)[0];
  if (!first) return fallback;
  const [field, msgs] = first;
  const msg = Array.isArray(msgs) ? msgs[0] : String(msgs);
  return field === 'non_field_errors' ? String(msg) : `${field}: ${msg}`;
}

/**
 * Who holds which role (spec 2.18). Admin only. Accounts are deactivated
 * rather than deleted, because audit entries name the person who acted.
 */
export default function AdminUsers() {
  const { showToast } = useToast();
  const me = authService.getCurrentUser();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(EMPTY_FORM);
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const load = async () => {
    try {
      setUsers(await userService.list());
    } catch (err) {
      showToast(errorText(err, 'Could not load accounts.'), 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      const created = await userService.create(form);
      setUsers((prev) => [...prev, created].sort((a, b) => a.username.localeCompare(b.username)));
      setForm(EMPTY_FORM);
      setShowForm(false);
      showToast(`Account ${created.username} created as ${ROLE_LABELS[created.role]}.`, 'success');
    } catch (err) {
      showToast(errorText(err, 'Could not create the account.'), 'error');
    } finally {
      setCreating(false);
    }
  };

  const update = async (user: ManagedUser, patch: Partial<ManagedUser>, done: string) => {
    try {
      const saved = await userService.update(user.id, patch);
      setUsers((prev) => prev.map((u) => (u.id === saved.id ? saved : u)));
      showToast(done, 'success');
    } catch (err) {
      showToast(errorText(err, 'Could not update the account.'), 'error');
    }
  };

  const field = (key: keyof typeof EMPTY_FORM, label: string, type = 'text', required = false) => (
    <label className="block">
      <span className="block text-xs font-semibold uppercase tracking-wider text-zinc-600 mb-1">{label}</span>
      <input
        type={type}
        required={required}
        value={form[key]}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
        className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-sage-500"
      />
    </label>
  );

  return (
    <div className="max-w-[1400px] mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-zinc-900">Users &amp; Roles</h1>
          <p className="text-zinc-500 mt-2 max-w-[70ch] text-sm leading-relaxed">
            Portal accounts and the role each one holds. The role decides everything a person can see and
            change; the server enforces it on every request.
          </p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="inline-flex items-center gap-2 bg-zinc-900 hover:bg-black text-white px-4 py-2.5 rounded-xl text-sm font-semibold"
        >
          <UserPlus weight="bold" className="w-4 h-4" /> New account
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        {ROLES.map((role) => (
          <div key={role} className="bg-white border border-slate-200/60 rounded-2xl p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-zinc-900">
              <ShieldCheck weight="duotone" className="w-4 h-4 text-sage-600" /> {ROLE_LABELS[role]}
            </div>
            <p className="text-xs text-zinc-500 mt-1 leading-relaxed">{ROLE_SUMMARIES[role]}</p>
            <p className="text-xs font-mono text-zinc-400 mt-2">
              {users.filter((u) => u.role === role && u.isActive).length} active
            </p>
          </div>
        ))}
      </div>

      {showForm && (
        <form onSubmit={create} className="bg-white border border-slate-200/60 rounded-2xl p-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          {field('username', 'Username', 'text', true)}
          {field('email', 'Institutional email', 'email', true)}
          <label className="block">
            <span className="block text-xs font-semibold uppercase tracking-wider text-zinc-600 mb-1">Role</span>
            <select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value as PortalRole })}
              className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-xl bg-white"
            >
              {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
            </select>
          </label>
          {field('first_name', 'First name')}
          {field('last_name', 'Last name')}
          {field('password', 'Initial password', 'password', true)}
          <p className="md:col-span-2 text-xs text-zinc-500 self-center">
            A nodal officer account is matched to the officer roster by email, which is what scopes them to
            their own department.
          </p>
          <button
            type="submit"
            disabled={creating}
            className="bg-sage-600 hover:bg-sage-700 disabled:opacity-60 text-white px-4 py-2.5 rounded-xl text-sm font-semibold"
          >
            {creating ? 'Creating…' : 'Create account'}
          </button>
        </form>
      )}

      <div className="bg-white border border-slate-200/60 rounded-2xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wider text-zinc-500">
            <tr>
              <th className="px-4 py-3">Account</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Last sign-in</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-zinc-400">Loading accounts…</td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-zinc-400">
                <UsersThree className="w-6 h-6 mx-auto mb-2" />No accounts yet.
              </td></tr>
            ) : users.map((u) => {
              const self = me && String(me.id) === String(u.id);
              return (
                <tr key={u.id} className="border-t border-slate-100">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-zinc-900">
                      {u.username}{self && <span className="ml-2 text-[10px] uppercase text-sage-700">you</span>}
                    </div>
                    <div className="text-xs text-zinc-500">{[u.first_name, u.last_name].filter(Boolean).join(' ') || '—'} · {u.email || 'no email'}</div>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      aria-label={`Role for ${u.username}`}
                      value={u.role}
                      disabled={Boolean(self) || u.isSuperuser}
                      title={u.isSuperuser ? 'Superusers are always Admin' : self ? 'You cannot change your own role' : undefined}
                      onChange={(e) => update(u, { role: e.target.value as PortalRole }, `${u.username} is now ${ROLE_LABELS[e.target.value as PortalRole]}.`)}
                      className="px-2 py-1.5 text-sm border border-zinc-200 rounded-lg bg-white disabled:bg-zinc-50"
                    >
                      {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-3 text-xs text-zinc-500">
                    {u.lastLogin ? new Date(u.lastLogin).toLocaleString('en-IN') : 'Never'}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      disabled={Boolean(self)}
                      onClick={() => update(u, { isActive: !u.isActive }, `${u.username} ${u.isActive ? 'deactivated' : 'reactivated'}.`)}
                      className={`text-xs font-semibold px-2.5 py-1 rounded-lg disabled:opacity-40 ${
                        u.isActive ? 'bg-sage-50 text-sage-800 hover:bg-sage-100' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                      }`}
                    >
                      {u.isActive ? 'Active · deactivate' : 'Inactive · reactivate'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
