# Proposal Studio — Complete Build Record

> **Project**: Collaborative HTML proposal editing system for Design Shopp
> **Builder**: Claude Sonnet 4.6 + Owen Quintenta
> **Started**: April 2, 2026
> **Last Updated**: April 5, 2026 (Session 2)
> **Repo**: github.com/RexOwenDev/proposal-studio
> **Live**: proposal-studio-mu.vercel.app
> **Supabase Project ID**: vjtpykjmrukhypghzqnt

---

## What This App Does

Owen's sales team types raw draft notes into the app → Claude AI converts them into a fully-rendered, styled HTML proposal → the team can then edit, comment, and publish. Two templates are available:

- **Client Proposal** — dark hero section, count-up stats, capability cards, flow pipeline, phases accordion, timeline bar, investment section, CTA
- **Internal Doc** — Notion-style reference doc with workflow steps, tech stack table, phase status board, notes

After generation, all editing, commenting, and publishing features work identically to the original import flow.

---

Owen creates polished HTML proposals (single-file, inline CSS/JS) for Design Shopp clients. Proposal Studio lets him import those HTML files, and then the sales team, CEO, and VP can:

- **View** the proposal with pixel-perfect CSS rendering (iframe isolation)
- **Comment** by highlighting text (Google Docs-style inline comments)
- **Reply** in threaded conversations under each highlight
- **Edit** their own comments (author-only, pencil icon, inline textarea)
- **Delete** comments (author or proposal owner)
- **React** to comments with emoji (👍 ✅ ❤️ 👀 🎯)
- **@mention** team members with autocomplete
- **Resolve** comment threads (author or proposal owner)
- **See who's online** and who's typing (Supabase Presence)
- **Toggle sections** on/off before sharing with clients
- **Publish** with a shareable public URL
- **Export** to a clean standalone `.html` file download

Only the person who imported a proposal can edit text. Everyone else can view and comment.

---

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Next.js (App Router) | 16.2.1 |
| React | React + React Compiler | 19.2.4 |
| Styling | Tailwind CSS (app UI) | v4 (inline @theme) |
| Database | Supabase (PostgreSQL) | Cloud |
| Auth | Supabase Magic Link | Email OTP |
| Realtime | Supabase Realtime + Presence | postgres_changes + Presence API |
| HTML Parsing | Cheerio | 1.2.0 |
| Editor | contentEditable (native) | — |
| CSS Isolation | iframe + srcdoc | — |
| AI Provider | Vercel AI Gateway → Anthropic | claude-sonnet-4.6 |
| AI SDK | Vercel AI SDK | v6 (generateText + Output.object) |
| Hosting | Vercel | Hobby plan |
| Repo | GitHub | Public, auto-deploy on push |

---

## Database Schema

### proposals
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK, auto-generated |
| slug | text | UNIQUE, URL-friendly |
| title | text | From HTML `<title>` or manual |
| status | text | draft / review / published |
| original_html | text | Full imported HTML |
| stylesheet | text | Extracted CSS + HEAD_LINKS markers |
| scripts | text | Extracted JS |
| created_by | uuid | FK → auth.users |
| created_by_email | text | For display without auth.users join |
| created_at | timestamptz | Auto |
| updated_at | timestamptz | Auto (trigger) |

### content_blocks
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| proposal_id | uuid | FK → proposals (CASCADE) |
| block_order | integer | Sort position |
| visible | boolean | Section visibility toggle |
| label | text | Auto-detected or manual |
| original_html | text | Immutable imported HTML |
| current_html | text | Editable version (always clean — no editor artifacts) |
| wrapper_class | text | Parent wrapper CSS class for re-wrapping |
| last_edited_by | text | Email of last editor |
| updated_at | timestamptz | Auto (trigger) |

### comments
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| proposal_id | uuid | FK → proposals (CASCADE) |
| block_id | uuid | FK → content_blocks (CASCADE), nullable |
| parent_id | uuid | FK → comments (CASCADE), nullable — threaded replies |
| author_id | uuid | FK → auth.users |
| author_name | text | Email prefix |
| text | text | Comment content (max 5000 chars) |
| selected_text | text | Highlighted text context (max 500 chars) |
| resolved | boolean | Default false |
| reactions | jsonb | e.g. `{"👍": ["owen@designshopp.com"]}` |
| created_at | timestamptz | Auto |
| edited_at | timestamptz | Set when author edits text; null means original |

### RLS Policies
- Published proposals: anyone can SELECT
- All proposals: authenticated users can SELECT, INSERT, UPDATE, DELETE
- Content blocks: authenticated can manage, public can read if proposal is published
- Comments: authenticated only (read + manage)

### Indexes
- `idx_content_blocks_proposal`, `idx_content_blocks_order`
- `idx_comments_proposal`, `idx_comments_block`, `idx_comments_parent`
- `idx_proposals_status`, `idx_proposals_slug`

### Supabase Realtime Publications
- `proposals` table (dashboard live refresh)
- `comments` table (live comments)
- `content_blocks` table (highlight rendering)

---

## File Structure

