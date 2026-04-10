/**
 * Returns a human-readable relative time string for a past Date.
 * Used for "Saved Xs ago" in the editor toolbar.
 */
export function formatRelativeTime(d: Date): string {
  const diffSec = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diffSec < 5) return 'just now';
  if (diffSec < 60) return `${diffSec}s ago`;
  return `${Math.floor(diffSec / 60)}m ago`;
}
