/**
 * Assign consistent colors to users based on their email.
 * Same email always gets the same color across sessions.
 */

// Higher opacity values (0.40–0.45) ensure highlights are clearly visible
// on the light/warm-white backgrounds used by proposal templates.
const HIGHLIGHT_COLORS = [
  { bg: 'rgba(255, 213, 79, 0.45)', border: 'rgba(245, 166, 35, 0.85)', name: 'amber' },
  { bg: 'rgba(96, 165, 250, 0.40)', border: 'rgba(59, 130, 246, 0.85)', name: 'blue' },
  { bg: 'rgba(52, 211, 153, 0.40)', border: 'rgba(16, 185, 129, 0.85)', name: 'emerald' },
  { bg: 'rgba(251, 146, 60, 0.40)', border: 'rgba(249, 115, 22, 0.85)', name: 'orange' },
  { bg: 'rgba(192, 132, 252, 0.40)', border: 'rgba(168, 85, 247, 0.85)', name: 'purple' },
  { bg: 'rgba(248, 113, 113, 0.40)', border: 'rgba(239, 68, 68, 0.85)', name: 'red' },
  { bg: 'rgba(45, 212, 191, 0.40)', border: 'rgba(20, 184, 166, 0.85)', name: 'teal' },
  { bg: 'rgba(244, 114, 182, 0.40)', border: 'rgba(236, 72, 153, 0.85)', name: 'pink' },
];

const COMMENT_BORDER_COLORS: Record<string, string> = {
  amber: 'border-l-amber-500',
  blue: 'border-l-blue-500',
  emerald: 'border-l-emerald-500',
  orange: 'border-l-orange-500',
  purple: 'border-l-purple-500',
  red: 'border-l-red-500',
  teal: 'border-l-teal-500',
  pink: 'border-l-pink-500',
};

function hashEmail(email: string): number {
  let hash = 0;
  for (let i = 0; i < email.length; i++) {
    hash = ((hash << 5) - hash) + email.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function getUserColor(email: string) {
  const index = hashEmail(email.toLowerCase()) % HIGHLIGHT_COLORS.length;
  return HIGHLIGHT_COLORS[index];
}

export function getUserCommentBorder(email: string): string {
  const color = getUserColor(email);
  return COMMENT_BORDER_COLORS[color.name] || 'border-l-amber-500';
}
