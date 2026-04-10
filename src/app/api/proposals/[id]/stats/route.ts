// src/app/api/proposals/[id]/stats/route.ts
import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
} as const;

async function getSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(list) {
          list.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        },
      },
    }
  );
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
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

  // Verify the proposal exists (any authenticated user can view stats)
  const { data: proposal } = await supabase
    .from('proposals')
    .select('id')
    .eq('id', id)
    .maybeSingle();

  if (!proposal) {
    return NextResponse.json({ error: 'Not found' }, { status: 404, headers: SECURITY_HEADERS });
  }

  const { data: views } = await supabase
    .from('proposal_views')
    .select('is_unique, viewed_at')
    .eq('proposal_id', id)
    .order('viewed_at', { ascending: false });

  const rows = views ?? [];
  const totalViews  = rows.length;
  const uniqueViews = rows.filter((r) => r.is_unique).length;
  const lastViewedAt = rows[0]?.viewed_at ?? null;

  return NextResponse.json(
    { total_views: totalViews, unique_views: uniqueViews, last_viewed_at: lastViewedAt },
    { headers: SECURITY_HEADERS }
  );
}
