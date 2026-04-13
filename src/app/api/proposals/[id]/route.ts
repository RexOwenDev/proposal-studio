import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { logger } from '@/lib/logger';
import { writeAuditEvent } from '@/lib/audit';

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
};

async function getSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
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
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await getSupabase();

  // Auth check — only authenticated users can fetch proposal details
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: SECURITY_HEADERS });
  }

  // Validate UUID format
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return NextResponse.json({ error: 'Invalid ID' }, { status: 400, headers: SECURITY_HEADERS });
  }

  const { data: proposal, error } = await supabase
    .from('proposals')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .single();

  if (error || !proposal) {
    logger.warn('Proposal GET: not found', { proposalId: id, userId: user.id });
    return NextResponse.json({ error: 'Not found' }, { status: 404, headers: SECURITY_HEADERS });
  }

  const { data: blocks } = await supabase
    .from('content_blocks')
    .select('*')
    .eq('proposal_id', id)
    .order('block_order', { ascending: true });

  return NextResponse.json(
    { ...proposal, blocks: blocks || [] },
    { headers: SECURITY_HEADERS }
  );
}

// Whitelist of fields that can be updated on a proposal
const ALLOWED_PATCH_FIELDS = new Set(['title', 'status']);

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await getSupabase();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: SECURITY_HEADERS });
  }

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return NextResponse.json({ error: 'Invalid ID' }, { status: 400, headers: SECURITY_HEADERS });
  }

  const body = await request.json();

  // Only allow whitelisted fields — prevents setting slug, created_by, original_html, etc.
  const allowed: Record<string, unknown> = {};
  for (const key of Object.keys(body)) {
    if (ALLOWED_PATCH_FIELDS.has(key)) {
      allowed[key] = body[key];
    }
  }

  if (Object.keys(allowed).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400, headers: SECURITY_HEADERS });
  }

  // Validate status values
  if ('status' in allowed && !['draft', 'published'].includes(allowed.status as string)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400, headers: SECURITY_HEADERS });
  }

  // Any authenticated user can update proposal fields (collaborative workspace)
  const { data, error } = await supabase
    .from('proposals')
    .update(allowed)
    .eq('id', id)
    .select()
    .single();

  if (error || !data) {
    logger.warn('Proposal PATCH: not found or update failed', { proposalId: id, userId: user.id });
    return NextResponse.json({ error: 'Not found or forbidden' }, { status: 404, headers: SECURITY_HEADERS });
  }

  logger.info('Proposal updated', { proposalId: id, userId: user.id, fields: Object.keys(allowed) });
  return NextResponse.json(data, { headers: SECURITY_HEADERS });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await getSupabase();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: SECURITY_HEADERS });
  }

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return NextResponse.json({ error: 'Invalid ID' }, { status: 400, headers: SECURITY_HEADERS });
  }

  // Ownership check — only the creator can delete. Collaborators can edit but not destroy.
  const { data: proposal, error: fetchError } = await supabase
    .from('proposals')
    .select('created_by')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();

  if (fetchError) {
    return NextResponse.json({ error: 'Server error' }, { status: 500, headers: SECURITY_HEADERS });
  }
  if (!proposal) {
    return NextResponse.json({ error: 'Not found' }, { status: 404, headers: SECURITY_HEADERS });
  }
  if (proposal.created_by !== user.id) {
    logger.warn('Proposal DELETE: forbidden — not owner', { proposalId: id, userId: user.id });
    return NextResponse.json({ error: 'Forbidden' }, { status: 403, headers: SECURITY_HEADERS });
  }

  // Soft delete — sets deleted_at timestamp; data is preserved for audit/recovery
  const { error } = await supabase
    .from('proposals')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);

  if (error) {
    logger.error('Proposal DELETE: DB error', error, { proposalId: id });
    return NextResponse.json({ error: 'Server error' }, { status: 500, headers: SECURITY_HEADERS });
  }

  logger.info('Proposal soft-deleted', { proposalId: id, userId: user.id });
  void writeAuditEvent({
    proposalId: id,
    userId: user.id,
    userEmail: user.email ?? null,
    eventType: 'proposal_deleted',
  });
  return NextResponse.json({ success: true }, { headers: SECURITY_HEADERS });
}
