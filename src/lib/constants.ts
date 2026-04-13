/**
 * Application-wide constants.
 * Single source of truth for limits, thresholds, and magic numbers.
 */

// ─── Rate limits ───────────────────────────────────────────────────────────

/** Max acceptance submissions per IP per calendar day */
export const ACCEPT_RATE_LIMIT = 3;

/** Max AI proposal generations per user per hour */
export const GENERATE_RATE_LIMIT = 10;

// ─── Field length limits ───────────────────────────────────────────────────

export const PROPOSAL_TITLE_MAX = 255;
export const COMMENT_TEXT_MAX = 5_000;
export const CLIENT_NAME_MAX = 120;
export const CLIENT_EMAIL_MAX = 254; // RFC 5321
export const IMPORT_HTML_MAX = 2_000_000; // 2 MB

// ─── Timeouts ──────────────────────────────────────────────────────────────

/** Vercel function max duration for AI generation (seconds) */
export const GENERATE_MAX_DURATION = 60;

/** Auto-save debounce delay (milliseconds) */
export const AUTOSAVE_DEBOUNCE_MS = 800;

// ─── Pagination ────────────────────────────────────────────────────────────

export const COMMENTS_PAGE_SIZE = 50;
export const PROPOSALS_PAGE_SIZE = 50;
