# UX Improvements — Proposal Studio Design Spec

> **Agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` to execute the plan produced from this spec. Each batch ships independently, with Lead Engineer + Security Engineer + QA Agent per batch.

**Date:** 2026-04-10
**Status:** Approved for implementation
**Scope:** All 13 UX improvements across 5 batches

---

## Pre-flight Audit — Already Partially Done

These items have existing implementation that must be preserved and extended, not rewritten:

| Item | What Exists | What's Missing |
|------|-------------|----------------|
| U1 (Publish flow) | Confirm dialog, `isPublishing` spinner, success toast already in `editor-toolbar.tsx` + `edit/page.tsx` | Post-publish toast should include public URL + copy action |
| U6 (Search bar) | Search input in `proposal-grid.tsx` line 43 filters by title | Sort dropdown; `client_name` is not a field on `Proposal` type so cannot search by it yet |
| U12 (Error retry) | `toast.tsx` already supports `action?: { label, onClick }` on `ToastItem` | Save error `showToast` call in `edit/page.tsx` does not pass an action — just wire it up |

---

## Stack and Constraints

- **Next.js 16 App Router** — all server components use `async/await params`; no `use()` hook
- **React 19 + React Compiler** — no manual `useMemo`/`useCallback` unless required for identity stability
- **TypeScript strict** — no `any`, all API inputs typed as `unknown` then narrowed
- **Tailwind CSS v4** — utility classes only; no inline `style=` for layout
- **Supabase** — PostgreSQL + Auth (`@supabase/ssr` for server, `createClient` for client)
- **`useToast` / `ToastContainer`** — canonical notification pattern; no browser `alert()`
- **`src/lib/types.ts`** — single source of truth for shared types; all new types go here

---

## Batch A — Quick Wins (No DB changes)

### U1 — Post-publish URL share

**Current state:** `handleSetStatus` in `edit/page.tsx` starts at line 656. The plain `showToast('Proposal published.', 'success')` call is at line **672** (just after the `labels` map). The toolbar's `isPublishing` prop shows `"..."` while in flight.

**Enhancement only:** Replace the plain success toast call at line 672 for the `published` case:

```typescript
// Replace the existing showToast call inside handleSetStatus for 'published':
if (newStatus === 'published') {
  showToast(
    'Proposal published — anyone with the link can view it.',
    'success',
    {
      label: 'Copy link',
      onClick: () => navigator.clipboard.writeText(
        `${window.location.origin}/p/${proposal.slug}`
      ),
    }
  );
} else {
  showToast(labels[newStatus] || 'Status updated.', 'success');
}
```

Action toasts auto-persist (no auto-dismiss) because `toast.tsx` line 85 only schedules `setTimeout` when `!action`. No other changes needed for U1.

---

### U3 — Keyboard shortcuts

**New file:** `src/components/editor/keyboard-shortcuts.tsx`

A `useKeyboardShortcuts` hook attached to `window` (inside the editor page) handles:

| Shortcut | Action |
|----------|--------|
| `Ctrl+S` / `Cmd+S` | `e.preventDefault()` + call `forceSave()` — flush debounce timer immediately |
| `Ctrl+/` / `Cmd+/` | Toggle sections sidebar |
| `Escape` | If a block is being edited: blur the active contentEditable. If only the sidebar is open: close it. |
| `?` | Toggle keyboard shortcut help overlay |

**Shortcut overlay:** A centered modal listing all shortcuts. Dismisses on `Escape` or backdrop click. Rendered inline in `keyboard-shortcuts.tsx` as a conditional return — no extra file needed.

**Toolbar badge:** A `?` icon button in the right side of `EditorToolbar` opens the overlay. Add `onShowShortcuts?: () => void` prop to `EditorToolbarProps`.

**Wiring in `edit/page.tsx`:**
- Add `const [showShortcuts, setShowShortcuts] = useState(false)` state
- Add `const activeEditRef = useRef<{ blockId: string; doc: Document } | null>(null)` — set inside `startEditing` when editing begins, cleared in `handleBlur`. This gives `forceSave` access to the current block and document without closure staleness.
- Add `forceSave`:
  ```typescript
  const forceSave = useCallback(() => {
    clearTimeout(saveTimerRef.current);
    const active = activeEditRef.current;
    if (active) saveBlockContent(active.blockId, active.doc);
  }, [saveBlockContent]);
  ```
- Mount `<KeyboardShortcuts onForceSave={forceSave} onToggleSections={...} onToggleShortcuts={() => setShowShortcuts(v => !v)} />` in the return JSX

---

### U4 — Save status: pulsing dot and timestamp

**File:** `src/components/editor/editor-toolbar.tsx`

Replace the static save status text (lines 175–181) with a richer indicator:

```typescript
// New prop on EditorToolbarProps:
lastSavedAt?: Date | null;

