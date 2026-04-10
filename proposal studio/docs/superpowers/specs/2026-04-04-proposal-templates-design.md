# Proposal Templates Design Spec
**Date:** 2026-04-04
**Project:** Spilled Milk Agency / Design Shopp — Proposal Studio
**Status:** Approved for implementation

---

## Overview

Two data-driven HTML templates to replace manually crafted proposal files:

1. **Client Proposal Template** — sent to clients, Spilled Milk branded
2. **Internal Automation Doc Template** — internal reference for the team

Both templates are **single HTML files** where a `window.PROPOSAL_DATA` JSON object at the top of the file drives all rendered content. The AI's job is to extract structured JSON from a sales rep's text input; the template's job is to render it beautifully. This means zero changes to the existing proposal studio import pipeline — any populated template can be imported as-is.

---

## Architecture

```
Sales rep text input
        ↓
  Claude API (prompt + schema)
        ↓
  PROPOSAL_DATA JSON object
        ↓
  Injected into template HTML
        ↓
  Complete HTML file
        ↓
  Imported to Proposal Studio (/api/import)
        ↓
  Team reviews, comments, publishes
```

The template reads `window.PROPOSAL_DATA` on `DOMContentLoaded` and renders every section dynamically. If a field is missing or an array is empty, the section either hides itself or renders a safe fallback. This makes the template resilient to partial AI output.

---

## Template 1: Client Proposal

### Design Direction
- **Dark hero + light body**: dramatic Spilled Milk-branded dark header section transitions to clean off-white body for detailed content
- **Typography**: mix of a display serif (headlines) and clean sans-serif (body) — consistent with existing proposal style
- **Accent colors**: `#6c3fff` (Spilled Milk purple) as primary, `#3b82f6` (blue) as secondary
- **Interactive philosophy**: additive — the page reads fully without interaction; hover/click reveals additional detail without blocking reading flow

### Sections (in scroll order)

#### Section 01 — Hero (Dark)
Full-viewport dark section. Sets emotional tone — client feels immediately understood.

**Renders:**
- Spilled Milk logo (top left) + client logo or name (top right)
- Overline: `meta.projectType` (e.g. "Automation Proposal")
- Headline: `hero.headline` — the pain point restated as a statement
- Subtext: `hero.subtext` — 1–2 sentence context
- Stats row: `hero.stats[]` — 2–3 before/after number pairs, animated count-up on load

**Interaction:** Number count-up animation on page load. Stats use `{before, after, label}` shape.

#### Section 02 — The Solution (Light)
What we're building. Client-language only — no technical jargon.

**Renders:**
- Section overline + title from `solution.title`
- `solution.overview` — 1–2 sentence summary
- Capability cards grid: `solution.capabilities[]` — each card has `{icon, title, detail, outcome}`

**Interaction:** Hover on each card reveals the `outcome` field ("How this helps you") via a smooth expand or flip. Cards are in a 2×2 or 2×3 grid depending on count.

#### Section 03 — How It Works (Light)
Visual pipeline of the automation flow. Animated on scroll.

**Renders:**
- Horizontal or vertical step pipeline from `flow.steps[]` — each step: `{type, icon, title, desc, time}`
- `type` is either `"auto"` (purple node) or `"human"` (teal node) — visually distinct
- Decision gate label: `flow.gate` (e.g. "Prospect Decides")
- Two branch paths: `flow.branches.yes` and `flow.branches.no` — each: `{title, desc, stat}`

**Interaction:** Steps animate in sequentially as the section scrolls into view (IntersectionObserver). Each step node is clickable/tappable to expand its `desc` in a tooltip or inline drawer.

#### Section 04 — Implementation Phases (Light)
Each phase as an expandable accordion card.

**Renders:**
- Accordion list from `phases[]` — each phase: `{number, title, duration, description, deliverables[], clientNeeds[]}`
- Collapsed state: phase number badge, title, duration pill
- Expanded state: description, deliverables list, "What we need from you" list

