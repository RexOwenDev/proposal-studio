import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Cache-Control': 'no-store',
};

async function getSupabaseClient() {
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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await getSupabaseClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: SECURITY_HEADERS });
  }

  if (!UUID_REGEX.test(id)) {
    return NextResponse.json({ error: 'Invalid comment ID' }, { status: 400, headers: SECURITY_HEADERS });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400, headers: SECURITY_HEADERS });
  }

  if (typeof body !== 'object' || body === null) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400, headers: SECURITY_HEADERS });
  }

  const raw = body as Record<string, unknown>;
  const hasText = 'text' in raw;
  const hasResolved = 'resolved' in raw;

  if (!hasText && !hasResolved) {
    return NextResponse.json({ error: 'Must provide text or resolved' }, { status: 400, headers: SECURITY_HEADERS });
  }

  // Fetch comment + proposal owner in one join
  const { data: comment, error: fetchError } = await supabase
    .from('comments')
    .select('*, proposals!inner(created_by)')
    .eq('id', id)
    .maybeSingle();

  if (fetchError) {
    return NextResponse.json({ error: 'Server error' }, { status: 500, headers: SECURITY_HEADERS });
  }
  if (!comment) {
    return NextResponse.json({ error: 'Comment not found' }, { status: 404, headers: SECURITY_HEADERS });
  }

  const isAuthor = comment.author_id === user.id;
  const isOwner = comment.proposals.created_by === user.id;

  if (hasText) {
    // Text edits: author only
    if (!isAuthor) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403, headers: SECURITY_HEADERS });
    }

    const text = raw.text;
    if (typeof text !== 'string' || text.trim().length === 0) {
      return NextResponse.json({ error: 'text must be a non-empty string' }, { status: 400, headers: SECURITY_HEADERS });
    }
    if (text.length > 5000) {
      return NextResponse.json({ error: 'text exceeds 5000 characters' }, { status: 400, headers: SECURITY_HEADERS });
    }

    const { data: updated, error: updateError } = await supabase
      .from('comments')
      .update({ text: text.trim(), edited_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ error: 'Server error' }, { status: 500, headers: SECURITY_HEADERS });
    }

    return NextResponse.json(updated, { headers: SECURITY_HEADERS });
  }

  // resolved update: author OR owner
  if (!isAuthor && !isOwner) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403, headers: SECURITY_HEADERS });
  }

  const resolved = raw.resolved;
  if (typeof resolved !== 'boolean') {
    return NextResponse.json({ error: 'resolved must be a boolean' }, { status: 400, headers: SECURITY_HEADERS });
  }

  const { data: updated, error: updateError } = await supabase
    .from('comments')
    .update({ resolved })
    .eq('id', id)
    .select()
    .single();

  if (updateError) {
    return NextResponse.json({ error: 'Server error' }, { status: 500, headers: SECURITY_HEADERS });
  }

  return NextResponse.json(updated, { headers: SECURITY_HEADERS });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await getSupabaseClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: SECURITY_HEADERS });
  }

  if (!UUID_REGEX.test(id)) {
    return NextResponse.json({ error: 'Invalid comment ID' }, { status: 400, headers: SECURITY_HEADERS });
  }

  // Fetch comment + proposal owner in one join
  const { data: comment, error: fetchError } = await supabase
    .from('comments')
    .select('*, proposals!inner(created_by)')
    .eq('id', id)
    .maybeSingle();

  if (fetchError) {
    return NextResponse.json({ error: 'Server error' }, { status: 500, headers: SECURITY_HEADERS });
  }
  if (!comment) {
    return NextResponse.json({ error: 'Comment not found' }, { status: 404, headers: SECURITY_HEADERS });
  }

  const isAuthor = comment.author_id === user.id;
  const isOwner = comment.proposals.created_by === user.id;

  if (!isAuthor && !isOwner) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403, headers: SECURITY_HEADERS });
  }

  const { error: deleteError } = await supabase
    .from('comments')
    .delete()
    .eq('id', id);

  if (deleteError) {
    return NextResponse.json({ error: 'Server error' }, { status: 500, headers: SECURITY_HEADERS });
  }

  return new NextResponse(null, { status: 204, headers: SECURITY_HEADERS });
}
