// src/app/api/proposals/[id]/restore/route.ts
// Restores a soft-deleted proposal. Only the original creator can restore.

import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { logger } from '@/lib/logger';
import { writeAuditEvent } from '@/lib/audit';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Cache-Control': 'no-store',
} as const;

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: SECURITY_HEADERS });
  }

  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: 'Invalid ID' }, { status: 400, headers: SECURITY_HEADERS });
  }

  // Verify this is a soft-deleted proposal owned by the requesting user
  const { data: proposal } = await supabase
    .from('proposals')
    .select('id, created_by')
    .eq('id', id)
    .not('deleted_at', 'is', null)
    .maybeSingle();

  if (!proposal) {
    return NextResponse.json({ error: 'Not found' }, { status: 404, headers: SECURITY_HEADERS });
  }

  if (proposal.created_by !== user.id) {
    logger.warn('Proposal restore: forbidden — not owner', { proposalId: id, userId: user.id });
    return NextResponse.json({ error: 'Forbidden' }, { status: 403, headers: SECURITY_HEADERS });
  }

  const { error } = await supabase
    .from('proposals')
    .update({ deleted_at: null })
    .eq('id', id);

  if (error) {
    logger.error('Proposal restore: DB error', error, { proposalId: id });
    return NextResponse.json({ error: 'Server error' }, { status: 500, headers: SECURITY_HEADERS });
  }

  logger.info('Proposal restored', { proposalId: id, userId: user.id });
  void writeAuditEvent({
    proposalId: id,
    userId: user.id,
    userEmail: user.email ?? null,
    eventType: 'proposal_restored',
  });
  return NextResponse.json({ success: true }, { headers: SECURITY_HEADERS });
}
