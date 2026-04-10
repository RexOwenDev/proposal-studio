import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await getSupabase();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: SECURITY_HEADERS });
  }

  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: 'Invalid ID' }, { status: 400, headers: SECURITY_HEADERS });
  }

  // Fetch the source proposal (must exist; any team member can duplicate)
  const { data: source } = await supabase
    .from('proposals')
    .select('*')
    .eq('id', id)
    .single();

  if (!source) {
    return NextResponse.json({ error: 'Not found' }, { status: 404, headers: SECURITY_HEADERS });
  }

  // Fetch source blocks ordered by position
  const { data: sourceBlocks } = await supabase
    .from('content_blocks')
    .select('*')
    .eq('proposal_id', id)
    .order('block_order', { ascending: true });

  // Generate a unique slug: <original-slug>-copy + short random suffix
  const baseCopySlug = `${source.slug}-copy`;
  const suffix = Math.random().toString(36).slice(2, 6);
  const copySlug = `${baseCopySlug}-${suffix}`;

  // Create the duplicate proposal — always starts as draft, owned by current user
  const { data: copy, error: copyError } = await supabase
    .from('proposals')
    .insert({
      slug: copySlug,
      title: `${source.title} (Copy)`,
      status: 'draft',
      original_html: source.original_html,
      stylesheet: source.stylesheet,
      scripts: source.scripts,
      created_by: user.id,
      created_by_email: user.email || null,
    })
    .select()
    .single();

  if (copyError || !copy) {
    return NextResponse.json({ error: 'Failed to duplicate proposal' }, { status: 500, headers: SECURITY_HEADERS });
  }

  // Duplicate all blocks — reset current_html to original (clean slate)
  // Comments are NOT copied — they belong to the source review cycle
  if (sourceBlocks && sourceBlocks.length > 0) {
    const blockInserts = sourceBlocks.map((b) => ({
      proposal_id: copy.id,
      block_order: b.block_order,
      label: b.label,
      original_html: b.original_html,
      current_html: b.original_html, // fresh copy — no edits carried over
      wrapper_class: b.wrapper_class,
      visible: b.visible,
    }));

    const { error: blocksError } = await supabase
      .from('content_blocks')
      .insert(blockInserts);

    if (blocksError) {
      // Best-effort cleanup — remove the orphaned copy proposal
      await supabase.from('proposals').delete().eq('id', copy.id);
      return NextResponse.json({ error: 'Failed to duplicate blocks' }, { status: 500, headers: SECURITY_HEADERS });
    }
  }

  return NextResponse.json({ proposal: copy }, { headers: SECURITY_HEADERS });
}
