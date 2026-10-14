import { buildCoverage } from '@/lib/server/coverage';
import { ok, serverError } from '@/lib/server/http';
import { listOfficers, listRequests } from '@/lib/server/store';
import { ORG_UNITS } from '@/lib/organogram';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Organogram coverage: who covers which section and what is outstanding. */
export async function GET() {
  try {
    const [officers, requests] = await Promise.all([listOfficers(), listRequests()]);
    const coverage = buildCoverage(officers, requests);
    const assignable = ORG_UNITS.filter((unit) => unit.id !== 'iit-mandi');
    const covered = assignable.filter((unit) => coverage[unit.id].officerIds.length > 0);

    return ok({
      officers,
      coverage,
      stats: {
        units: assignable.length,
        covered: covered.length,
        uncovered: assignable.length - covered.length,
        officers: officers.filter((officer) => officer.status !== 'REVOKED').length,
        openRequests: requests.filter((request) => request.status !== 'CLOSED').length,
      },
    });
  } catch (error) {
    return serverError(error);
  }
}
