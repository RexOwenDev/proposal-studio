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

export async function GET(request: NextRequest) {
  const supabase = await getSupabaseClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: SECURITY_HEADERS });
  }

  const { searchParams } = new URL(request.url);
  const proposalId = searchParams.get('proposalId');

  if (!proposalId || !UUID_REGEX.test(proposalId)) {
    return NextResponse.json({ error: 'Invalid or missing proposalId' }, { status: 400, headers: SECURITY_HEADERS });
  }

  const { data, error } = await supabase
    .from('comments')
    .select('*')
    .eq('proposal_id', proposalId)
    .order('created_at', { ascending: true });

  if (error) {
    return NextResponse.json({ error: 'Server error' }, { status: 500, headers: SECURITY_HEADERS });
  }

  return NextResponse.json({ comments: data ?? [] }, { headers: SECURITY_HEADERS });
}

export async function POST(request: NextRequest) {
  const supabase = await getSupabaseClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: SECURITY_HEADERS });
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

  // Validate required fields
  const proposal_id = raw.proposal_id;
  if (typeof proposal_id !== 'string' || !UUID_REGEX.test(proposal_id)) {
    return NextResponse.json({ error: 'Invalid or missing proposal_id' }, { status: 400, headers: SECURITY_HEADERS });
  }

  const text = raw.text;
  if (typeof text !== 'string' || text.trim().length === 0) {
    return NextResponse.json({ error: 'text is required' }, { status: 400, headers: SECURITY_HEADERS });
  }
  if (text.length > 5000) {
    return NextResponse.json({ error: 'text exceeds 5000 characters' }, { status: 400, headers: SECURITY_HEADERS });
  }

  // Validate optional fields
  const selected_text = raw.selected_text;
  if (selected_text !== undefined && selected_text !== null) {
    if (typeof selected_text !== 'string') {
      return NextResponse.json({ error: 'selected_text must be a string' }, { status: 400, headers: SECURITY_HEADERS });
    }
    if (selected_text.length > 500) {
      return NextResponse.json({ error: 'selected_text exceeds 500 characters' }, { status: 400, headers: SECURITY_HEADERS });
    }
  }

  const block_id = raw.block_id;
  if (block_id !== undefined && block_id !== null) {
    if (typeof block_id !== 'string' || !UUID_REGEX.test(block_id)) {
      return NextResponse.json({ error: 'Invalid block_id' }, { status: 400, headers: SECURITY_HEADERS });
    }
  }

  const parent_id = raw.parent_id;
  if (parent_id !== undefined && parent_id !== null) {
    if (typeof parent_id !== 'string' || !UUID_REGEX.test(parent_id)) {
      return NextResponse.json({ error: 'Invalid parent_id' }, { status: 400, headers: SECURITY_HEADERS });
    }
  }

  // Verify proposal exists
  const { data: proposal, error: proposalError } = await supabase
    .from('proposals')
    .select('id')
    .eq('id', proposal_id)
    .maybeSingle();

  if (proposalError) {
    return NextResponse.json({ error: 'Server error' }, { status: 500, headers: SECURITY_HEADERS });
  }
  if (!proposal) {
    return NextResponse.json({ error: 'Proposal not found' }, { status: 404, headers: SECURITY_HEADERS });
  }

  const author_name = user.email?.split('@')[0] ?? 'Team member';

  const { data: comment, error: insertError } = await supabase
    .from('comments')
    .insert({
      proposal_id,
      text: text.trim(),
      selected_text: selected_text ?? null,
      block_id: block_id ?? null,
      parent_id: parent_id ?? null,
      author_id: user.id,
      author_name,
    })
    .select()
    .single();

  if (insertError) {
    return NextResponse.json({ error: 'Server error' }, { status: 500, headers: SECURITY_HEADERS });
  }

  return NextResponse.json(comment, { status: 201, headers: SECURITY_HEADERS });
}
