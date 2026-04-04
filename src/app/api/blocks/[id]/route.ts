import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { stripEditorArtifacts } from '@/lib/utils/strip-editor-artifacts';

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: 'Invalid ID' }, { status: 400, headers: SECURITY_HEADERS });
  }

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

  // Owner check: only the proposal creator can edit blocks
  const { data: block } = await supabase
    .from('content_blocks')
    .select('proposal_id, proposals(created_by)')
    .eq('id', id)
    .single();

  if (block) {
    const proposal = (block as Record<string, unknown>).proposals as { created_by: string } | null;
    if (proposal && proposal.created_by !== user.id) {
      return NextResponse.json({ error: 'Only the proposal owner can edit' }, { status: 403, headers: SECURITY_HEADERS });
    }
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400, headers: SECURITY_HEADERS });
  }

  // Strict field whitelist
  const allowed: Record<string, unknown> = {};
  if ('current_html' in body && typeof body.current_html === 'string') {
    // Strip ALL editor artifacts server-side (marks, data-editable, contenteditable,
    // etc.) — defence-in-depth against any path that bypasses the client-side strip.
    allowed.current_html = stripEditorArtifacts(body.current_html);
  }
  if ('visible' in body && typeof body.visible === 'boolean') {
    allowed.visible = body.visible;
  }
  if ('label' in body && typeof body.label === 'string') {
    allowed.label = (body.label as string).slice(0, 200);
  }

  if (Object.keys(allowed).length === 0) {
    return NextResponse.json({ error: 'No valid fields' }, { status: 400, headers: SECURITY_HEADERS });
  }

  // Track who made this edit
  if ('current_html' in allowed) {
    allowed.last_edited_by = user.email || 'unknown';
  }

  // Conflict detection: if client sends expected_updated_at, check it
  if ('expected_updated_at' in body && typeof body.expected_updated_at === 'string') {
    const { data: current } = await supabase
      .from('content_blocks')
      .select('updated_at')
      .eq('id', id)
      .single();

    if (current && current.updated_at !== body.expected_updated_at) {
      return NextResponse.json(
        { error: 'conflict', message: 'This section was edited by someone else. Reload to see their changes.' },
        { status: 409, headers: SECURITY_HEADERS }
      );
    }
  }

  const { data, error } = await supabase
    .from('content_blocks')
    .update(allowed)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: 'Server error' }, { status: 500, headers: SECURITY_HEADERS });
  }

  return NextResponse.json(data, { headers: SECURITY_HEADERS });
}
