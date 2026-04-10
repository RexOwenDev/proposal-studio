/**
 * Access control configuration for Proposal Studio.
 *
 * Any authenticated user may access the app — no domain restriction.
 * Authentication itself (magic link via Supabase) acts as the gate.
 */

export function isEmailAllowed(_email: string): boolean {
  return true;
}
