// src/lib/email/send-acceptance-notification.ts
// SERVER-ONLY — never import this file from client components

import { Resend } from 'resend';

/** Escapes the 5 HTML special characters to prevent injection in email HTML */
function escHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

interface AcceptanceEmailParams {
  ownerEmail: string;
  clientName: string;
  proposalTitle: string;
  proposalSlug: string;
}

/**
 * Sends an email notification to the proposal owner when a client accepts.
 * Call with `void sendAcceptanceNotification(...)` — fire-and-forget.
 */
export async function sendAcceptanceNotification({
  ownerEmail,
  clientName,
  proposalTitle,
  proposalSlug,
}: AcceptanceEmailParams): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn('[sendAcceptanceNotification] RESEND_API_KEY not set — skipping email');
    return;
  }

  const resend = new Resend(apiKey);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://designshopp.app';
  const editUrl = `${appUrl}/p/${proposalSlug}/edit`;

  await resend.emails.send({
    from: 'Proposal Studio <notifications@designshopp.app>',
    to: ownerEmail,
    subject: `${clientName} accepted "${proposalTitle}"`,
    html: `
      <p>Hi,</p>
      <p><strong>${escHtml(clientName)}</strong> just accepted your proposal <em>${escHtml(proposalTitle)}</em>.</p>
      <p><a href="${editUrl}">View proposal →</a></p>
      <hr />
      <p style="font-size:12px;color:#888">Sent by Proposal Studio · Design Shopp</p>
    `,
  });
}
