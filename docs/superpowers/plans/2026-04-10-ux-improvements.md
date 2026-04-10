# UX Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship 13 UX improvements across 5 independent batches — from quick editor wins (publish URL sharing, keyboard shortcuts, save timestamp) through dashboard bulk actions, proposal analytics, and a client acceptance flow with email notification.

**Architecture:** Each batch is independently shippable and commit-clean before the next begins. Batches A–C touch only existing files with no DB changes. Batch D adds a `proposal_views` table + Supabase RPC. Batch E adds `proposal_acceptances`, a public POST endpoint (no auth), and Resend email.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript strict, Tailwind CSS v4, Supabase (`@supabase/ssr`), Resend (email). No test framework — verification uses `npx tsc --noEmit` + `npm run build`. All commands run from `C:/Users/owenq/OneDrive/Documents/N8N Automation`.

**Multi-agent roles per batch:**
- **Lead Engineer** — implements each task
- **Security Engineer** — reviews after every API/DB task
- **QA Agent** — runs `npm run build` + regression checklist after each batch

---

## Pre-flight: Already-Done Audit

Before starting ANY task, verify these are in place (read the files — do not re-implement):

| Item | Location | What to verify |
|------|----------|----------------|
| Publish confirm dialog | `editor-toolbar.tsx` lines 216–239 | `showPublishDialog` state + confirm/cancel buttons exist |
| `isPublishing` spinner | `editor-toolbar.tsx` line 203 | `disabled={isPublishing}` on publish button |
| Toast action support | `src/components/ui/toast.tsx` line 11 | `action?: { label: string; onClick: () => void }` on `ToastItem` |
| Search bar on dashboard | `src/components/dashboard/proposal-grid.tsx` lines 43–51 | `<input>` with `onChange` setting `search` state |

If any are missing, fix them before proceeding.

**U6 status:** The dashboard search bar already exists and filters by title. `client_name` is not a field on the `Proposal` type, so client-name search is out of scope. Sort options (U9 / Task C1) complete the intended U6 work. No separate U6 task is needed.

---

## File Map

### New files
- `src/lib/utils/format-time.ts` — `formatRelativeTime(d: Date): string`
- `src/components/editor/keyboard-shortcuts.tsx` — `useKeyboardShortcuts` hook + shortcut overlay
- `src/lib/analytics/record-view.ts` — server-side view tracking utility
- `src/app/api/proposals/[id]/stats/route.ts` — GET view stats (owner-only)
- `src/app/api/proposals/[id]/accept/route.ts` — POST acceptance (no auth)
- `src/components/proposal/accept-proposal-button.tsx` — CTA client component
- `src/lib/email/send-acceptance-notification.ts` — Resend email utility

### Modified files
- `src/app/p/[slug]/edit/page.tsx` — U1 toast, U3 shortcuts wiring, U4 save timestamp, U12 retry, U2 undo, U5 empty guard, `activeEditRef`
- `src/components/editor/editor-toolbar.tsx` — U4 pulsing dot, U3 shortcut badge, U13 export spinner + error prop
- `src/components/dashboard/proposal-grid.tsx` — U9 sort, U7 bulk mode
- `src/components/dashboard/proposal-card.tsx` — U7 checkbox overlay, D analytics display, E accepted badge
- `src/app/p/[slug]/page.tsx` — D fire-and-forget view recording, E `AcceptProposalButton` mount
- `src/app/page.tsx` — D batch-fetch view stats
- `src/lib/types.ts` — `ProposalAcceptance` interface

---

## BATCH A — Quick Wins

### Task A1: `formatRelativeTime` utility

**Files:**
- Create: `src/lib/utils/format-time.ts`

- [ ] **Step 1: Create the file**

```typescript
// src/lib/utils/format-time.ts

/**
 * Returns a human-readable relative time string for a past Date.
 * Used for "Saved Xs ago" in the editor toolbar.
 */
export function formatRelativeTime(d: Date): string {
  const diffSec = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diffSec < 5)  return 'just now';
  if (diffSec < 60) return `${diffSec}s ago`;
  return `${Math.floor(diffSec / 60)}m ago`;
}
```

- [ ] **Step 2: Type-check**

```bash
cd "C:/Users/owenq/OneDrive/Documents/N8N Automation" && npx tsc --noEmit 2>&1 | tail -10
```

Expected: no errors mentioning `format-time.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/utils/format-time.ts
git commit -m "feat(utils): add formatRelativeTime helper

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task A2: U4 — Pulsing save status dot + timestamp

**Files:**
- Modify: `src/components/editor/editor-toolbar.tsx`
- Modify: `src/app/p/[slug]/edit/page.tsx`

- [ ] **Step 1: Add `lastSavedAt` prop + updated save indicator to toolbar**

Open `src/components/editor/editor-toolbar.tsx`. In `EditorToolbarProps` (line 10), add after `isPublishing?`:

```typescript
lastSavedAt?: Date | null;
```

Add to the destructured props (line 33 area):

```typescript
lastSavedAt,
```

Import `formatRelativeTime` at the top:

```typescript
import { formatRelativeTime } from '@/lib/utils/format-time';
```

Replace the existing save status `<span>` block (lines 175–181 — the block that renders "Saving...", "Saved", "Failed"):

```typescript
<div className="hidden sm:flex items-center gap-1.5 text-xs text-zinc-500 shrink-0">
  {saveStatus === 'saving' && (
    <>
      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse shrink-0" aria-hidden="true" />
      <span>Saving…</span>
    </>
  )}
  {saveStatus === 'saved' && lastSavedAt && (
    <>
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" aria-hidden="true" />
      <span>Saved {formatRelativeTime(lastSavedAt)}</span>
    </>
  )}
  {saveStatus === 'error' && (
    <>
      <span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" aria-hidden="true" />
      <span className="text-red-400">Save failed</span>
    </>
  )}
</div>
```

- [ ] **Step 2: Add `lastSavedAt` state + tick interval in edit page**

Open `src/app/p/[slug]/edit/page.tsx`. After the existing state declarations (around line 37), add:

```typescript
const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
const [, forceTickRender] = useState(0);
```

Add a `useEffect` to keep the relative time fresh (place after the `setMounted` effect):

```typescript
// Tick every 15s so "Xm ago" label stays current
useEffect(() => {
  const id = setInterval(() => forceTickRender((n) => n + 1), 15_000);
  return () => clearInterval(id);
}, []);
```

Find the place where `setSaveStatus('saved')` is called (inside `saveBlockContent`). Add `setLastSavedAt(new Date())` immediately after it:

```typescript
setSaveStatus('saved');
setLastSavedAt(new Date());
```

- [ ] **Step 3: Pass `lastSavedAt` to `EditorToolbar`**

In the `<EditorToolbar ...>` JSX (around line 693), add:

```typescript
lastSavedAt={lastSavedAt}
```

- [ ] **Step 4: Type-check**

```bash
cd "C:/Users/owenq/OneDrive/Documents/N8N Automation" && npx tsc --noEmit 2>&1 | tail -10
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/editor/editor-toolbar.tsx src/app/p/[slug]/edit/page.tsx
git commit -m "feat(editor): pulsing save dot + relative timestamp (U4)

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task A3: U1 — Post-publish copy-link toast

**Files:**
- Modify: `src/app/p/[slug]/edit/page.tsx`

- [ ] **Step 1: Update `handleSetStatus` success toast**

In `edit/page.tsx`, find `handleSetStatus` (starts line 656). The existing `showToast(labels[newStatus] || 'Status updated.', 'success')` call is at line 672. Replace the entire `showToast` call with:

```typescript
if (newStatus === 'published') {
  showToast(
    'Proposal published — anyone with the link can view it.',
    'success',
    {
      label: 'Copy link',
      onClick: () =>
        navigator.clipboard.writeText(
          `${window.location.origin}/p/${proposal!.slug}`
        ),
    }
  );
} else {
  showToast(labels[newStatus] || 'Status updated.', 'success');
}
```

