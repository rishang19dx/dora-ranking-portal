import Link from 'next/link';
import { ShieldCheck, WarningOctagon } from '@phosphor-icons/react/dist/ssr';

import { getDataItem } from '@/lib/data-catalogue';
import { unitBreadcrumb, unitLabel } from '@/lib/organogram';
import { ACCESS_FAILURE_MESSAGES, verifyAccessToken } from '@/lib/server/access';
import { listUploads } from '@/lib/server/store';

import PortalUploader from './PortalUploader';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Secure Upload | IIT Mandi Ranking Portal',
  robots: { index: false, follow: false },
};

export default async function PortalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const access = await verifyAccessToken(token);

  if (!access.ok) {
    return (
      <main className="min-h-[100dvh] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white border border-slate-200/50 rounded-[2rem] p-10 text-center shadow-[0_20px_40px_-15px_rgba(0,0,0,0.06)]">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-dusty-rose-50 text-dusty-rose-600 flex items-center justify-center">
            <WarningOctagon weight="duotone" className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 mt-6">
            Access unavailable
          </h1>
          <p className="text-sm text-zinc-500 leading-relaxed mt-3">
            {ACCESS_FAILURE_MESSAGES[access.reason]}
          </p>
          <Link
            href="/"
            className="inline-block mt-8 text-sm font-semibold text-sage-700 hover:underline"
          >
            Go to the public portal
          </Link>
        </div>
      </main>
    );
  }

  const { grant, officer, request } = access;
  const uploads = (await listUploads()).filter(
    (upload) => upload.requestId === grant.requestId && upload.unitId === grant.unitId,
  );

  const items = grant.dataItemIds.map((id) => ({
    id,
    label: getDataItem(id)?.label ?? id,
    description: getDataItem(id)?.description ?? '',
    proofFormats: getDataItem(id)?.proofFormats ?? [],
  }));

  const closed = request.status === 'CLOSED';

  return (
    <main className="min-h-[100dvh] py-10 px-4 md:px-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <header className="bg-white border border-slate-200/50 rounded-[2rem] p-8 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)]">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-sage-700">
            <ShieldCheck weight="duotone" className="w-4 h-4" />
            Restricted upload access
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 mt-3">
            {request.title}
          </h1>
          <p className="text-sm text-zinc-500 mt-2 leading-relaxed">
            {request.reference} &middot; {request.framework} {request.cycleYear} &middot; deadline{' '}
            {new Date(request.deadline).toLocaleDateString('en-IN', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </p>

          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6 pt-6 border-t border-slate-100 text-sm">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Nodal officer
              </dt>
              <dd className="text-zinc-900 font-medium mt-1">{officer.name}</dd>
              <dd className="text-zinc-500 text-xs">{officer.email}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Section
              </dt>
              <dd className="text-zinc-900 font-medium mt-1">{unitLabel(grant.unitId)}</dd>
              <dd className="text-zinc-500 text-xs">
                {unitBreadcrumb(grant.unitId).join(' / ') || 'Institute'}
              </dd>
            </div>
          </dl>

          <p className="text-xs text-zinc-400 mt-6 leading-relaxed">
            This link is personal, expires on{' '}
            {new Date(grant.expiresAt).toLocaleDateString('en-IN', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
            , and can only be used to upload evidence for the section named above. Do not forward
            it.
          </p>
        </header>

        {closed ? (
          <div className="bg-white border border-slate-200/50 rounded-[2rem] p-8 text-center">
            <p className="text-sm text-zinc-600">
              This data request has been closed by the DORA office. Uploads are no longer accepted.
            </p>
          </div>
        ) : (
          <PortalUploader token={token} items={items} initialUploads={uploads} />
        )}
      </div>
    </main>
  );
}
