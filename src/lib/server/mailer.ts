/**
 * Outbound email for targeted data requests.
 *
 * Two transports, chosen from the environment so no SMTP dependency is needed:
 *   - `resend`  : posts to the Resend HTTP API when RESEND_API_KEY is set.
 *   - `outbox`  : writes the rendered message to `.data/outbox/` and reports
 *                 SIMULATED. This is the default in development so dispatch is
 *                 fully exercisable without sending mail to real mailboxes.
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';

import type { DeliveryStatus } from '../types';

const OUTBOX_DIR = process.env.PORTAL_DATA_DIR
  ? path.join(path.resolve(process.env.PORTAL_DATA_DIR), 'outbox')
  : path.join(process.cwd(), '.data', 'outbox');

export interface MailMessage {
  to: string;
  subject: string;
  body: string;
}

export interface MailResult {
  status: DeliveryStatus;
  error?: string;
}

export function mailFrom(): string {
  return process.env.MAIL_FROM || 'DORA Office <dora@iitmandi.ac.in>';
}

export function transportName(): 'resend' | 'outbox' {
  return process.env.RESEND_API_KEY ? 'resend' : 'outbox';
}

/** Substitutes `{{placeholder}}` tokens; unknown placeholders are left intact. */
export function renderTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (match, key: string) =>
    Object.prototype.hasOwnProperty.call(vars, key) ? vars[key] : match,
  );
}

async function writeToOutbox(message: MailMessage): Promise<MailResult> {
  try {
    await fs.mkdir(OUTBOX_DIR, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const safeTo = message.to.replace(/[^a-z0-9@._-]/gi, '_');
    const file = path.join(OUTBOX_DIR, `${stamp}__${safeTo}.txt`);
    const contents = [
      `From: ${mailFrom()}`,
      `To: ${message.to}`,
      `Subject: ${message.subject}`,
      `Date: ${new Date().toUTCString()}`,
      '',
      message.body,
    ].join('\n');
    await fs.writeFile(file, contents, 'utf8');
    return { status: 'SIMULATED' };
  } catch (error) {
    return { status: 'FAILED', error: (error as Error).message };
  }
}

async function sendViaResend(message: MailMessage): Promise<MailResult> {
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: mailFrom(),
        to: [message.to],
        subject: message.subject,
        text: message.body,
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      return { status: 'FAILED', error: `${response.status} ${detail.slice(0, 200)}` };
    }
    return { status: 'SENT' };
  } catch (error) {
    return { status: 'FAILED', error: (error as Error).message };
  }
}

export async function sendMail(message: MailMessage): Promise<MailResult> {
  return transportName() === 'resend' ? sendViaResend(message) : writeToOutbox(message);
}

export const DEFAULT_REQUEST_TEMPLATE = `Dear {{officer}},

The DORA office is compiling the institute's {{framework}} {{cycle}} submission. As the nodal officer for {{section}}, you are requested to provide the following data along with verifiable supporting proof:

{{dataItems}}

Please upload the data and proof documents through your restricted portal link below. The link is personal to you and scoped to {{section}} only:

{{portalLink}}

Submission deadline: {{deadline}}
Request reference: {{reference}}

Regards,
DORA Office
Indian Institute of Technology Mandi`;

export const DEFAULT_REMINDER_TEMPLATE = `Dear {{officer}},

This is a reminder for data request {{reference}} covering {{section}}. The following items are still awaited:

{{dataItems}}

Your restricted upload link remains active:

{{portalLink}}

Submission deadline: {{deadline}}

Regards,
DORA Office
Indian Institute of Technology Mandi`;
