import { notFound, ok, serverError } from '@/lib/server/http';
import { findRequest, listOfficers, listUploads } from '@/lib/server/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const dataRequest = await findRequest(id);
    if (!dataRequest) return notFound('Data request not found.');

    const [officers, uploads] = await Promise.all([listOfficers(), listUploads()]);
    return ok({
      request: dataRequest,
      officers: officers.filter((officer) =>
        dataRequest.targets.some((target) => target.officerIds.includes(officer.id)),
      ),
      uploads: uploads.filter((upload) => upload.requestId === id),
    });
  } catch (error) {
    return serverError(error);
  }
}
