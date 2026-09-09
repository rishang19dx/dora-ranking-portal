/**
 * Dispatching a targeted data request.
 *
 * One call resolves the selected organogram sections to their nodal officers,
 * narrows the requested data per section, provisions a restricted upload grant
 * for every recipient and sends the email carrying that link.
 */

import { getUnit, unitLabel } from '../organogram';
import { dataItemLabel, getDataItem, type RankingFramework } from '../data-catalogue';
import type {
  AccessGrant,
  DataRequest,
  DataRequestTarget,
  DeliveryRecord,
  NodalOfficer,
} from '../types';
import { accessTtlDays, buildGrant, portalPath, portalUrl } from './access';
import {
  DEFAULT_REMINDER_TEMPLATE,
  renderTemplate,
  sendMail,
} from './mailer';
import {
  addGrants,
  findRequest,
  listOfficers,
  newId,
  nextReference,
  revokeGrants,
  saveRequest,
  updateRequest,
} from './store';

export interface DispatchInput {
  title: string;
  framework: RankingFramework;
  cycleYear: number;
  subject: string;
  message: string;
  deadline: string;
  unitIds: string[];
  dataItemIds: string[];
  createdBy: string;
}

/** Bullet list of the requested items, used in the email body. */
function formatDataItems(dataItemIds: string[]): string {
  return dataItemIds
    .map((id) => {
      const item = getDataItem(id);
      if (!item) return `  - ${id}`;
      return `  - ${item.label} (proof: ${item.proofFormats.join(', ')})`;
    })
    .join('\n');
}

function formatDeadline(deadline: string): string {
  const date = new Date(deadline);
  if (Number.isNaN(date.getTime())) return deadline;
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
}

/** Items the section actually owns; falls back to the full list if none match. */
export function itemsForUnit(unitId: string, dataItemIds: string[]): string[] {
  const scopes = new Set(getUnit(unitId)?.dataScopes ?? []);
  const owned = dataItemIds.filter((id) => scopes.has(id));
  return owned.length > 0 ? owned : dataItemIds;
}

function templateVars(args: {
  officer: NodalOfficer;
  unitId: string;
  request: Pick<DataRequest, 'reference' | 'framework' | 'cycleYear' | 'deadline' | 'title'>;
  dataItemIds: string[];
  token: string;
}): Record<string, string> {
  return {
    officer: args.officer.name,
    email: args.officer.email,
    section: unitLabel(args.unitId),
    sectionFullName: getUnit(args.unitId)?.name ?? args.unitId,
    framework: args.request.framework,
    cycle: String(args.request.cycleYear),
    title: args.request.title,
    reference: args.request.reference,
    deadline: formatDeadline(args.request.deadline),
    dataItems: formatDataItems(args.dataItemIds),
    portalLink: portalUrl(args.token),
  };
}

export interface DispatchSummary {
  request: DataRequest;
  sent: number;
  simulated: number;
  failed: number;
  unassignedUnitIds: string[];
}

export async function dispatchRequest(input: DispatchInput): Promise<DispatchSummary> {
  const officers = await listOfficers();
  const reference = await nextReference(input.framework, input.cycleYear);
  const requestId = newId('req');
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + accessTtlDays() * 86_400_000).toISOString();

  const targets: DataRequestTarget[] = [];
  const deliveries: DeliveryRecord[] = [];
  const grants: AccessGrant[] = [];
  const unassignedUnitIds: string[] = [];

  for (const unitId of input.unitIds) {
    const unitItems = itemsForUnit(unitId, input.dataItemIds);
    const recipients = officers.filter(
      (officer) => officer.status !== 'REVOKED' && officer.unitIds.includes(unitId),
    );

    if (recipients.length === 0) unassignedUnitIds.push(unitId);

    targets.push({
      unitId,
      officerIds: recipients.map((officer) => officer.id),
      dataItemIds: unitItems,
      status: 'PENDING',
      remindersSent: 0,
    });

    for (const officer of recipients) {
      const issued = buildGrant({
        officerId: officer.id,
        requestId,
        unitId,
        dataItemIds: unitItems,
        expiresAt,
      });
      grants.push(issued.grant);

      const vars = templateVars({
        officer,
        unitId,
        request: {
          reference,
          framework: input.framework,
          cycleYear: input.cycleYear,
          deadline: input.deadline,
          title: input.title,
        },
        dataItemIds: unitItems,
        token: issued.token,
      });

      const subject = renderTemplate(input.subject, vars);
      const result = await sendMail({
        to: officer.email,
        subject,
        body: renderTemplate(input.message, vars),
      });

      deliveries.push({
        id: newId('del'),
        officerId: officer.id,
        officerName: officer.name,
        unitId,
        email: officer.email,
        subject,
        status: result.status,
        error: result.error,
        sentAt: new Date().toISOString(),
        portalPath: portalPath(issued.token),
        kind: 'DISPATCH',
      });
    }
  }

  const request: DataRequest = {
    id: requestId,
    reference,
    title: input.title,
    framework: input.framework,
    cycleYear: input.cycleYear,
    subject: input.subject,
    message: input.message,
    deadline: input.deadline,
    dataItemIds: input.dataItemIds,
    targets,
    deliveries,
    status: 'DISPATCHED',
    createdBy: input.createdBy,
    createdAt: now,
    dispatchedAt: now,
  };

  await addGrants(grants);
  await saveRequest(request);

  return {
    request,
    sent: deliveries.filter((d) => d.status === 'SENT').length,
    simulated: deliveries.filter((d) => d.status === 'SIMULATED').length,
    failed: deliveries.filter((d) => d.status === 'FAILED').length,
    unassignedUnitIds,
  };
}