- [ ] **Step 2: Type-check**

```bash
cd "C:/Users/owenq/OneDrive/Documents/N8N Automation" && npx tsc --noEmit 2>&1 | tail -10
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/p/[slug]/edit/page.tsx
git commit -m "feat(editor): post-publish copy-link action in success toast (U1)

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task A4: U12 — Save error retry action

**Files:**
- Modify: `src/app/p/[slug]/edit/page.tsx`

- [ ] **Step 1: Locate the save error `showToast` call**

Search for `showToast` inside `saveBlockContent` in `edit/page.tsx`. It will look like:

```typescript
showToast('Error saving block.', 'error');
// or similar — exact message may differ
```

- [ ] **Step 2: Replace with retry action**

Replace that single save-error `showToast` call with:

```typescript
showToast('Save failed — click to retry.', 'error', {
  label: 'Retry',
  onClick: () => saveBlockContent(blockId, doc),
});
```

- [ ] **Step 3: Type-check**

```bash
cd "C:/Users/owenq/OneDrive/Documents/N8N Automation" && npx tsc --noEmit 2>&1 | tail -10
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/p/[slug]/edit/page.tsx
git commit -m "fix(editor): save error toast now includes retry action (U12)

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task A5: U3 — Keyboard shortcuts hook + overlay

**Files:**
- Create: `src/components/editor/keyboard-shortcuts.tsx`
- Modify: `src/components/editor/editor-toolbar.tsx`
- Modify: `src/app/p/[slug]/edit/page.tsx`

- [ ] **Step 1: Create `keyboard-shortcuts.tsx`**

```typescript
// src/components/editor/keyboard-shortcuts.tsx
'use client';

import { useEffect } from 'react';

interface Props {
  onForceSave: () => void;
  onToggleSections: () => void;
  onToggleShortcuts: () => void;
  showOverlay: boolean;
}

const SHORTCUTS = [
  { keys: 'Ctrl+S', mac: '⌘S',   label: 'Force save immediately' },
  { keys: 'Ctrl+/', mac: '⌘/',   label: 'Toggle sections panel' },
  { keys: 'Escape', mac: 'Esc',  label: 'Exit edit mode / close panel' },
  { keys: '?',      mac: '?',    label: 'Show/hide this shortcuts overlay' },
];

export default function KeyboardShortcuts({
  onForceSave,
  onToggleSections,
  onToggleShortcuts,
  showOverlay,
}: Props) {
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      const isMac = navigator.platform.toUpperCase().includes('MAC');
      const mod = isMac ? e.metaKey : e.ctrlKey;

      // Ctrl/Cmd+S — force save
      if (mod && e.key === 's') {
        e.preventDefault();
        onForceSave();
        return;
      }

      // Ctrl/Cmd+/ — toggle sections
      if (mod && e.key === '/') {
        e.preventDefault();
        onToggleSections();
        return;
      }

      // ? — toggle shortcut overlay (only when not typing in an input/textarea)
      if (
        e.key === '?' &&
        !['INPUT', 'TEXTAREA', 'SELECT'].includes(
          (document.activeElement as HTMLElement)?.tagName ?? ''
        )
      ) {
        e.preventDefault();
        onToggleShortcuts();
        return;
      }

      // Escape — close overlay if open; otherwise blur active contentEditable
      if (e.key === 'Escape') {
        if (showOverlay) {
          onToggleShortcuts();
          return;
        }
        const active = document.activeElement as HTMLElement | null;
        if (active?.contentEditable === 'true') {
          active.blur();
        }
      }
    }

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onForceSave, onToggleSections, onToggleShortcuts, showOverlay]);

  if (!showOverlay) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60"
      onClick={onToggleShortcuts}
    >
      <div
        className="bg-zinc-900 border border-zinc-700 rounded-xl p-6 w-full max-w-sm mx-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-white font-semibold text-base mb-4">Keyboard Shortcuts</h2>
        <table className="w-full text-sm">
          <tbody>
            {SHORTCUTS.map(({ keys, mac, label }) => (
              <tr key={keys} className="border-b border-zinc-800 last:border-0">
                <td className="py-2.5 pr-4">
                  <div className="flex gap-1">
                    {(navigator.platform.toUpperCase().includes('MAC') ? mac : keys)
                      .split('+')
                      .map((k) => (
                        <kbd
                          key={k}
                          className="px-1.5 py-0.5 bg-zinc-800 border border-zinc-700 rounded text-xs text-zinc-300 font-mono"
                        >
                          {k}
                        </kbd>
                      ))}
                  </div>
                </td>
                <td className="py-2.5 text-zinc-400">{label}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-xs text-zinc-600 mt-4 text-center">Press ? or Esc to close</p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add `onShowShortcuts` prop to `EditorToolbar` and `?` button**

In `editor-toolbar.tsx`, add to `EditorToolbarProps`:

```typescript
onShowShortcuts?: () => void;
```

Add to destructured props and add a `?` button in the right-side actions group (before the publish button):

```typescript
{onShowShortcuts && (
  <button
    onClick={onShowShortcuts}
    className="hidden sm:inline-flex px-2 py-1.5 text-xs text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-md transition-colors border border-zinc-700"
    aria-label="Keyboard shortcuts"
    title="Keyboard shortcuts (?)"
  >
    ?
  </button>
)}
```

- [ ] **Step 3: Wire shortcuts into `edit/page.tsx`**

Add state and `activeEditRef`:

```typescript
const [showShortcuts, setShowShortcuts] = useState(false);
const activeEditRef = useRef<{ blockId: string; doc: Document } | null>(null);
```

In `startEditing`, set `activeEditRef` when editing starts (add after `el.focus()`):

```typescript
activeEditRef.current = { blockId, doc };
```

In `handleBlur` (inside `startEditing`), clear it:

```typescript
activeEditRef.current = null;
```

Add `forceSave` callback (place near other callbacks, after `usePresence`):

```typescript
const forceSave = useCallback(() => {
  clearTimeout(saveTimerRef.current);
  const active = activeEditRef.current;
  if (active) saveBlockContent(active.blockId, active.doc);
}, [saveBlockContent]);
```

Mount `KeyboardShortcuts` in the return JSX (inside the outer `<div>`, after `ToastContainer`):

```typescript
import KeyboardShortcuts from '@/components/editor/keyboard-shortcuts';

// In JSX:
<KeyboardShortcuts
  onForceSave={forceSave}
  onToggleSections={() => setShowSections((v) => !v)}
  onToggleShortcuts={() => setShowShortcuts((v) => !v)}
  showOverlay={showShortcuts}
/>
```

Pass `onShowShortcuts` to `EditorToolbar`:

```typescript
onShowShortcuts={() => setShowShortcuts((v) => !v)}
```

- [ ] **Step 4: Type-check + build**

```bash
cd "C:/Users/owenq/OneDrive/Documents/N8N Automation" && npx tsc --noEmit 2>&1 | tail -15
```

Expected: no errors. Then:

```bash
npm run build 2>&1 | tail -20
```

Expected: `Compiled successfully` or `✓ Compiled`.

- [ ] **Step 5: Commit**

```bash
git add src/components/editor/keyboard-shortcuts.tsx src/components/editor/editor-toolbar.tsx src/app/p/[slug]/edit/page.tsx
git commit -m "feat(editor): keyboard shortcuts — Ctrl+S, Ctrl+/, Esc, ? overlay (U3)

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task A6: Batch A QA + Security Pass

- [ ] **Step 1: Full build**

```bash
cd "C:/Users/owenq/OneDrive/Documents/N8N Automation" && npm run build 2>&1 | tail -20
```

Expected: zero errors, zero TypeScript complaints.

- [ ] **Step 2: Security review (dispatch Security Engineer subagent)**

