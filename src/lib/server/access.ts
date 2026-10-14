/**
 * Restricted portal access for nodal officers.
 *
 * Dispatching a data request automatically provisions one single-purpose grant
 * per (officer, section, request). The raw token only ever exists inside the
 * outgoing email and the returned link; the store keeps its SHA-256 digest, so
 * a leaked datastore cannot be replayed against the upload endpoint.
 */

import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

import type { AccessGrant, DataRequest, NodalOfficer } from '../types';
import { findGrantByHash, findOfficer, findRequest, newId } from './store';

const DEFAULT_TTL_DAYS = 45;

export function accessTtlDays(): number {
  const configured = Number(process.env.PORTAL_ACCESS_TTL_DAYS);
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_TTL_DAYS;
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function generateToken(): string {
  return randomBytes(32).toString('base64url');
}

export function portalPath(token: string): string {
  return `/portal/${token}`;
}

export function baseUrl(): string {
  const configured = process.env.APP_BASE_URL || process.env.APP_URL;
  return (configured || 'http://localhost:3000').replace(/\/+$/, '');
}

export function portalUrl(token: string): string {
  return `${baseUrl()}${portalPath(token)}`;
}

export interface IssuedGrant {
  grant: AccessGrant;
  token: string;
  url: string;
}

export function buildGrant(input: {
  officerId: string;
  requestId: string;
  unitId: string;
  dataItemIds: string[];
  expiresAt: string;
}): IssuedGrant {
  const token = generateToken();
  const grant: AccessGrant = {
    id: newId('grant'),
    tokenHash: hashToken(token),
    officerId: input.officerId,
    requestId: input.requestId,
    unitId: input.unitId,
    dataItemIds: input.dataItemIds,
    createdAt: new Date().toISOString(),
    expiresAt: input.expiresAt,
    useCount: 0,
  };
  return { grant, token, url: portalUrl(token) };
}

export type AccessFailure = 'INVALID' | 'REVOKED' | 'EXPIRED' | 'ORPHANED';

export type AccessResult =
  | { ok: true; grant: AccessGrant; officer: NodalOfficer; request: DataRequest }
  | { ok: false; reason: AccessFailure };

/** Resolves a raw portal token to its grant, officer and data request. */
export async function verifyAccessToken(token: string): Promise<AccessResult> {
  if (!token || token.length < 20) return { ok: false, reason: 'INVALID' };

  const digest = hashToken(token);
  const grant = await findGrantByHash(digest);
  if (!grant) return { ok: false, reason: 'INVALID' };

  // Constant-time confirmation of the digest match.
  const expected = Buffer.from(grant.tokenHash, 'hex');
  const actual = Buffer.from(digest, 'hex');
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    return { ok: false, reason: 'INVALID' };
  }

  if (grant.revokedAt) return { ok: false, reason: 'REVOKED' };
  if (new Date(grant.expiresAt).getTime() < Date.now()) return { ok: false, reason: 'EXPIRED' };

  const [officer, request] = await Promise.all([
    findOfficer(grant.officerId),
    findRequest(grant.requestId),
  ]);
  if (!officer || !request) return { ok: false, reason: 'ORPHANED' };
  if (officer.status === 'REVOKED') return { ok: false, reason: 'REVOKED' };

  return { ok: true, grant, officer, request };
}

export const ACCESS_FAILURE_MESSAGES: Record<AccessFailure, string> = {
  INVALID: 'This access link is not valid. Please use the link from your request email.',
  REVOKED: 'Access through this link has been revoked by the DORA office.',
  EXPIRED: 'This access link has expired. Request a fresh link from the DORA office.',
  ORPHANED: 'The data request behind this link is no longer available.',
};