```
proposal-studio/
├── src/
│   ├── app/
│   │   ├── page.tsx                        # Dashboard (proposal grid + LiveRefresh)
│   │   ├── layout.tsx                      # Root layout (Geist fonts)
│   │   ├── globals.css                     # Tailwind v4 + animations + scrollbar
│   │   ├── login/page.tsx                  # Magic link login + access control check
│   │   ├── import/page.tsx                 # HTML paste/upload + parse preview
│   │   ├── p/[slug]/
│   │   │   ├── page.tsx                    # Public view (iframe, no auth, published only)
│   │   │   └── edit/page.tsx               # Editor (contentEditable, highlights, comments)
│   │   └── api/
│   │       ├── auth/callback/route.ts      # Supabase auth callback (open redirect protected)
│   │       ├── import/route.ts             # POST: parse HTML → create proposal + blocks
│   │       ├── generate/route.ts           # POST: draft notes → AI → HTML → create proposal + blocks
│   │       ├── team/route.ts               # GET: dynamic team members for @mentions
│   │       ├── proposals/
│   │       │   ├── route.ts                # GET: list proposals
│   │       │   └── [id]/
│   │       │       ├── route.ts            # GET/PATCH/DELETE (ownership checked)
│   │       │       ├── publish/route.ts    # PATCH: publish/unpublish
│   │       │       └── export/route.ts     # GET: download clean standalone .html
│   │       ├── blocks/[id]/
│   │       │   ├── route.ts                # PATCH: update block (owner + conflict detection)
│   │       │   └── revert/route.ts         # POST: revert to original_html (owner check)
│   │       └── comments/route.ts           # GET/POST/PATCH/DELETE (3-tier auth)
│   ├── components/
│   │   ├── dashboard/
│   │   │   ├── dashboard-shell.tsx         # 'use client' wrapper — holds modal state, receives server props
│   │   │   ├── dashboard-header.tsx        # Logo, New Proposal button (calls onNewProposal), user dropdown
│   │   │   ├── create-proposal-modal.tsx   # AI generation modal (template selector, draft textarea, progress)
│   │   │   ├── proposal-card.tsx           # Card with actions (preview, copy, delete)
│   │   │   └── live-refresh.tsx            # Invisible: Supabase Realtime → router.refresh()
│   │   ├── editor/
│   │   │   ├── editor-toolbar.tsx          # Fixed toolbar (Back, presence avatars, Publish)
│   │   │   ├── section-sidebar.tsx         # Block list with toggle + revert + "edited" badge
│   │   │   ├── comment-panel.tsx           # Google Docs-style threaded comments + edit
│   │   │   └── comment-trigger.tsx         # Floating amber comment button on text selection
│   │   └── proposal/
│   │       └── proposal-renderer.tsx       # iframe srcdoc renderer (view + edit modes)
│   ├── lib/
│   │   ├── access-control.ts               # Email domain/whitelist auth
│   │   ├── types.ts                        # Proposal, ContentBlock, Comment types
│   │   ├── create-proposal-from-html.ts    # Shared: slug collision + DB insert (used by import + generate)
│   │   ├── ai/
│   │   │   └── generate-proposal.ts        # generateClientProposal / generateInternalDoc (Zod schemas)
│   │   ├── templates/
│   │   │   ├── types.ts                    # ClientProposalData + InternalDocData TypeScript interfaces
│   │   │   ├── client-proposal.ts          # Template 1 builder → static HTML (dark hero, animations)
│   │   │   └── internal-doc.ts             # Template 2 builder → static HTML (Notion-style)
│   │   ├── utils.ts                        # slugify, formatDate, debounce
│   │   ├── user-colors.ts                  # Per-user highlight colors (8 colors)
│   │   ├── hooks/
│   │   │   └── use-realtime.ts             # Supabase Realtime: comments + presence + typing
│   │   ├── parser/
│   │   │   └── html-parser.ts              # Cheerio: styles/scripts/blocks + SVG defs fix
│   │   ├── utils/
│   │   │   ├── strip-editor-artifacts.ts   # Canonical artifact stripper (all output paths)
│   │   │   └── wrap-scripts.ts             # Global fn hoisting + DOMContentLoaded wrapper
│   │   └── supabase/
│   │       ├── client.ts                   # Browser client
│   │       └── server.ts                   # Server client (async cookies)
│   └── proxy.ts                            # Auth + access control + security headers
├── .env.local                              # Supabase URL + anon key (gitignored)
├── CLAUDE.md                               # Project rules for AI assistants
├── PROGRESS.md                             # This file
├── package.json
└── next.config.ts                          # React Compiler enabled
```

---

## Key Architecture Decisions

### 1. iframe + srcdoc for CSS Isolation
Proposal HTML has its own CSS (custom fonts, colors, layouts). Tailwind v4 would conflict. The iframe creates a completely isolated rendering context. We use `srcdoc` (not `doc.write()`) for reliable script execution timing. Both iframes (editor + public view) have `sandbox="allow-scripts allow-same-origin"` to prevent proposal scripts from navigating the parent window.

### 2. Script Splitting (Global vs DOMContentLoaded)
Proposals use inline `onclick="togglePhase(this)"` and `oninput="calc()"` handlers. The `wrapScripts()` function splits: function declarations stay global (so inline handlers can find them), everything else wraps in DOMContentLoaded (so DOM is ready).

