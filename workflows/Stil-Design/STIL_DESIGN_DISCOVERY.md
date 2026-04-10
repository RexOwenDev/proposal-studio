# Stil Design — Speed Quote Automation
## Discovery Phase Brief
**Project:** Stil Design × Spilled Milk (Internal)
**Logged under:** Intervals → Discovery Spilled Milk [DSCOVRY]
**Hour cap:** 5 hours (discovery only, not invoiced yet)
**Last updated:** April 2026

---

## Project Context

**Who:** Stil Design — custom closet company, Pointe-Claire QC. Run by Shawn Evans (sevans@stildesign.ca).

**The Problem:**
Shawn invests 2–3 hours building full CAD designs + estimates in ClosetPro before a prospect commits. Prospects take the design to competitors or ghost due to pricing shock before committing.

**The Goal of This Discovery:**
Prove that a form → AI rendering pipeline is feasible. Specifically:
- Shawn fills in a simple form describing a project
- The automation generates a concept rendering
- Output is 85–90% accurate to what the final CAD render would look like
- This saves Shawn from doing full CAD work on unqualified leads

**Important clarification from Melissa (meeting):**
> "That form is only for Shawn to use at first."
The form does NOT need to be client-facing yet. It's an internal tool for Shawn only. It just needs clear instructions on what to input.

---

## Current Status

### ✅ Done
- Analyzed 6 Stil Design PDF documents (3 design renders + 3 estimates)
- Confirmed current renders are CAD software outputs (ClosetPro), NOT photorealistic
- Identified FLUX API (FluxAPI.ai) as the rendering tool
- Researched and confirmed pricing: $0.025/image (Kontext Pro), $0.0005/text (GPT-4o mini)
- Built and iterated prompt versions for R2 (Bedroom) and R4 (Primary Closet)
- Confirmed render style preference: detailed/realistic (NOT sketch style) — confirmed by Melissa
- Built internal proposal site: `C:/Users/owenq/Downloads/stil-design-proposal.html`
- Melissa emailed Shawn requesting 15 simple + 5 complex renderings (CC: Taylor, Cece)
- **Received and analyzed 13 render PDFs from Shawn (April 2026)** — 20+ rooms across all complexity levels
- **Finalized form fields** based on 13-render corpus
- **Finalized prompt template** mapping form fields → FLUX prompt
- **Defined 8-test sequence** ordered easy → hard

### ⏳ Next Step
- Run the 8 test renders against FLUX API
- Rate each for accuracy vs. source CAD render (0–100%)
- Document drift patterns and adjust prompt template
- Log time in Intervals → Discovery Spilled Milk [DSCOVRY]

---

## Discovery Scope (5-Hour Cap)

```
Shawn describes a project via form fields
        ↓
Form inputs map to a structured FLUX prompt
        ↓
FLUX Kontext Pro generates rendering
        ↓
Output compared to actual CAD render
        ↓
Iterate until 85-90% fidelity achieved
```

### Deliverables for This Discovery
1. Draft form fields that Shawn would use to describe a project
2. Prompt template that maps form fields → FLUX prompt
3. Test results: sample renderings with accuracy notes
4. Feasibility verdict + time estimate for full build
5. This document updated with findings

---

## Rendering Samples Requested from Shawn

Melissa sent this email during the call:
- **15 renderings** — recent, simple projects
- **5 renderings** — slightly more complex (more panels, smaller measurements)
- Total: **20 renderings**

**What "complex" means in this context (from Owen):**
> "Sometimes there's panels over panels with small adjustments, or a small distance. The more spacing, the easier the model reads it."
More panels stacked, tighter measurements = more complex.

---

## FLUX API Setup

