import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function GET() {
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
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Get unique author names from comments (people who've used the system)
  const { data: commentAuthors } = await supabase
    .from('comments')
    .select('author_name')
    .order('author_name');

  // Get unique creator emails from proposals
  const { data: proposalCreators } = await supabase
    .from('proposals')
    .select('created_by_email')
    .not('created_by_email', 'is', null);

  // Build unique team member list
  const names = new Set<string>();

  commentAuthors?.forEach((c) => {
    if (c.author_name) names.add(c.author_name.toLowerCase());
  });

  proposalCreators?.forEach((p) => {
    if (p.created_by_email) {
      names.add(p.created_by_email.split('@')[0].toLowerCase());
    }
  });

  // Always include the current user
  if (user.email) {
    names.add(user.email.split('@')[0].toLowerCase());
  }

  return NextResponse.json(Array.from(names).sort());
}