### 3. Universal Leaf-Text Editability
Instead of hardcoding CSS classes that are editable, we walk the DOM tree:
- Skip: script, style, SVG shapes, inputs, media
- Walk into: div, section, article, SVG containers (svg, g)
- Make editable: any element with direct text AND only inline children
- Also editable: SVG `<text>` elements (chart labels, diagram text)

### 4. Wrapper Class Tracking
The parser detects wrapper divs (containers), expands their children into separate blocks, and stores the wrapper's class name. The renderer re-groups consecutive blocks with the same `wrapper_class` back into their wrapper div.

### 5. Forced-Reveal + SVG Animation Kill in Edit Mode
Many proposals use `.reveal { opacity: 0 }` with IntersectionObserver. In edit mode, CSS overrides force everything visible. SVG `<animate>` elements are hidden via CSS to prevent repeated flashing.

### 6. Single Iframe Render (No Flash)
The editor renders the iframe ONCE on initial load. Block edits go directly to the API via contentEditable — they don't rebuild the iframe. ResizeObserver + MutationObserver are debounced at 100ms.

### 7. HEAD_LINKS Markers
Font `<link>` tags and preconnects are stored with structured markers in the stylesheet field. The renderer parses these back into `<head>` elements. Backward-compatible with legacy format.

### 8. Google Docs-Style Inline Comments
- `mouseup` + `touchend` listeners on iframe document capture text selection
- `CommentTrigger` renders floating amber button at selection rect
- `highlightTextInElement` uses TreeWalker + splitText to wrap matched text in `<mark>` tags
- Whitespace-normalized + case-insensitive fallback text matching
- Per-user colors (8 colors, deterministic hash of email)
- Bidirectional scroll: click highlight → sidebar, click sidebar → iframe with flash

### 9. Editor Artifact Stripping (Defense-in-Depth)
Editor injects artifacts into the live iframe DOM that must NEVER reach stored HTML or published views. Four layers of protection:

| Layer | Where | What |
|-------|-------|------|
| DOM clone | `saveBlockContent()` client-side | Strip before sending to API |
| Server write | `blocks/[id]/route.ts` PATCH | `stripEditorArtifacts()` on every save |
| Renderer | `proposal-renderer.tsx` view mode | Strip before building iframe srcdoc |
| Export | `proposals/[id]/export/route.ts` | Strip before generating download HTML |

Artifacts stripped:
- `<mark class="ps-highlight" data-comment-id="...">` — comment highlight wrappers
- `data-editable="..."` — editor targeting attributes
- `data-block-id-ref="..."` — editor targeting attributes
- `contenteditable="..."` — active-edit state
- `class="editing"` token — active-edit state

### 12. AI Proposal Generation Pipeline
Sales rep types draft notes → POST `/api/generate` → Claude structured output → template builder → `createProposalFromHTML` → redirect to editor.

Key design decisions:
- **Static HTML output, not JS-rendered**: Template builders emit fully-rendered HTML where all content is in the DOM from day 1. JS is interaction-only (accordion, count-up, reveal). This is critical because the editor's `saveBlockContent()` saves `current_html` — if JS re-rendered content at runtime, edits would be overwritten on next load.
- **Vercel AI SDK v6 + Zod structured output**: `generateObject` was removed in v6. The correct API is `generateText({ output: Output.object({ schema }) })`. Zod `.describe()` on each field acts as inline prompt hints to Claude.
- **AI Gateway provider**: Uses `anthropic/claude-sonnet-4.6` via Vercel AI Gateway (not direct Anthropic SDK). OIDC handles auth automatically in production — no API key needed on Vercel. Local dev uses `AI_GATEWAY_API_KEY`.
- **maxDuration = 60**: Without this, Vercel kills the function at 10s. AI generation takes 10–20s. This is a required export on the route.
- **AbortSignal.timeout(55s)**: Prevents indefinite hangs if Anthropic is slow.
- **`data-edit-mode` JS guards**: All accordion/toggle JS functions check `document.body.getAttribute('data-edit-mode') === 'true'` before collapsing content. CSS `!important` overrides don't work against inline `element.style.height = '0'` set by JS.
- **`safeHref()` sanitizer**: CTA href from AI output is sanitized to only allow `https:`, `mailto:`, and `#`. Blocks `javascript:` XSS.
- **Shared `createProposalFromHTML`**: Extracted from `/api/import` to avoid duplicate slug + DB insert logic. Both import and generate routes use the same utility.

### 13. Dashboard Architecture (Server + Client Split)
`page.tsx` is a Server Component — it fetches proposals + unresolved comment counts at request time, then passes them as plain props to `DashboardShell`. The shell is a `'use client'` component that holds `showModal` state and renders the header, grid, and modal. This keeps data fetching in the server while interactivity stays in the client.

### 10. Three-Tier Comment Authorization
Different operations have different auth requirements, all enforced server-side:

| Operation | Who Can Do It | Server Check |
|-----------|--------------|--------------|
| Add comment / reply | Any authenticated user | `user` exists |
| React with emoji | Any authenticated user | `user` exists |
| Resolve / unresolve | Author OR proposal owner | `author_id === user.id \|\| proposalOwner === user.id` |
| Edit comment text | Author ONLY | `author_id === user.id` |
| Delete comment | Author OR proposal owner | `author_id === user.id \|\| proposalOwner === user.id` |

