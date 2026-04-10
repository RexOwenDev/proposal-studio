// src/lib/analytics/record-view.ts
import { createClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';

// Lazy-initialized service client — avoids module-level instantiation crashing
// next build when env vars aren't yet set (e.g. first CI build before provisioning).
// Uses service role to bypass RLS — server-only, never imported by client components.
let _serviceClient: ReturnType<typeof createClient> | null = null;
function getServiceClient() {
  if (!_serviceClient) {
    _serviceClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }
  return _serviceClient;
}

/**
 * Records a proposal view. Deduplicates by hashed IP within a 24-hour window.
 * Uses SHA-256(ip + YYYY-MM-DD) — not reversible, not raw PII.
 * Call with `void recordView(...)` — fire-and-forget, never await in render path.
 */
export async function recordView(proposalId: string, rawIp: string): Promise<void> {
  try {
    const serviceClient = getServiceClient();
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const hashedIp = createHash('sha256')
      .update(`${rawIp}:${today}`)
      .digest('hex');

    // Check for an existing view from this IP hash today
    const { data: existing } = await serviceClient
      .from('proposal_views')
      .select('id')
      .eq('proposal_id', proposalId)
      .eq('viewer_ip', hashedIp)
      .gte('viewed_at', `${today}T00:00:00Z`)
      .maybeSingle();

    if (existing) return; // already recorded today — not unique

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (serviceClient.from('proposal_views') as any).insert({
      proposal_id: proposalId,
      viewer_ip: hashedIp,
      is_unique: true,
    });
  } catch {
    // Never throw — this must not break the page render
  }
}
