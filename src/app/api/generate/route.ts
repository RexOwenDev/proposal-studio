import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { generateClientProposal, generateInternalDoc } from '@/lib/ai/generate-proposal';
import { buildClientProposalHTML } from '@/lib/templates/client-proposal';
import { buildInternalDocHTML } from '@/lib/templates/internal-doc';
import { createProposalFromHTML } from '@/lib/create-proposal-from-html';

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

  // Auth check
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Parse body
  let body: {
    text?: string;
    templateType?: 'client' | 'internal';
    title?: string;
    clientName?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { text, templateType = 'client', title, clientName } = body;

  if (!text || typeof text !== 'string' || text.trim().length < 20) {
    return NextResponse.json(
      { error: 'Draft text is required (minimum 20 characters)' },
      { status: 400 }
    );
  }

  if (text.length > 20000) {
    return NextResponse.json(
      { error: 'Draft text too long (max 20,000 characters)' },
      { status: 400 }
    );
  }

  try {
    // 1. Generate structured data from Claude
    let html: string;

    if (templateType === 'internal') {
      const data = await generateInternalDoc(text, {
        title,
        owner: user.email || undefined,
      });
      html = buildInternalDocHTML(data);
    } else {
      const data = await generateClientProposal(text, {
        title,
        clientName,
        preparedBy: user.email?.split('@')[0] || 'Design Shopp',
      });
      html = buildClientProposalHTML(data);
    }

    // 2. Parse + insert into DB using the same pipeline as /api/import
    const result = await createProposalFromHTML(supabase, {
      html,
      title,
      userId: user.id,
      userEmail: user.email || null,
    });

    return NextResponse.json(result);
  } catch (err) {
    // Surface AI errors distinctly so the client can show a useful message
    const message = err instanceof Error ? err.message : 'Unknown error';
    const isAiError = message.toLowerCase().includes('anthropic') ||
      message.toLowerCase().includes('rate limit') ||
      message.toLowerCase().includes('api');

    console.error('[generate] Error:', message);

    return NextResponse.json(
      { error: isAiError ? 'AI generation failed. Please try again.' : 'Server error' },
      { status: 500 }
    );
  }
}
