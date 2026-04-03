import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function POST(
  _request: Request,
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
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Get the block's original_html and set current_html back to it
  const { data: block, error: fetchError } = await supabase
    .from('content_blocks')
    .select('original_html')
    .eq('id', id)
    .single();

  if (fetchError || !block) {
    return NextResponse.json({ error: 'Block not found' }, { status: 404 });
  }

  const { data, error } = await supabase
    .from('content_blocks')
    .update({ current_html: block.original_html })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  return NextResponse.json(data);
}