### 11. Comment Edit UI (Author-Only)
- Pencil icon visible ONLY when `comment.author_id === currentUserId` (UUID match, immune to name casing)
- Clicking pencil → inline textarea replaces text display
- `Enter` saves, `Escape` cancels, Cancel button also available
- Save calls `PATCH /api/comments` with `{ id, text }` — server re-verifies author
- `edited_at` timestamp stored; "(edited)" label shown next to comment timestamp
- Works independently for parent comments AND replies

---

## Security Model

### Access Control (3 layers)
1. **Supabase**: Email auth only, confirm required, no social providers, no anonymous
2. **Login page** (client): Checks `isEmailAllowed(email)` before sending magic link
3. **proxy.ts** (server): Checks `isEmailAllowed(user.email)` — signs out + redirects unauthorized

### Allowed Users
```typescript
// src/lib/access-control.ts
const ALLOWED_DOMAINS = ['designshopp.com'];
const ALLOWED_EMAILS = [
  'owenquintenta@gmail.com',
  'jeniekagerona15@gmail.com',
];
```

### API Security Checklist
- ✅ Auth: Every endpoint checks `supabase.auth.getUser()`
- ✅ Ownership: Block PATCH / DELETE verifies `created_by === user.id` (403 otherwise)
- ✅ Comment authorization: 3-tier (see above)
- ✅ UUID validation: Regex on ALL `[id]` params AND `proposal_id` query params
- ✅ Field whitelists: Proposals PATCH: `title`, `status` only. Blocks PATCH: `current_html`, `visible`, `label` only
- ✅ Conflict detection: Block PATCH accepts `expected_updated_at`, returns 409 if stale
- ✅ Size limits: 10MB request, 5MB HTML, 5000 char comments, 500 char selected_text
- ✅ Error sanitization: Generic "Server error" messages — no DB internals leaked
- ✅ Open redirect protection: Auth callback validates `next` param (relative paths only)
- ✅ Security headers: `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` on all responses
- ✅ iframe sandbox: `allow-scripts allow-same-origin` on both editor + public view iframes
- ✅ Reactor identity: Reactions always use session user identity, never client-supplied name
- ✅ Revert ownership: `blocks/[id]/revert` verifies proposal owner before reverting

---

## Collaboration Features

| Feature | Status | Implementation |
|---------|--------|---------------|
| Inline comments | ✅ Live | Highlight text → amber button → submit → colored mark |
| Per-user colors | ✅ Live | 8 colors (amber, blue, emerald, orange, purple, red, teal, pink) |
| Threaded replies | ✅ Live | Flat under parent (Google Docs model) |
| Comment edit | ✅ Live | Author-only pencil icon → inline textarea → save/cancel |
| Comment delete | ✅ Live | Author or proposal owner can delete |
| "(edited)" label | ✅ Live | Shows when `edited_at` is set on a comment |
| @mentions | ✅ Live | Type @ → autocomplete from /api/team |
| Reactions | ✅ Live | 5 emoji, toggle per user, server validates identity |
| Resolve threads | ✅ Live | Author or owner, unresolve available in resolved section |
| Typing indicators | ✅ Live | Supabase Presence, deduplicated |
| Who's online | ✅ Live | Green avatar circles in toolbar |
| Live comments | ✅ Live | Supabase Realtime INSERT/UPDATE |
| Dashboard refresh | ✅ Live | LiveRefresh → router.refresh() on proposals changes |
| Conflict detection | ✅ Live | 409 response with in-app toast (no alert()) |
| Section visibility | ✅ Live | Toggle visible, synced to all users via Realtime |
| Bidirectional scroll | ✅ Live | Click highlight ↔ sidebar |
| Scroll-to-highlight | ✅ Live | Click sidebar comment → iframe scrolls + flashes mark |
| Export HTML | ⚠️ API only | API endpoint exists (`/api/proposals/[id]/export`) but export button removed from toolbar UI (April 5) |
| Auto-save | ✅ Live | Every 30s + on tab hide + on beforeunload |
| Comment count badge | ✅ Live | Dashboard cards show unresolved comment count |

---

## HTML Compatibility Fixes (parser + renderer)

| Fix | Status | Description |
|-----|--------|-------------|
| H1: Arrow fn hoisting | ✅ Done | `const fn = () => {}` hoisted to global scope |
| H2: Single-block split | ✅ Done | Secondary semantic split on `section/article/header/main/footer` |
| H3: SVG defs injection | ✅ Done | `<use href="#id">` cross-block refs fixed by injecting missing defs |
| H4: Media element warning | ✅ Done | canvas/video/audio/iframe warn on import |
| H5: ES module detection | ✅ Done | `type="module"` preserved with sentinels in wrapScripts |

---

## Commit History (chronological)

