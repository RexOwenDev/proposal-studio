# Proposal Studio — Complete Build Record

> **Project**: Collaborative HTML proposal editing system for Design Shopp
> **Builder**: Claude Opus 4.6 + Owen Quintenta
> **Date**: April 2-4, 2026
> **Repo**: github.com/RexOwenDev/proposal-studio (public)
> **Live**: proposal-studio-mu.vercel.app
> **Supabase**: vjtpykjmrukhypghzqnt

---

## What This App Does

Owen creates polished HTML proposals (single-file, inline CSS/JS) for Design Shopp clients. Proposal Studio lets him import those HTML files, and then the sales team, CEO, and VP can:

- **View** the proposal with pixel-perfect CSS rendering (iframe isolation)
- **Comment** by highlighting text (Google Docs-style inline comments)
- **Reply** in threaded conversations under each highlight
- **React** to comments with emoji (thumbs up, check, heart, eyes, target)
- **@mention** team members with autocomplete (dynamic from database)
- **See who's online** and who's typing (Supabase Presence)
- **Toggle sections** on/off before sharing with clients
- **Publish** with a shareable public URL

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
| Hosting | Vercel | Hobby plan |
| Repo | GitHub | Public |

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
| current_html | text | Editable version |
| wrapper_class | text | Parent wrapper CSS class for re-wrapping |
| last_edited_by | text | Email of last editor |
| updated_at | timestamptz | Auto (trigger) |

### comments
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| proposal_id | uuid | FK → proposals (CASCADE) |
| block_id | uuid | FK → content_blocks (CASCADE), nullable |
| parent_id | uuid | FK → comments (CASCADE), nullable — for threaded replies |
| author_id | uuid | FK → auth.users |
| author_name | text | Email prefix |
| text | text | Comment content (max 5000 chars) |
| selected_text | text | Highlighted text context (max 500 chars) |
| resolved | boolean | Default false |
| reactions | jsonb | e.g. {"thumbs_up": ["owen", "jenie"]} |
| created_at | timestamptz | Auto |

### RLS Policies
- Published proposals: anyone can SELECT
- All proposals: authenticated users can SELECT, INSERT, UPDATE, DELETE
- Content blocks: authenticated can manage, public can read if proposal is published
- Comments: authenticated only (read + manage)

### Indexes
- idx_content_blocks_proposal, idx_content_blocks_order
- idx_comments_proposal, idx_comments_block, idx_comments_parent
- idx_proposals_status, idx_proposals_slug

### Supabase Realtime Publications
- proposals table (dashboard live refresh)
- comments table (live comments)
- content_blocks table (highlight rendering)

---

## File Structure

```
proposal-studio/
├── src/
│   ├── app/
│   │   ├── page.tsx                    # Dashboard (proposal grid + LiveRefresh)
│   │   ├── layout.tsx                  # Root layout (Geist fonts)
│   │   ├── globals.css                 # Tailwind v4 + animations + scrollbar
│   │   ├── login/page.tsx              # Magic link login + access control check
│   │   ├── import/page.tsx             # HTML paste/upload + parse preview
│   │   ├── p/[slug]/
│   │   │   ├── page.tsx                # Public view (iframe, no auth, published only)
│   │   │   └── edit/page.tsx           # Editor (contentEditable, highlights, comments)
│   │   └── api/
│   │       ├── auth/callback/route.ts  # Supabase auth callback (open redirect protected)
│   │       ├── import/route.ts         # POST: parse HTML → create proposal + blocks
│   │       ├── team/route.ts           # GET: dynamic team members for @mentions
│   │       ├── proposals/
│   │       │   ├── route.ts            # GET: list proposals
│   │       │   └── [id]/
│   │       │       ├── route.ts        # GET/PATCH/DELETE proposal (field whitelisted)
│   │       │       └── publish/route.ts # PATCH: publish/unpublish
│   │       ├── blocks/[id]/
│   │       │   ├── route.ts            # PATCH: update block (owner check + conflict detection)
│   │       │   └── revert/route.ts     # POST: revert to original_html
│   │       └── comments/route.ts       # GET/POST/PATCH: comments with selected_text + parent_id
│   ├── components/
│   │   ├── dashboard/
│   │   │   ├── dashboard-header.tsx    # User avatar, logout dropdown
│   │   │   ├── proposal-card.tsx       # Card with actions (preview, copy, delete)
│   │   │   └── live-refresh.tsx        # Invisible: Supabase Realtime → router.refresh()
│   │   ├── editor/
│   │   │   ├── editor-toolbar.tsx      # Fixed toolbar (Back, Home, presence avatars, Publish)
│   │   │   ├── section-sidebar.tsx     # Block list with toggle + revert + "edited" badge
│   │   │   ├── comment-panel.tsx       # Google Docs-style threaded comments
│   │   │   └── comment-trigger.tsx     # Floating amber comment button on text selection
│   │   └── proposal/
│   │       └── proposal-renderer.tsx   # iframe srcdoc renderer (view + edit modes)
│   ├── lib/
│   │   ├── access-control.ts           # Email domain/whitelist: @designshopp.com + specific emails
│   │   ├── types.ts                    # Proposal, ContentBlock, Comment, ParseResult types
│   │   ├── utils.ts                    # slugify, formatDate, debounce
│   │   ├── user-colors.ts             # Per-user highlight colors (8 colors, email hash)
│   │   ├── hooks/
│   │   │   └── use-realtime.ts         # Supabase Realtime: live comments + presence + typing
│   │   ├── parser/
│   │   │   └── html-parser.ts          # Cheerio: extract styles/scripts/blocks + wrapper detection
│   │   └── supabase/
│   │       ├── client.ts               # Browser client (createBrowserClient)
│   │       └── server.ts               # Server client (async cookies)
│   └── proxy.ts                        # Auth + access control + security headers
├── .env.local                          # Supabase URL + anon key (gitignored)
├── CLAUDE.md                           # Project rules for AI assistants
├── PROGRESS.md                         # This file
├── package.json                        # Dependencies + Node.js >=20
└── next.config.ts                      # React Compiler enabled
```

