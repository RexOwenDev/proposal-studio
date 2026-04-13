/**
 * Environment variable validation.
 * Validates all required env vars at module load time — fails fast
 * with a clear message rather than cryptic runtime errors deep in the app.
 *
 * Import this in server-only code (API routes, server actions).
 * Never import in client components.
 */

type EnvVar = {
  key: string;
  required: boolean;
  description: string;
};

const SERVER_ENV_VARS: EnvVar[] = [
  { key: 'NEXT_PUBLIC_SUPABASE_URL', required: true, description: 'Supabase project URL' },
  { key: 'NEXT_PUBLIC_SUPABASE_ANON_KEY', required: true, description: 'Supabase anonymous key' },
  { key: 'SUPABASE_SERVICE_ROLE_KEY', required: true, description: 'Supabase service role key (server-only)' },
  { key: 'NEXT_PUBLIC_APP_URL', required: true, description: 'Public app URL for OAuth redirects and CSRF' },
  { key: 'RESEND_API_KEY', required: true, description: 'Resend email API key' },
  { key: 'ANTHROPIC_API_KEY', required: true, description: 'Anthropic Claude API key' },
];

function validateEnv(): void {
  if (process.env.NODE_ENV === 'test') return;

  const missing = SERVER_ENV_VARS.filter(
    ({ required, key }) => required && !process.env[key]
  );

  if (missing.length > 0) {
    const lines = missing.map(({ key, description }) => `  • ${key} — ${description}`);
    throw new Error(
      `[env] Missing required environment variables:\n${lines.join('\n')}\n\n` +
      'Copy .env.example to .env.local and fill in the values.'
    );
  }
}

validateEnv();

// Typed accessors — use these instead of process.env directly
export const env = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
  appUrl: process.env.NEXT_PUBLIC_APP_URL!,
  resendApiKey: process.env.RESEND_API_KEY!,
  anthropicApiKey: process.env.ANTHROPIC_API_KEY!,
  isDev: process.env.NODE_ENV === 'development',
  isProd: process.env.NODE_ENV === 'production',
} as const;
