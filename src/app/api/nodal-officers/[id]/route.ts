import { isValidUnitId } from '@/lib/organogram';
import {
  asString,
  asStringArray,
  badRequest,
  isEmail,
  notFound,
  ok,
  readJson,
  serverError,
} from '@/lib/server/http';
import {
  deleteOfficer,
  findOfficer,
  findOfficerByEmail,
  updateOfficer,
} from '@/lib/server/store';
import type { NodalOfficer, OfficerStatus } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const STATUSES: OfficerStatus[] = ['INVITED', 'ACTIVE', 'REVOKED'];

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const existing = await findOfficer(id);
    if (!existing) return notFound('Nodal officer not found.');

    const body = await readJson(request);
    if (!body) return badRequest('Expected a JSON object.');

    const patch: Partial<NodalOfficer> = {};

    if ('name' in body) {
      const name = asString(body.name);
      if (!name) return badRequest('Officer name cannot be empty.');
      patch.name = name;
    }

    if ('email' in body) {
      const email = asString(body.email)?.toLowerCase();
      if (!email || !isEmail(email)) return badRequest('A valid email address is required.');
      const clash = await findOfficerByEmail(email);
      if (clash && clash.id !== id) return badRequest('Another officer already uses this email.');
      patch.email = email;
    }

    if ('unitIds' in body) {
      const unitIds = asStringArray(body.unitIds);
      if (unitIds.length === 0) return badRequest('Assign at least one organogram section.');
      const unknown = unitIds.filter((unitId) => !isValidUnitId(unitId));
      if (unknown.length > 0) return badRequest('Unknown organogram sections.', unknown);
      patch.unitIds = unitIds;
    }

    if ('status' in body) {
      const status = asString(body.status) as OfficerStatus | undefined;
      if (!status || !STATUSES.includes(status)) return badRequest('Unknown officer status.');
      patch.status = status;
    }

    if ('designation' in body) patch.designation = asString(body.designation);
    if ('phone' in body) patch.phone = asString(body.phone);
    if ('notes' in body) patch.notes = asString(body.notes);

    const officer = await updateOfficer(id, patch);
    return officer ? ok({ officer }) : notFound('Nodal officer not found.');
  } catch (error) {
    return serverError(error);
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const removed = await deleteOfficer(id);
    return removed ? ok({ removed: true }) : notFound('Nodal officer not found.');
  } catch (error) {
    return serverError(error);
  }
}
