// src/app/api/proposals/[id]/accept/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';
import { sendAcceptanceNotification } from '@/lib/email/send-acceptance-notification';
import { logger } from '@/lib/logger';
import { writeAuditEvent } from '@/lib/audit';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
} as const;

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * Guards against cross-origin browser-based CSRF attacks.
 * Allows requests with no Origin header (curl, Postman, server-to-server).
 * Rejects browser requests originating from untrusted domains.
 */
function isOriginAllowed(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return true; // non-browser request — allow

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';
  if (!appUrl) return true; // env not configured — skip check

  try {
    const originHost = new URL(origin).hostname;
    const appHost = new URL(appUrl).hostname;
    return originHost === appHost;
  } catch {
    return false;
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404, headers: SECURITY_HEADERS });
  }

  // CSRF: reject cross-origin browser requests
  if (!isOriginAllowed(request)) {
    logger.warn('Accept endpoint: cross-origin request rejected', {
      proposalId: id,
      origin: request.headers.get('origin'),
    });
    return NextResponse.json({ error: 'Forbidden' }, { status: 403, headers: SECURITY_HEADERS });
  }

  // Parse + validate body early so we can use the IP hash for DB-based rate limiting
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400, headers: SECURITY_HEADERS });
  }

  if (typeof body !== 'object' || body === null) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 422, headers: SECURITY_HEADERS });
  }

  const { client_name, client_email } = body as Record<string, unknown>;

  if (typeof client_name !== 'string' || client_name.trim().length < 1 || client_name.trim().length > 120) {
    return NextResponse.json(
      { error: 'client_name is required and must be 1–120 characters' },
      { status: 422, headers: SECURITY_HEADERS }
    );
  }

  if (client_email !== undefined && client_email !== null && client_email !== '') {
    if (typeof client_email !== 'string' || !EMAIL_RE.test(client_email)) {
      return NextResponse.json(
        { error: 'client_email must be a valid email address' },
        { status: 422, headers: SECURITY_HEADERS }
      );
    }
  }

  const serviceClient = getServiceClient();

  // DB-based rate limit: 3 acceptance attempts per IP per day.
  // Uses Supabase rather than in-memory — safe across multiple Vercel instances.
  const rawIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const today = new Date().toISOString().slice(0, 10);
  const hashedIp = createHash('sha256').update(`${rawIp}:${today}`).digest('hex');

  const { count: attemptCount } = await serviceClient
    .from('proposal_acceptances')
    .select('id', { count: 'exact', head: true })
    .eq('ip_address', hashedIp)
    .gte('accepted_at', `${today}T00:00:00.000Z`);

  if (typeof attemptCount === 'number' && attemptCount >= 3) {
    logger.warn('Accept rate limit reached', { proposalId: id, hashedIp });
    return NextResponse.json({ error: 'Too many attempts. Try again tomorrow.' }, { status: 429, headers: SECURITY_HEADERS });
  }

  // Verify proposal is published — return 404 for both non-existent and non-published
  const { data: proposal } = await serviceClient
    .from('proposals')
    .select('id, title, slug, created_by')
    .eq('id', id)
    .eq('status', 'published')
    .maybeSingle();

  if (!proposal) {
    return NextResponse.json({ error: 'Not found' }, { status: 404, headers: SECURITY_HEADERS });
  }

  // Get owner email via auth admin API
  let ownerEmail: string | null = null;
  try {
    const { data: { user: ownerUser } } = await serviceClient.auth.admin.getUserById(proposal.created_by);
    ownerEmail = ownerUser?.email ?? null;
  } catch (err) {
    logger.warn('Could not fetch owner email for acceptance notification', err instanceof Error ? { err: err.message } : {});
  }

  // Insert — unique index enforces one-acceptance-per-proposal
  const { error: insertError } = await serviceClient
    .from('proposal_acceptances')
    .insert({
      proposal_id: id,
      client_name: client_name.trim(),
      client_email: typeof client_email === 'string' && client_email.trim() ? client_email.trim() : null,
      ip_address: hashedIp,
    });

  if (insertError) {
    if (insertError.code === '23505') {
      return NextResponse.json({ error: 'Already accepted' }, { status: 409, headers: SECURITY_HEADERS });
    }
    logger.error('Failed to insert acceptance', undefined, { proposalId: id, code: insertError.code });
    return NextResponse.json({ error: 'Server error' }, { status: 500, headers: SECURITY_HEADERS });
  }

  logger.info('Proposal accepted', { proposalId: id, clientName: client_name.trim() });
  void writeAuditEvent({
    proposalId: id,
    userId: null,
    userEmail: typeof client_email === 'string' && client_email.trim() ? client_email.trim() : null,
    eventType: 'proposal_accepted',
    metadata: { clientName: client_name.trim() },
  });

  const accepted_at = new Date().toISOString();

  // Fire-and-forget email
  if (ownerEmail) {
    void sendAcceptanceNotification({
      ownerEmail,
      clientName: client_name.trim(),
      proposalTitle: proposal.title,
      proposalSlug: proposal.slug,
    });
  }

  return NextResponse.json({ accepted_at }, { status: 201, headers: SECURITY_HEADERS });
}