| # | Hash | Description |
|---|------|-------------|
| 1 | `72161e2` | Initial Next.js 16 scaffold |
| 2 | `9c8acd6` | Full app: auth, parser, renderer, editor, comments, dashboard |
| 3 | `313faf7` | Fix build: createClient inside event handler for static gen |
| 4 | `430ecec` | Layout spacing, dividers, wrapper_class, editability |
| 5 | `1d95e41` | Renderer: srcdoc, DOMContentLoaded, forced-reveal, MutationObserver |
| 6 | `9d7a636` | Script scoping (global functions), universal leaf-text editability |
| 7 | `94775a2` | Delete, navigation (Back/Home), mixed-content editability |
| 8 | `aaf123c` | Logout, user indicator, revert-to-original, loading skeleton, mobile |
| 9 | `e9d78e1` | Security hardening: whitelists, UUID validation, headers, size limits |
| 10 | `c30584d` | Fix editor flashing, SVG editability, animation stability |
| 11 | `a056351` | Public repo: open redirect fix, error sanitization |
| 12 | `8a7a8f6` | Email-based access control (@designshopp.com + whitelist) |
| 13 | `8987c5a` | Add jeniekagerona15@gmail.com to access whitelist |
| 14 | `bdee082` | Real-time collaboration: live comments, presence, conflict detection |
| 15 | `e35251c` | Google Docs-style inline comments + owner-only editing |
| 16 | `baec144` | Fix highlights + per-user colors + threaded replies + scroll-to |
| 17 | `c39ee8d` | Recursive threaded comments + always-visible reply input |
| 18 | `7a1a40b` | Typing indicators, @mentions, comment reactions |
| 19 | `7f328c3` | Dynamic @mentions from DB + reply/resolve at every depth |
| 20 | `8ffa2e8` | Redesign comment panel to Google Docs flat UX |
| 21 | `0787fe7` | Fix 5 bugs: presence duplicates, touch selection, dashboard live updates |
| 22 | `615c86c` | Fix highlight rendering + improve visibility on light themes |
| 23 | `7705445` | Fix black screen on dark-theme/animated HTML: snap animations to final frame |
| 24 | `f2a7857` | Real-time section visibility sync across all users |
| 25 | `01df1f2` | Security: ownership checks, reactor identity, UUID validation, consistent headers |
| 26 | `a5a3b25` | Phase 2 UX: toast system, comment delete, dashboard comment counts |
| 27 | `cd1787a` | Phases 3-7: dashboard search/filter, auto-save, export, SVG compat, bundle cleanup |
| 28 | `1185b65` | **Fix comment edit auth, strip highlights from published views, harden artifact cleanup** |
| 29 | `0b81303` | Fix comment DELETE/PATCH: two-step auth queries (remove `!inner` join), treat 404 as success |
| 30 | `239d452` | Fix dark homepage (globals.css `--background` → `#f9fafb`), login: switch to `useSearchParams` |
| 31 | `ef8d9e1` | Fix Vercel build failure: wrap login in `<Suspense>` for `useSearchParams`; remove export buttons from toolbar |
| 32 | `3fd02da` | Fix React #418 hydration error: mounted guard pattern on edit page |
| 33 | `0c8a4c8` | **feat: AI proposal generation** — full pipeline: modal → Claude → template → editor |
| 34 | `148db0b` | **fix: QA pass** — maxDuration, AbortSignal, AI Gateway, edit-mode guards, XSS sanitizer, modal UX |
| 35 | `186e7b7` | **Merge**: feature/ai-proposal-generation → main |

---

## Known Bugs Fixed (Session: April 4, 2026)

### BUG: Editor artifacts leaking to published URLs
**Symptom**: Published proposals showed yellow comment highlights (clickable), and had `data-editable`, `contenteditable` attributes visible in page source.

**Root cause 1**: Previous SQL cleanup used regex that missed 4 specific blocks.
**Root cause 2**: `stripEditorArtifacts` regex was attribute-order-sensitive on `<mark>` tags.

**Fix**:
1. Ran corrected SQL cleanup — confirmed 0 dirty rows remain
2. Rewrote `stripEditorArtifacts` with two-pass mark removal (attribute-order-independent):
   - Pass 1: remove `<mark ...data-comment-id...>` opening tags
   - Pass 2: remove orphaned `</mark>` closing tags
3. Four defense layers now all active (client clone, server write, renderer, export)

### BUG: Can't edit own comments
**Symptom**: Pencil icon never appeared even on the user's own comments.

**Root cause**: Edit button was gated on `comment.author_name === currentUser` (string comparison). Any case difference or legacy "Unknown" stored name silently broke the check.

**Fix**: Changed to UUID comparison `comment.author_id === currentUserId` — the same check the server uses. `currentUserId` is now threaded as a separate prop through `CommentPanel` → `CommentThread`.

---

## Known Bugs Fixed (Session: April 5, 2026)

### BUG: Dark homepage — app background was near-black
**Symptom**: Dashboard page showed dark background even though the page div used `bg-gray-50`.

**Root cause**: `globals.css` declared `--background: #09090b` (near-black), and `body { background: var(--background) }` overrode any Tailwind class on child divs.

**Fix**: Changed `--background` to `#f9fafb` (light gray) and `--foreground` to `#09090b` in `globals.css` `:root`. No component changes needed.

---

### BUG: Vercel builds failing — all 3 projects broken
**Symptom**: All pushes since commit `239d452` produced failed deployments on `proposal-studio-k6rd`, `proposal-studio`, and `proposal-studio-3xl1`. None of the session's other fixes were live.

**Root cause**: `login/page.tsx` called `useSearchParams()` at the top level of a client component with no `<Suspense>` boundary. Next.js App Router build aborts with `missing-suspense-with-csr-bailout` for this pattern.

**Fix**: Split the login page into two components in the same file:
- `LoginForm` — contains `useSearchParams()` and all form logic
- `LoginPage` (default export) — just wraps `<LoginForm />` in `<Suspense>`