**Interaction:** Click to expand/collapse. First phase open by default. Smooth CSS height transition.

#### Section 05 — Timeline (Light)
Visual horizontal timeline across all phases.

**Renders:**
- Phase blocks from `timeline.phases[]` — each: `{name, weeks, color?}`
- Block widths proportional to `weeks` value
- Total duration callout: `timeline.totalDuration`

**Interaction:** Hover over each phase block shows a tooltip with the phase deliverables summary. Clean, no Gantt complexity.

#### Section 06 — Investment (Dark accent)
Pricing section. Dark background signals importance and creates visual pause before final CTA.

**Renders:**
- Single total price: `investment.total` — displayed large and prominent
- Includes list: `investment.includes[]` — bullet points of what's covered
- Optional note: `investment.note` (payment terms, scope disclaimer, etc.)

**No interactive toggles** — total price only, clean and direct.

#### Section 07 — Next Steps (Light)
Short, frictionless. Ends with a clear CTA.

**Renders:**
- Numbered action items from `nextSteps[]` — each: `{action, detail}`
- CTA button: `cta.label` + `cta.href` (e.g. "Book a Call" → Calendly link)

**Interaction:** Static. CTA button opens `cta.href` in a new tab.

#### Footer (Dark)
**Renders:** Spilled Milk + Design Shopp logos, `meta.date`, `meta.preparedBy`, tagline.

---

### Full PROPOSAL_DATA Schema (Template 1)

```json
{
  "meta": {
    "client_name": "string",
    "project_name": "string",
    "projectType": "string",
    "date": "string",
    "preparedBy": "string"
  },
  "hero": {
    "headline": "string",
    "subtext": "string",
    "stats": [
      { "before": "string", "after": "string", "label": "string" }
    ]
  },
  "solution": {
    "title": "string",
    "overview": "string",
    "capabilities": [
      { "icon": "string", "title": "string", "detail": "string", "outcome": "string" }
    ]
  },
  "flow": {
    "steps": [
      { "type": "auto|human", "icon": "string", "title": "string", "desc": "string", "time": "string" }
    ],
    "gate": "string",
    "branches": {
      "yes": { "title": "string", "desc": "string", "stat": "string" },
      "no": { "title": "string", "desc": "string", "stat": "string" }
    }
  },
  "phases": [
    {
      "number": "number",
      "title": "string",
      "duration": "string",
      "description": "string",
      "deliverables": ["string"],
      "clientNeeds": ["string"]
    }
  ],
  "timeline": {
    "totalDuration": "string",
    "phases": [
      { "name": "string", "weeks": "number" }
    ]
  },
  "investment": {
    "total": "string",
    "includes": ["string"],
    "note": "string"
  },
  "nextSteps": [
    { "action": "string", "detail": "string" }
  ],
  "cta": {
    "label": "string",
    "href": "string"
  }
}
```

---

## Template 2: Internal Automation Doc

