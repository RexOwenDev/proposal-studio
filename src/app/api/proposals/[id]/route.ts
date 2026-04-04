import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

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
    .single();

  if (error || !proposal) {
    return NextResponse.json({ error: 'Not found' }, { status: 404, headers: SECURITY_HEADERS });
  }

  const { data: blocks } = await supabase
    .from('content_blocks')
    .select('*')
    .eq('proposal_id', id)
    .order('block_order', { ascending: true });

  const { data: comments } = await supabase
    .from('comments')
    .select('*')
    .eq('proposal_id', id)
    .order('created_at', { ascending: true });

  return NextResponse.json(
    { ...proposal, blocks: blocks || [], comments: comments || [] },
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
  if ('status' in allowed && !['draft', 'review', 'approved', 'published'].includes(allowed.status as string)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400, headers: SECURITY_HEADERS });
  }

  // Status-only updates (draft→review→approved→published) can be performed by any
  // authenticated team member — approvals and review actions are not owner-gated.
  // Title and other field updates still require the proposal creator.
  const isStatusOnly = Object.keys(allowed).length === 1 && 'status' in allowed;

  if (isStatusOnly) {
    const { data, error } = await supabase
      .from('proposals')
      .update(allowed)
      .eq('id', id)
      .select()
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'Not found' }, { status: 404, headers: SECURITY_HEADERS });
    }
    return NextResponse.json(data, { headers: SECURITY_HEADERS });
  }

  // Ownership check: only the proposal creator can update title and other fields.
  // Adding created_by filter to the UPDATE itself is atomic — returns no rows if not owner.
  const { data, error } = await supabase
    .from('proposals')
    .update(allowed)
    .eq('id', id)
    .eq('created_by', user.id)
    .select()
    .single();

  if (error || !data) {
    // Either server error or the proposal doesn't belong to this user
    return NextResponse.json({ error: 'Not found or forbidden' }, { status: 404, headers: SECURITY_HEADERS });
  }

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

  // Ownership check: only the proposal creator can delete it.
  // Verify ownership first — delete on a non-owned row silently succeeds in Supabase
  // so we do an explicit select-then-delete pattern here.
  const { data: proposal } = await supabase
    .from('proposals')
    .select('id')
    .eq('id', id)
    .eq('created_by', user.id)
    .single();

  if (!proposal) {
    return NextResponse.json({ error: 'Not found or forbidden' }, { status: 404, headers: SECURITY_HEADERS });
  }

  const { error } = await supabase
    .from('proposals')
    .delete()
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: 'Server error' }, { status: 500, headers: SECURITY_HEADERS });
  }

  return NextResponse.json({ success: true }, { headers: SECURITY_HEADERS });
}