This unblocked all 3 Vercel deployments. Every fix from the session went live after commit `ef8d9e1`.

---

### BUG: DELETE /api/comments returning 404 on valid deletes
**Symptom**: Deleting a comment showed "Error, please try again" toast even when the comment visually disappeared. Double-deleting (or a race where the comment was already removed) always errored.

**Root cause 1** (server): Old deployed code used `proposals!inner(created_by)` join. When a comment is already deleted, the join returns 406 (no matching row) → API read `data` as null → returned 404.

**Root cause 2** (client): Client treated any non-2xx response as an error and threw, showing the error toast.

**Fix 1** (server): Two-step auth pattern (separate `proposals` query, no `!inner` join) was already in the file; it only went live once the Vercel build failure was fixed (above).

**Fix 2** (client): `handleDeleteComment` in `edit/page.tsx` now explicitly treats 404 as success — a 404 means the comment is already gone, so the UI should still remove it without showing an error.

---

### BUG: PATCH /api/comments returning 500 on comment edit
**Symptom**: Editing a comment's text always returned "Server error" after saving.

**Root cause**: The PATCH handler included `.update({ text: sanitizedText, edited_at: new Date().toISOString() })`, but the `edited_at` column didn't exist in the `comments` table. PostgREST returned HTTP 400 (unknown column) → API caught this and returned 500.

**Fix**: Added the missing column via Supabase migration:
```sql
ALTER TABLE comments ADD COLUMN IF NOT EXISTS edited_at timestamptz;
```
No API code changes needed — the update query was already correct.

---

### BUG: React hydration error #418 in editor
**Symptom**: Console showed `Warning: An error occurred during hydration. The server HTML was replaced with client content in <div>`. Error args `text` and `` (empty string) pointed to a text node mismatch.

**Root cause**: The server (SSR) and client first-render produced different DOM structures due to state-dependent content rendered before `useEffect` ran. Exact component couldn't be pinpointed from the minified production bundle.

**Fix**: Added a `mounted` guard in `edit/page.tsx`. The page now returns the loading skeleton on both SSR AND the first client render (when `mounted === false`). After `useEffect(() => setMounted(true), [])` fires, the full editor content renders. This guarantees SSR and client first-render produce identical HTML, eliminating the mismatch.

---

### CHANGE: Export button removed from editor toolbar
**Requested**: Remove the HTML/PDF export option from the toolbar navbar.

**What changed**: Both the HTML download `<a>` tag and the PDF print button were removed from `editor-toolbar.tsx`. The underlying export API endpoint (`/api/proposals/[id]/export`) remains intact.

---

## Database Maintenance History

### April 5, 2026 — Add `edited_at` column to `comments`
Added missing column that the PATCH edit-comment handler was already trying to write:
```sql
ALTER TABLE comments ADD COLUMN IF NOT EXISTS edited_at timestamptz;
```
This fixed the 500 error on comment edits. The `(edited)` label in the comment UI was already wired up; it just never had data to show before this column existed.

### April 4, 2026 — Artifact Cleanup (Run 2)
Cleaned 4 blocks with contaminated `current_html`:
- `ce954579` — "Qualify Prospects Before the Full Design Investment"
- `44239ac5` — "Where Your Hours Go — Before & After"
- `444c644b` — "Qualify Prospects Before the Full Design Investment" (dupe label)
- `b10fdea8` — "Drag to See Your Savings"

SQL used:
```sql
UPDATE content_blocks
SET current_html = regexp_replace(
  regexp_replace(
    regexp_replace(
      regexp_replace(
        regexp_replace(current_html,
          '<mark[^>]*data-comment-id[^>]*>', '', 'g'),
        '</mark>', '', 'g'),
      '\s+data-editable="[^"]*"', '', 'g'),
    '\s+data-block-id-ref="[^"]*"', '', 'g'),
  '\s+contenteditable="[^"]*"', '', 'g')
WHERE current_html LIKE '%data-comment-id%'
   OR current_html LIKE '%data-editable%'
   OR current_html LIKE '%contenteditable%';
-- Result: 0 dirty rows remaining
```

### April 3, 2026 — Artifact Cleanup (Run 1)
First pass that missed the 4 blocks above.

---

## Deployment

### Current Setup
- **Vercel project**: proposal-studio-mu.vercel.app
- **GitHub**: auto-deploys on push to main
- **Env vars in Vercel**: `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **AI in production**: Vercel AI Gateway (OIDC — no key needed, auto-provisioned by Vercel)
- **AI in local dev**: `AI_GATEWAY_API_KEY` in `.env.local` — get from vercel.com → team → AI Gateway → API Keys
- **Build**: ~30s, Turbopack, zero TypeScript errors

### Supabase Auth Config
- Site URL: `https://proposal-studio-mu.vercel.app`
- Redirect URLs: `https://proposal-studio-mu.vercel.app/api/auth/callback`, `http://localhost:3000/api/auth/callback`
- Email provider: enabled (only provider)
- Confirm email: ON | Anonymous: OFF | Signups: ON

---

## Custom Domain (When Ready)

When the client wants `proposals.designshopp.com`:

1. **Vercel**: Settings → Domains → add `proposals.designshopp.com`
2. **DNS**: Add CNAME: `proposals` → `cname.vercel-dns.com`
3. **Supabase**: Update Site URL + add redirect URL for new domain
4. **Code**: Zero changes needed (uses `window.location.origin`)

---

## Remaining Items from Roadmap

Items NOT yet implemented (from the full audit plan):

| Item | Priority | Effort | Notes |
|------|----------|--------|-------|
| Custom SMTP (Resend) | **High** | 30 min | Built-in Supabase email rate-limited. Add Resend integration in Supabase dashboard. |
| Proposal duplication (U7) | Medium | 1.5 hr | Clone proposal + all blocks with new IDs, fresh status/slug. Comments NOT copied. |
| Typing indicator on block edit (R1) | Medium | 1.5 hr | Broadcast `editingBlockId` via presence when startEditing fires |
| Comment notification toasts (R3) | Medium | 2 hr | Toast when new comment arrives from another user |
| Section-level edit lock (R5) | Medium | 2 hr | "Owen is editing this section" badge from presence |
| @Mention email via Edge Function (R4) | Low | 3 hr | Supabase Edge Function → Resend email |
| Block version history (T4) | Low | 4 hr | `block_versions` table, history UI in sidebar |
| Dashboard search + filter (U6) | Low | 2 hr | Client-side filter on title/status |
| Dashboard proposal duplication (U7) | Low | 1.5 hr | |
| Proposal status: `approved` (T2) | Low | 2 hr | draft → review → approved → published |
| View-only share links (T3) | Low | 2 hr | `?mode=view` or token-based link |
| Unresolved comment badge in panel (U4) | Low | 30 min | "Block hidden" badge when referenced block is not visible |
| Public view caching ISR (P4) | Low | 1 hr | `revalidate: 60` on published proposals |

---

## How to Continue Development

### Local Setup
```bash
cd C:\Users\owenq\Documents\proposal-studio
npm install
# .env.local already exists with Supabase keys
npm run dev
# Opens at http://localhost:3000
```

### Critical Files
| File | Purpose |
|------|---------|
| `src/app/p/[slug]/edit/page.tsx` | Main editor — highlights, saves, comments wiring |
| `src/lib/utils/strip-editor-artifacts.ts` | **CANONICAL artifact strip — fix leaks here first** |
| `src/lib/parser/html-parser.ts` | How HTML is split into blocks |
| `src/components/proposal/proposal-renderer.tsx` | How blocks render in iframes |
| `src/components/editor/comment-panel.tsx` | Comment UI — threads, edit, reactions |
| `src/app/api/comments/route.ts` | Comment API — 3-tier auth enforced here |
| `src/app/api/blocks/[id]/route.ts` | Block save API — strips artifacts server-side |
| `src/lib/access-control.ts` | Add/remove allowed emails and domains |
| `src/lib/hooks/use-realtime.ts` | Live comments, presence, typing |

### Adding a New Allowed Email
Edit `src/lib/access-control.ts`:
```typescript
const ALLOWED_EMAILS = [
  'owenquintenta@gmail.com',
  'jeniekagerona15@gmail.com',
  'newemail@example.com',  // add here
];
```
Push to main → Vercel auto-deploys.

### Supabase MCP (connected as `supabase-proposal-studio`)
```
execute_sql      — run queries against the DB
apply_migration  — add columns/tables with migrations
list_tables      — inspect schema
get_logs         — check auth/API error logs
```

### If Artifacts Appear in Published Views Again
Run this SQL immediately (idempotent, safe to re-run):
```sql
UPDATE content_blocks
SET current_html = regexp_replace(
  regexp_replace(
    regexp_replace(
      regexp_replace(
        regexp_replace(current_html,
          '<mark[^>]*data-comment-id[^>]*>', '', 'g'),
        '</mark>', '', 'g'),
      '\s+data-editable="[^"]*"', '', 'g'),
    '\s+data-block-id-ref="[^"]*"', '', 'g'),
  '\s+contenteditable="[^"]*"', '', 'g')
WHERE current_html LIKE '%data-comment-id%'
   OR current_html LIKE '%data-editable%'
   OR current_html LIKE '%contenteditable%';
```
Then check: `SELECT COUNT(*) FROM content_blocks WHERE current_html LIKE '%data-comment-id%';` — should be 0.

---

## Session: April 5, 2026 — AI Proposal Generation Feature

### What Was Built

Replaced the HTML file import flow with a fully AI-powered text-to-proposal pipeline. Sales rep pastes draft notes → Claude generates a fully structured, styled HTML proposal → opens directly in the editor.

**Branch**: `feature/ai-proposal-generation` → merged to `main` (commit `186e7b7`)

### New Files Created

| File | Purpose |
|------|---------|
| `src/lib/templates/types.ts` | TypeScript interfaces for `ClientProposalData` and `InternalDocData` |
| `src/lib/templates/client-proposal.ts` | Template 1 builder: dark hero, count-up stats, capability cards, flow pipeline, phases accordion, timeline bar, investment, next steps, CTA |
| `src/lib/templates/internal-doc.ts` | Template 2 builder: Notion-style header, goal overview, collapsible workflow steps, tech stack table, phase status board, notes |
| `src/lib/ai/generate-proposal.ts` | AI utility: full Zod schemas + `generateClientProposal()` + `generateInternalDoc()` |
| `src/lib/create-proposal-from-html.ts` | Shared DB utility: slug collision check + proposal row + content_blocks insert |
| `src/app/api/generate/route.ts` | POST endpoint: auth → validate → AI generate → template build → DB insert → return slug |
| `src/components/dashboard/create-proposal-modal.tsx` | 4-state modal (idle → generating → redirect \| error): template selector, optional title/client name, draft textarea, rotating progress messages |
| `src/components/dashboard/dashboard-shell.tsx` | `'use client'` wrapper: holds `showModal` state, receives server-fetched proposals as props |