Review these files for auth, XSS, and input-handling issues:
- `src/app/p/[slug]/edit/page.tsx` — U1 `navigator.clipboard` call (confirm it's client-only), U12 retry closure captures correct `blockId`/`doc`
- `src/components/editor/keyboard-shortcuts.tsx` — event listener cleanup, no eval, no dynamic imports

- [ ] **Step 3: QA regression checklist**

Manually verify:
- [ ] Save dot pulses amber while saving → turns green with "Xm ago" on success
- [ ] Save error shows "Save failed — click to retry." toast that persists (no auto-dismiss) with a Retry button that triggers re-save
- [ ] After publishing: toast says "Proposal published — anyone with the link can view it." + "Copy link" button copies the correct URL
- [ ] `?` opens shortcut overlay with all 4 shortcuts listed
- [ ] `Esc` closes overlay
- [ ] `Ctrl+S` in a browser tab forces an immediate save (no debounce wait)
- [ ] `Ctrl+/` toggles sections panel

- [ ] **Step 4: Push Batch A to GitHub**

```bash
cd "C:/Users/owenq/OneDrive/Documents/N8N Automation" && git push origin main
```

---

## BATCH B — Editor Completeness

### Task B1: U13 — Export progress + error handling

**Files:**
- Modify: `src/components/editor/editor-toolbar.tsx`
- Modify: `src/app/p/[slug]/edit/page.tsx`

- [ ] **Step 1: Add `isExporting` state + `onExportError` prop to toolbar**

In `editor-toolbar.tsx`, add to `EditorToolbarProps`:

```typescript
onExportError?: () => void;
```

Add to destructured props. Add local state (inside the component, after `showPublishDialog`):

```typescript
const [isExporting, setIsExporting] = useState(false);
```

- [ ] **Step 2: Replace `handleExport` with error-handling version**

Replace the existing `handleExport` function (lines 54–67):

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

- [ ] **Step 3: Update the Export HTML button**

Replace the existing static Export HTML button (lines 192–199) with:

```typescript
{proposalId && (
  <button
    onClick={handleExport}
    disabled={isExporting}
    className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-700 rounded-md transition-colors border border-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed"
  >
    {isExporting ? (
      <>
        <span className="w-3 h-3 border-2 border-zinc-400 border-t-transparent rounded-full animate-spin" aria-hidden="true" />
        Exporting…
      </>
    ) : (
      'Export HTML'
    )}
  </button>
)}
```

- [ ] **Step 4: Wire `onExportError` in `edit/page.tsx`**

In the `<EditorToolbar ...>` JSX, add:

```typescript
onExportError={() => showToast('Export failed. Please try again.', 'error')}
```

- [ ] **Step 5: Type-check + build**

```bash
cd "C:/Users/owenq/OneDrive/Documents/N8N Automation" && npx tsc --noEmit 2>&1 | tail -10 && npm run build 2>&1 | tail -10
```

Expected: no errors on both.

- [ ] **Step 6: Commit**

```bash
git add src/components/editor/editor-toolbar.tsx src/app/p/[slug]/edit/page.tsx
git commit -m "fix(editor): export spinner + error toast — no more silent failure (U13)

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task B2: U2 — Block-level undo (Ctrl+Z)

**Files:**
- Modify: `src/app/p/[slug]/edit/page.tsx`

- [ ] **Step 1: Add undo stack ref + `snapshotEl` helper**

In `edit/page.tsx`, after `iframeRef` is declared, add:

```typescript
const undoStackRef = useRef<Map<string, string[]>>(new Map());
```

Add the `snapshotEl` helper function inside the component body (above `makeEditable` — it will be used there):

```typescript
/**
 * Serializes an editable element's inner structure as an HTML string,
 * stripping editor-injected attributes so snapshots are clean.
 * The result is controlled/trusted — only our own serialized content.
 */
function snapshotEl(el: HTMLElement): string {
  const clone = el.cloneNode(true) as HTMLElement;
  clone.removeAttribute('contenteditable');
  clone.removeAttribute('data-editable');
  clone.classList.remove('editing');
  // Read-only serialization — safe
  return clone.getInnerHTML?.() ?? new XMLSerializer().serializeToString(clone).replace(/^<[^>]+>|<\/[^>]+>$/g, '');
}
```

Note: `getInnerHTML()` is a Chrome 125+ DOM API. For broader compat, use `XMLSerializer` or strip outer tag from `outerHTML`:

```typescript
function snapshotEl(el: HTMLElement): string {
  const clone = el.cloneNode(true) as HTMLElement;
  clone.removeAttribute('contenteditable');
  clone.removeAttribute('data-editable');
  clone.classList.remove('editing');
  const outer = clone.outerHTML;
  // Strip the outer tag: <tag ...>CONTENT</tag> → CONTENT
  return outer.replace(/^<[^>]*>/, '').replace(/<\/[^>]+>$/, '');
}
```

- [ ] **Step 2: Capture initial snapshot in `startEditing`**

In `startEditing`, immediately after `el.focus()` (around line 450), add:

```typescript
// Capture starting state for Ctrl+Z
undoStackRef.current.set(blockId, [snapshotEl(el)]);
```

- [ ] **Step 3: Push snapshot on input in `makeEditable`**

In `makeEditable`, inside the existing `input` event listener (after `setTyping(true)`), add:

```typescript
// Capture undo snapshot on each input (deduplicated)
const stack = undoStackRef.current.get(blockId) ?? [];
const current = snapshotEl(el);
if (stack[stack.length - 1] !== current) {
  stack.push(current);
  if (stack.length > 20) stack.shift();
  undoStackRef.current.set(blockId, stack);
}
```

- [ ] **Step 4: Handle Ctrl+Z in the keydown handler inside `startEditing`**

Locate `handleKeydown` inside `startEditing`. Add before the existing `Enter`/`Escape` handling:

```typescript
// Ctrl/Cmd+Z — undo last snapshot
if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
  e.preventDefault();
  const stack = undoStackRef.current.get(blockId);
  if (stack && stack.length > 1) {
    stack.pop(); // discard current state
    const prev = stack[stack.length - 1];
    // Restore by parsing our own snapshot into a sandboxed temp node
    const temp = el.ownerDocument.createElement('div');
    // Controlled source — our own serialized snapshot
    temp.setAttribute('data-undo-restore', 'true');
    temp.textContent = ''; // clear first
    const parser = new el.ownerDocument.defaultView!.DOMParser();
    const parsed = parser.parseFromString(`<body>${prev}</body>`, 'text/html');
    el.replaceChildren(...Array.from(parsed.body.childNodes));
    undoStackRef.current.set(blockId, stack);
  }
  return;
}
```

- [ ] **Step 5: Clear stack on blur**

In `handleBlur` inside `startEditing`, add after `saveBlockContent`:

```typescript
undoStackRef.current.delete(blockId); // free memory
```

- [ ] **Step 6: Type-check**

```bash
cd "C:/Users/owenq/OneDrive/Documents/N8N Automation" && npx tsc --noEmit 2>&1 | tail -10
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/app/p/[slug]/edit/page.tsx
git commit -m "feat(editor): block-level Ctrl+Z undo, 20-step per-block history (U2)

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task B3: U5 — Empty block guard

**Files:**
- Modify: `src/app/p/[slug]/edit/page.tsx`

- [ ] **Step 1: Locate `saveBlockContent` and find where stripping happens**

Read `saveBlockContent` in `edit/page.tsx`. Find the line where the block HTML is processed/stripped of editor attributes. The stripped HTML string will be assigned to a local variable (likely `strippedHtml`, `cleanedHtml`, or similar) before being sent to `PATCH /api/blocks/:id`.

- [ ] **Step 2: Add empty-content guard after the strip step**

Immediately after the strip assignment, add:

