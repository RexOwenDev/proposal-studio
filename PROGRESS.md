# Proposal Studio — Complete Build Record

> **Project**: Collaborative HTML proposal editing system for Design Shopp
> **Builder**: Claude Opus 4.6 + Owen Quintenta
> **Date**: April 2-3, 2026
> **Repo**: github.com/RexOwenDev/proposal-studio
> **Live**: proposal-studio-mu.vercel.app
> **Supabase**: vjtpykjmrukhypghzqnt

---

## What This App Does

Owen creates polished HTML proposals (single-file, inline CSS/JS) for Design Shopp clients. Proposal Studio lets him import those HTML files, and then the sales team, CEO, and VP can:

- **Edit any text** inline (click to edit, auto-saves)
- **Toggle sections** on/off (hide parts before sharing)
- **Leave comments** per section
- **Publish** with a shareable URL (pixel-perfect CSS isolation in iframe)
- **Revert** edited sections to their original imported state

---

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Next.js | 16.2.1 |
| React | React + React Compiler | 19.2.4 |
| Styling | Tailwind CSS (app UI) | v4 (inline @theme) |
| Database | Supabase (PostgreSQL) | Cloud |
| Auth | Supabase Magic Link | Email OTP |
| HTML Parsing | Cheerio | 1.2.0 |
| Editor | contentEditable (native) | — |
| CSS Isolation | iframe + srcdoc | — |
| Hosting | Vercel | Hobby plan |
| Repo | GitHub | Private (going public) |

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
| updated_at | timestamptz | Auto (trigger) |

### comments
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| proposal_id | uuid | FK → proposals (CASCADE) |
| block_id | uuid | FK → content_blocks (CASCADE), nullable |
| author_id | uuid | FK → auth.users |
| author_name | text | Email prefix |
| text | text | Max 5000 chars |
| resolved | boolean | Default false |
| created_at | timestamptz | Auto |

### RLS Policies
- Published proposals: anyone can SELECT
- All proposals: authenticated users can SELECT, INSERT, UPDATE, DELETE
- Content blocks: authenticated can manage, public can read if proposal is published
- Comments: authenticated only (read + manage)

### Indexes
- `idx_content_blocks_proposal` on proposal_id
- `idx_content_blocks_order` on (proposal_id, block_order)
- `idx_comments_proposal` on proposal_id
- `idx_comments_block` on block_id
- `idx_proposals_status` on status
- `idx_proposals_slug` on slug

---

## File Structure

```
proposal-studio/
├── src/
│   ├── app/
│   │   ├── page.tsx                    # Dashboard (proposal grid)
│   │   ├── layout.tsx                  # Root layout (Geist fonts)
│   │   ├── globals.css                 # Tailwind v4 + animations
│   │   ├── login/page.tsx              # Magic link login + access control
│   │   ├── import/page.tsx             # HTML paste/upload + parse preview
│   │   ├── p/[slug]/
│   │   │   ├── page.tsx                # Public view (iframe, no auth)
│   │   │   └── edit/page.tsx           # Editor (contentEditable, sidebar, comments)
│   │   └── api/
│   │       ├── auth/callback/route.ts  # Supabase auth callback (open redirect protected)
│   │       ├── import/route.ts         # POST: parse HTML → create proposal + blocks
│   │       ├── proposals/
│   │       │   ├── route.ts            # GET: list proposals
│   │       │   └── [id]/
│   │       │       ├── route.ts        # GET/PATCH/DELETE proposal (field whitelisted)
│   │       │       └── publish/route.ts # PATCH: publish/unpublish
│   │       ├── blocks/[id]/
│   │       │   ├── route.ts            # PATCH: update block content/visibility
│   │       │   └── revert/route.ts     # POST: revert to original_html
│   │       └── comments/route.ts       # GET/POST/PATCH comments
│   ├── components/
│   │   ├── dashboard/
│   │   │   ├── dashboard-header.tsx    # User avatar, logout dropdown
│   │   │   └── proposal-card.tsx       # Card with actions (preview, copy, delete)
│   │   ├── editor/
│   │   │   ├── editor-toolbar.tsx      # Fixed toolbar (Back, Home, Sections, Comments, Publish)
│   │   │   ├── section-sidebar.tsx     # Block list with toggle + revert
│   │   │   └── comment-panel.tsx       # Comment thread + resolve
│   │   └── proposal/
│   │       └── proposal-renderer.tsx   # iframe srcdoc renderer (view + edit modes)
│   ├── lib/
│   │   ├── access-control.ts           # Email domain/whitelist check
│   │   ├── types.ts                    # Proposal, ContentBlock, Comment, ParseResult
│   │   ├── utils.ts                    # slugify, formatDate, debounce
│   │   ├── parser/
│   │   │   └── html-parser.ts          # Cheerio: extract styles/scripts/blocks
│   │   └── supabase/
│   │       ├── client.ts               # Browser client (createBrowserClient)
│   │       └── server.ts               # Server client (async cookies)
│   └── proxy.ts                        # Auth + access control + security headers
├── .env.local                          # Supabase URL + anon key (gitignored)
├── CLAUDE.md                           # Project rules for AI assistants
├── package.json                        # Dependencies + Node.js >=20
└── next.config.ts                      # React Compiler enabled
```

---

## Key Architecture Decisions

### 1. iframe + srcdoc for CSS Isolation
Proposal HTML has its own CSS (custom fonts, colors, layouts). Tailwind v4 would conflict. The iframe creates a completely isolated rendering context. We use `srcdoc` (not `doc.write()`) for reliable script execution timing.

