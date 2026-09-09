/**
 * File-backed persistence for the data-collection workflow.
 *
 * The Prisma models in `prisma/schema.prisma` describe the same entities, but
 * the Postgres instance is not provisioned yet (see the roadmap in README.md).
 * Everything here is deliberately confined to this module so swapping the
 * implementation for Prisma queries touches nothing else: the API routes only
 * ever call the exported repository functions.
 */

import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';

import { ORG_UNITS } from '../organogram';
import type {
  AccessGrant,
  DataRequest,
  NodalOfficer,
  PortalStore,
  ProofUpload,
} from '../types';

const DATA_DIR = process.env.PORTAL_DATA_DIR
  ? path.resolve(process.env.PORTAL_DATA_DIR)
  : path.join(process.cwd(), '.data');

const STORE_FILE = path.join(DATA_DIR, 'portal-store.json');
export const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');

const EMPTY_STORE: PortalStore = {
  officers: [],
  requests: [],
  grants: [],
  uploads: [],
  sequence: 0,
};

/**
 * Seeds the roster from the mailboxes published in the organogram so an
 * administrator starts from the real institute contacts rather than an empty
 * table. Seeded rows are INVITED - they become ACTIVE once access is used.
 */
function seedOfficers(): NodalOfficer[] {
  const now = new Date().toISOString();
  return ORG_UNITS.filter((unit) => Boolean(unit.email)).map((unit) => ({
    id: `seed-${unit.id}`,
    name: unit.head ?? unit.name,
    designation: unit.head,
    email: unit.email!,
    unitIds: [unit.id],
    status: 'INVITED' as const,
    createdAt: now,
    updatedAt: now,
    notes: 'Imported from the institute organogram.',
  }));
}

let cache: PortalStore | null = null;
/** Serialises read-modify-write cycles so concurrent requests cannot interleave. */
let queue: Promise<unknown> = Promise.resolve();

async function readStore(): Promise<PortalStore> {
  if (cache) return cache;
  try {
    const raw = await fs.readFile(STORE_FILE, 'utf8');
    const parsed = JSON.parse(raw) as Partial<PortalStore>;
    cache = { ...EMPTY_STORE, ...parsed };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    cache = { ...EMPTY_STORE, officers: seedOfficers() };
    await writeStore(cache);
  }
  return cache;
}

async function writeStore(store: PortalStore): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const tmp = `${STORE_FILE}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(store, null, 2), 'utf8');
  await fs.rename(tmp, STORE_FILE);
  cache = store;
}

/** Runs `mutator` against the store and persists whatever it leaves behind. */
async function mutate<T>(mutator: (store: PortalStore) => T | Promise<T>): Promise<T> {
  const run = queue.then(async () => {
    const store = await readStore();
    const result = await mutator(store);
    await writeStore(store);
    return result;
  });
  // Keep the chain alive even when a mutation rejects.
  queue = run.catch(() => undefined);
  return run;
}

export function newId(prefix: string): string {
  return `${prefix}_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
}

// ---------------------------------------------------------------------------
// Nodal officers
// ---------------------------------------------------------------------------

export async function listOfficers(): Promise<NodalOfficer[]> {
  const store = await readStore();
  return [...store.officers].sort((a, b) => a.name.localeCompare(b.name));
}

export async function findOfficer(id: string): Promise<NodalOfficer | undefined> {
  const store = await readStore();
  return store.officers.find((officer) => officer.id === id);
}

export async function findOfficerByEmail(email: string): Promise<NodalOfficer | undefined> {
  const store = await readStore();
  const needle = email.trim().toLowerCase();
  return store.officers.find((officer) => officer.email.toLowerCase() === needle);
}

export async function createOfficer(
  input: Omit<NodalOfficer, 'id' | 'createdAt' | 'updatedAt' | 'status'> &
    Partial<Pick<NodalOfficer, 'status'>>,
): Promise<NodalOfficer> {
  return mutate((store) => {
    const now = new Date().toISOString();
    const officer: NodalOfficer = {
      ...input,
      id: newId('off'),
      status: input.status ?? 'INVITED',
      createdAt: now,
      updatedAt: now,
    };
    store.officers.push(officer);
    return officer;
  });
}