```typescript
// Guard: if the block is now empty, do not save — restore and warn instead
const visibleText = strippedHtml.replace(/<[^>]+>/g, '').trim();
if (!visibleText) {
  showToast(
    'Block is empty — content not saved. Add text to keep changes.',
    'warning'
  );
  // Restore the element from last saved state in React state
  const savedBlock = blocks.find((b) => b.id === blockId);
  if (savedBlock && iframeRef.current?.contentDocument) {
    const target = iframeRef.current.contentDocument.querySelector(
      `[data-editable][data-block-id-ref="${blockId}"]`
    ) as HTMLElement | null;
    if (target) {
      // Parse our own DB-sourced HTML via a sandboxed temp node
      const temp = iframeRef.current.contentDocument.createElement('div');
      const parser = new iframeRef.current.contentWindow!.DOMParser();
      const parsed = parser.parseFromString(
        `<body>${savedBlock.current_html}</body>`,
        'text/html'
      );
      target.replaceChildren(...Array.from(parsed.body.childNodes));
    }
  }
  setSaveStatus('idle');
  return;
}
```

Replace `strippedHtml` with the actual variable name you found in Step 1.

- [ ] **Step 3: Type-check + build**

```bash
cd "C:/Users/owenq/OneDrive/Documents/N8N Automation" && npx tsc --noEmit 2>&1 | tail -10 && npm run build 2>&1 | tail -10
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/p/[slug]/edit/page.tsx
git commit -m "fix(editor): guard against saving empty block content (U5)

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task B4: Batch B QA + Security Pass

- [ ] **Step 1: Full build**

```bash
cd "C:/Users/owenq/OneDrive/Documents/N8N Automation" && npm run build 2>&1 | tail -20
```

- [ ] **Step 2: Security review (dispatch Security Engineer subagent)**

Review `edit/page.tsx` undo restore and empty block restore patterns. Confirm:
- Undo restore uses `DOMParser` within the iframe's `contentWindow` — sandboxed
- Restore source is always from `blocks` React state (DB-sourced, already stored) — not raw user input
- No eval, no direct string concatenation into live DOM outside DOMParser

- [ ] **Step 3: QA regression checklist**

- [ ] Export button shows spinner while downloading, then reverts to "Export HTML"
- [ ] Simulated export failure (disconnect network, trigger export) shows "Export failed. Please try again." error toast
- [ ] Type text in a block → press Ctrl+Z → previous text is restored with inline formatting (bold, spans) intact
- [ ] Pressing Ctrl+Z at the initial state does nothing (no crash, no corruption)
- [ ] Delete all text from a block → blur → warning toast appears, block restores its previous content
- [ ] Normal save still works after the empty-block guard check

- [ ] **Step 4: Push Batch B to GitHub**

```bash
cd "C:/Users/owenq/OneDrive/Documents/N8N Automation" && git push origin main
```

---

## BATCH C — Dashboard Polish

### Task C1: U9 — Sort options

**Files:**
- Modify: `src/components/dashboard/proposal-grid.tsx`

- [ ] **Step 1: Add sort state and updated `useMemo`**

Open `proposal-grid.tsx`. Add after `statusFilter` state:

```typescript
type SortKey = 'newest' | 'oldest' | 'title-az';
const [sortKey, setSortKey] = useState<SortKey>('newest');
```

Replace the existing `filtered` `useMemo` with one that filters **and** sorts:

```typescript
const displayed = useMemo(() => {
  const q = search.toLowerCase().trim();
  const list = proposals.filter((p) => {
    const matchesSearch = !q || p.title.toLowerCase().includes(q);
    const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  switch (sortKey) {
    case 'oldest':
      return [...list].sort((a, b) => a.created_at.localeCompare(b.created_at));
    case 'title-az':
      return [...list].sort((a, b) => a.title.localeCompare(b.title));
    default: // newest
      return [...list].sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  }
}, [proposals, search, statusFilter, sortKey]);
```

Update all references from `filtered` to `displayed` in the JSX (empty-state check, grid render, result count).

- [ ] **Step 2: Add sort dropdown to filter bar**

In the filter bar `<div>` (the `flex flex-col sm:flex-row gap-3 mb-6` container), add a sort `<select>` after the status filter buttons `<div>`:

```typescript
<select
  value={sortKey}
  onChange={(e) => setSortKey(e.target.value as SortKey)}
  className="px-3 py-1.5 text-xs rounded-lg border bg-white border-gray-200 text-gray-600 font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-colors"
  aria-label="Sort proposals"
>
  <option value="newest">Newest first</option>
  <option value="oldest">Oldest first</option>
  <option value="title-az">Title A→Z</option>
</select>
```

- [ ] **Step 3: Type-check**

```bash
cd "C:/Users/owenq/OneDrive/Documents/N8N Automation" && npx tsc --noEmit 2>&1 | tail -10
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/dashboard/proposal-grid.tsx
git commit -m "feat(dashboard): sort options — Newest, Oldest, Title A-Z (U9)

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task C2: U7 — Bulk actions (select + delete/publish)

**Files:**
- Modify: `src/components/dashboard/proposal-grid.tsx`
- Modify: `src/components/dashboard/proposal-card.tsx`

- [ ] **Step 1: Add bulk state to `proposal-grid.tsx`**

After `sortKey` state, add:

```typescript
const [bulkMode, setBulkMode]     = useState(false);
const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
const [bulkWorking, setBulkWorking] = useState(false);
const router = useRouter(); // add import: import { useRouter } from 'next/navigation';
```

Add a toggle helper:

```typescript
function toggleSelect(id: string) {
  setSelectedIds((prev) => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });
}

function exitBulkMode() {
  setBulkMode(false);
  setSelectedIds(new Set());
}
```

- [ ] **Step 2: Add bulk delete and publish handlers**

```typescript
async function handleBulkDelete() {
  if (selectedIds.size === 0 || bulkWorking) return;
  setBulkWorking(true);
  await Promise.all(
    Array.from(selectedIds).map((id) =>
      fetch(`/api/proposals/${id}`, { method: 'DELETE' })
    )
  );
  setBulkWorking(false);
  exitBulkMode();
  router.refresh();
}

async function handleBulkPublish() {
  if (selectedIds.size === 0 || bulkWorking) return;
  setBulkWorking(true);
  await Promise.all(
    Array.from(selectedIds).map((id) =>
      fetch(`/api/proposals/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'published' }),
      })
    )
  );
  setBulkWorking(false);
  exitBulkMode();
  router.refresh();
}
```

- [ ] **Step 3: Add "Select" toggle button to filter bar**

In the filter bar, add a "Select" toggle button before the status filter buttons:

```typescript
<button
  onClick={() => { setBulkMode((v) => !v); setSelectedIds(new Set()); }}
  className={`px-3 py-1.5 text-xs rounded-lg border transition-colors font-medium ${
    bulkMode
      ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
      : 'bg-white border-gray-200 text-gray-500 hover:text-gray-900 hover:border-gray-300 shadow-sm'
  }`}
>
  {bulkMode ? 'Cancel' : 'Select'}
</button>
```

- [ ] **Step 4: Pass bulk props to `ProposalCard`**

In the grid map, pass selection props when `bulkMode` is active:

```typescript
<ProposalCard
  key={proposal.id}
  proposal={proposal}
  blockCount={proposal.content_blocks?.length || 0}
  isSelected={bulkMode ? selectedIds.has(proposal.id) : undefined}
  onToggleSelect={bulkMode ? toggleSelect : undefined}
