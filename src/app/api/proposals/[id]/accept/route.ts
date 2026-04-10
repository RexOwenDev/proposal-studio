// src/app/api/proposals/[id]/accept/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';
import { sendAcceptanceNotification } from '@/lib/email/send-acceptance-notification';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
} as const;

// In-memory rate limiter: { ip_date → attempt_count }
const rateLimitMap = new Map<string, number>();

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404, headers: SECURITY_HEADERS });
  }

  // Rate limit: 3 attempts per IP per day
  const rawIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const today = new Date().toISOString().slice(0, 10);
  const rateLimitKey = `${rawIp}:${today}`;
  const attempts = rateLimitMap.get(rateLimitKey) ?? 0;
  if (attempts >= 3) {
    return NextResponse.json({ error: 'Too many attempts' }, { status: 429, headers: SECURITY_HEADERS });
  }
  rateLimitMap.set(rateLimitKey, attempts + 1);

  // Parse + validate body
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
      return NextResponse.json({ error: 'client_email must be a valid email address' }, { status: 422, headers: SECURITY_HEADERS });
    }
  }

  const serviceClient = getServiceClient();

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
  } catch {
    // Non-fatal — email just won't be sent
  }

  // Hash IP for storage
  const hashedIp = createHash('sha256').update(`${rawIp}:${today}`).digest('hex');

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
    return NextResponse.json({ error: 'Server error' }, { status: 500, headers: SECURITY_HEADERS });
  }

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