// In toolbar JSX — replace the existing save status span:
<div className="hidden sm:flex items-center gap-1.5 text-xs text-zinc-500">
  {saveStatus === 'saving' && (
    <>
      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse shrink-0" />
      <span>Saving…</span>
    </>
  )}
  {saveStatus === 'saved' && lastSavedAt && (
    <>
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
      <span>Saved {formatRelativeTime(lastSavedAt)}</span>
    </>
  )}
  {saveStatus === 'error' && (
    <>
      <span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
      <span className="text-red-400">Save failed</span>
    </>
  )}
</div>
```

**New utility `src/lib/utils/format-time.ts`:**

```typescript
export function formatRelativeTime(d: Date): string {
  const diffMs = Date.now() - d.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 5) return 'just now';
  if (diffSec < 60) return `${diffSec}s ago`;
  return `${Math.floor(diffSec / 60)}m ago`;
}
```

**State in `edit/page.tsx`:**
- Add `const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null)`
- Call `setLastSavedAt(new Date())` at the point `setSaveStatus('saved')` is called
- Add a `const [, forceTickRender] = useState(0)` dummy state and a `useEffect` that runs `setInterval(() => forceTickRender(n => n + 1), 15_000)` — this triggers React to re-diff `formatRelativeTime(lastSavedAt)` every 15 s so the "Xm ago" label stays fresh. Clear the interval on unmount.
- Pass `lastSavedAt` to `EditorToolbar`

---

### U12 — Save error retry action

**File:** `src/app/p/[slug]/edit/page.tsx`

In `saveBlockContent`, the error toast call becomes:

```typescript
showToast('Save failed — click to retry.', 'error', {
  label: 'Retry',
  onClick: () => saveBlockContent(blockId, doc),
});
```

`toast.tsx` already handles action persistence (no auto-dismiss when `action` is present). No other changes needed for U12.

---

## Batch B — Editor Completeness (No DB changes)

### U2 — Block-level undo (Ctrl+Z)

Store undo history per block in a `Map<blockId, string[]>` ref. Snapshots store the element's **serialized child nodes** (not `textContent`) so inline HTML (bold, spans, links) is preserved through undo. Cap at 20 snapshots per block.

**Why not `textContent`:** Blocks contain mixed HTML — `<strong>`, `<span>`, `<a>` elements. Restoring `textContent` would strip all markup, permanently corrupting inline formatting. Use `el.cloneNode(true)` serialized via `XMLSerializer` or the `serializeEditableEl` helper below.

**New ref in `edit/page.tsx`:**

```typescript
const undoStackRef = useRef<Map<string, string[]>>(new Map());