/>
```

- [ ] **Step 5: Add bulk action bar (sticky bottom)**

After the grid / empty-state block, add the action bar:

```typescript
{bulkMode && selectedIds.size > 0 && (
  <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-zinc-900 border border-zinc-700 rounded-xl px-5 py-3 shadow-2xl">
    <span className="text-sm text-zinc-300 font-medium">
      {selectedIds.size} selected
    </span>
    <button
      onClick={handleBulkPublish}
      disabled={bulkWorking}
      className="px-3 py-1.5 text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white rounded-md transition-colors disabled:opacity-50"
    >
      Publish
    </button>
    <button
      onClick={handleBulkDelete}
      disabled={bulkWorking}
      className="px-3 py-1.5 text-xs font-medium bg-red-700 hover:bg-red-600 text-white rounded-md transition-colors disabled:opacity-50"
    >
      {bulkWorking ? 'Working…' : 'Delete'}
    </button>
    <button onClick={exitBulkMode} className="text-xs text-zinc-400 hover:text-white transition-colors">
      Cancel
    </button>
  </div>
)}
```

- [ ] **Step 6: Update `ProposalCard` to accept selection props**

Open `src/components/dashboard/proposal-card.tsx`. Add to the props interface:

```typescript
isSelected?: boolean;
onToggleSelect?: (id: string) => void;
```

Add to the destructured props. Inside the card's outer `<div>` (the one with `relative group`), add a checkbox overlay at the top:

```typescript
{onToggleSelect && (
  <button
    onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggleSelect(proposal.id); }}
    className={`absolute top-2 left-2 z-10 w-5 h-5 rounded border-2 transition-colors flex items-center justify-center ${
      isSelected
        ? 'bg-blue-600 border-blue-600 text-white'
        : 'bg-white border-gray-300 hover:border-blue-400'
    }`}
    aria-label={isSelected ? 'Deselect proposal' : 'Select proposal'}
    aria-pressed={isSelected}
  >
    {isSelected && (
      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 12 12">
        <path d="M10 3L5 8.5 2 5.5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )}
  </button>
)}
```

Also add a visual ring to the card when selected:

```typescript
// On the outer card div, add a conditional ring class:
className={`... ${isSelected ? 'ring-2 ring-blue-500' : ''}`}
```

- [ ] **Step 7: Type-check + build**

```bash
cd "C:/Users/owenq/OneDrive/Documents/N8N Automation" && npx tsc --noEmit 2>&1 | tail -10 && npm run build 2>&1 | tail -10
```

Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add src/components/dashboard/proposal-grid.tsx src/components/dashboard/proposal-card.tsx
git commit -m "feat(dashboard): bulk select + delete/publish actions (U7)

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task C3: Batch C QA + Security Pass

- [ ] **Step 1: Full build**

```bash
cd "C:/Users/owenq/OneDrive/Documents/N8N Automation" && npm run build 2>&1 | tail -20
```

- [ ] **Step 2: Security review (dispatch Security Engineer subagent)**

Review `proposal-grid.tsx` bulk handlers:
- Both `handleBulkDelete` and `handleBulkPublish` call existing endpoints that enforce `eq('created_by', user.id)` ownership — confirm this is actually enforced by reading `src/app/api/proposals/[id]/route.ts` PATCH + DELETE handlers
- Confirm `Promise.all` cannot be weaponized (each call is authed independently server-side)
- Confirm `router.refresh()` doesn't expose stale data

- [ ] **Step 3: QA regression checklist**

- [ ] Proposals sort correctly by Newest / Oldest / Title A→Z; sort persists while filtering
- [ ] Search + sort + status filter work simultaneously
- [ ] "Select" button activates bulk mode; clicking a card checkbox selects/deselects it
- [ ] Sticky action bar appears with count when ≥1 selected
- [ ] Bulk delete removes selected proposals and refreshes grid
- [ ] Bulk publish marks selected proposals as published and refreshes grid
- [ ] "Cancel" exits bulk mode and clears selection
- [ ] Dashboard still works when there are zero proposals (empty state visible)

- [ ] **Step 4: Push Batch C to GitHub**

```bash
cd "C:/Users/owenq/OneDrive/Documents/N8N Automation" && git push origin main
```

---

## BATCH D — Analytics

### Task D1: Supabase migration — `proposal_views` + RPC

**Files:**
- Supabase SQL migration (run in Supabase dashboard or via MCP `apply_migration`)

- [ ] **Step 1: Run this migration in Supabase**

```sql
-- Migration: create proposal_views table
create table if not exists proposal_views (
  id            uuid primary key default gen_random_uuid(),
  proposal_id   uuid not null references proposals(id) on delete cascade,
  viewed_at     timestamptz not null default now(),
  viewer_ip     text,
  is_unique     boolean not null default true
);

create index if not exists proposal_views_proposal_id_idx
  on proposal_views(proposal_id);

create index if not exists proposal_views_viewed_at_idx
  on proposal_views(viewed_at);

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

-- RPC: aggregate view stats per proposal for a given owner
create or replace function get_proposal_view_stats(owner_id uuid)
returns table (
  proposal_id   uuid,
  total_views   bigint,
  unique_views  bigint,
  last_viewed_at timestamptz
)
language sql
security definer
as $$
  select
    pv.proposal_id,
    count(*)                                   as total_views,
    count(*) filter (where pv.is_unique = true) as unique_views,
    max(pv.viewed_at)                          as last_viewed_at
  from proposal_views pv
  where pv.proposal_id = any(
    select id from proposals where created_by = owner_id
  )
  group by pv.proposal_id;
