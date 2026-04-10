# Proposal Studio — Complete Session Handoff

> **Session Date**: March 28, 2026
> **Purpose**: Brainstorming & planning a collaborative proposal editing system for Design Shopp
> **Status**: Plan complete, ready to build v1

---

## Background & Trigger

Owen presented the **CPA Exam Automation Report** to the team as a polished 1-page HTML proposal (not a PDF). The team loved the quality and wants to adopt HTML proposals as the standard. The problem: Owen is the only one who can create/edit HTML. Sales and CEO need a way to review, edit content, remove sections, and publish proposals themselves.

### The CPA Report That Started This
- File: `C:\Users\owenq\Downloads\CPA_Automation_Report (1).html`
- Single-page HTML with custom CSS (Fraunces + DM Sans fonts)
- Sections: Hero stats, Problem statement, Solution/workflow diagram, Routing table, Test results, Cost comparison with ROI, Roadmap phases, Next steps
- Well-crafted responsive design with CSS variables, animations, status badges
- This is the quality bar — any system built must preserve this level of polish

### Supporting Files Reviewed
- `C:\Users\owenq\Downloads\CPA Files\Missing Trainer's Signature.pdf` — CPA exam sample (100-11, Dalton Frowen)
- `C:\Users\owenq\Downloads\CPA Files\Missing Trainer Signature.pdf` — CPA exam samples (100-04, multiple students)
- `C:\Users\owenq\Downloads\CPA Files\Missing Passing Grade, Trainer's Signature, Name PTI Trainer ID# and Exam Access Key.pdf` — CPA exam sample (100-09, Scott Best)
- `C:\Users\owenq\Downloads\CPA Files\Hands-on practical not completed.pdf` — CPA exam sample (400-04, Garry Redman)
- Plus the photo of exam 100-12 (Shane Robertson) shown at conversation start

---

## Brainstorming Decisions (Q&A Summary)

### Who uses this?
- **Owen**: Creates proposals using Claude, imports HTML into the system
- **Sales team / CEO**: Reviews, edits text/content, removes sections, publishes
- **Clients**: View published proposals via shareable links

### Team technical level?
- Comfortable with Notion/Google Docs level tools
- Do NOT want drag-and-drop or website builder interfaces
- Just want to click text and change it, toggle sections, publish

### Volume?
- 4-10 proposals per month

### How do they edit?
- **Both** direct editing AND comment/feedback
- Some people edit directly, others leave feedback for others to implement

### Delivery format?
- **Shareable links** (not PDF, not internal-only)

### Budget?
- Open — whatever works best

### Business model?
- Owen builds and owns the tool
- Two options considered:
  1. **Sell outright to Design Shopp** ($5,000-8,000 CAD)
  2. **Owen owns, Design Shopp licenses** ($2,500-3,500 setup + $250-400/mo) — **preferred**

### Owen's dev skills?
- Primarily uses AI to code (Claude Code + v0.dev)
- Has used v0.dev and Claude Code
- Understands code enough to guide and review

### Workflow clarification?
- Owen is ALWAYS the initial proposal creator (for now)
- Team is ALWAYS the reviewer/editor
- Sometimes Sales sends Owen a rough draft (email/text) → Owen prompts it into HTML
- Eventually, Sales should be able to self-serve with templates + AI generation

### Scalability concern?
- Addressed with 3-phase product roadmap (see below)
- v1: Owen creates, team edits
- v2: Template library + AI generation from drafts
- v3: Smart proposals with website scraping + brand matching

---

## Three Approaches Considered

### Approach A: Custom Proposal Builder on Vercel (CHOSEN)
- Next.js app, Owen uploads HTML, team edits inline, publishes as shareable link
- Full design control, tailored UX, scalable
- Requires building (~5-6 days)

### Approach B: Notion + n8n HTML Generator Pipeline (REJECTED)
- Team edits in Notion, n8n converts to styled HTML
- Loses fine-grained design control, gap between Notion view and final HTML

### Approach C: Existing SaaS Tool — Gamma, Framer, Typedream (REJECTED)
- Zero dev work but can't match Owen's custom HTML quality
- Not designed for proposal workflows specifically

---

## Product Roadmap

