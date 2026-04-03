import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

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

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: Request) {
  const supabase = await getSupabase();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: SECURITY_HEADERS });
  }

  const { searchParams } = new URL(request.url);
  const proposalId = searchParams.get('proposal_id');

  if (!proposalId) {
    return NextResponse.json({ error: 'proposal_id is required' }, { status: 400, headers: SECURITY_HEADERS });
  }

  // S3: validate UUID format (other routes already do this — enforce consistently here)
  if (!UUID_RE.test(proposalId)) {
    return NextResponse.json({ error: 'Invalid proposal_id' }, { status: 400, headers: SECURITY_HEADERS });
  }

  const { data: comments, error } = await supabase
    .from('comments')
    .select('*')
    .eq('proposal_id', proposalId)
    .order('created_at', { ascending: true });

  if (error) {
    return NextResponse.json({ error: 'Server error' }, { status: 500, headers: SECURITY_HEADERS });
  }

  return NextResponse.json(comments, { headers: SECURITY_HEADERS });
}

export async function POST(request: Request) {
  const supabase = await getSupabase();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: SECURITY_HEADERS });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400, headers: SECURITY_HEADERS });
  }

  const { proposal_id, block_id, text, selected_text, parent_id } = body as {
    proposal_id?: string; block_id?: string; text?: string; selected_text?: string; parent_id?: string;
  };

  if (!proposal_id || typeof proposal_id !== 'string' || !text || typeof text !== 'string') {
    return NextResponse.json({ error: 'proposal_id and text are required' }, { status: 400, headers: SECURITY_HEADERS });
  }

  // Limit comment text length
  const sanitizedText = text.trim().slice(0, 5000);
  if (!sanitizedText) {
    return NextResponse.json({ error: 'Comment text cannot be empty' }, { status: 400, headers: SECURITY_HEADERS });
  }

  const { data: comment, error } = await supabase
    .from('comments')
    .insert({
      proposal_id,
      block_id: block_id || null,
      parent_id: parent_id || null,
      author_id: user.id,
      author_name: user.email?.split('@')[0] || 'Unknown',
      text: sanitizedText,
      selected_text: typeof selected_text === 'string' ? selected_text.trim().slice(0, 500) : null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: 'Server error' }, { status: 500, headers: SECURITY_HEADERS });
  }

  return NextResponse.json(comment, { headers: SECURITY_HEADERS });
}

export async function PATCH(request: Request) {
  const supabase = await getSupabase();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: SECURITY_HEADERS });
  }

  const body = await request.json();
  // S2: ignore `reactor` from body — always use the authenticated session user's email
  const { id, resolved, reaction } = body;

  if (!id || typeof id !== 'string') {
    return NextResponse.json({ error: 'id is required' }, { status: 400, headers: SECURITY_HEADERS });
  }

  // Handle reaction toggle
  if (reaction) {
    const { data: existing } = await supabase
      .from('comments')
      .select('reactions')
      .eq('id', id)
      .single();

    if (!existing) {
      return NextResponse.json({ error: 'Comment not found' }, { status: 404, headers: SECURITY_HEADERS });
    }

    // S2: use verified session identity, not a client-supplied reactor name
    const sessionReactor = user.email || user.id;
    const reactions = (existing.reactions || {}) as Record<string, string[]>;
    const users = reactions[reaction] || [];

    if (users.includes(sessionReactor)) {
      // Remove reaction (toggle off)
      reactions[reaction] = users.filter((u: string) => u !== sessionReactor);
      if (reactions[reaction].length === 0) delete reactions[reaction];
    } else {
      reactions[reaction] = [...users, sessionReactor];
    }

    const { data: comment, error } = await supabase
      .from('comments')
      .update({ reactions })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: 'Server error' }, { status: 500, headers: SECURITY_HEADERS });
    }
    return NextResponse.json(comment, { headers: SECURITY_HEADERS });
  }

  // Handle resolve toggle
  if (typeof resolved !== 'boolean') {
    return NextResponse.json({ error: 'resolved or reaction is required' }, { status: 400, headers: SECURITY_HEADERS });
  }

  const { data: comment, error } = await supabase
    .from('comments')
    .update({ resolved })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: 'Server error' }, { status: 500, headers: SECURITY_HEADERS });
  }

  return NextResponse.json(comment, { headers: SECURITY_HEADERS });
}