export interface ReminderSummary {
  request: DataRequest;
  reminded: number;
  failed: number;
}

/**
 * Re-sends a request to sections that have not submitted yet. Each reminder
 * provisions a fresh grant and revokes the recipient's previous link for the
 * request, so exactly one live link exists per officer and section.
 */
export async function sendReminders(
  requestId: string,
  unitIds?: string[],
): Promise<ReminderSummary | undefined> {
  const officers = await listOfficers();
  const officerById = new Map(officers.map((officer) => [officer.id, officer]));
  const expiresAt = new Date(Date.now() + accessTtlDays() * 86_400_000).toISOString();

  const pending: { unitId: string; officer: NodalOfficer; dataItemIds: string[] }[] = [];

  const request = await findRequest(requestId);
  if (!request) return undefined;

  request.targets.forEach((target) => {
    if (target.status === 'SUBMITTED') return;
    if (unitIds && unitIds.length > 0 && !unitIds.includes(target.unitId)) return;
    target.officerIds.forEach((officerId) => {
      const officer = officerById.get(officerId);
      if (!officer || officer.status === 'REVOKED') return;
      pending.push({ unitId: target.unitId, officer, dataItemIds: target.dataItemIds });
    });
  });

  const grants: AccessGrant[] = [];
  const deliveries: DeliveryRecord[] = [];

  for (const entry of pending) {
    await revokeGrants(
      (grant) =>
        grant.requestId === requestId &&
        grant.unitId === entry.unitId &&
        grant.officerId === entry.officer.id,
    );

    const issued = buildGrant({
      officerId: entry.officer.id,
      requestId,
      unitId: entry.unitId,
      dataItemIds: entry.dataItemIds,
      expiresAt,
    });
    grants.push(issued.grant);

    const vars = templateVars({
      officer: entry.officer,
      unitId: entry.unitId,
      request,
      dataItemIds: entry.dataItemIds,
      token: issued.token,
    });

    const subject = renderTemplate(`Reminder: {{reference}} - {{title}}`, vars);
    const result = await sendMail({
      to: entry.officer.email,
      subject,
      body: renderTemplate(DEFAULT_REMINDER_TEMPLATE, vars),
    });

    deliveries.push({
      id: newId('del'),
      officerId: entry.officer.id,
      officerName: entry.officer.name,
      unitId: entry.unitId,
      email: entry.officer.email,
      subject,
      status: result.status,
      error: result.error,
      sentAt: new Date().toISOString(),
      portalPath: portalPath(issued.token),
      kind: 'REMINDER',
    });
  }

  await addGrants(grants);

  const updated = await updateRequest(requestId, (draft) => {
    draft.deliveries.push(...deliveries);
    const now = new Date().toISOString();
    const remindedUnits = new Set(deliveries.map((delivery) => delivery.unitId));
    draft.targets.forEach((target) => {
      if (!remindedUnits.has(target.unitId)) return;
      target.remindersSent += 1;
      target.lastReminderAt = now;
    });
  });

  return {
    request: updated ?? request,
    reminded: deliveries.filter((delivery) => delivery.status !== 'FAILED').length,
    failed: deliveries.filter((delivery) => delivery.status === 'FAILED').length,
  };
}

/** Re-issues a single officer's link for a request without emailing a reminder. */
export async function reissueLink(
  requestId: string,
  unitId: string,
  officerId: string,
): Promise<{ url: string } | undefined> {
  const request = await findRequest(requestId);
  if (!request) return undefined;
  const target = request.targets.find((row) => row.unitId === unitId);
  if (!target || !target.officerIds.includes(officerId)) return undefined;

  await revokeGrants(
    (grant) =>
      grant.requestId === requestId && grant.unitId === unitId && grant.officerId === officerId,
  );

  const issued = buildGrant({
    officerId,
    requestId,
    unitId,
    dataItemIds: target.dataItemIds,
    expiresAt: new Date(Date.now() + accessTtlDays() * 86_400_000).toISOString(),
  });
  await addGrants([issued.grant]);
  return { url: issued.url };
}

export function describeRequestItems(dataItemIds: string[]): string {
  return dataItemIds.map((id) => dataItemLabel(id)).join(', ');
}
