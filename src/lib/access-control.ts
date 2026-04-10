/**
 * Access control configuration for Proposal Studio.
 *
 * Who can access:
 * - Any @designshopp.com email
 * - Specifically whitelisted personal emails
 *
 * This is checked in TWO places:
 * 1. proxy.ts — server-side, blocks authenticated but unauthorized users
 * 2. login page — client-side UX, rejects before sending magic link
 */

const ALLOWED_DOMAINS = ['designshopp.com'];

const ALLOWED_EMAILS = [
  'owenquintenta@gmail.com',
  'jeniekagerona15@gmail.com',
];

export function isEmailAllowed(email: string): boolean {
  const normalized = email.toLowerCase().trim();

  // Check specific whitelist
  if (ALLOWED_EMAILS.includes(normalized)) return true;

  // Check domain whitelist
  const domain = normalized.split('@')[1];
  if (domain && ALLOWED_DOMAINS.includes(domain)) return true;

  return false;
}