### v1: "Import, Edit, Publish" — BUILD NOW
- Owen imports Claude-generated HTML
- System parses HTML into editable content blocks
- Team edits text inline on the real design
- Toggle sections visible/hidden
- Comments system
- Publish as shareable URL
- **Build time: 19-23 hours (5 days at ~4 hrs/day)**

### v2: "Draft to Proposal" — BUILD LATER
- Sales pastes rough draft or fills brief (client name, project type, key numbers)
- System uses Owen's embedded Claude prompts to generate polished proposal
- Team reviews, edits, publishes
- Productizes Owen's prompt engineering
- **Build time: 9-12 hours additional**

### v3: "Smart Proposals" — FUTURE
- Sales enters client website URL
- System scrapes site (using Firecrawl MCP tool)
- Analyzes brand colors, fonts, industry, what they do
- Generates brand-matched proposal automatically
- **Build time: 15-20 hours additional**

---

## v1 Technical Specification

### Tech Stack

| Layer | Technology | Cost | Why |
|-------|-----------|------|-----|
| Framework | Next.js 14 (App Router) | Free | SSR for public views, API routes, great DX |
| Styling | Tailwind CSS (app UI) + preserved proposal CSS | Free | Clean app UI + Owen's custom proposal styles |
| Inline Editor | Tiptap (headless rich text) | Free (open source) | Click-to-edit text in preview mode |
| Database + Auth + Storage | Supabase (PostgreSQL) | Free tier (500MB, 50k rows) | All-in-one: data, auth, file storage |
| Hosting | Vercel | Free tier or $20/mo Pro | Auto-deploy, edge CDN, Next.js native |
| Domain | `proposals.designshopp.com` | $0 (subdomain) | Clean client-facing URLs |
| **Monthly running cost** | | **$0-20/mo** | |

### Build Tools

| Tool | What For |
|------|----------|
| **Claude Code** | Backend, API routes, HTML parser, template engine, editor logic, Supabase integration |
| **v0.dev** | UI component generation: dashboard, editor toolbar, sidebar panels, form components |

**Build workflow**: Use v0 to generate UI components → bring into project → use Claude Code to wire backend/logic.

### Architecture

```
Vercel (hosting)
  └── Next.js App
       ├── /                    Dashboard (Owen — list/manage proposals)
       ├── /import              HTML import (Owen — paste/upload)
       ├── /p/[slug]            Public view (Client — no auth, clean URL)
       ├── /p/[slug]/edit       Inline editor (Team — auth required)
       ├── /login               Magic link login (Supabase Auth)
       └── /api/*               API routes
            └── Supabase (PostgreSQL + Auth + Storage)
```

### Data Model

```sql
-- proposals table
proposals (
  id            uuid PRIMARY KEY,
  slug          text UNIQUE,           -- for clean URLs like /p/cpa-automation
  title         text,
  status        text CHECK (status IN ('draft', 'review', 'published')),
  original_html text,                  -- Owen's pasted HTML (preserved)
  stylesheet    text,                  -- extracted <style> content
  scripts       text,                  -- extracted <script> content
  created_by    uuid REFERENCES auth.users,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
)

-- content_blocks table (one per section of the proposal)
content_blocks (
  id            uuid PRIMARY KEY,
  proposal_id   uuid REFERENCES proposals(id) ON DELETE CASCADE,
  block_order   integer,               -- display order
  visible       boolean DEFAULT true,  -- toggle show/hide
  label         text,                  -- auto-detected: "Hero", "The Problem", etc.
  original_html text,                  -- original section HTML
  current_html  text,                  -- edited version (starts as copy of original)
  updated_at    timestamptz DEFAULT now()
)

-- comments table
comments (
  id            uuid PRIMARY KEY,
  proposal_id   uuid REFERENCES proposals(id) ON DELETE CASCADE,
  block_id      uuid REFERENCES content_blocks(id),  -- nullable, for general comments
  author_id     uuid REFERENCES auth.users,
  author_name   text,
  text          text,
  resolved      boolean DEFAULT false,
  created_at    timestamptz DEFAULT now()
)
```

### HTML Parser Logic (Core Innovation)

When Owen pastes full HTML, the parser:

1. **Extracts `<style>` blocks** → stored as `stylesheet` in proposals table
2. **Extracts `<script>` blocks** → stored as `scripts` (for animations, smooth scroll, etc.)
3. **Splits `<body>` content** at top-level semantic elements:
   - `<header>`, `<section>`, `<footer>`, `<div class="rule">` (dividers)
   - Each becomes a `content_block`
