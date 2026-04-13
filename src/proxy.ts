import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { isEmailAllowed } from '@/lib/access-control';

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Mutate the in-memory request object so Supabase SSR can re-read
          // the refreshed session within the same middleware invocation.
          // This does NOT produce a Set-Cookie header — it is not a response
          // cookie. SameSite enforcement is applied to the response below.
          // nosemgrep: javascript.express.security.audit.xss.pug.var-in-href
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value) // nosemgrep
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            // Enforce SameSite=lax — prevents cross-site request forgery.
            // 'lax' allows top-level navigations (OAuth redirects) while
            // blocking cross-site sub-requests. Never set to 'none' without
            // a valid reason and Secure flag.
            supabaseResponse.cookies.set(name, value, {
              ...options,
              sameSite: options?.sameSite === 'strict' ? 'strict' : 'lax',
              secure: process.env.NODE_ENV === 'production',
            })
          );
        },
      },
    }
  );

  // Refresh session — must happen before any route checks
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  // Protected routes: dashboard, import, and edit pages
  const needsAuth =
    pathname === '/' ||
    pathname === '/import' ||
    (pathname.startsWith('/p/') && pathname.endsWith('/edit'));

  if (!user && needsAuth) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('redirect', pathname);
    return NextResponse.redirect(url);
  }

  // If logged in and hitting /login, redirect to dashboard
  if (user && pathname === '/login') {
    return NextResponse.redirect(new URL('/', request.url));
  }

  // Add security headers to all responses
  supabaseResponse.headers.set('X-Content-Type-Options', 'nosniff');
  supabaseResponse.headers.set('X-Frame-Options', 'DENY');
  supabaseResponse.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  supabaseResponse.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  supabaseResponse.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  supabaseResponse.headers.set('Cache-Control', 'no-store');

  return supabaseResponse;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico|api/auth).*)'],
};
