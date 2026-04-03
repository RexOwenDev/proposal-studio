import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
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

  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: 'Invalid ID' }, { status: 400, headers: SECURITY_HEADERS });
  }

  const body = await request.json();
  const { status } = body as { status: 'published' | 'draft' };

  if (!['published', 'draft'].includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400, headers: SECURITY_HEADERS });
  }

  // Ownership check: only the proposal creator can publish/unpublish.
  const { data: proposal, error } = await supabase
    .from('proposals')
    .update({ status })
    .eq('id', id)
    .eq('created_by', user.id)
    .select('*, slug')
    .single();

  if (error || !proposal) {
    return NextResponse.json({ error: 'Not found or forbidden' }, { status: 404, headers: SECURITY_HEADERS });
  }

  return NextResponse.json(
    { ...proposal, public_url: status === 'published' ? `/p/${proposal.slug}` : null },
    { headers: SECURITY_HEADERS }
  );
}
