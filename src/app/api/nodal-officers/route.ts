import { isValidUnitId } from '@/lib/organogram';
import { buildCoverage } from '@/lib/server/coverage';
import {
  asString,
  asStringArray,
  badRequest,
  isEmail,
  ok,
  readJson,
  serverError,
} from '@/lib/server/http';
import { createOfficer, findOfficerByEmail, listOfficers, listRequests } from '@/lib/server/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const [officers, requests] = await Promise.all([listOfficers(), listRequests()]);
    return ok({ officers, coverage: buildCoverage(officers, requests) });
  } catch (error) {
    return serverError(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await readJson(request);
    if (!body) return badRequest('Expected a JSON object.');

    const name = asString(body.name);
    const email = asString(body.email)?.toLowerCase();
    const unitIds = asStringArray(body.unitIds);

    if (!name) return badRequest('Officer name is required.');
    if (!email || !isEmail(email)) return badRequest('A valid email address is required.');
    if (unitIds.length === 0) return badRequest('Assign at least one organogram section.');

    const unknownUnits = unitIds.filter((id) => !isValidUnitId(id));
    if (unknownUnits.length > 0) {
      return badRequest('Unknown organogram sections.', unknownUnits);
    }

    if (await findOfficerByEmail(email)) {
      return badRequest('A nodal officer with this email already exists.');
    }

    const officer = await createOfficer({
      name,
      email,
      unitIds,
      designation: asString(body.designation),
      phone: asString(body.phone),
      notes: asString(body.notes),
    });

    return ok({ officer }, { status: 201 });
  } catch (error) {
    return serverError(error);
  }
}