$$;
```

- [ ] **Step 2: Verify in Supabase dashboard**

Confirm `proposal_views` table exists with correct columns. Confirm `get_proposal_view_stats` function is listed under Database → Functions.

---

### Task D2: `record-view.ts` server utility

**Files:**
- Create: `src/lib/analytics/record-view.ts`

- [ ] **Step 1: Create the file**

```typescript
// src/lib/analytics/record-view.ts
import { createClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';

// Uses service role to bypass RLS — server-only, never imported by client components
const serviceClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Records a proposal view. Deduplicates by hashed IP within a 24-hour window.
 * Uses SHA-256(ip + YYYY-MM-DD) — not reversible, not raw PII.
 * Call with `void recordView(...)` — fire-and-forget, never await in render path.
 */
export async function recordView(proposalId: string, rawIp: string): Promise<void> {
  try {
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

    await serviceClient.from('proposal_views').insert({
      proposal_id: proposalId,
      viewer_ip: hashedIp,
      is_unique: true,
    });
  } catch {
    // Never throw — this must not break the page render
  }
}
```

- [ ] **Step 2: Add `SUPABASE_SERVICE_ROLE_KEY` to environment**

Confirm `SUPABASE_SERVICE_ROLE_KEY` exists in `.env.local`. If not, add it (get value from Supabase dashboard → Settings → API → service_role secret). This key must **never** appear in any client-side file or be prefixed with `NEXT_PUBLIC_`.

- [ ] **Step 3: Type-check**

```bash
cd "C:/Users/owenq/OneDrive/Documents/N8N Automation" && npx tsc --noEmit 2>&1 | tail -10
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/analytics/record-view.ts
git commit -m "feat(analytics): server-side view tracking with hashed IP dedup (D)

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task D3: Stats API route

**Files:**
- Create: `src/app/api/proposals/[id]/stats/route.ts`

- [ ] **Step 1: Create the route**

```typescript
// src/app/api/proposals/[id]/stats/route.ts
import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
} as const;

async function getSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(list) {
          list.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        },
      },
    }
  );
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await getSupabase();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: SECURITY_HEADERS });
  }

  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: 'Invalid ID' }, { status: 400, headers: SECURITY_HEADERS });
  }

  // Ownership check before returning analytics
  const { data: proposal } = await supabase
    .from('proposals')
    .select('id')
    .eq('id', id)
    .eq('created_by', user.id)
    .maybeSingle();

  if (!proposal) {
    return NextResponse.json({ error: 'Not found or forbidden' }, { status: 404, headers: SECURITY_HEADERS });
  }

  const { data: views } = await supabase
    .from('proposal_views')
    .select('is_unique, viewed_at')
    .eq('proposal_id', id)
    .order('viewed_at', { ascending: false });

  const rows = views ?? [];
  const totalViews  = rows.length;
  const uniqueViews = rows.filter((r) => r.is_unique).length;
  const lastViewedAt = rows[0]?.viewed_at ?? null;

  return NextResponse.json(
    { total_views: totalViews, unique_views: uniqueViews, last_viewed_at: lastViewedAt },
    { headers: SECURITY_HEADERS }
  );
}
```

- [ ] **Step 2: Type-check**

```bash
cd "C:/Users/owenq/OneDrive/Documents/N8N Automation" && npx tsc --noEmit 2>&1 | tail -10
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/proposals/[id]/stats/route.ts
git commit -m "feat(api): GET /api/proposals/:id/stats — view count + last viewed (D)

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task D4: Wire view recording into public page + dashboard

**Files:**
- Modify: `src/app/p/[slug]/page.tsx`
- Modify: `src/app/page.tsx`
- Modify: `src/components/dashboard/proposal-card.tsx`

- [ ] **Step 1: Fire-and-forget view recording in public page**

Open `src/app/p/[slug]/page.tsx`. Add imports:

```typescript
import { headers } from 'next/headers';
import { recordView } from '@/lib/analytics/record-view';
```

After fetching `proposal` (and after the `notFound()` guard), add:

```typescript
// Record view — non-blocking, must not delay page render
const hdrs = await headers();
const rawIp = hdrs.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '';
void recordView(proposal.id, rawIp);
```

- [ ] **Step 2: Add `ViewStats` type to `src/lib/types.ts`**

```typescript
export interface ViewStats {
  total_views: number;
  unique_views: number;
  last_viewed_at: string | null;
}
```

- [ ] **Step 3: Fetch stats in dashboard server component**

Open `src/app/page.tsx`. After fetching proposals, call the Supabase RPC:

```typescript
import type { ViewStats } from '@/lib/types';

// After fetching proposals and user:
const { data: statsRows } = await supabase.rpc('get_proposal_view_stats', {
  owner_id: user.id,
});

const statsMap = new Map<string, ViewStats>(
  (statsRows ?? []).map((r: { proposal_id: string; total_views: number; unique_views: number; last_viewed_at: string | null }) => [
    r.proposal_id,
    {
      total_views: Number(r.total_views),
      unique_views: Number(r.unique_views),
      last_viewed_at: r.last_viewed_at,
    },
  ])
);
```

Pass stats to `ProposalGrid` (or directly to each card via the grid component). Add `statsMap` as a prop on `ProposalGrid`:

```typescript
<ProposalGrid proposals={proposals} viewStatsMap={statsMap} />
```

Update `ProposalGrid`'s props interface:

```typescript
viewStatsMap?: Map<string, ViewStats>;
```

Pass the relevant stat to each `ProposalCard`:

```typescript
<ProposalCard
  ...
  viewStats={viewStatsMap?.get(proposal.id)}
/>
```

- [ ] **Step 4: Render view stats on `ProposalCard`**

Open `src/components/dashboard/proposal-card.tsx`. Add to props:

```typescript
viewStats?: ViewStats;
```

Import `formatRelativeTime`:

```typescript
import { formatRelativeTime } from '@/lib/utils/format-time';
import type { ViewStats } from '@/lib/types';
```

In the card footer (after block count / date), add:

```typescript
{viewStats && proposal.status === 'published' && (
  <span className="flex items-center gap-1 text-xs text-gray-400" title={`${viewStats.total_views} total views`}>
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.641 0-8.574-3.007-9.964-7.178z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
    {viewStats.unique_views}
    {viewStats.last_viewed_at && (
      <> · {formatRelativeTime(new Date(viewStats.last_viewed_at))}</>
    )}
  </span>
)}
```

- [ ] **Step 5: Type-check + build**

```bash
cd "C:/Users/owenq/OneDrive/Documents/N8N Automation" && npx tsc --noEmit 2>&1 | tail -15 && npm run build 2>&1 | tail -15
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/app/p/[slug]/page.tsx src/app/page.tsx src/components/dashboard/proposal-card.tsx src/lib/types.ts
git commit -m "feat(analytics): proposal view count + last-viewed date on dashboard cards (U8+U11)

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task D5: Batch D QA + Security Pass

- [ ] **Step 1: Full build**

```bash
cd "C:/Users/owenq/OneDrive/Documents/N8N Automation" && npm run build 2>&1 | tail -20
```

- [ ] **Step 2: Security review (dispatch Security Engineer subagent)**

Review:
- `record-view.ts`: confirm `SUPABASE_SERVICE_ROLE_KEY` is server-only (no `NEXT_PUBLIC_` prefix), never imported from client components
- `/stats` route: UUID validation present, ownership check enforced, no direct SQL injection surface
- `get_proposal_view_stats` RPC uses `security definer` — confirm this is appropriate (it queries `proposals` owned by the passed `owner_id`; the RLS on `proposal_views` further restricts reads)
- Hashed IP: SHA-256 output is hex, never stored as raw IP — compliant with minimal PII principle

- [ ] **Step 3: QA regression checklist**

- [ ] Visit a published proposal public URL → view is recorded (check Supabase table)
- [ ] Visit twice with same simulated IP + same day → only one unique row inserted
- [ ] Dashboard card for a published proposal shows `👁 N` view count + "Viewed Xm ago"
- [ ] Dashboard card for a draft proposal shows no view count
- [ ] Stats API returns 401 for unauthenticated request
- [ ] Stats API returns 404 when requesting stats for another user's proposal

- [ ] **Step 4: Push Batch D to GitHub**

```bash
cd "C:/Users/owenq/OneDrive/Documents/N8N Automation" && git push origin main
```

---

## BATCH E — Client Flow

### Task E1: Supabase migration — `proposal_acceptances`

- [ ] **Step 1: Run this migration in Supabase**

```sql
create table if not exists proposal_acceptances (
  id            uuid primary key default gen_random_uuid(),
  proposal_id   uuid not null references proposals(id) on delete cascade,
  client_name   text not null check (char_length(client_name) between 1 and 120),
  client_email  text,
  accepted_at   timestamptz not null default now(),
  ip_address    text  -- SHA-256(ip + date) — not raw PII
);

-- One acceptance per proposal maximum
create unique index if not exists one_acceptance_per_proposal
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

- [ ] **Step 2: Add `ProposalAcceptance` to `src/lib/types.ts`**

```typescript
export interface ProposalAcceptance {
  id: string;
  proposal_id: string;
  client_name: string;
  client_email: string | null;
  accepted_at: string;
  // ip_address intentionally excluded — server-only field, never sent to client
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/types.ts
git commit -m "feat(types): add ProposalAcceptance interface (E)

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task E2: Resend email utility

**Files:**
- Create: `src/lib/email/send-acceptance-notification.ts`

- [ ] **Step 1: Confirm dependencies are installed**

```bash
cd "C:/Users/owenq/OneDrive/Documents/N8N Automation" && npm list resend @supabase/supabase-js 2>&1 | head -6
```

If `resend` is not listed: `npm install resend`

If `@supabase/supabase-js` is not listed (it may be a transitive dep of `@supabase/ssr`): `npm install @supabase/supabase-js`

Both are needed — `resend` for email, `@supabase/supabase-js` for the service-role client used in `record-view.ts` and `accept/route.ts`.

- [ ] **Step 2: Create the utility**

```typescript
// src/lib/email/send-acceptance-notification.ts
// SERVER-ONLY — never import this file from client components

import { Resend } from 'resend';

interface AcceptanceEmailParams {
  ownerEmail: string;
  clientName: string;
  proposalTitle: string;
  proposalSlug: string;
}

/**
 * Sends an email notification to the proposal owner when a client accepts.
 * Call with `void sendAcceptanceNotification(...)` — fire-and-forget.
 */
export async function sendAcceptanceNotification({
  ownerEmail,
  clientName,
  proposalTitle,
  proposalSlug,
}: AcceptanceEmailParams): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn('[sendAcceptanceNotification] RESEND_API_KEY not set — skipping email');
    return;
  }

  const resend = new Resend(apiKey);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://designshopp.app';
  const editUrl = `${appUrl}/p/${proposalSlug}/edit`;

  await resend.emails.send({
    from: 'Proposal Studio <notifications@designshopp.app>',
    to: ownerEmail,
    subject: `${clientName} accepted "${proposalTitle}"`,
    html: `
      <p>Hi,</p>
      <p><strong>${clientName}</strong> just accepted your proposal <em>${proposalTitle}</em>.</p>
      <p><a href="${editUrl}">View proposal →</a></p>
      <hr />
      <p style="font-size:12px;color:#888">Sent by Proposal Studio · Design Shopp</p>
    `,
  });
}
```

- [ ] **Step 3: Add `RESEND_API_KEY` and `NEXT_PUBLIC_APP_URL` to `.env.local`**

Add if missing:
```
RESEND_API_KEY=re_your_key_here
NEXT_PUBLIC_APP_URL=https://your-vercel-domain.vercel.app
```

- [ ] **Step 4: Type-check**

```bash
cd "C:/Users/owenq/OneDrive/Documents/N8N Automation" && npx tsc --noEmit 2>&1 | tail -10
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/email/send-acceptance-notification.ts
git commit -m "feat(email): proposal acceptance notification via Resend (E)

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task E3: Accept API route

**Files:**
- Create: `src/app/api/proposals/[id]/accept/route.ts`

- [ ] **Step 1: Create the route**

```typescript
// src/app/api/proposals/[id]/accept/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';
import { sendAcceptanceNotification } from '@/lib/email/send-acceptance-notification';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
} as const;

// In-memory rate limiter: { ip_date → attempt_count }
// Resets on server redeploy — intentional for lightweight abuse prevention
const rateLimitMap = new Map<string, number>();

const serviceClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404, headers: SECURITY_HEADERS });
  }

  // Rate limit: 3 attempts per IP per day
  const rawIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const today = new Date().toISOString().slice(0, 10);
  const rateLimitKey = `${rawIp}:${today}`;
  const attempts = rateLimitMap.get(rateLimitKey) ?? 0;
  if (attempts >= 3) {
    return NextResponse.json({ error: 'Too many attempts' }, { status: 429, headers: SECURITY_HEADERS });
  }
  rateLimitMap.set(rateLimitKey, attempts + 1);

  // Parse + validate body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400, headers: SECURITY_HEADERS });
  }

  if (typeof body !== 'object' || body === null) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 422, headers: SECURITY_HEADERS });
  }

  const { client_name, client_email } = body as Record<string, unknown>;

  if (typeof client_name !== 'string' || client_name.trim().length < 1 || client_name.trim().length > 120) {
    return NextResponse.json(
      { error: 'client_name is required and must be 1–120 characters' },
      { status: 422, headers: SECURITY_HEADERS }
    );
  }

  if (client_email !== undefined && client_email !== null && client_email !== '') {
    if (typeof client_email !== 'string' || !EMAIL_RE.test(client_email)) {
      return NextResponse.json({ error: 'client_email must be a valid email address' }, { status: 422, headers: SECURITY_HEADERS });
    }
  }

  // Verify proposal is published — return 404 for both non-existent and non-published
  // to avoid leaking which proposal IDs exist
  const { data: proposal } = await serviceClient
    .from('proposals')
    .select('id, title, slug, created_by_email')
    .eq('id', id)
    .eq('status', 'published')
    .maybeSingle();

  if (!proposal) {
    return NextResponse.json({ error: 'Not found' }, { status: 404, headers: SECURITY_HEADERS });
  }

  // Hash IP for storage — not raw PII
  const hashedIp = createHash('sha256').update(`${rawIp}:${today}`).digest('hex');

  // Insert — unique index on proposal_id enforces one-acceptance-per-proposal
  const { error: insertError } = await serviceClient
    .from('proposal_acceptances')
    .insert({
      proposal_id: id,
      client_name: client_name.trim(),
      client_email: typeof client_email === 'string' && client_email.trim() ? client_email.trim() : null,
      ip_address: hashedIp,
    });

  if (insertError) {
    // Unique constraint violation → already accepted
    if (insertError.code === '23505') {
      return NextResponse.json({ error: 'Already accepted' }, { status: 409, headers: SECURITY_HEADERS });
    }
    return NextResponse.json({ error: 'Server error' }, { status: 500, headers: SECURITY_HEADERS });
  }

  const accepted_at = new Date().toISOString();

  // Fire-and-forget email — do not await, do not let failure block the response
  if (proposal.created_by_email) {
    void sendAcceptanceNotification({
      ownerEmail: proposal.created_by_email,
      clientName: client_name.trim(),
      proposalTitle: proposal.title,
      proposalSlug: proposal.slug,
    });
  }

  return NextResponse.json({ accepted_at }, { status: 201, headers: SECURITY_HEADERS });
}
```

- [ ] **Step 2: Type-check**

```bash
cd "C:/Users/owenq/OneDrive/Documents/N8N Automation" && npx tsc --noEmit 2>&1 | tail -10
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/proposals/[id]/accept/route.ts
git commit -m "feat(api): POST /api/proposals/:id/accept — client acceptance endpoint (E)

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task E4: `AcceptProposalButton` client component