### Files Modified

| File | Change |
|------|--------|
| `src/app/page.tsx` | Replaced direct render with `DashboardShell` (Server Component now just fetches data + passes props) |
| `src/components/dashboard/dashboard-header.tsx` | Replaced `<Link href="/import">Import New</Link>` with `<button onClick={onNewProposal}>New Proposal</button>`; added `onNewProposal: () => void` prop |
| `src/components/proposal/proposal-renderer.tsx` | Added `data-edit-mode="true"` attribute to `<body>` when `mode === 'edit'` in `buildIframeHTML()` |

### QA Fixes Applied (commit `148db0b`)

| Fix | Details |
|-----|---------|
| `export const maxDuration = 60` | Vercel default is 10s — AI takes 10–20s. Without this, 100% timeout rate in production |
| `AbortSignal.timeout(55_000)` | On both AI calls — prevents indefinite hang if Anthropic is unresponsive |
| Migrate to AI Gateway | Changed from `@ai-sdk/anthropic` + direct API key to `'anthropic/claude-sonnet-4.6'` via Vercel AI Gateway. OIDC in prod = no key management |
| Edit-mode JS guards | `initAccordions`, `initCapabilityCards`, `initFlowSteps` (client proposal) + `initWorkflowToggles`, `initNoteToggles` (internal doc) all check `data-edit-mode` before collapsing. CSS `!important` does NOT override JS inline styles |
| `safeHref()` sanitizer | CTA href from AI validated against `/^(https?:\|mailto:\|#)/i` — blocks `javascript:` XSS |
| `animate-scale-in` class | Replaced `zoom-in-95 duration-200` (requires `tailwindcss-animate`, not installed) with `animate-scale-in` (defined in `globals.css`) |
| `maxLength={20000}` | Hard browser stop on textarea — previously only showed a red counter but allowed typing past limit |
| `aria-label="Close dialog"` | Screen reader accessibility on X button |

### How the AI Pipeline Works

```
User types draft notes (20 char min, 20k char max)
  ↓
POST /api/generate
  ↓
Auth check (Supabase session)
  ↓
generateClientProposal() or generateInternalDoc()
  ├── generateText({ model: 'anthropic/claude-sonnet-4.6', output: Output.object({ schema }) })
  ├── Zod schema validates + retries if Claude output doesn't conform
  └── Returns typed ClientProposalData or InternalDocData
  ↓
buildClientProposalHTML(data) or buildInternalDocHTML(data)
  └── Returns fully-rendered <!DOCTYPE html> string (content in DOM, JS interaction-only)
  ↓
createProposalFromHTML(supabase, { html, title, userId, userEmail })
  ├── parseHTML() → stylesheet, scripts, blocks
  ├── Slug collision check + suffix if taken
  ├── INSERT into proposals
  └── INSERT into content_blocks
  ↓
Return { proposal: { slug, ... } }
  ↓
router.push('/p/{slug}/edit')  ← editor opens
```

### AI Model Notes
- Model: `anthropic/claude-sonnet-4.6` via Vercel AI Gateway
- Local dev: requires `AI_GATEWAY_API_KEY` in `.env.local`
- Production: OIDC auth — no key needed, Vercel handles it automatically
- Zod schema `.describe()` strings act as inline prompt instructions to Claude
- If generation fails, error message is shown in modal — user can fix notes and retry

### Template Architecture Notes

**Why static HTML (not JS-rendered templates)**:
The editor saves `element.innerHTML` as `current_html` in the DB. If the template rendered content via a JS `PROPOSAL_DATA` object at runtime, every editor save would capture the rendered state — but on re-load, the JS would run again and overwrite it. Static HTML means the content is in the DOM at parse time. JS is strictly interaction-only (animations, accordions, count-ups).

**`data-edit-mode` body attribute**:
The template CSS includes `body[data-edit-mode] * { opacity: 1 !important; animation: none !important; transition: none !important; }`. The renderer injects `data-edit-mode="true"` on `<body>` when `mode === 'edit'`. This forces all animated/hidden content fully visible. But CSS `!important` only covers CSS properties — JS that sets `element.style.height = '0'` bypasses it. That's why all accordion-init functions have an early-return edit-mode guard.

### Environment Variables (current state)
```
# .env.local
NEXT_PUBLIC_SUPABASE_URL=https://vjtpykjmrukhypghzqnt.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[anon key]
# AI Gateway key for local dev (rotate after sharing)
AI_GATEWAY_API_KEY=[key]
```

**Vercel production env vars needed** (add in Vercel dashboard → Settings → Environment Variables):
- `NEXT_PUBLIC_SUPABASE_URL` ✅ already set
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` ✅ already set
- AI Gateway: **no key needed** — OIDC handles it automatically on Vercel
