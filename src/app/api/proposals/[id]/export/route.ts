import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { wrapScripts } from '@/lib/utils/wrap-scripts';
import { stripEditorArtifacts } from '@/lib/utils/strip-editor-artifacts';

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

function parseStylesheet(raw: string | null): { headLinks: string; css: string } {
  if (!raw) return { headLinks: '', css: '' };
  const match = raw.match(/<!--HEAD_LINKS-->\n([\s\S]*?)\n<!--\/HEAD_LINKS-->/);
  if (match) {
    return {
      headLinks: match[1].trim(),
      css: raw.replace(/<!--HEAD_LINKS-->[\s\S]*?<!--\/HEAD_LINKS-->\n?/, '').trim(),
    };
  }
  if (raw.includes('<!-- Font preconnects -->')) {
    const parts = raw.split('\n\n');
    return {
      headLinks: parts.filter((p) => p.includes('<link')).map((p) => p.replace('<!-- Font preconnects -->', '').trim()).join('\n'),
      css: parts.filter((p) => !p.includes('<link') && !p.includes('<!-- Font')).join('\n\n'),
    };
  }
  return { headLinks: '', css: raw };
}

export async function GET(
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

  const { data: proposal } = await supabase
    .from('proposals')
    .select('*')
    .eq('id', id)
    .single();

  if (!proposal) {
    return NextResponse.json({ error: 'Not found' }, { status: 404, headers: SECURITY_HEADERS });
  }

  if (proposal.created_by !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403, headers: SECURITY_HEADERS });
  }

  const { data: blocks } = await supabase
    .from('content_blocks')
    .select('*')
    .eq('proposal_id', id)
    .eq('visible', true)
    .order('block_order', { ascending: true });

  const { headLinks, css } = parseStylesheet(proposal.stylesheet);

  // Group blocks by wrapper_class (same logic as renderer)
  const bodyParts: string[] = [];
  let currentWrapper: string | null = null;
  let wrapperBuffer: string[] = [];

  function flushWrapper() {
    if (wrapperBuffer.length > 0 && currentWrapper) {
      bodyParts.push(`<div class="${currentWrapper}">\n${wrapperBuffer.join('\n')}\n</div>`);
      wrapperBuffer = [];
    }
    currentWrapper = null;
  }

  for (const block of blocks || []) {
    // Strip ALL editor artifacts — exported HTML must be completely clean
    const html = stripEditorArtifacts(block.current_html);
    const wrapper = block.wrapper_class || null;
    if (wrapper !== currentWrapper) {
      flushWrapper();
      if (wrapper) { currentWrapper = wrapper; wrapperBuffer.push(html); }
      else bodyParts.push(html);
    } else if (wrapper) {
      wrapperBuffer.push(html);
    } else {
      bodyParts.push(html);
    }
  }
  flushWrapper();

  const hasScripts = Boolean(proposal.scripts && proposal.scripts.trim().length > 0);
  const wrappedScripts = hasScripts ? wrapScripts(proposal.scripts) : '';

  let html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${proposal.title.replace(/</g, '&lt;')}</title>
  ${headLinks}
  <style>${css}</style>
</head>
<body>
  ${bodyParts.join('\n')}
  ${wrappedScripts}
</body>
</html>`;

  if (hasScripts) {
    const warning = [
      '',
      '<!--',
      '  NOTE: This proposal contains JavaScript interactions.',
      '  For best results, open this file in a browser directly (not VS Code preview or email).',
      '  Font rendering requires an internet connection.',
      '-->',
      '',
    ].join('\n');
    html = html.replace('<!DOCTYPE html>', `<!DOCTYPE html>${warning}`);
  }

  // Sanitise title for use as a filename
  const filename = proposal.title.replace(/[^a-z0-9\-_ ]/gi, '').trim().replace(/\s+/g, '-').toLowerCase() || 'proposal';

  const headers: Record<string, string> = {
    'Content-Type': 'text/html; charset=utf-8',
    'Content-Disposition': `attachment; filename="${filename}.html"`,
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
  };
  if (hasScripts) headers['X-Has-Scripts'] = '1';

  return new Response(html, { headers });
}
