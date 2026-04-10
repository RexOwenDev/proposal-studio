/**
 * Returns a human-readable relative time string for a past Date.
 * Used for "Saved Xs ago" in the editor toolbar.
 * Returns 'just now' for dates within 5 seconds.
 * Falls back to 'just now' for invalid or future dates (defensive).
 */
export function formatRelativeTime(d: Date): string {
  const diffMs = Date.now() - d.getTime();

  // Guard: invalid Date (NaN) or future date — treat as just saved
  if (!isFinite(diffMs) || diffMs < 0) return 'just now';

  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 5)   return 'just now';
  if (diffSec < 60)  return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60)  return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24)   return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}
