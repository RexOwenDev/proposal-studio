/**
 * Shared API utilities — imported by all route handlers.
 *
 * Centralises security headers, UUID validation, and standard JSON
 * responses so every endpoint is consistent without duplication.
 */

import { NextResponse } from 'next/server';

// ─── Security headers ──────────────────────────────────────────────────────

export const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Cache-Control': 'no-store',
} as const;

// ─── Validation ────────────────────────────────────────────────────────────

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidUUID(value: string): boolean {
  return UUID_RE.test(value);
}

// ─── Standard JSON responses ───────────────────────────────────────────────

type JsonValue = Record<string, unknown> | unknown[] | null;

export function ok(body: JsonValue = null, status = 200): NextResponse {
  return NextResponse.json(body, { status, headers: SECURITY_HEADERS });
}

export function err(message: string, status: number): NextResponse {
  return NextResponse.json({ error: message }, { status, headers: SECURITY_HEADERS });
}

export const Res = { ok, err };