export async function updateOfficer(
  id: string,
  patch: Partial<Omit<NodalOfficer, 'id' | 'createdAt'>>,
): Promise<NodalOfficer | undefined> {
  return mutate((store) => {
    const officer = store.officers.find((row) => row.id === id);
    if (!officer) return undefined;
    Object.assign(officer, patch, { updatedAt: new Date().toISOString() });
    return officer;
  });
}

export async function deleteOfficer(id: string): Promise<boolean> {
  return mutate((store) => {
    const before = store.officers.length;
    store.officers = store.officers.filter((officer) => officer.id !== id);
    // Revoke any portal access the officer still holds.
    const now = new Date().toISOString();
    store.grants.forEach((grant) => {
      if (grant.officerId === id && !grant.revokedAt) grant.revokedAt = now;
    });
    return store.officers.length < before;
  });
}

/** Officers responsible for a section, including those covering an ancestor. */
export async function officersForUnits(unitIds: string[]): Promise<NodalOfficer[]> {
  const store = await readStore();
  const wanted = new Set(unitIds);
  return store.officers.filter(
    (officer) => officer.status !== 'REVOKED' && officer.unitIds.some((id) => wanted.has(id)),
  );
}

// ---------------------------------------------------------------------------
// Data requests
// ---------------------------------------------------------------------------

export async function listRequests(): Promise<DataRequest[]> {
  const store = await readStore();
  return [...store.requests].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function findRequest(id: string): Promise<DataRequest | undefined> {
  const store = await readStore();
  return store.requests.find((request) => request.id === id);
}

export async function nextReference(framework: string, cycleYear: number): Promise<string> {
  return mutate((store) => {
    store.sequence += 1;
    return `DORA/${cycleYear}/${framework}/${String(store.sequence).padStart(3, '0')}`;
  });
}

export async function saveRequest(request: DataRequest): Promise<DataRequest> {
  return mutate((store) => {
    const index = store.requests.findIndex((row) => row.id === request.id);
    if (index >= 0) store.requests[index] = request;
    else store.requests.push(request);
    return request;
  });
}

export async function updateRequest(
  id: string,
  mutator: (request: DataRequest) => void,
): Promise<DataRequest | undefined> {
  return mutate((store) => {
    const request = store.requests.find((row) => row.id === id);
    if (!request) return undefined;
    mutator(request);
    return request;
  });
}

// ---------------------------------------------------------------------------
// Access grants
// ---------------------------------------------------------------------------

export async function listGrants(): Promise<AccessGrant[]> {
  const store = await readStore();
  return store.grants;
}

export async function addGrants(grants: AccessGrant[]): Promise<void> {
  await mutate((store) => {
    store.grants.push(...grants);
  });
}

export async function findGrantByHash(tokenHash: string): Promise<AccessGrant | undefined> {
  const store = await readStore();
  return store.grants.find((grant) => grant.tokenHash === tokenHash);
}

export async function touchGrant(id: string): Promise<void> {
  await mutate((store) => {
    const grant = store.grants.find((row) => row.id === id);
    if (!grant) return;
    grant.lastUsedAt = new Date().toISOString();
    grant.useCount += 1;
  });
}

export async function revokeGrants(predicate: (grant: AccessGrant) => boolean): Promise<number> {
  return mutate((store) => {
    const now = new Date().toISOString();
    let revoked = 0;
    store.grants.forEach((grant) => {
      if (!grant.revokedAt && predicate(grant)) {
        grant.revokedAt = now;
        revoked += 1;
      }
    });
    return revoked;
  });
}

// ---------------------------------------------------------------------------
// Proof uploads
// ---------------------------------------------------------------------------

export async function listUploads(): Promise<ProofUpload[]> {
  const store = await readStore();
  return store.uploads;
}

export async function addUpload(upload: ProofUpload): Promise<ProofUpload> {
  return mutate((store) => {
    store.uploads.push(upload);
    return upload;
  });
}

export async function ensureUploadDir(): Promise<string> {
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  return UPLOAD_DIR;
}

/** Drops the in-process cache so the next read hits disk (tests, maintenance). */
export function resetCache(): void {
  cache = null;
}
