/**
 * Role-based access control for the SPA (spec 2.18).
 *
 * The backend is the authority: every endpoint enforces these rules itself.
 * This module only decides what the UI offers, so a read-only role is not
 * shown buttons that would be refused, and a user is not sent to pages their
 * role cannot load.
 */
import type { User } from '../types';

export type PortalRole = 'ADMIN' | 'DIRECTOR' | 'AUDITOR' | 'NODAL_OFFICER';

export const ROLE_LABELS: Record<PortalRole, string> = {
  ADMIN: 'Admin / Data Officer',
  DIRECTOR: 'Leadership / Director',
  AUDITOR: 'Auditor',
  NODAL_OFFICER: 'Nodal Officer',
};

export const ROLE_SUMMARIES: Record<PortalRole, string> = {
  ADMIN: 'Full access: dispatch requests, review and approve submissions, export.',
  DIRECTOR: 'Read-only: executive dashboards, analytics and final reports.',
  AUDITOR: 'Read-only: proofs, the audit log and submission trails.',
  NODAL_OFFICER: 'Your own department only: tasks, submissions and analytics.',
};

export const OVERSIGHT: PortalRole[] = ['ADMIN', 'DIRECTOR', 'AUDITOR'];
export const LEADERSHIP: PortalRole[] = ['ADMIN', 'DIRECTOR'];
export const ADMIN_ONLY: PortalRole[] = ['ADMIN'];

export function roleOf(user: Pick<User, 'role'> | null | undefined): PortalRole | null {
  const role = user?.role;
  return role === 'ADMIN' || role === 'DIRECTOR' || role === 'AUDITOR' || role === 'NODAL_OFFICER'
    ? role
    : null;
}

/** Only the Data Officer changes anything; Director and Auditor are read-only. */
export function canWrite(user: Pick<User, 'role'> | null | undefined): boolean {
  return roleOf(user) === 'ADMIN';
}

export function hasRole(user: Pick<User, 'role'> | null | undefined, allowed: PortalRole[]): boolean {
  const role = roleOf(user);
  return role !== null && allowed.includes(role);
}

/** Where a role lands after signing in. */
export function homeFor(user: Pick<User, 'role'> | null | undefined): string {
  return roleOf(user) === 'NODAL_OFFICER' ? '/nodal-officer' : '/admin';
}

/**
 * Which roles may open each admin page. Pages missing here fall back to the
 * section default (oversight roles for /admin).
 */
export const ADMIN_ROUTE_ROLES: Record<string, PortalRole[]> = {
  '': OVERSIGHT,
  organogram: OVERSIGHT,
  'nodal-officers': OVERSIGHT,
  'data-collection': OVERSIGHT,
  'data-requests/new': ADMIN_ONLY,
  'data-requests/:id': OVERSIGHT,
  programmes: OVERSIGHT,
  rankings: OVERSIGHT,
  documents: OVERSIGHT,
  proofs: OVERSIGHT,
  'audit-log': OVERSIGHT,
  discrepancies: OVERSIGHT,
  reminders: OVERSIGHT,
  'public-rankings': OVERSIGHT,
  users: ADMIN_ONLY,
  settings: ADMIN_ONLY,
};

/** `canWrite` for the user in this browser session (read from the stored profile). */
export function canWriteNow(): boolean {
  try {
    const raw = localStorage.getItem('dora_user');
    return canWrite(raw ? JSON.parse(raw) : null);
  } catch {
    return false;
  }
}
