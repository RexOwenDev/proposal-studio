import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { parseHTML } from '@/lib/parser/html-parser';
import { slugify } from '@/lib/utils';

export async function POST(request: Request) {
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

  // Verify auth
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Check content-length before parsing (10MB limit)
  const contentLength = request.headers.get('content-length');
  if (contentLength && parseInt(contentLength) > 10 * 1024 * 1024) {
    return NextResponse.json({ error: 'Payload too large (max 10MB)' }, { status: 413 });
  }

  let body: { html?: string; title?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { html, title: providedTitle } = body;

  if (!html || typeof html !== 'string') {
    return NextResponse.json({ error: 'HTML content is required' }, { status: 400 });
  }

  if (html.length > 5 * 1024 * 1024) {
    return NextResponse.json({ error: 'HTML content too large (max 5MB)' }, { status: 413 });
  }

  // Parse the HTML
  const parsed = parseHTML(html);
  const title = providedTitle || parsed.title;
  let slug = slugify(title);

  // Check for slug collision
  const { data: existing } = await supabase
    .from('proposals')
    .select('slug')
    .eq('slug', slug)
    .single();

  if (existing) {
    const suffix = Math.random().toString(36).substring(2, 6);
    slug = `${slug}-${suffix}`;
  }

  // Create proposal
  const { data: proposal, error: proposalError } = await supabase
    .from('proposals')
    .insert({
      slug,
      title,
      original_html: html,
      stylesheet: parsed.stylesheet,
      scripts: parsed.scripts,
      created_by: user.id,
      created_by_email: user.email || null,
    })
    .select()
    .single();

  if (proposalError) {
    return NextResponse.json({ error: 'Failed to create proposal' }, { status: 500 });
  }

  // Create content blocks
  const blockInserts = parsed.blocks.map((block) => ({
    proposal_id: proposal.id,
    block_order: block.order,
    label: block.label,
    original_html: block.html,
    current_html: block.html,
    wrapper_class: block.wrapperClass || null,
  }));

  const { data: blocks, error: blocksError } = await supabase
    .from('content_blocks')
    .insert(blockInserts)
    .select();

  if (blocksError) {
    return NextResponse.json({ error: 'Failed to create content blocks' }, { status: 500 });
  }

  return NextResponse.json({ proposal, blocks });
}