---

## Key Architecture Decisions

### 1. iframe + srcdoc for CSS Isolation
Proposal HTML has its own CSS (custom fonts, colors, layouts). Tailwind v4 would conflict. The iframe creates a completely isolated rendering context. We use `srcdoc` (not `doc.write()`) for reliable script execution timing.

### 2. Script Splitting (Global vs DOMContentLoaded)
Proposals use inline `onclick="togglePhase(this)"` and `oninput="calc()"` handlers. The `wrapScripts()` function splits: function declarations stay global (so inline handlers can find them), everything else wraps in DOMContentLoaded (so DOM is ready).

### 3. Universal Leaf-Text Editability
Instead of hardcoding CSS classes that are editable, we walk the DOM tree:
- Skip: script, style, SVG shapes, inputs, media
- Walk into: div, section, article, SVG containers (svg, g)
- Make editable: any element with direct text AND only inline children
- Also editable: SVG `<text>` elements (chart labels, diagram text)

### 4. Wrapper Class Tracking
The CPA report has `<div class="content-wrap">` (max-width, centered). The parser detects wrapper divs, expands their children into separate blocks, and stores the wrapper's class name. The renderer re-groups consecutive blocks with the same `wrapper_class` back into their wrapper div.

### 5. Forced-Reveal + SVG Animation Kill in Edit Mode
Many proposals use `.reveal { opacity: 0 }` with IntersectionObserver. In edit mode, CSS overrides force everything visible. SVG `<animate>` elements are hidden via CSS to prevent repeated flashing.

### 6. Single Iframe Render (No Flash)
The editor renders the iframe ONCE on initial load. Block edits go directly to the API via contentEditable — they don't rebuild the iframe. The ResizeObserver is debounced to prevent rapid height oscillation.

### 7. HEAD_LINKS Markers
Font `<link>` tags and preconnects are stored with structured markers in the stylesheet field. The renderer parses these back into `<head>` elements. Backward-compatible with legacy format.

### 8. Google Docs-Style Inline Comments
- `mouseup` + `touchend` listeners on iframe document capture text selection
- `CommentTrigger` component renders floating amber button at selection rect
- `highlightTextInElement` uses TreeWalker + surroundContents to wrap matched text in `<mark>` tags
- Whitespace-normalized + case-insensitive fallback text matching
- Per-user colors (8 colors, deterministic hash of email)
- Bidirectional scroll: click highlight → scroll sidebar, click sidebar → scroll iframe with flash

### 9. Flat Threaded Comments (Google Docs Model)
- Parent comment = the highlighted text comment
- All replies appear flat underneath (same indentation, no deep nesting)
- Single reply input at bottom of each thread (rounded pill, "Reply or add others with @")
- `parent_id` FK enables threading, but UI flattens to root parent for clean UX

### 10. Supabase Realtime
- Live comments: `postgres_changes` on comments table (INSERT + UPDATE)
- Presence: Supabase Presence API tracks who's online per proposal
- Typing indicators: presence `track()` updates with `isTyping` flag
- Deduplicated: Map for users (by email), Set for typing (unique emails)
- Dashboard live refresh: LiveRefresh component → `router.refresh()` on proposals changes

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

### API Security
- Auth: Every mutation endpoint checks `supabase.auth.getUser()`
- Owner check: Block PATCH verifies `proposal.created_by === user.id` (403 if not)
- UUID validation: Regex on all `[id]` params
- Field whitelists: Proposals PATCH only accepts `title` and `status`. Blocks PATCH only accepts `current_html`, `visible`, `label`
- Conflict detection: Block PATCH accepts `expected_updated_at`, returns 409 if stale
- Payload limits: 10MB request, 5MB HTML, 5000 char comments, 500 char selected_text
- Error sanitization: Generic "Server error" messages, no DB internals leaked
- Open redirect protection: Auth callback validates `next` param (relative paths only)
- Security headers: X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy

---

## Collaboration Features (all live)

| Feature | Implementation |
|---------|---------------|
| **Inline comments** | Highlight text → amber Comment button → submit → yellow highlight on text |
| **Per-user colors** | 8 colors (amber, blue, emerald, orange, purple, red, teal, pink) via email hash |
| **Threaded replies** | Flat under parent (Google Docs model), single reply input at bottom |
| **@mentions** | Type @ → autocomplete dropdown from /api/team (dynamic from DB) |
| **Reactions** | 5 emoji (👍 ✅ ❤️ 👀 🎯), toggle per user, stored as JSONB |
| **Typing indicators** | Supabase Presence track() with isTyping flag, deduplicated |
| **Who's online** | Green avatar circles in toolbar, count badge |
| **Live comments** | Supabase Realtime INSERT/UPDATE on comments table |
| **Dashboard refresh** | LiveRefresh component: Realtime on proposals → router.refresh() |
| **Conflict detection** | expected_updated_at on block saves, 409 response on conflict |
| **Owner-only editing** | Only importer can edit text, everyone can comment |
| **Bidirectional scroll** | Click highlight → sidebar scrolls to comment. Click comment → iframe scrolls to highlight with flash |
| **Touch support** | touchend listener alongside mouseup for mobile/iPad text selection |

---

## Tested HTML Patterns

| Proposal | Theme | Key Features Tested |
|----------|-------|-------------------|
| CPA Exam Report | Light, warm | content-wrap centering, simple sections, hero, rule dividers |
| Speed Quote Presentation | Dark | scroll reveal (.reveal.visible), onclick togglePhase, data-width bars, IntersectionObserver |
| Speed Quote CEO | Light, minimal | .wrap layouts, interactive calculator (oninput, range inputs), .v class reveal, mixed-content divs |
| Speed Quote Client v2 | Light, warm | SVG Sankey diagram with `<animate>`, donut charts, SVG `<text>` labels, interactive calculator |

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

---

## Deployment

### Current Setup
- **Vercel project**: proposal-studio-mu.vercel.app
- **GitHub**: auto-deploys on push to main
- **Env vars in Vercel**: NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY
- **Build**: ~30s, Turbopack, zero warnings

### Supabase Auth Config
- Site URL: `https://proposal-studio-mu.vercel.app`
- Redirect URLs: `https://proposal-studio-mu.vercel.app/api/auth/callback`, `http://localhost:3000/api/auth/callback`
- Email provider: enabled (only provider)
- Confirm email: ON
- Allow signups: ON
- Anonymous: OFF
- SMTP: Built-in (needs Resend upgrade for production)

---

## Custom Domain (When Ready)

When the client wants `proposals.designshopp.com`:

1. **Vercel**: Settings → Domains → add `proposals.designshopp.com`
2. **DNS**: Add CNAME: `proposals` → `cname.vercel-dns.com`
3. **Supabase**: Update Site URL + add redirect URL for new domain
4. **Code**: Zero changes needed (uses `window.location.origin`)

---

## Pending / Nice-to-Have

| Item | Priority | Notes |
|------|----------|-------|
| Custom SMTP (Resend) | **High** | Built-in Supabase email rate-limited (~3-4/hr). Team magic links will fail. |
| Unread comment badges | Medium | Show count of new comments since last visit |
| Email notifications via n8n | Medium | When someone comments on your proposal |
| Search/filter dashboard | Low | Useful at 10+ proposals |
| Export edited HTML | Low | Download the edited version |
| Proposal preview thumbnails | Low | Visual cards instead of text-only |

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

### Key Files to Know
- **Parser**: `src/lib/parser/html-parser.ts` — change how HTML is split into blocks
- **Renderer**: `src/components/proposal/proposal-renderer.tsx` — change how blocks render in iframe
- **Editor**: `src/app/p/[slug]/edit/page.tsx` — the main editor page (~800 lines)
- **Comment panel**: `src/components/editor/comment-panel.tsx` — Google Docs-style comments
- **Access control**: `src/lib/access-control.ts` — add/remove allowed emails and domains
- **Proxy**: `src/proxy.ts` — auth enforcement, security headers, protected routes
- **Realtime**: `src/lib/hooks/use-realtime.ts` — live comments, presence, typing

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

### Supabase MCP
The Supabase project is connected via MCP (`supabase-proposal-studio`). You can:
- `execute_sql` — run queries
- `apply_migration` — add columns/tables
- `list_tables` — inspect schema
- `get_logs` — check auth/API logs
