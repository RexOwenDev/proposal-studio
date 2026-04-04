/**
 * stripEditorArtifacts — canonical HTML sanitiser for proposal output.
 *
 * Every path that produces HTML visible to the end-user (view mode renderer,
 * block save API, export API) imports this single function. Fixing a leak here
 * fixes it everywhere at once.
 *
 * Artifacts removed:
 *
 *   <mark data-comment-id="…">text</mark>   → text
 *     Comment highlight wrappers injected by renderHighlights(). They carry
 *     inline styles (background, border, cursor:pointer) that are visible and
 *     interactive in the published view. Removed in two passes: first the
 *     opening tag, then any orphaned closing tags. Attribute order is ignored.
 *
 *   data-editable="…"
 *     Set by makeEditable() on every inline-editable DOM node.
 *
 *   data-block-id-ref="…"
 *     Editor's pointer back to the owning block.
 *
 *   contenteditable="…"
 *     Set by startEditing() when the user clicks an element.
 *
 *   "editing" CSS class token
 *     Applied during an active inline edit session.
 *
 * The function is pure — it does not mutate its input and it is safe to call
 * multiple times (idempotent after the first pass).
 */
export function stripEditorArtifacts(html: string): string {
  return html
    // ── 1. Unwrap comment-highlight marks (two-pass, attribute-order-independent) ─
    //
    // Pass 1a: remove the opening <mark> tag if it has data-comment-id anywhere.
    // Using [^>]* which cannot cross an attribute boundary (no > inside attrs).
    .replace(/<mark\b[^>]*\bdata-comment-id\b[^>]*>/gi, '')
    //
    // Pass 1b: remove all orphaned </mark> closing tags left by pass 1a.
    // Only our editor injects <mark>; legitimate proposal markup doesn't use it.
    .replace(/<\/mark>/gi, '')

    // ── 2. Editor-only data attributes ───────────────────────────────────────────
    .replace(/\s+data-editable="[^"]*"/gi, '')
    .replace(/\s+data-block-id-ref="[^"]*"/gi, '')

    // ── 3. contenteditable ────────────────────────────────────────────────────────
    .replace(/\s+contenteditable="[^"]*"/gi, '')

    // ── 4. "editing" CSS class token ─────────────────────────────────────────────
    // Handles all positions: start, middle, end, and sole class token.
    .replace(/(\sclass="[^"]*?)\s*\bediting\b/gi, '$1')
    // Clean up any class="" left after removing the only token
    .replace(/\s+class="\s*"/gi, '');
}
