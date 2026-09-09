import { isValidDataItemId, type RankingFramework } from '@/lib/data-catalogue';
import { isValidUnitId } from '@/lib/organogram';
import { dispatchRequest } from '@/lib/server/dispatch';
import {
  asString,
  asStringArray,
  badRequest,
  ok,
  readJson,
  serverError,
} from '@/lib/server/http';
import { transportName } from '@/lib/server/mailer';
import { listRequests, listUploads } from '@/lib/server/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const FRAMEWORKS: RankingFramework[] = ['NIRF', 'QS', 'THE', 'NAAC'];

export async function GET() {
  try {
    const [requests, uploads] = await Promise.all([listRequests(), listUploads()]);
    return ok({ requests, uploads, transport: transportName() });
  } catch (error) {
    return serverError(error);
  }
}

/** Dispatches a targeted data request to the selected organogram sections. */
export async function POST(request: Request) {
  try {
    const body = await readJson(request);
    if (!body) return badRequest('Expected a JSON object.');

    const title = asString(body.title);
    const subject = asString(body.subject);
    const message = asString(body.message);
    const deadline = asString(body.deadline);
    const framework = (asString(body.framework)?.toUpperCase() ?? 'NIRF') as RankingFramework;
    const cycleYear = Number(body.cycleYear);
    const unitIds = asStringArray(body.unitIds);
    const dataItemIds = asStringArray(body.dataItemIds);

    if (!title) return badRequest('Request title is required.');
    if (!subject) return badRequest('Email subject is required.');
    if (!message) return badRequest('Email message is required.');
    if (!FRAMEWORKS.includes(framework)) return badRequest('Unknown ranking framework.');
    if (!Number.isInteger(cycleYear) || cycleYear < 2000 || cycleYear > 2100) {
      return badRequest('A valid ranking cycle year is required.');
    }
    if (!deadline || Number.isNaN(new Date(deadline).getTime())) {
      return badRequest('A valid submission deadline is required.');
    }
    if (unitIds.length === 0) return badRequest('Select at least one organogram section.');
    if (dataItemIds.length === 0) return badRequest('Select at least one required data item.');

    const unknownUnits = unitIds.filter((id) => !isValidUnitId(id));
    if (unknownUnits.length > 0) return badRequest('Unknown organogram sections.', unknownUnits);

    const unknownItems = dataItemIds.filter((id) => !isValidDataItemId(id));
    if (unknownItems.length > 0) return badRequest('Unknown data items.', unknownItems);

    const summary = await dispatchRequest({
      title,
      subject,
      message,
      deadline: new Date(deadline).toISOString(),
      framework,
      cycleYear,
      unitIds,
      dataItemIds,
      createdBy: asString(body.createdBy) ?? 'DORA Office',
    });

    return ok({ ...summary, transport: transportName() }, { status: 201 });
  } catch (error) {
    return serverError(error);
  }
}