**Files:**
- Create: `src/components/proposal/accept-proposal-button.tsx`

- [ ] **Step 1: Create the component**

```typescript
// src/components/proposal/accept-proposal-button.tsx
'use client';

import { useState } from 'react';
import type { ProposalAcceptance } from '@/lib/types';

type AcceptState = 'idle' | 'confirming' | 'submitting' | 'accepted' | 'already_accepted';

interface Props {
  proposalId: string;
  existingAcceptance?: ProposalAcceptance | null;
}

export default function AcceptProposalButton({ proposalId, existingAcceptance }: Props) {
  const [state, setState] = useState<AcceptState>(
    existingAcceptance ? 'already_accepted' : 'idle'
  );
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [acceptedInfo, setAcceptedInfo] = useState<{ name: string; at: string } | null>(
    existingAcceptance
      ? { name: existingAcceptance.client_name, at: existingAcceptance.accepted_at }
      : null
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!clientName.trim()) {
      setErrorMsg('Please enter your name.');
      return;
    }
    setState('submitting');
    setErrorMsg('');

    try {
      const res = await fetch(`/api/proposals/${proposalId}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_name: clientName.trim(),
          client_email: clientEmail.trim() || undefined,
        }),
      });

      if (res.status === 201) {
        const { accepted_at } = await res.json() as { accepted_at: string };
        setAcceptedInfo({ name: clientName.trim(), at: accepted_at });
        setState('accepted');
        return;
      }

      if (res.status === 409) {
        setState('already_accepted');
        return;
      }

      const { error } = await res.json() as { error?: string };
      setErrorMsg(error ?? 'Something went wrong. Please try again.');
      setState('confirming');
    } catch {
      setErrorMsg('Network error. Please try again.');
      setState('confirming');
    }
  }

  // Accepted / Already accepted state
  if (state === 'accepted' || state === 'already_accepted') {
    return (
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-emerald-950/95 border-t border-emerald-800 px-4 py-3 flex items-center justify-center gap-3">
        <svg className="w-5 h-5 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
        </svg>
        <p className="text-emerald-300 text-sm font-medium">
          {acceptedInfo
            ? `Accepted by ${acceptedInfo.name} on ${new Date(acceptedInfo.at).toLocaleDateString()}`
            : 'This proposal has been accepted.'}
        </p>
      </div>
    );
  }

  // Confirming / submitting state
  if (state === 'confirming' || state === 'submitting') {
    return (
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 px-4 py-4 shadow-2xl">
        <form onSubmit={handleSubmit} className="max-w-md mx-auto flex flex-col gap-3">
          <p className="text-sm font-semibold text-gray-800">Confirm your acceptance</p>
          {errorMsg && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{errorMsg}</p>
          )}
          <input
            type="text"
            placeholder="Your full name *"
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            maxLength={120}
            required
            disabled={state === 'submitting'}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400"
          />
          <input
            type="email"
            placeholder="Email address (optional)"
            value={clientEmail}
            onChange={(e) => setClientEmail(e.target.value)}
            disabled={state === 'submitting'}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400"
          />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={state === 'submitting'}
              className="flex-1 py-2 text-sm font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {state === 'submitting' ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Confirming…
                </span>
              ) : (
                'Confirm acceptance'
              )}
            </button>
            <button
              type="button"
              onClick={() => setState('idle')}
              disabled={state === 'submitting'}
              className="px-4 py-2 text-sm text-gray-500 hover:text-gray-800 border border-gray-200 rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    );
  }

  // Idle state — CTA bar
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 px-4 py-3 flex items-center justify-center shadow-2xl">
      <button
        onClick={() => setState('confirming')}
        className="w-full max-w-md py-2.5 text-sm font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors shadow-sm"
      >
        Accept this Proposal →
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
cd "C:/Users/owenq/OneDrive/Documents/N8N Automation" && npx tsc --noEmit 2>&1 | tail -10
```

- [ ] **Step 3: Commit**

```bash
git add src/components/proposal/accept-proposal-button.tsx
git commit -m "feat(proposal): AcceptProposalButton CTA component — idle/confirm/accepted states (E)

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task E5: Wire acceptance into public page + dashboard card