// Helper — serializes the editable element's children as an HTML string,
// stripping editor-injected attributes (data-editable, contenteditable, class=editing)
function snapshotEl(el: HTMLElement): string {
  const clone = el.cloneNode(true) as HTMLElement;
  clone.removeAttribute('contenteditable');
  clone.removeAttribute('data-editable');
  clone.classList.remove('editing');
  return clone.innerHTML;  // safe: reading, not writing
}
```

**In `startEditing` — capture initial snapshot:**

```typescript
undoStackRef.current.set(blockId, [snapshotEl(el)]);
```

**In `makeEditable` — push snapshot on input:**

```typescript
el.addEventListener('input', () => {
  const stack = undoStackRef.current.get(blockId) ?? [];
  const current = snapshotEl(el);
  if (stack[stack.length - 1] !== current) {
    stack.push(current);
    if (stack.length > 20) stack.shift();
    undoStackRef.current.set(blockId, stack);
  }
  // ... existing typing indicator logic unchanged
});
```

**In `startEditing` keydown handler — handle Ctrl+Z:**

```typescript
if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
  e.preventDefault();
  const stack = undoStackRef.current.get(blockId);
  if (stack && stack.length > 1) {
    stack.pop();
    // Restore: parse snapshot back into the element's children via a temp container
    const temp = el.ownerDocument.createElement('div');
    temp.innerHTML = stack[stack.length - 1]; // controlled: our own serialized snapshot
    el.replaceChildren(...Array.from(temp.childNodes));
    undoStackRef.current.set(blockId, stack);
  }
}
```

Undo is in-memory only — does not persist across blur or page reload.

---

### U5 — Empty block guard

**Problem:** Clearing all text from a block and blurring saves an empty string to the DB, collapsing the block to nothing.

**Guard in `saveBlockContent`** — insert this check at the top of the function body, before the existing `cloneNode` / serialize logic. The existing function already constructs a `clonedHtml` string and calls the `strip-editor-artifacts` utility; add the guard immediately after that stripped string is produced.

Locate the pattern in `saveBlockContent` where `setSaveStatus('saving')` is first called and the block's HTML is extracted. Add:

```typescript
// After the HTML is stripped of editor artifacts (existing logic):
const plainText = strippedHtml.replace(/<[^>]+>/g, '').trim();
if (!plainText) {
  showToast('Block is empty — content not saved. Add text to keep changes.', 'warning');
  // Restore the element in the iframe from the last saved state in React state
  const saved = blocks.find((b) => b.id === blockId);
  if (saved) {
    const iframeEl = iframeRef.current?.contentDocument?.querySelector(
      `[data-block-id="${blockId}"] [data-editable]`
    ) as HTMLElement | null;
    if (iframeEl) {
      // Parse saved HTML into the element using a sandboxed temp node — controlled source
      const temp = iframeRef.current!.contentDocument!.createElement('div');
      temp.innerHTML = saved.current_html; // controlled: our own DB-sourced HTML
      iframeEl.replaceChildren(...Array.from(temp.childNodes));
    }
  }
  setSaveStatus('idle');
  return;
}
```

`strippedHtml` is the local variable name the implementer must match to the actual variable in the existing `saveBlockContent` body — read the function before inserting.

---

### U13 — Export progress and error handling

**Gap:** Current `handleExport` in `editor-toolbar.tsx` line 56 returns silently on `!res.ok`.

**New local state in `EditorToolbar`:** `const [isExporting, setIsExporting] = useState(false)`

**Updated `handleExport`:**

```typescript
async function handleExport() {
  if (!proposalId || isExporting) return;
  setIsExporting(true);
  try {
    const res = await fetch(`/api/proposals/${proposalId}/export`);
    if (!res.ok) throw new Error(`Export failed (${res.status})`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title ?? 'proposal'}.html`;
    a.click();
    URL.revokeObjectURL(url);
    if (res.headers.get('X-Has-Scripts') === '1') {
      onExportWarning?.();
    }
  } catch {
    onExportError?.();
  } finally {
    setIsExporting(false);
  }
}
```

**New prop:** `onExportError?: () => void` on `EditorToolbarProps`. Wired in `edit/page.tsx`:

```typescript
onExportError={() => showToast('Export failed. Please try again.', 'error')}
```

**Export button while in-flight:**

```typescript
<button disabled={isExporting} onClick={handleExport}>
  {isExporting
    ? <><span className="w-3 h-3 border-2 border-zinc-400 border-t-transparent rounded-full animate-spin inline-block mr-1.5" />Exporting…</>
    : 'Export HTML'
  }
</button>
```

---

## Batch C — Dashboard Polish (No DB changes)

### U7 — Bulk actions

**State additions in `proposal-grid.tsx`:**

```typescript
const [bulkMode, setBulkMode] = useState(false);
const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
const [bulkActionStatus, setBulkActionStatus] = useState<'idle' | 'working'>('idle');
```

**UI flow:**
1. A "Select" toggle button in the filter bar (next to status filters) enters bulk mode
2. In bulk mode, each `ProposalCard` receives `isSelected: boolean` + `onToggleSelect: (id: string) => void` props — renders a checkbox in the top-left corner
3. A sticky action bar renders at the bottom when `selectedIds.size > 0`: `"N selected · Delete · Publish · Cancel"`
4. Bulk delete: `Promise.all` parallel `DELETE /api/proposals/:id` calls (each enforces ownership server-side, so parallel is safe). Show a pending toast: `"Deleting N proposals…"` — dismiss and show summary toast on completion.
5. Bulk publish: `Promise.all` parallel `PATCH /api/proposals/:id` with `{ status: 'published' }`
6. After bulk action: clear selection, exit bulk mode, call `router.refresh()`

**`ProposalCard` changes:** Add optional `isSelected?: boolean` and `onToggleSelect?: (id: string) => void`. When `onToggleSelect` is defined, render a `<div>` checkbox overlay in top-left corner of card.

---

### U9 — Sort options

**State in `proposal-grid.tsx`:**

```typescript
type SortKey = 'newest' | 'oldest' | 'title-az';
const [sortKey, setSortKey] = useState<SortKey>('newest');
```

**Sort logic integrated into existing `useMemo`:**

```typescript
const sorted = useMemo(() => {
  const list = [...filtered];
  switch (sortKey) {
    case 'oldest':   return list.sort((a, b) => a.created_at.localeCompare(b.created_at));
    case 'title-az': return list.sort((a, b) => a.title.localeCompare(b.title));
    default:         return list.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  }
}, [filtered, sortKey]);
```

Render `sorted` instead of `filtered` in the grid.

**UI:** A `<select>` dropdown in the filter bar, right-aligned. Options: `Newest first`, `Oldest first`, `Title A→Z`.

Note: "Recently viewed by client" option is deferred to Batch D (requires `proposal_views` table).

---

## Batch D — Analytics (New DB table: `proposal_views`)

### DB Migration

```sql
create table proposal_views (
  id            uuid primary key default gen_random_uuid(),
  proposal_id   uuid not null references proposals(id) on delete cascade,
  viewed_at     timestamptz not null default now(),
  viewer_ip     text,
  is_unique     boolean not null default true
);

create index proposal_views_proposal_id_idx on proposal_views(proposal_id);
create index proposal_views_viewed_at_idx   on proposal_views(viewed_at);

alter table proposal_views enable row level security;

create policy "owner can read their proposal views"
  on proposal_views for select
  using (
    exists (
      select 1 from proposals
      where proposals.id = proposal_views.proposal_id
        and proposals.created_by = auth.uid()
    )
  );
```

`viewer_ip` stores `SHA-256(raw_ip + YYYY-MM-DD)` — one-way hash, not raw PII. Inserts use the Supabase service role key (server-only) and bypass RLS — no INSERT policy needed.

---

### U8 + U11 — View count and last viewed

**Server utility `src/lib/analytics/record-view.ts`:**
- Accepts `proposalId: string` and `rawIp: string`
- Hashes IP with today's date salt using `crypto.createHash('sha256')`
- Checks for a row with same `proposal_id` + `viewer_ip` in the last 24h
- If none: inserts `{ proposal_id, viewer_ip, is_unique: true }`
- Uses service role Supabase client (never the anon key)
- Call is fire-and-forget — does not block the page render

**Wired in `src/app/p/[slug]/page.tsx`:**

```typescript
// After fetching proposal, non-blocking:
const ip = (await headers()).get('x-forwarded-for')?.split(',')[0]?.trim() ?? '';
void recordView(proposal.id, ip);
```

**New API route `src/app/api/proposals/[id]/stats/route.ts`:**

```typescript
GET /api/proposals/:id/stats
Authorization: session cookie (must be proposal owner)
Response: { total_views: number, unique_views: number, last_viewed_at: string | null }
```

Single Supabase aggregate query — no N+1.

**Dashboard integration:** `src/app/page.tsx` (server component) fetches aggregate stats for all published proposals in a single grouped query — no N+1. Use raw SQL via Supabase `rpc` or a single select with aggregation:

```sql
-- Supabase rpc function: get_proposal_view_stats(owner_id uuid)
select
  proposal_id,
  count(*)                                    as total_views,
  count(*) filter (where is_unique = true)    as unique_views,
  max(viewed_at)                              as last_viewed_at
from proposal_views
where proposal_id = any(
  select id from proposals where created_by = owner_id
)
group by proposal_id;
```

Create this as a Supabase RPC function in the migration. Call it from `page.tsx` as `supabase.rpc('get_proposal_view_stats', { owner_id: user.id })`. Build a `Map<proposalId, stats>` and pass the relevant entry to each `ProposalCard` as `viewStats`.

**Card UI:** When `viewStats` is present on a published proposal, render `👁 {unique_views}` and `Viewed {formatRelativeTime(last_viewed_at)}` in the card footer.

---

## Batch E — Client Flow (New DB table: `proposal_acceptances`)

### DB Migration

```sql
create table proposal_acceptances (
  id            uuid primary key default gen_random_uuid(),
  proposal_id   uuid not null references proposals(id) on delete cascade,
  client_name   text not null check (char_length(client_name) between 1 and 120),
  client_email  text,
  accepted_at   timestamptz not null default now(),
  ip_address    text
);

create unique index one_acceptance_per_proposal
  on proposal_acceptances(proposal_id);

alter table proposal_acceptances enable row level security;

create policy "owner can read their proposal acceptances"
  on proposal_acceptances for select
  using (
    exists (
      select 1 from proposals
      where proposals.id = proposal_acceptances.proposal_id
        and proposals.created_by = auth.uid()
    )
  );
```

---

### U10 — Client acceptance CTA

**New API route `src/app/api/proposals/[id]/accept/route.ts`:**

```typescript
POST /api/proposals/:id/accept   // No auth required — public endpoint
Body: { client_name: string; client_email?: string }
201: { accepted_at: string }
409: { error: 'Already accepted' }
422: { error: 'client_name is required and must be 1–120 characters' }
429: { error: 'Too many attempts' }
```

Security:
- UUID validation on `id` param
- `client_name` trimmed and length-checked server-side; never rendered as raw HTML
- Rate limit: 3 POSTs per IP per 10 minutes (in-memory Map, resets on redeploy)
- Returns `404` for non-published proposals — same shape as `404` for non-existent — avoids ID enumeration
- Inserts using service role key; unique index enforces one acceptance

After inserting, calls `sendAcceptanceNotification(...)` (non-blocking — `void`).

**Email utility `src/lib/email/send-acceptance-notification.ts`:**

Uses `resend` npm package. Sends from `notifications@designshopp.app` to the proposal owner's email. Subject: `[clientName] accepted "[proposalTitle]"`. Requires `RESEND_API_KEY` env var (server-only).

**New client component `src/components/proposal/accept-proposal-button.tsx`:**

States: `idle | confirming | submitting | accepted | already_accepted`

- **Idle:** Fixed bottom bar — `"Accept this Proposal →"` button in emerald
- **Confirming:** Form slides up with `client_name` input (required, max 120 chars) and `client_email` input (optional). "Confirm" and "Cancel" buttons.
- **Submitting:** Confirm button disabled + spinner
- **Accepted / Already accepted:** Bar replaced with `"✓ Accepted by [name] on [date]"` — permanent

**Wired in `src/app/p/[slug]/page.tsx`:** Check for existing acceptance at render time. Pass `existingAcceptance` to `AcceptProposalButton` so it starts in `already_accepted` state if needed.

**Dashboard card:** When proposal has been accepted, render an `Accepted` badge (emerald) with `title="Accepted by [name] on [date]"` tooltip.

**New type in `src/lib/types.ts`:**

```typescript
export interface ProposalAcceptance {
  id: string;
  proposal_id: string;
  client_name: string;
  client_email: string | null;
  accepted_at: string;
  // ip_address intentionally excluded — server-only, never sent to client
}
```

---

## Security Checklist (All Batches)

| Risk | Mitigation |
|------|------------|
| U7 bulk delete — wrong owner | Each `DELETE /api/proposals/:id` already enforces `eq('created_by', user.id)` — no bypass possible |
| U7 bulk publish — wrong owner | Each `PATCH /api/proposals/:id` already enforces ownership check |
| U10 accept — spam / repeated accepts | Unique DB index on `(proposal_id)` returns 409 on second attempt |
| U10 accept — XSS via client_name | All user-supplied text rendered via React JSX (auto-escaped) — never via unsafe DOM APIs |
| U10 accept — ID enumeration | `404` returned for non-existent AND non-published proposals — same response shape |
| U10 accept — rate abuse | 3 attempts per IP per 10 minutes (in-memory rate limiter) |
| Analytics — PII (IP storage) | `SHA-256(ip + date)` — not reversible, not raw PII |
| U10 email — key exposure | `RESEND_API_KEY` used only in server-side utility file, never in client components |
| All new API routes — UUID injection | UUID regex validation on all `id` params, matching existing pattern in `proposals/[id]/route.ts` |

---

## File Map Summary

### Batch A — 2 files modified, 2 new
- `src/app/p/[slug]/edit/page.tsx` — U1 toast upgrade, U4 lastSavedAt state + interval, U12 retry action
- `src/components/editor/editor-toolbar.tsx` — U4 pulsing dot, U3 `onShowShortcuts` prop
- `src/lib/utils/format-time.ts` — **NEW** `formatRelativeTime`
- `src/components/editor/keyboard-shortcuts.tsx` — **NEW** hook + overlay

### Batch B — 2 files modified
- `src/app/p/[slug]/edit/page.tsx` — U2 undo stack ref + keydown handler, U5 empty block guard
- `src/components/editor/editor-toolbar.tsx` — U13 `isExporting` state + `onExportError` prop

### Batch C — 2 files modified
- `src/components/dashboard/proposal-grid.tsx` — U7 bulk mode + selection, U9 sort dropdown
- `src/components/dashboard/proposal-card.tsx` — U7 checkbox overlay props

### Batch D — 4 new, 3 modified
- `src/lib/analytics/record-view.ts` — **NEW**
- `src/app/api/proposals/[id]/stats/route.ts` — **NEW**
- `src/app/p/[slug]/page.tsx` — fire-and-forget recordView
- `src/components/dashboard/proposal-card.tsx` — view count + last viewed UI
- `src/app/page.tsx` — batch-fetch stats

### Batch E — 3 new, 4 modified
- `src/app/api/proposals/[id]/accept/route.ts` — **NEW**
- `src/components/proposal/accept-proposal-button.tsx` — **NEW**
- `src/lib/email/send-acceptance-notification.ts` — **NEW**
- `src/app/p/[slug]/page.tsx` — mount AcceptProposalButton + check existing acceptance
- `src/components/dashboard/proposal-card.tsx` — accepted badge
- `src/lib/types.ts` — `ProposalAcceptance` type

---

## QA Regression Checklist

- [ ] `npm run build` — zero TypeScript errors, zero lint errors
- [ ] Dashboard: search + status filter + sort all work independently and together
- [ ] Dashboard: bulk select enters/exits cleanly; bulk delete + publish complete with feedback
- [ ] Dashboard: empty state still appears when all proposals filtered out
- [ ] Editor: save status dot pulses on save, turns green + shows "Xm ago" on success
- [ ] Editor: save error shows "Retry" toast action; clicking retry re-attempts the save
- [ ] Editor: Ctrl+S flushes the debounce and saves without waiting
- [ ] Editor: Ctrl+/ toggles the sections panel
- [ ] Editor: `?` opens shortcut overlay; Escape closes it
- [ ] Editor: Ctrl+Z undoes last typed change in active block; 20-step cap
- [ ] Editor: clearing a block entirely shows warning toast and does not persist blank content
- [ ] Editor: Export shows spinner while in-flight; error toast on failure; success downloads file
- [ ] Editor: Publishing shows confirm dialog → success toast with "Copy link" action
- [ ] Public view: "Accept Proposal" bar visible on published proposals
- [ ] Public view: Submitting acceptance records to DB; owner receives email notification
- [ ] Public view: Submitting a second acceptance shows "already accepted" state (409)
- [ ] Public view: Accept POST with overlong `client_name` returns 422
- [ ] Dashboard card (published): shows `👁 N views` and `Viewed X ago`
- [ ] Dashboard card (accepted): shows `Accepted` badge with client name tooltip
- [ ] Security: Bulk delete on another user's proposal IDs returns 403/404
- [ ] Security: Accept POST with `client_name` containing script tags renders as plain text