**Provider:** FluxAPI.ai (https://fluxapi.ai)
**Model:** FLUX Kontext Pro
**Cost:** $0.025 per image
**Auth:** Bearer Token
**Endpoint:** POST /api/v1/flux/kontext/generate

**Pricing tiers:**
| Credits | Price |
|---|---|
| 1,000 | $5 |
| 10,000 | $50 |
| 105,000 | $500 (5% off) |

**Monthly cost estimate (with 30% buffer):**
| Volume | Budgeted Total |
|---|---|
| 50 leads/mo | ~$3.35/mo |
| 200 leads/mo | ~$13.15/mo |

**Why FluxAPI.ai over fal.ai:**
- 37% cheaper for the same Kontext Pro model
- fal.ai = $0.040/image vs FluxAPI.ai = $0.025/image
- No subscription, credit-based, no minimums

**Why Kontext Pro over DALL-E 3 or SDXL:**
- Handles material textures (wood grain, matte/gloss) accurately
- Better spatial geometry for closet layouts
- Can edit existing images (image-to-image) for style variants
- SDXL is too low quality for client-facing output
- Midjourney has NO public API — cannot be automated

---

## What Stil Design's Current Renders Actually Look Like

From analyzing the 3 design PDFs (Aram Masseredjian, Aryeh Bensabath, Baril Design):

- **Software used:** ClosetPro (or similar dedicated cabinet CAD tool)
- **Render style:** Clean CAD 3D renders — NOT photorealistic
  - Gray walls, dark wood floors, white melamine panels
  - Flat ambient lighting, minimal shadows
  - Multiple views: perspective 3D + 2D elevation drawings with fractional measurements
- **FLUX cannot replicate:** The 2D technical drawings with exact measurements (76 3/8", etc.)
- **FLUX can produce:** Concept renders that capture the style, material, and general configuration
- **The renders serve different purposes:**
  - CAD renders = post-site-visit technical deliverable for installation
  - FLUX renders = pre-commitment concept to excite the prospect

**Materials seen in actual projects:**
- 3/4" Supermat Nova White Melamine (most common)
- AGT 313 Arctic Grey (office projects)
- Slab drawer fronts
- Chrome oval rods
- Undermount soft-close drawer glides (Matrix 30KG)
- Toe kicks (2.5")
- Full panels + backing

---

## Prompt Engineering — What We Know So Far

### Render Style Decision
**Use:** Detailed/realistic render style (NOT sketch, NOT SketchUp-style)
**Melissa's reasoning:** "If I was to get a project and I saw that, I'd be like, okay, I can really visualize it."

### Best Style Trigger Phrase
```
Professional architectural 3D render... Clean product visualization 
style — crisp lines, accurate materials, controlled studio lighting. 
Not a lifestyle photo, not a sketch. Think high-quality cabinet 
manufacturer catalogue render.
```

### Anti-Hallucination Block (critical — add to every prompt)
```
RENDER RULES — strictly follow:
- Do not hallucinate extra shelves, rods, or drawers.
- Do not merge or omit any section.
- [Specific counts repeated here]
```

### Key Prompt Findings
- `flat ambient lighting` alone is not enough — use `no dramatic shadows` explicitly
- Repeat counts at the END of the prompt as rules — FLUX reads top to bottom and drifts
- `No clothing, no people, no accessories` prevents FLUX from filling the closet
- State `no hanging rod` explicitly in sections that don't have one
- Room context (gray walls + dark hardwood floor) matches Stil Design's CAD template

### R2 Bedroom — Verified Prompt (full detail version)
```
Professional architectural 3D render of a built-in reach-in closet 
system. Clean product visualization style — crisp lines, accurate 
materials, controlled studio lighting. Not a lifestyle photo, not 
a sketch. Think high-quality cabinet manufacturer catalogue render.

VIEWING ANGLE:
Perspective from slightly left of center, mildly elevated. 
The left interior side wall of the closet must show visible 
depth. 3/4 angle view into the closet interior. No doors shown, 
fully open front.

CLOSET STRUCTURE:
Exactly three vertical sections of equal width, separated by 
two full-height white melamine divider panels. One continuous 
white melamine top panel spanning all three sections. One 
continuous white melamine bottom panel with a 2.5 inch toe 
kick running the full width. Full white melamine backing panel 
on the rear interior wall.

LEFT SECTION — double hang only, no shelves, no drawers:
- Upper zone: one chrome oval rod, exactly 2 wooden hangers
- Lower zone: one chrome oval rod, exactly 3 wooden hangers

CENTER SECTION — shelves upper, drawers lower, NO hanging rod:
- Upper half: exactly 4 evenly-spaced open shelves, white melamine
- Lower half: exactly 4 slab drawers, chrome bar handle centered on each

RIGHT SECTION — double hang only, no shelves, no drawers:
- Upper zone: one chrome oval rod, exactly 3 wooden hangers
- Lower zone: one chrome oval rod, exactly 3 wooden hangers

Materials: white matte melamine panels, chrome oval rods, 
slim chrome bar handles, natural wood tone hangers.
Room: flat grey walls, dark walnut hardwood floor, no ceiling.
Lighting: soft uniform studio lighting, subtle shadows only.
No clothing, no people, no accessories.
Output: 4:3 JPEG.

RENDER RULES:
- Center upper = exactly 4 shelves
- Center lower = exactly 4 drawers
- Center has ZERO hanging rods
- Left: 2 hangers upper, 3 lower
- Right: 3 hangers upper, 3 lower
```

### 200-Character Compressed Version (for FluxAPI playground)
```
White matte melamine reach-in closet, photo, 3/4 
view. Left+right: double hang chrome rods, wooden 
hangers. Center: 4 open shelves, 4 white slab 
drawers chrome handles. Grey walls, dark wood floor.
```
(197 characters)

---

## Reverse Engineering Plan (Main Discovery Task)

### Step 1 — Receive Shawn's renderings
Wait for Melissa's email reply from Shawn with 15 simple + 5 complex renders.

### Step 2 — Analyze each rendering
For each render, document:
- Closet type (reach-in, walk-in, pantry, etc.)
- Number of sections / panels
- Per section: what's in it (hang / shelves / drawers / mixed)
- Material/finish (white, grey, wood-tone, etc.)
- Hardware (chrome rods, handles, etc.)
- Approximate width / ceiling height if visible
- Complexity rating: Simple / Medium / Complex

### Step 3 — Define draft form fields
Based on analysis of 15-20 renders, identify what fields Shawn would naturally fill in.
**Starting hypothesis (to be validated):**
```
- Space type (walk-in / reach-in / pantry / office)
- Number of wall sections
- Per section:
    - Type: hang / shelves / drawers / combo
    - If hang: single or double hang
    - If shelves: how many
    - If drawers: how many
- Material finish (white melamine / grey / wood-tone)
- Approximate total width (feet)
- Ceiling height (feet)
- Hardware: chrome / matte black / other
```

### Step 4 — Build prompt template
Map each form field to a prompt segment.
Target structure:
```
[Style trigger] + [Viewing angle] + [Section layout from fields] 
+ [Materials from fields] + [Room context] + [Render rules]
```

### Step 5 — Test and iterate
- Run minimum 8-10 test renders
- Compare each to the source render
- Rate accuracy (0-100%)
- Document what drifts and what holds
- Adjust prompt template

### Step 6 — Feasibility report
Come back with:
- Can we hit 85-90% fidelity? Yes/No/Conditional
- How long would a full build take?
- What form fields are needed?
- What edge cases need special handling?
- Cost per render in production

---

## Accuracy Targets (from meeting)
- **Minimum acceptable:** 85%
- **Target:** 90%
- **Stretch:** 95%
- **Owen's note:** "The model is good with reading enough examples — need about 10-20 designs to reverse engineer back and forth."

---

## Full Automation Proposal (3 Paths — for context)

Built in: `C:/Users/owenq/Downloads/stil-design-proposal.html`
Brand color: `rgb(246, 184, 24)` (Stil Design yellow)

**Path 1 — Notify**
Form → Stil Design gets email with form submission → Stil Design follows up manually → Prospect gets email with link to pricing calculator tool

**Path 2 — Price Range**
Form → Automated pricing tool runs → Stil Design gets output + lead → Stil Design reviews and follows up

**Path 3 — Full Pipeline**
Form → Validate → Pricing engine → [AI Description + AI Renderings in parallel] → Branded PDF assembled → Stil Design reviews + approves → Email to prospect + CRM update + 48h auto follow-up → Prospect decision (Accept = schedule measurement | Decline = feedback survey)

---

## Files Reference

| File | Location | Notes |
|---|---|---|
| Proposal site | `C:/Users/owenq/Downloads/stil-design-proposal.html` | Light theme, 3-section site |
| Aram design PDF | `C:/Users/owenq/Downloads/Automation Assets/Aram Masseredjian ST2197 March 16 2026 Design #1399.pdf` | 4 rooms, most complex |
| Aram estimate PDF | `C:/Users/owenq/Downloads/Automation Assets/Aram Masseredjian ST2197 March 16 2026 Estimate #1399.pdf` | $19,430.79 total |
| Aryeh design PDF | `C:/Users/owenq/Downloads/Automation Assets/Aryeh Bensabath ST4776 March 24 2026 Design #1415.pdf` | Simple single unit |
| Aryeh estimate PDF | `C:/Users/owenq/Downloads/Automation Assets/Aryeh Bensabath ST4776 March 24 2026 Estimate #1415.pdf` | $1,034.78 |
| Baril design PDF | `C:/Users/owenq/Downloads/Automation Assets/Baril Design ST4747 24 Mars 2026 Design #1171.pdf` | Office/desk unit |
| Baril estimate PDF | `C:/Users/owenq/Downloads/Automation Assets/Baril Design ST4747 24 Mars 2026 Estimation #1171.pdf` | $1,839.60 |
| This file | `workflows/Stil-Design/STIL_DESIGN_DISCOVERY.md` | You are here |

---

## Render Corpus Analysis (April 2026 — 13 Files from Shawn)

| File | Client | Rooms | Material | Hardware | FLUX Difficulty |
|---|---|---|---|---|---|
| 556306 Roumy Install | Syliane Roumy | 1 entrance (2-sec) | White | Chrome | Easy |
| 555953 Hops Install | Steph Hops | 1 entrance (2-sec) | **Warm Oak** | Chrome | Easy |
| 556319 Pettit Install | Taylor Pettit | R1: corridor walk-in 10-sec + R2/R3: reach-ins | White | **Matte Black** | R2/R3=Easy-Med, R1=Hard |
| 555334 Ngiriye Install | Guy Yves Ngiriye | R1: reach-in 4-sec + R2: 2-sec | White | Chrome | Medium |
| Marc Abdelsayed #1439 | Marc Abdelsayed | Walk-in L-shape 4-sec | White | Chrome | Medium |
| Jeremy Hampson #1382 | Jeremy Hampson | Walk-in 5-wall 7-sec | White | Chrome | Medium |
| 555285 Nguyen Install | Céline Nguyen | Walk-in L (tall 101 7/8") + reach-in | White | Chrome | Medium |
| Jerremy Teilio #1422 | Jerremy Teilio | Reach-in, mixed (white + oak drawers) | White + Oak | Chrome | Medium |
| Misha Hazarati #1388 | Misha Hazarati | Corner reach-in (low 80.5") + cabinet | White | Chrome | Medium |
| Daniel Bakerman #1314 | Daniel Bakerman | 3 walk-ins: small + large + mega 13-sec | White | Chrome | Med → Extreme |
| Dany Cesar #1398 | Dany Cesar | Walk-in 8-sec 6-walls | **Dark Walnut** | Chrome | Very Hard |
| 555914 Betournay Install | Anne Betournay | Whole-home millwork (NOT closets) | Various | Various | Out of scope |
| 556333 JS Cabinetry Roslyn | JS Cabinetry | Closed cabinet storage (NOT closets) | Various | Various | Out of scope |

**Cross-project patterns (from 11 in-scope files):**
- White melamine = 10/11 projects (default)
- Chrome hardware = 10/11 projects (default)
- No backing panel = majority (must be explicit in prompts)
- Standard ceiling height = 95–96"
- Standard double-hang zones = 47 3/8" upper + 37 13/16" lower
- Single-hang zone = 77 5/8"
- Standard drawer height = 8 11/16"

---

## Finalized Form Fields

**CLOSET-LEVEL (one per closet)**

| Field | Type | Options / Notes |
|---|---|---|
| Closet type | Select | Reach-in / Walk-in (straight) / Walk-in (L-shape) / Walk-in (U-shape) / Entrance closet |
| Total width | Number | Inches (e.g. 96) |
| Ceiling height | Select | Standard (95–96") / Tall (101–102") / Low (80") / Custom |
| Number of sections | Number | Integer 1–13 |
| Material / finish | Select | White Melamine / Dark Walnut / Warm Oak |
| Hardware finish | Select | Chrome / Matte Black |
| Has backing panel | Select | No (default) / Yes |
| Room context | Select | Bedroom / Primary closet / Entrance / Other |

**PER-SECTION (repeat for each section)**

| Field | Type | Options / Notes |
|---|---|---|
| Section type | Select | Double hang / Single hang / Shelves only / Drawers only / Shelves + drawers / Hang + shelves / Hang + drawers |
| Number of shelves | Number | If shelves present |
| Number of drawers | Number | If drawers present |

---

## Prompt Template (Form Fields → FLUX)

```
[STYLE TRIGGER — fixed, never changes]
Professional architectural 3D render of a built-in {closet_type}
closet system. Clean product visualization style — crisp lines,
accurate materials, controlled studio lighting. Not a lifestyle
photo, not a sketch. Think high-quality cabinet manufacturer
catalogue render.

[VIEWING ANGLE — driven by closet_type]
Reach-in / Entrance:
  "Perspective from slightly left of center, mildly elevated.
   3/4 angle view into the closet interior. No doors shown, 
   fully open front."
Walk-in (straight):
  "Standing at the entrance looking in, centered, slightly
   elevated. Front wall fills the frame. No doors shown."
Walk-in (L-shape):
  "Perspective from the entry corner, showing both the long wall
   and the short return wall at once. Slightly elevated 3/4 angle."

[STRUCTURE — driven by sections + ceiling_height + backing]
Exactly {N} vertical sections, separated by {N-1} full-height
{material} divider panels. One continuous {material} top panel.
One continuous {material} bottom panel with 2.5 inch toe kick.
[IF backing=No]:  "No backing — rear wall is visible through the unit."
[IF backing=Yes]: "Full {material} backing panel on rear interior wall."

[PER-SECTION — one block per section, labeled left→right]
{SECTION NAME} SECTION:
  double hang: "Double hang: upper chrome oval rod + lower chrome
    oval rod, wooden hangers on each."
  single hang: "Single hang: one {hardware} oval rod, wooden hangers."
  shelves only: "Exactly {N} evenly-spaced open shelves, {material}.
    No rod, no drawers."
  drawers only: "Exactly {N} slab drawers stacked, {hardware} bar
    handle centered on each. No rod, no shelves."
  shelves+drawers: "Upper half: exactly {N} shelves, {material}.
    Lower half: exactly {N} slab drawers, {hardware} handles."
  hang+drawers: "Upper: {hang_type} with {hardware} rod.
    Lower: exactly {N} slab drawers, {hardware} handles."

[MATERIALS + ROOM]
Materials: {material} panels, {hardware} oval rods, slim {hardware}
bar handles, natural wood tone hangers.
Room: flat grey walls, dark hardwood floor, no ceiling visible.
Lighting: soft uniform studio lighting, no dramatic shadows.
No clothing, no people, no accessories in the closet.
Output: 4:3 JPEG.

[RENDER RULES — anti-hallucination, always last]
RENDER RULES — strictly follow:
- Exactly {N} sections — do not add or remove any
- Do not hallucinate extra shelves, rods, or drawers
- Do not merge or omit any section
{Repeat per-section content summaries here}
[IF no backing]: "NO backing panel — do not add one"
[IF matte black]: "Hardware is MATTE BLACK — not chrome, not silver"
[IF dark walnut]: "Panels are DARK WALNUT wood grain — not white"
```

---

## Test Plan (8 Cases — Easy → Hard)

| # | Source | Sections | Material | Hardware | Primary Test | Difficulty |
|---|---|---|---|---|---|---|
| T1 | Roumy entrance | 2 (hang + hang) | White | Chrome | Baseline structure | Easy |
| T2 | Hops entrance | 2 (double hang + double hang) | **Warm Oak** | Chrome | Material variant | Easy |
| T3 | Pettit R2 | 3 | White | **Matte Black** | Hardware variant | Easy-Med |
| T4 | Pettit R3 | 3 | White | **Matte Black** | Confirm T3 | Easy-Med |
| T5 | Ngiriye R1 | 4 (mixed types) | White | Chrome | Mixed sections | Medium |
| T6 | Abdelsayed | 4 (L-shape walk-in) | White | Chrome | Walk-in angle | Medium |
| T7 | Hampson | 7 (walk-in straight) | White | Chrome | Section count accuracy | Med-Hard |
| T8 | Pettit R1 | 10 (corridor walk-in) | White | **Matte Black** | Complex + HW variant | Hard |

**Reserve (only if time + credits allow):**
- T9: Dany Cesar (dark walnut + 8 sections — hardest material + hardest structure)
- T10: Bakerman Primary (13 sections — count accuracy ceiling test)

**Decision gates:**
- If T2 (warm oak) fails badly → skip Cesar dark walnut
- If T6 (L-shape angle) fails → adjust angle trigger before running T7/T8
- If T3/T4 matte black doesn't hold → add stronger override rule before T8

---

## Render Accuracy Scoring Sheet

| Test | Source | Score (0–100) | Section Count Right? | Material Right? | Hardware Right? | Drift Notes |
|---|---|---|---|---|---|---|
| T1 | Roumy 2-sec entrance | 92% | ✅ | ✅ White | ✅ Chrome | Round rods not oval, closed side panels |
| T2 | Hops 2-sec warm oak | 93% | ✅ | ✅ Warm Oak | ✅ Chrome | Same closed panels, otherwise excellent |
| T3 | Pettit R2 3-sec matte black | 88% | ✅ | ✅ White | ✅ Matte Black | Center shelf count drifted (3 not 4) |
| T4 | Pettit R3 3-sec shelves | 85% | ✅ | ✅ White | ✅ Matte Black | Left lost lower rod in 3/4 view |
| T5 | Ngiriye R1 4-sec mixed | 87% | ✅ | ✅ White | ✅ Chrome | Per-section content mostly right |
| T6 | Abdelsayed L-shape | 83% | ✅ | ✅ White | ✅ Chrome | Drawers rendered open, angle correct |
| T7 | Hampson 7-sec walk-in | 82% | ~7 ✅ | ✅ White | ✅ Chrome | Section widths uneven, content drifts |
| T8 | Pettit R1 10-sec corridor | 84% | ~10 ✅ | ✅ White | ✅ Matte Black | Ceiling visible, baseboard added |

**Verdict — Testing Complete (April 2026):**
- Average accuracy across 8 tests: **86.75%**
- Hits 85% minimum: **YES**
- API winner: **Gemini/Imagen via MCP** — free with Gemini Pro subscription
- Rejected: fal.ai Recraft V3 (ignored prompt, rendered own aesthetic)
- Rejected: FluxAPI.ai (service outage, wrong model type — Kontext is image-to-image)

**Consistent drift patterns (fix in full build):**
1. Drawers render open — add "all drawers fully closed" to every prompt
2. Ceiling/baseboard appear — add "no ceiling visible, no baseboard trim"
3. Left section in 3/4 view loses lower rod — strengthen double-hang enforcement

**Feasibility: CONFIRMED VIABLE**
- Estimated full build time: 15-20 hours
- Cost per render in production: $0 (covered by Gemini Pro subscription)
- Recommended stack: n8n form → prompt template → Gemini MCP → image → PDF

---

## Next Chat — Start Here

1. Reference this file for all context — renders analyzed, fields locked, template ready
2. Run T1–T8 test renders using the prompt template above
3. Fill in the scoring sheet as each render comes back
4. Adjust the render rules block between tests if drift is detected
5. Deliver feasibility verdict to Melissa once T8 is complete

**Key reminder:**
The form is for Shawn only (not client-facing) for now. Shawn just needs instructions on what to type. Don't over-engineer the UX at this stage.
