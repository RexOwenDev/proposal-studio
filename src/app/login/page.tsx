'use client';

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

function LoginForm() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'sent' | 'error' | 'oauth-loading'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  useSearchParams(); // keeps Suspense boundary required by Next.js

  const redirectTo = typeof window !== 'undefined'
    ? new URL(window.location.href).searchParams.get('redirect') || '/'
    : '/';

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setStatus('loading');
    setErrorMsg('');

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/api/auth/callback?next=${redirectTo}`,
      },
    });

    if (error) {
      setStatus('error');
      setErrorMsg('Could not send link. Please check your email and try again.');
    } else {
      setStatus('sent');
    }
  }

  async function handleGoogleSignIn() {
    setStatus('oauth-loading');
    setErrorMsg('');

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/api/auth/callback?next=${redirectTo}`,
      },
    });

    if (error) {
      setStatus('error');
      setErrorMsg('Google sign-in failed. Please try again.');
    }
    // On success, browser redirects — no state update needed
  }

  const busy = status === 'loading' || status === 'oauth-loading';

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950 px-4">
      <div className="w-full max-w-sm">
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-8">
          <h1 className="text-xl font-semibold text-white mb-1">Proposal Studio</h1>
          <p className="text-zinc-400 text-sm mb-6">Sign in to continue</p>

          {status === 'sent' ? (
            <div className="bg-emerald-950/50 border border-emerald-800 rounded-md p-4">
              <p className="text-emerald-300 text-sm font-medium">Check your email</p>
              <p className="text-emerald-400/70 text-xs mt-1">
                We sent a magic link to <strong>{email}</strong>
              </p>
              <button
                onClick={() => setStatus('idle')}
                className="mt-3 text-xs text-emerald-500 hover:text-emerald-300 transition-colors"
              >
                Use a different email →
              </button>
            </div>
          ) : (
            <>
              {/* Google OAuth — primary CTA for speed */}
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={busy}
                className="w-full flex items-center justify-center gap-2.5 py-2.5 px-4 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-gray-900 text-sm font-medium rounded-md transition-colors duration-150 border border-gray-200 mb-4"
              >
                {status === 'oauth-loading' ? (
                  <span className="w-4 h-4 border-2 border-gray-300 border-t-gray-700 rounded-full animate-spin" />
                ) : (
                  <GoogleIcon />
                )}
                {status === 'oauth-loading' ? 'Redirecting…' : 'Continue with Google'}
              </button>

              {/* Divider */}
              <div className="flex items-center gap-3 mb-4">
                <div className="flex-1 h-px bg-zinc-700" />
                <span className="text-zinc-500 text-xs">or</span>
                <div className="flex-1 h-px bg-zinc-700" />
              </div>

              {/* Magic link fallback */}
              <form onSubmit={handleMagicLink} className="space-y-4">
                <div>
                  <label htmlFor="email" className="block text-sm text-zinc-300 mb-1.5">
                    Email address
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-md text-white placeholder:text-zinc-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {status === 'error' && (
                  <p className="text-red-400 text-xs">{errorMsg}</p>
                )}

                <button
                  type="submit"
                  disabled={busy || !email}
                  className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-md transition-colors duration-150"
                >
                  {status === 'loading' ? 'Sending…' : 'Send Magic Link'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z" fill="#4285F4" />
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z" fill="#34A853" />
      <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z" fill="#FBBC05" />
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z" fill="#EA4335" />
    </svg>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