### 2. Script Splitting (Global vs DOMContentLoaded)
Proposals use inline `onclick="togglePhase(this)"` and `oninput="calc()"` handlers. These need functions in global scope. But execution code (IntersectionObserver setup, initial calc calls) needs to wait for DOM. The `wrapScripts()` function splits: function declarations stay global, everything else wraps in DOMContentLoaded.

### 3. Universal Leaf-Text Editability
Instead of hardcoding CSS classes that are editable (breaks with each new HTML), we walk the DOM tree:
- Skip: script, style, SVG shapes, inputs, media
- Walk into: div, section, article, SVG containers (svg, g)
- Make editable: any element with direct text AND only inline children (strong, em, span, a)
- Also editable: SVG `<text>` elements (chart labels, diagram text)

### 4. Wrapper Class Tracking
The CPA report has `<div class="content-wrap">` (max-width: 960px, centered). The parser detects wrapper divs, expands their children into separate blocks, and stores the wrapper's class name. The renderer re-groups consecutive blocks with the same `wrapper_class` back into their wrapper div.

### 5. Forced-Reveal in Edit Mode
Many proposals use `.reveal { opacity: 0 }` with IntersectionObserver. In edit mode, CSS overrides force everything visible:
```css
.reveal, [class*="reveal"], [class*="animate"], [class*="fade"] {
  opacity: 1 !important; transform: none !important;
  transition: none !important; animation: none !important;
}
animate, animateTransform, animateMotion, set { display: none !important; }
svg path, svg rect, svg circle, svg text, svg g { opacity: 1 !important; }
```

### 6. Single Iframe Render (No Flash)
The editor renders the iframe ONCE on initial load. Block edits go directly to the API via contentEditable — they don't rebuild the iframe. This prevents the flash that occurred when `setBlocks()` triggered `useEffect → renderIframe()`.

### 7. HEAD_LINKS Markers
Font `<link>` tags and preconnects are stored with structured markers in the stylesheet field:
```
<!--HEAD_LINKS-->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?..." rel="stylesheet">
<!--/HEAD_LINKS-->
:root { --ink: #0f1117; ... }
```
The renderer parses these back into `<head>` elements. Backward-compatible with legacy `<!-- Font preconnects -->` format.

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
const ALLOWED_EMAILS = ['owenquintenta@gmail.com'];
```

### API Security
- **Auth**: Every mutation endpoint checks `supabase.auth.getUser()`
- **UUID validation**: Regex on all `[id]` params
- **Field whitelists**: Proposals PATCH only accepts `title` and `status`. Blocks PATCH only accepts `current_html`, `visible`, `label`
- **Payload limits**: 10MB request, 5MB HTML, 5000 char comments
- **Error sanitization**: Generic "Server error" messages, no DB internals leaked
- **Open redirect protection**: Auth callback validates `next` param (relative paths only)
- **Security headers**: X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy

### Protected Routes
| Route | Auth Required | Access Control |
|-------|--------------|----------------|
| `/` (dashboard) | Yes | Email whitelist |
| `/import` | Yes | Email whitelist |
| `/p/[slug]/edit` | Yes | Email whitelist |
| `/p/[slug]` (public) | No | Published proposals only |
| `/login` | No | — |
| `/api/auth/callback` | No | — |
| `/api/*` (mutations) | Yes | Via getUser() in each route |

---

## Tested HTML Patterns

| Proposal | Theme | Key Features Tested |
|----------|-------|-------------------|
| CPA Exam Report | Light, warm | content-wrap centering, simple sections, hero, rule dividers |
| Speed Quote Presentation | Dark | scroll reveal (.reveal.visible), onclick togglePhase, data-width bars, IntersectionObserver |
| Speed Quote CEO | Light, minimal | .wrap layouts, interactive calculator (oninput, range inputs), .v class reveal, mixed-content divs |
| Speed Quote Client v2 | Light, warm | SVG Sankey diagram with `<animate>`, donut charts, SVG `<text>` labels, interactive calculator, reveal animations |

---

## Commit History

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
| 9 | `e9d78e1` | Security: whitelists, UUID validation, headers, size limits |
| 10 | `c30584d` | Fix editor flashing, SVG editability, animation stability |
| 11 | `a056351` | Public repo: open redirect fix, error sanitization |
| 12 | `8a7a8f6` | Email-based access control (@designshopp.com + whitelist) |

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
| Custom SMTP (Resend) | **High** | Built-in Supabase email is rate-limited (~3-4/hr). Team magic links will fail under load. |
| Observability/logging | Medium | API routes have no logging. Add for production debugging. |
| Search/filter dashboard | Low | Useful at 10+ proposals |
| Export edited HTML | Low | Download the edited version |
| Team member management UI | Low | Currently managed via access-control.ts code changes |
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
- **Editor**: `src/app/p/[slug]/edit/page.tsx` — the main editor page (largest file ~510 lines)
- **Access control**: `src/lib/access-control.ts` — add/remove allowed emails and domains
- **Proxy**: `src/proxy.ts` — auth enforcement, security headers, protected routes

### Adding a New Allowed Email
Edit `src/lib/access-control.ts`:
```typescript
const ALLOWED_EMAILS = [
  'owenquintenta@gmail.com',
  'newemail@example.com',  // ← add here
];
```
Push to main → Vercel auto-deploys.

### Importing a New Proposal
1. Login at proposal-studio-mu.vercel.app
2. Click "Import New"
3. Paste the full HTML (or upload .html file)
4. Preview sections → "Create Proposal"
5. Edit text, toggle sections, leave comments
6. Publish → share the public URL

### Supabase MCP
The Supabase project is connected via MCP (`supabase-proposal-studio`). You can:
- `execute_sql` — run queries
- `apply_migration` — add columns/tables
- `list_tables` — inspect schema
- `get_logs` — check auth/API logs