**Files:**
- Modify: `src/app/p/[slug]/page.tsx`
- Modify: `src/components/dashboard/proposal-card.tsx`
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Mount `AcceptProposalButton` in public page**

Open `src/app/p/[slug]/page.tsx`. Add imports:

```typescript
import AcceptProposalButton from '@/components/proposal/accept-proposal-button';
import type { ProposalAcceptance } from '@/lib/types';
```

After fetching blocks, fetch the existing acceptance:

```typescript
const { data: existingAcceptance } = await supabase
  .from('proposal_acceptances')
  .select('*')
  .eq('proposal_id', proposal.id)
  .maybeSingle<ProposalAcceptance>();
```

In the return JSX, after `<ProposalRenderer ...>`, add:

```typescript
<AcceptProposalButton
  proposalId={proposal.id}
  existingAcceptance={existingAcceptance}
/>
```

- [ ] **Step 2: Show accepted badge on dashboard card**

Open `src/components/dashboard/proposal-card.tsx`. Add `isAccepted?: boolean` and `acceptedBy?: string` to props. Pass from the grid.

In the card, replace the status badge when accepted:

```typescript
{isAccepted ? (
  <span
    className="text-xs px-2 py-0.5 rounded border bg-emerald-900/50 text-emerald-300 border-emerald-700 shrink-0"
    title={acceptedBy ? `Accepted by ${acceptedBy}` : 'Accepted'}
  >
    Accepted
  </span>
) : (
  <span className={`text-xs px-2 py-0.5 rounded border shrink-0 ${statusColors[proposal.status] || ''}`}>
    {proposal.status}
  </span>
)}
```

- [ ] **Step 3: Fetch acceptances in dashboard server component**

In `src/app/page.tsx`, after fetching proposals, add:

```typescript
const { data: acceptances } = await supabase
  .from('proposal_acceptances')
  .select('proposal_id, client_name')
  .in('proposal_id', proposals.map((p) => p.id));

const acceptanceMap = new Map<string, string>(
  (acceptances ?? []).map((a: { proposal_id: string; client_name: string }) => [
    a.proposal_id,
    a.client_name,
  ])
);
```

Pass to `ProposalGrid`:

```typescript
<ProposalGrid
  proposals={proposals}
  viewStatsMap={statsMap}
  acceptanceMap={acceptanceMap}
/>
```

In `ProposalGrid`'s props interface (`proposal-grid.tsx`), add:

```typescript
acceptanceMap?: Map<string, string>;
```

In `ProposalGrid`, pass to each card:

```typescript
<ProposalCard
  key={proposal.id}
  proposal={proposal}
  blockCount={proposal.content_blocks?.length || 0}
  isSelected={bulkMode ? selectedIds.has(proposal.id) : undefined}
  onToggleSelect={bulkMode ? toggleSelect : undefined}
  viewStats={viewStatsMap?.get(proposal.id)}
  isAccepted={acceptanceMap?.has(proposal.id) ?? false}
  acceptedBy={acceptanceMap?.get(proposal.id)}
/>
```

- [ ] **Step 4: Type-check + full build**

```bash
cd "C:/Users/owenq/OneDrive/Documents/N8N Automation" && npx tsc --noEmit 2>&1 | tail -15 && npm run build 2>&1 | tail -20
```

Expected: zero errors on both.

- [ ] **Step 5: Commit**

```bash
git add src/app/p/[slug]/page.tsx src/components/dashboard/proposal-card.tsx src/app/page.tsx
git commit -m "feat(proposal): wire client acceptance CTA into public page + accepted badge on dashboard (U10)

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task E6: Batch E QA + Security Pass (Full Regression)

- [ ] **Step 1: Full build**

```bash
cd "C:/Users/owenq/OneDrive/Documents/N8N Automation" && npm run build 2>&1 | tail -20
```

- [ ] **Step 2: Security review (dispatch Security Engineer subagent)**

Review `src/app/api/proposals/[id]/accept/route.ts`:
- No auth required — confirm this is intentional (public endpoint) and that the proposal must be `status = 'published'` before accepting
- UUID validation present at top before any DB call
- Rate limiter key uses raw IP + date — confirm in-memory Map cannot be bypassed (it can be via multiple server instances; acceptable for MVP)
- `client_name` and `client_email` validated before DB insert
- Unique index enforced at DB level — `409` returned on duplicate
- Hashed IP stored, never raw
- `sendAcceptanceNotification` is fire-and-forget — confirm it cannot cause response to hang on failure (confirm `void` is used)
- Email HTML contains `clientName` and `proposalTitle` — confirm these are server-stored strings, not client-supplied at render time

- [ ] **Step 3: Full QA regression checklist**

**Batch A:**
- [ ] Save dot: pulses amber while saving, goes green + "Xm ago" after save
- [ ] Save retry: error toast has "Retry" button, click retries successfully
- [ ] Publish: "Copy link" action in success toast copies correct URL
- [ ] Shortcuts: `?` opens overlay, all 4 shown, Esc closes
- [ ] Ctrl+S: force-saves without debounce delay

**Batch B:**
- [ ] Export: spinner during download, error toast on failure
- [ ] Undo: Ctrl+Z restores previous state including bold/inline formatting
- [ ] Empty block: warning toast, block content restored, not saved to DB

**Batch C:**
- [ ] Sort: newest/oldest/title-az all correct
- [ ] Bulk: checkbox appears in select mode, action bar shows count, delete + publish work

**Batch D:**
- [ ] View count shows on published proposal cards
- [ ] "Viewed Xm ago" shows last view time
- [ ] No view count on draft cards

**Batch E:**
- [ ] "Accept this Proposal →" CTA visible on published proposal public view
- [ ] Filling name + submitting → "Accepted by X on [date]" bar replaces CTA
- [ ] Revisiting the page → already_accepted state rendered from server (no flash)
- [ ] Second submission returns 409 → graceful "already accepted" message
- [ ] Owner receives email notification
- [ ] Dashboard card shows "Accepted" badge with client name tooltip
- [ ] `client_name` with 121 chars returns 422

- [ ] **Step 4: Push all batches to GitHub**

```bash
cd "C:/Users/owenq/OneDrive/Documents/N8N Automation" && git push origin main
```

---

## Environment Variables Checklist

Before deploying to Vercel, confirm all these are set in Vercel project settings → Environment Variables:

| Variable | Used by | Notes |
|----------|---------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | All Supabase clients | Already set |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client + server Supabase | Already set |
| `SUPABASE_SERVICE_ROLE_KEY` | `record-view.ts`, `accept/route.ts` | **New — server-only, no `NEXT_PUBLIC_` prefix** |
| `RESEND_API_KEY` | `send-acceptance-notification.ts` | **New — server-only** |
| `NEXT_PUBLIC_APP_URL` | Email links | **New — your Vercel production URL** |
