import { reissueLink, sendReminders } from '@/lib/server/dispatch';
import {
  asString,
  asStringArray,
  badRequest,
  notFound,
  ok,
  readJson,
  serverError,
} from '@/lib/server/http';
import { findRequest, revokeGrants, updateRequest } from '@/lib/server/store';
import type { TargetStatus } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TARGET_STATUSES: TargetStatus[] = ['PENDING', 'PARTIAL', 'SUBMITTED'];

/** Follow-up actions on a dispatched request: reminders, link reissue, closure. */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    if (!(await findRequest(id))) return notFound('Data request not found.');

    const body = (await readJson(request)) ?? {};
    const action = asString(body.action)?.toUpperCase();

    if (action === 'REMIND') {
      const summary = await sendReminders(id, asStringArray(body.unitIds));
      if (!summary) return notFound('Data request not found.');
      return ok({
        request: summary.request,
        message:
          summary.reminded === 0
            ? 'No pending sections to remind.'
            : `Reminder sent to ${summary.reminded} recipient${summary.reminded === 1 ? '' : 's'} with fresh upload links.`,
        failed: summary.failed,
      });
    }

    if (action === 'REISSUE') {
      const unitId = asString(body.unitId);
      const officerId = asString(body.officerId);
      if (!unitId || !officerId) return badRequest('unitId and officerId are required.');
      const issued = await reissueLink(id, unitId, officerId);
      if (!issued) return notFound('No such recipient on this request.');
      return ok({ url: issued.url, message: 'A fresh upload link has been provisioned.' });
    }

    if (action === 'SET_TARGET_STATUS') {
      const unitId = asString(body.unitId);
      const status = asString(body.status)?.toUpperCase() as TargetStatus | undefined;
      if (!unitId) return badRequest('unitId is required.');
      if (!status || !TARGET_STATUSES.includes(status)) return badRequest('Unknown target status.');

      const updated = await updateRequest(id, (draft) => {
        const target = draft.targets.find((row) => row.unitId === unitId);
        if (!target) return;
        target.status = status;
        target.submittedAt = status === 'SUBMITTED' ? new Date().toISOString() : undefined;
      });
      return ok({ request: updated, message: 'Section status updated.' });
    }

    if (action === 'CLOSE') {
      const revoked = await revokeGrants((grant) => grant.requestId === id);
      const updated = await updateRequest(id, (draft) => {
        draft.status = 'CLOSED';
      });
      return ok({
        request: updated,
        message: `Request closed. ${revoked} upload link${revoked === 1 ? '' : 's'} invalidated.`,
      });
    }

    if (action === 'REOPEN') {
      const updated = await updateRequest(id, (draft) => {
        draft.status = 'DISPATCHED';
      });
      return ok({
        request: updated,
        message: 'Request reopened. Send a reminder to provision new upload links.',
      });
    }

    return badRequest('Unknown request action.');
  } catch (error) {
    return serverError(error);
  }
}
