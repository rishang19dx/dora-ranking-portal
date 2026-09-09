import { createHash, randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';

import { getDataItem } from '@/lib/data-catalogue';
import { ACCESS_FAILURE_MESSAGES, verifyAccessToken } from '@/lib/server/access';
import { badRequest, ok, serverError } from '@/lib/server/http';
import {
  addUpload,
  ensureUploadDir,
  listUploads,
  newId,
  touchGrant,
  updateOfficer,
  updateRequest,
} from '@/lib/server/store';
import type { ProofUpload } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_BYTES = 25 * 1024 * 1024;

/** Extensions derived from the catalogue's declared proof formats. */
function allowedExtensions(dataItemId: string): string[] {
  return (getDataItem(dataItemId)?.proofFormats ?? []).map((format) => `.${format.toLowerCase()}`);
}

/** Accepts one proof file against a restricted, single-section access grant. */
export async function POST(request: Request, context: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await context.params;
    const access = await verifyAccessToken(token);
    if (!access.ok) {
      return Response.json(
        { error: ACCESS_FAILURE_MESSAGES[access.reason] },
        { status: access.reason === 'INVALID' ? 404 : 403 },
      );
    }

    const { grant, officer } = access;

    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return badRequest('Expected a multipart form upload.');
    }

    const dataItemId = String(form.get('dataItemId') ?? '');
    const note = String(form.get('note') ?? '').trim();
    const file = form.get('file');

    if (!grant.dataItemIds.includes(dataItemId)) {
      return badRequest('This data item is not part of your request.');
    }
    if (!(file instanceof File) || file.size === 0) {
      return badRequest('Attach a file to upload.');
    }
    if (file.size > MAX_BYTES) {
      return badRequest('File exceeds the 25 MB limit.');
    }

    const extension = path.extname(file.name).toLowerCase();
    const permitted = allowedExtensions(dataItemId);
    if (permitted.length > 0 && !permitted.includes(extension)) {
      return badRequest(`Accepted formats for this item: ${permitted.join(', ')}.`);
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const checksum = createHash('sha256').update(buffer).digest('hex');

    const uploadRoot = await ensureUploadDir();
    const requestDir = path.join(uploadRoot, grant.requestId);
    await fs.mkdir(requestDir, { recursive: true });

    const storedName = `${grant.unitId}__${dataItemId}__${randomUUID()}${extension}`;
    await fs.writeFile(path.join(requestDir, storedName), buffer);

    const upload: ProofUpload = {
      id: newId('up'),
      requestId: grant.requestId,
      grantId: grant.id,
      officerId: grant.officerId,
      unitId: grant.unitId,
      dataItemId,
      fileName: file.name,
      storedName,
      size: file.size,
      contentType: file.type || 'application/octet-stream',
      checksum,
      note: note || undefined,
      uploadedAt: new Date().toISOString(),
    };

    await addUpload(upload);
    await touchGrant(grant.id);
    if (officer.status === 'INVITED') await updateOfficer(officer.id, { status: 'ACTIVE' });

    // Roll the section forward: SUBMITTED once every requested item has a proof.
    const uploads = await listUploads();
    const covered = new Set(
      uploads
        .filter((row) => row.requestId === grant.requestId && row.unitId === grant.unitId)
        .map((row) => row.dataItemId),
    );
    const complete = grant.dataItemIds.every((id) => covered.has(id));

    const updated = await updateRequest(grant.requestId, (draft) => {
      const target = draft.targets.find((row) => row.unitId === grant.unitId);
      if (!target) return;
      target.status = complete ? 'SUBMITTED' : 'PARTIAL';
      target.submittedAt = complete ? new Date().toISOString() : undefined;
    });

    return ok({
      upload,
      status: complete ? 'SUBMITTED' : 'PARTIAL',
      remaining: grant.dataItemIds.filter((id) => !covered.has(id)),
      requestStatus: updated?.status,
    });
  } catch (error) {
    return serverError(error);
  }
}