### Design Direction
- **Light + Structured**: clean white/light-grey (#f8f9fa), high information density
- **Spilled Milk colors as accents only**: purple for headings and status badges, not backgrounds
- **Notion-inspired**: collapsible sections, clear hierarchy, status indicators throughout
- Purpose: internal reference for the team — optimized for scanning and reading, not presentation

### Sections

#### Header
Project identity at a glance.

**Renders:** `project.client`, `project.name`, `project.status` (color-coded badge: Draft / In Progress / Complete), `project.phase` (current phase), `project.owner`, `project.date`

#### Goal & Overview
**Renders:** `goal.summary` (bold lead), `goal.problem`, `goal.outcome`

#### Workflow Steps
Numbered list of automation phases with type labels.

**Renders:** `workflow[]` — each: `{number, type, title, desc, details[]}`
- `type` options: `"Automation"`, `"AI"`, `"Human"`, `"Automation & AI"`
- `details[]` — sub-bullet points

**Interaction:** Each step is collapsible. Collapsed shows number + title + type badge. Expanded shows desc + details.

#### Tech Stack
Simple reference table.

**Renders:** `tech[]` — each: `{tool, purpose, notes}`

#### Phase Status
Progress tracker across all phases.

**Renders:** `status.phases[]` — each: `{name, status, dueDate, notes}`
- Status badge colors: Done (green), In Progress (amber), Pending (grey), Blocked (red)

#### Notes & Decisions
**Renders:** `notes[]` — each: `{date, author, note}`
Each entry is a dated log item. Expandable if long.

---

### Full PROPOSAL_DATA Schema (Template 2)

```json
{
  "project": {
    "client": "string",
    "name": "string",
    "status": "Draft|In Progress|Complete",
    "phase": "string",
    "owner": "string",
    "date": "string"
  },
  "goal": {
    "summary": "string",
    "problem": "string",
    "outcome": "string"
  },
  "workflow": [
    {
      "number": "number",
      "type": "Automation|AI|Human|Automation & AI",
      "title": "string",
      "desc": "string",
      "details": ["string"]
    }
  ],
  "tech": [
    { "tool": "string", "purpose": "string", "notes": "string" }
  ],
  "status": {
    "phases": [
      { "name": "string", "status": "Done|In Progress|Pending|Blocked", "dueDate": "string", "notes": "string" }
    ]
  },
  "notes": [
    { "date": "string", "author": "string", "note": "string" }
  ]
}
```

---

## Shared Technical Constraints

### Data Injection Pattern
Both templates ship with a placeholder `PROPOSAL_DATA` block at the very top of the single `<script>` tag. The AI generation route (a new `/api/generate` endpoint in the proposal studio, separate from `/api/import`) populates this object before the file is created. The completed HTML file — with data already baked in — is then passed to the existing `/api/import` route unchanged.

```html
<script>
// --- DATA: populated by /api/generate before import ---
window.PROPOSAL_DATA = { /* AI-generated JSON injected here */ };

// --- RENDER: all rendering logic lives below ---
// wrapScripts() in the parser hoists named function declarations to global
// scope; everything else (including the render call below) gets wrapped in
// DOMContentLoaded. Because PROPOSAL_DATA assignment and the render call are
// in the SAME script block, both are wrapped together in one DOMContentLoaded
// callback — so PROPOSAL_DATA is always assigned before renderProposal() reads it.
function renderProposal() { /* ... */ }
renderProposal(); // wrapped in DOMContentLoaded by parser — runs after assignment
</script>
```

**Why this works with wrapScripts():** The proposal studio's `wrapScripts()` utility (in `src/lib/utils/wrap-scripts.ts`) splits a script block into two groups — named `function` declarations stay at global scope, everything else (assignments, calls, listeners) is wrapped in a single `DOMContentLoaded`. Because `PROPOSAL_DATA = {...}` and `renderProposal()` are both non-declaration statements in the same `<script>` block, they land in the same `DOMContentLoaded` callback in their original order. The assignment runs first, then the render call reads it. No race condition.

**Owner of the injection step:** A new `/api/generate` route in the proposal studio (future work, informed by this spec). It accepts `{ text: string }`, calls Claude with the schema prompt, receives JSON, string-replaces the placeholder in the template file, and calls the existing import logic. This route is out of scope for the template build but is defined here so the template author knows where the injection contract lives.

### Resilience Rules
- If an array is empty, the corresponding section hides via `display:none`
- If a required string field is missing, the element renders an empty string (no crash)
- Optional fields checked before render: `investment.note`, `cta.href`, `flow.gate`, `flow.branches`
- If `flow.branches` is absent, the pipeline section ends after the last step with no decision gate shown
- `timeline.phases[].color` defaults to `#6c3fff` (Spilled Milk purple) when omitted
- `hero.stats[].before` and `hero.stats[].after` must be **numeric strings only** (e.g. `"4"`, `"92%"`, `"0"`) — the AI prompt schema enforces this constraint. The count-up animation strips non-numeric characters (e.g. `%`, `h`, `+`) before counting, then reappends them after. If the value contains no digits, the stat renders as plain text with no animation.
- `phases[]` and `timeline.phases[]` must have the same length and same ordering — the AI prompt enforces this by generating both from the same source phases. If lengths differ, the timeline renders only up to `Math.min(phases.length, timeline.phases.length)`.

### Compatibility with Proposal Studio
- Single-file HTML with all CSS and JS inline
- **No Google Fonts `<link>` tags** — fonts loaded via `@import url(...)` inside a `<style>` block so the Cheerio parser preserves them (the parser extracts `<style>` content but drops `<head>` link tags)
- No `<canvas>`, `<video>`, or `<iframe>` elements (flagged as warnings on import)
- All interactive functions declared with `function foo() {}` syntax — not arrow functions or `const` — so `wrapScripts()` hoists them to global scope and inline `onclick` handlers can find them
- **No SVG-based animations** in the pipeline diagram — use CSS/HTML only (divs, borders, pseudo-elements) to avoid SVG-inside-contenteditable cross-browser breakage in edit mode
- Reveal animations use `IntersectionObserver` with `opacity: 0` as the pre-animation state. The proposal studio injects `data-edit-mode="true"` on the iframe's `<body>` in edit mode. Template CSS must include: `body[data-edit-mode] * { opacity: 1 !important; animation: none !important; transition: none !important; }` to force-reveal all content for editors
- Accordion height transitions use JavaScript `scrollHeight` measurement (not `height: auto`) to enable smooth CSS animation: collapse sets `el.style.height = el.scrollHeight + 'px'` then on next frame sets `el.style.height = '0'`; expand reverses this
- `capabilities[].icon` must be a single Unicode emoji character — the AI prompt enforces this format. No SVG strings, no icon names.

---

## Implementation Notes (for the template builder)

1. **Single `<script>` tag only.** Keep all JS in one block. Splitting into a second `<script>` breaks the `wrapScripts()` execution-order guarantee — `PROPOSAL_DATA` would be assigned in a separate `DOMContentLoaded` listener with no ordering guarantee relative to the render call.

2. **Verify `data-edit-mode` attribute before shipping.** The spec says the proposal studio injects `data-edit-mode="true"` on the iframe `<body>` in edit mode. Confirm this against the actual source (`src/app/p/[slug]/edit/page.tsx` or `proposal-renderer.tsx`) before writing the edit-mode CSS override — if the attribute name is different, the forced-reveal CSS silently does nothing and all animated content is invisible to editors.

3. **Template 2 resilience:** Apply the "empty array hides section" rule to `notes[]`, `tech[]`, and `status.phases[]` even though they are not individually listed in the Resilience Rules — the general rule covers both templates.

4. **Two separate status enums.** `project.status` (Draft / In Progress / Complete) and `status.phases[].status` (Done / In Progress / Pending / Blocked) need separate badge-color maps in the render logic.

5. **CSP check for Google Fonts.** The `@import url(https://fonts.googleapis.com/...)` approach requires the Vercel deployment's CSP to allow `style-src fonts.googleapis.com` and `font-src fonts.gstatic.com`. Check existing CSP headers before the first deploy — silent font fallback to system fonts is easy to miss.

6. **Log phase array mismatches.** If `phases[]` and `timeline.phases[]` lengths differ, emit `console.warn('PROPOSAL_DATA: phases and timeline.phases length mismatch')` so mismatches are visible during development before they reach a client.

---

## Out of Scope
- The AI prompt engineering (separate deliverable, informed by the schemas above)
- The backend route that calls Claude and injects JSON into the template
- Any changes to the existing proposal studio codebase
- The internal doc template does not need interactive animations — static rendering only
