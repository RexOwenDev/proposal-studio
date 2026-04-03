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

export async function GET(request: Request) {
  const supabase = await getSupabase();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const proposalId = searchParams.get('proposal_id');

  if (!proposalId) {
    return NextResponse.json({ error: 'proposal_id is required' }, { status: 400 });
  }

  const { data: comments, error } = await supabase
    .from('comments')
    .select('*')
    .eq('proposal_id', proposalId)
    .order('created_at', { ascending: true });

  if (error) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  return NextResponse.json(comments);
}

export async function POST(request: Request) {
  const supabase = await getSupabase();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { proposal_id, block_id, text, selected_text } = body as {
    proposal_id?: string; block_id?: string; text?: string; selected_text?: string;
  };

  if (!proposal_id || typeof proposal_id !== 'string' || !text || typeof text !== 'string') {
    return NextResponse.json({ error: 'proposal_id and text are required' }, { status: 400 });
  }

  // Limit comment text length
  const sanitizedText = text.trim().slice(0, 5000);
  if (!sanitizedText) {
    return NextResponse.json({ error: 'Comment text cannot be empty' }, { status: 400 });
  }

  const { data: comment, error } = await supabase
    .from('comments')
    .insert({
      proposal_id,
      block_id: block_id || null,
      author_id: user.id,
      author_name: user.email?.split('@')[0] || 'Unknown',
      text: sanitizedText,
      selected_text: typeof selected_text === 'string' ? selected_text.trim().slice(0, 500) : null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  return NextResponse.json(comment);
}

export async function PATCH(request: Request) {
  const supabase = await getSupabase();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { id, resolved } = body;

  if (!id || typeof resolved !== 'boolean') {
    return NextResponse.json({ error: 'id and resolved are required' }, { status: 400 });
  }

  const { data: comment, error } = await supabase
    .from('comments')
    .update({ resolved })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  return NextResponse.json(comment);
}