4. **Auto-labels blocks** from headings or CSS classes:
   - Finds first `<h2>` or section title → uses as label
   - Falls back to class name analysis (e.g., `.hero` → "Hero Section")
5. **Marks editable elements** within blocks:
   - Text nodes, headings, paragraphs, list items, table cells get `contenteditable` data attributes
   - Images get "replace" affordance
6. **Preserves everything**: original HTML structure, CSS classes, inline styles — the rendered output is pixel-identical to Owen's original

**This means any HTML Owen creates with Claude works** — no special template format needed. The system adapts to whatever HTML structure Claude produces.

### Pages Detail

#### Dashboard (`/`)
- Grid of proposal cards with: title, status badge (draft/review/published), last edited, created by
- "Import New" button → goes to /import
- Search/filter by status
- Quick actions: duplicate, archive, delete

#### Import Page (`/import`)
- Large text area: "Paste your HTML here"
- OR file upload button (.html files)
- "Parse" button → shows preview of detected sections
- Each section shown as a collapsible card with label + preview
- "Create Proposal" → saves to Supabase, redirects to edit page

#### Public View (`/p/[slug]`)
- No auth required — anyone with the link can view
- Renders: proposal stylesheet in `<style>` tag + visible content blocks in order + scripts
- Should be pixel-perfect match with Owen's original HTML
- Responsive (preserves Owen's media queries)
- SEO meta tags (title, description)
- Only accessible when proposal status = "published"

#### Inline Editor (`/p/[slug]/edit`)
- Auth required (magic link login)
- **What the team sees**: the full styled proposal (identical to public view) PLUS:
  - **Floating toolbar** at top: "Editing: [Title]" + [Sections] + [Comments] + [Publish]
  - **Hover effect**: subtle blue outline + pencil icon on hoverable text elements
  - **Click text** → inline Tiptap editor opens, they type directly
  - **[Sections] button** → slides out sidebar with:
    - List of all content blocks with labels
    - Toggle switches (show/hide each section)
    - Reorder is NOT included (team doesn't want drag-and-drop) — Owen controls order via import
  - **[Comments] button** → slides out comment panel:
    - List of comments grouped by section
    - Click "Add comment" → click a section → type comment
    - Resolve button on each comment
  - **[Publish] button** → confirmation dialog → generates public URL → copy to clipboard
  - **Auto-saves** every edit with "Saved ✓" indicator in toolbar

#### Login Page (`/login`)
- Simple email input
- Supabase sends magic link to email
- Click link → logged in, redirected to dashboard or edit page

### Editing Experience (Critical UX Detail)

The team should feel like they're editing a Google Doc that happens to look like a website. Specifically:

1. **No modes to switch between** — they see the real proposal with edit affordances overlaid
2. **No forms to fill** — they click directly on the text they want to change
3. **No learning curve** — if they can use Google Docs, they can use this
4. **Changes are instant** — they see the styled result as they type
5. **Section hiding is simple** — toggle switch in a sidebar, not drag-and-drop
6. **Comments are contextual** — pinned to specific sections, not floating

---

## Build Schedule

### Day 1: Foundation (5-6 hours)
| # | Task | Hours | Tool |
|---|------|-------|------|
| 1 | `npx create-next-app` with TypeScript + Tailwind CSS | 0.5 | Claude Code |
| 2 | Create Supabase project (database + auth + storage) | 0.5 | Manual + Claude Code |
| 3 | Database migration: create proposals, content_blocks, comments tables | 0.5 | Claude Code |
| 4 | Supabase Auth setup (magic link provider) + middleware | 1 | Claude Code |
| 5 | HTML parser: paste → extract `<style>` + split `<body>` into blocks | 2-2.5 | Claude Code |
| 6 | Basic layout/nav component | 0.5 | Claude Code |

### Day 2: Core Rendering (4-5 hours)
| # | Task | Hours | Tool |
|---|------|-------|------|
| 7 | Import page UI (paste textarea + upload + "Parse" button) | 1 | v0 + Claude Code |
| 8 | Parse preview (show detected sections as collapsible cards) | 1 | v0 + Claude Code |
| 9 | Public view page: render stylesheet + blocks + scripts | 1.5 | Claude Code |
| 10 | **TEST**: Import CPA report HTML → verify public view is pixel-identical | 1-1.5 | Manual |

### Day 3: Inline Editor (5-6 hours)
| # | Task | Hours | Tool |
|---|------|-------|------|
| 11 | Floating editor toolbar component | 1 | v0 |
| 12 | Click-to-edit with Tiptap: detect editable elements, open inline editor | 2-2.5 | Claude Code |
| 13 | Section sidebar: list blocks with labels + visibility toggles | 1.5-2 | v0 + Claude Code |
| 14 | Auto-save: debounced save of current_html to Supabase | 0.5 | Claude Code |

### Day 4: Comments + Dashboard (4-5 hours)
| # | Task | Hours | Tool |
|---|------|-------|------|
| 15 | Comment panel UI (slide-out sidebar) | 1 | v0 |
| 16 | Comment CRUD: add comment to block, resolve, list | 1 | Claude Code |
| 17 | Dashboard: proposal grid with cards, status badges, search | 1.5 | v0 + Claude Code |
| 18 | Publish/unpublish: status toggle + URL generation + copy link | 0.5-1 | Claude Code |

### Day 5: Polish + Deploy (3-4 hours)
| # | Task | Hours | Tool |
|---|------|-------|------|
| 19 | Responsive polish: mobile nav, loading skeletons, error states | 1.5 | Claude Code |
| 20 | Vercel deployment + GitHub repo + custom domain setup | 1 | Claude Code |
| 21 | End-to-end test: full flow from import → edit → publish → view | 0.5-1 | Manual |

### Total: 19-23 hours across 5 working days

---

## File Structure

```
proposal-studio/
├── app/
│   ├── layout.tsx                    # Root layout + nav + Supabase provider
│   ├── page.tsx                      # Dashboard (list proposals)
│   ├── login/page.tsx                # Magic link login
│   ├── import/page.tsx               # HTML import (paste/upload)
│   ├── p/
│   │   └── [slug]/
│   │       ├── page.tsx              # Public view (no auth required)
│   │       └── edit/page.tsx         # Inline editor (auth required)
│   └── api/
│       ├── proposals/
│       │   ├── route.ts              # List + create proposal
│       │   └── [id]/
│       │       ├── route.ts          # Get + update + delete proposal
│       │       └── publish/route.ts  # Publish/unpublish
│       ├── blocks/
│       │   └── [id]/route.ts         # Update block content/visibility/order
│       ├── comments/route.ts         # CRUD comments
│       ├── import/route.ts           # HTML parser API endpoint
│       └── auth/callback/route.ts    # Supabase auth callback
├── components/
│   ├── ui/                           # Shared: buttons, badges, inputs, dialogs
│   ├── dashboard/
│   │   └── proposal-card.tsx         # Proposal list item with status badge
│   ├── editor/
│   │   ├── editor-toolbar.tsx        # Floating top toolbar
│   │   ├── inline-text-editor.tsx    # Tiptap inline overlay (click-to-edit)
│   │   ├── section-sidebar.tsx       # Section list + visibility toggles
│   │   ├── comment-panel.tsx         # Comment list + add
│   │   └── comment-pin.tsx           # Comment indicator on blocks
│   ├── proposal/
│   │   ├── proposal-renderer.tsx     # Master renderer: blocks + stylesheet
│   │   └── block-wrapper.tsx         # Wraps each block with edit affordances
│   └── import/
│       ├── html-input.tsx            # Paste/upload interface
│       └── parse-preview.tsx         # Preview parsed sections before saving
├── lib/
│   ├── supabase/
│   │   ├── client.ts                 # Browser Supabase client
│   │   ├── server.ts                 # Server Supabase client
│   │   └── middleware.ts             # Auth middleware for protected routes
│   ├── parser/
│   │   └── html-parser.ts           # Core: HTML string → stylesheet + content blocks
│   ├── types.ts                      # TypeScript interfaces (Proposal, ContentBlock, Comment)
│   └── utils.ts                      # Helpers (slug generation, etc.)
├── supabase/
│   └── migrations/
│       └── 001_initial_schema.sql    # Full database schema
├── public/                           # Static assets
├── tailwind.config.ts
├── next.config.js
├── package.json
├── .env.local                        # NEXT_PUBLIC_SUPABASE_URL, SUPABASE_ANON_KEY, etc.
└── README.md
```

---

## Pricing & Business Model

### Option A: Sell Outright to Design Shopp
| Item | Amount |
|------|--------|
| One-time price | $5,000-8,000 CAD |
| Includes | Built app, deployment, 1 month bug fixes, 3 proposal templates |
| They get | Full code ownership, deployment on their Vercel |
| Owen gets | One-time payment, moves on |

### Option B: Owen Owns + Design Shopp Licenses (RECOMMENDED)
| Item | Amount |
|------|--------|
| Setup fee | $2,500-3,500 CAD |
| Monthly license | $250-400 CAD/month |
| Includes | Hosting, maintenance, updates, 2 templates/month, support |
| Owen retains | Full IP and codebase ownership |
| Annual value to Owen | $5,500-8,300 CAD (setup + 12 months) |
| Future potential | License to other companies, build into SaaS product |

### Option C: Hybrid
| Item | Amount |
|------|--------|
| Build fee | $3,500-5,000 CAD |
| Monthly maintenance | $150-200 CAD/month |
| Owen retains | IP, Design Shopp gets 12-month exclusive use |

### Value Justification (For Pitching to Design Shopp)
- **Time saved**: 4-10 proposals/month × 2 hrs saved per proposal = **8-20 hrs/month**
- **Cost saved**: At $40-60/hr loaded cost = **$320-1,200/month in productivity**
- **Revenue impact**: Professional HTML proposals vs PDF = higher close rate on deals
- **ROI**: Tool pays for itself in **month 1-2**
- **Scalability**: Once templates exist, Sales can self-serve (v2+)

---

## Verification Checklist (After Build)

- [ ] Import CPA report HTML → public view is pixel-identical to original
- [ ] Click text in editor → change it → refresh → changes persisted in Supabase
- [ ] Toggle section off in sidebar → public view doesn't show that section
- [ ] Add comment on a block → other logged-in user sees it → resolve it
- [ ] Magic link login works → edit page requires auth → public view is open to anyone
- [ ] Set proposal to "published" → accessible at /p/[slug] → set to "draft" → returns 404
- [ ] Published proposal is responsive on mobile (preserves Owen's CSS media queries)
- [ ] Non-technical team member completes full edit → publish flow without instructions

---

## Reference: CPA Report HTML Structure

The first proposal to import (for testing) has this structure:

```html
<header class="site-header">    → "Header" block (logo + nav + badge)
<section class="hero">          → "Hero" block (title, stats grid)
<section id="problem">          → "The Problem" block (cards, problem list)
<div class="rule">              → Divider (auto-hidden, structural)
<section id="solution">         → "The Solution" block (workflow diagram, fields grid)
<div class="divider-label">     → "Routing Logic" label
<div class="card">              → Routing table block
<div class="rule">              → Divider
<section id="results">          → "Test Results" block (test grid, accuracy note)
<div class="rule">              → Divider
<section id="costs">            → "Costs & ROI" block (cost comparison, ROI stats)
<div class="rule">              → Divider
<section id="roadmap">          → "Roadmap" block (phase cards, total hours)
<div class="rule">              → Divider
<section>                       → "Next Steps" block (step rows)
<footer class="site-footer">    → "Footer" block (credits)
```

CSS uses custom properties (`:root` variables), Google Fonts (Fraunces + DM Sans), and responsive breakpoints at 768px.

---

## Key Decisions Made During Brainstorming

1. **Custom app over SaaS tools** — preserves Owen's design quality (Gamma/Framer can't match it)
2. **Custom app over Notion pipeline** — avoids Notion↔HTML fidelity gap
3. **Inline editing on real design** — not a separate form/CMS view (team sees what client sees)
4. **HTML import (any HTML works)** — not a rigid template system (flexible, future-proof)
5. **Magic link auth** — no passwords, simple for non-technical team
6. **Phase-by-phase delivery** — ship v1 fast, add AI generation and smart proposals later
7. **Owen retains IP** — licenses to Design Shopp, can scale to other clients/SaaS later
8. **No drag-and-drop** — team explicitly doesn't want website builder UX, just text editing + section toggles
