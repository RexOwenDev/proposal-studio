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

  const body = await request.json();
  const { html, title: providedTitle } = body as { html: string; title?: string };

  if (!html) {
    return NextResponse.json({ error: 'HTML content is required' }, { status: 400 });
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
    })
    .select()
    .single();

  if (proposalError) {
    return NextResponse.json({ error: proposalError.message }, { status: 500 });
  }

  // Create content blocks
  const blockInserts = parsed.blocks.map((block) => ({
    proposal_id: proposal.id,
    block_order: block.order,
    label: block.label,
    original_html: block.html,
    current_html: block.html,
  }));

  const { data: blocks, error: blocksError } = await supabase
    .from('content_blocks')
    .insert(blockInserts)
    .select();

  if (blocksError) {
    return NextResponse.json({ error: blocksError.message }, { status: 500 });
  }

  return NextResponse.json({ proposal, blocks });
}
