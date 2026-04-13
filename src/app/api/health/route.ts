// src/app/api/health/route.ts
// Lightweight liveness + readiness probe.
// Used by uptime monitors (Better Stack, Pingdom, etc.) and load balancers.
// Returns 200 when DB is reachable, 503 otherwise.

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic'; // never cache — always a live check

export async function GET() {
  const start = Date.now();

  let dbStatus: 'ok' | 'error' = 'error';
  let dbLatencyMs: number | null = null;

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // Minimal probe — count query on a small table, no data returned
    const { error } = await supabase
      .from('proposals')
      .select('id', { count: 'exact', head: true })
      .limit(1);

    if (!error) {
      dbStatus = 'ok';
      dbLatencyMs = Date.now() - start;
    }
  } catch (err) {
    logger.error('Health check: DB probe failed', err instanceof Error ? err : undefined);
  }

  const healthy = dbStatus === 'ok';
  if (!healthy) {
    logger.warn('Health check: degraded', { dbStatus });
  }

  return NextResponse.json(
    {
      status: healthy ? 'ok' : 'degraded',
      ts: new Date().toISOString(),
      services: {
        db: { status: dbStatus, latencyMs: dbLatencyMs },
      },
      version: process.env.NEXT_PUBLIC_APP_VERSION ?? 'dev',
    },
    {
      status: healthy ? 200 : 503,
      headers: {
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    }
  );
}
