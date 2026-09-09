import { unitLabel } from '@/lib/organogram';
import { baseUrl } from '@/lib/server/access';
import { asString, badRequest, notFound, ok, readJson, serverError } from '@/lib/server/http';
import { mailFrom, renderTemplate, sendMail, transportName } from '@/lib/server/mailer';
import { findOfficer, revokeGrants, updateOfficer } from '@/lib/server/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const INVITE_TEMPLATE = `Dear {{officer}},

You have been designated as a Nodal Officer for {{sections}} in the IIT Mandi Automated Ranking Portal.

Data requests from the DORA office will reach you by email. Each request carries a personal, time-limited upload link scoped to your section only - no portal account or password is required, and the link cannot be used for any other section.

Portal: {{portal}}

Please keep supporting proof documents ready in PDF, DOCX, XLSX or CSV form.

Regards,
DORA Office
Indian Institute of Technology Mandi`;

/** Officer-level access administration: invitation, revocation and restoration. */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const officer = await findOfficer(id);
    if (!officer) return notFound('Nodal officer not found.');

    const body = (await readJson(request)) ?? {};
    const action = asString(body.action)?.toUpperCase() ?? 'INVITE';

    if (action === 'REVOKE') {
      const revoked = await revokeGrants((grant) => grant.officerId === id);
      const updated = await updateOfficer(id, { status: 'REVOKED' });
      return ok({
        officer: updated,
        revokedGrants: revoked,
        message: `Portal access revoked. ${revoked} active link${revoked === 1 ? '' : 's'} invalidated.`,
      });
    }

    if (action === 'RESTORE') {
      const updated = await updateOfficer(id, { status: 'ACTIVE' });
      return ok({
        officer: updated,
        message: 'Officer restored. Issue a fresh request to provision new upload links.',
      });
    }

    if (action !== 'INVITE') return badRequest('Unknown access action.');

    const sections = officer.unitIds.map((unitId) => unitLabel(unitId)).join(', ');
    const vars = { officer: officer.name, sections, portal: baseUrl(), from: mailFrom() };
    const result = await sendMail({
      to: officer.email,
      subject: renderTemplate('Nodal Officer access - IIT Mandi Ranking Portal', vars),
      body: renderTemplate(INVITE_TEMPLATE, vars),
    });

    if (result.status === 'FAILED') {
      return ok(
        { officer, delivery: result, message: `Invitation could not be sent: ${result.error}` },
        { status: 502 },
      );
    }

    const updated = await updateOfficer(id, {
      lastInvitedAt: new Date().toISOString(),
      status: officer.status === 'REVOKED' ? 'INVITED' : officer.status,
    });

    return ok({
      officer: updated,
      delivery: result,
      message:
        result.status === 'SIMULATED'
          ? `Invitation written to the local outbox (no mail transport configured).`
          : `Invitation sent to ${officer.email}.`,
      transport: transportName(),
    });
  } catch (error) {
    return serverError(error);
  }
}
