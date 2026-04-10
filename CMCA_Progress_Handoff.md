# CMCA SEO Automation — Full Progress Handoff
**Last updated:** 2026-03-27
**Workflow:** P3+P4+P5 — ID: `wbLgyQrVlroyVo0f`
**n8n Instance:** https://designshopp.app.n8n.cloud

---

## Email Context

### Thread 1 — Melissa's Master Prompt (trigger for Work Item 1)
Melissa shared her "Master Prompt for Refining Articles" and asked for it to be added as an automated second-pass OpenAI step in the P3+P4+P5 workflow before articles are published. Owen committed to this. Peter separately flagged lead quality as "terrible" — better article depth via the refinement pass is the first fix we control.

### Thread 2 — Reliability Improvements (trigger for Work Item 2)
**Mar 25 — Owen proposed 3 reliability improvements:**
1. Clearer error notifications (HIGH/LOW priority labels, plain-English descriptions)
2. Auto-retry on Google Sheets nodes (up to 3 retries, 3000ms wait)
3. Node hardening across key workflows

**Melissa approved all three.** She asked Owen to:
- Log all time under maintenance tasks for each client (CMCA + Tornatech)
- Create recurring monthly tasks for each client
- Note: No extra charge for CMCA/Tornatech as they were the first clients

---

## Work Item 1 — Second-Pass Refinement Node (P3+P4+P5)
**Status: FUNCTIONALLY COMPLETE — needs one clean test run to fully confirm**

### What Was Done

#### 1. Added `Refine Article` node
- Type: `@n8n/n8n-nodes-langchain.openAi`, typeVersion 1.8
- Positioned between `Check First Pass` (branch 1 / false) and `Create a document`
- Uses Melissa's full refinement criteria as system prompt (Tone, Structure, Realism, Canadian Context, Language, CMCA Positioning, Closing)
- `jsonOutput: true`
- Credentials: `[SpilledMilk - billing@spilledmilk.com] OpenAi account` (ID: `cGgSXZ6cb8m5Q3gj`)
- Returns same JSON structure: `title`, `slug`, `content`, `wp_content`, `category`, `meta_description`

#### 2. Removed `Date & Time` node — ROOT CAUSE FIX
- **Problem:** The `Date & Time` node (typeVersion 2) was in the chain between `Check Content Extracted` and `Convert DateTime format`. It output ONLY `{currentDate: "..."}` — stripping every other field (CONTENT, TITLE, URL, etc.) from the item
- **Fix:** Removed `Date & Time` node entirely. Rewired `Check Content Extracted [branch 1 / false]` → `Convert DateTime format` directly

#### 3. Updated `Convert DateTime format` code
- **Old code (broken):** Tried to recover article data with `$('Extract Article Text').item.json` — this cross-chain reference fails silently for cycle 2+ in a loop. The try/catch caught the error and set `articleData = {}` → empty content
- **New code (fixed):** Uses `$input.first().json` directly (which now IS the full article item from `Check Content Extracted`) and computes date inline with `new Date()`

```javascript
const articleData = $input.first().json;

const now = new Date();
const formatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Toronto',
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hour12: false,
});
const parts = formatter.formatToParts(now);
const get = (type) => parts.find(p => p.type === type).value;

return [{
  json: {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    time: `${get('hour')}:${get('minute')}`,
    CONTENT: articleData.CONTENT || '',
    TITLE: articleData.TITLE || '',
    URL: articleData.URL || '',
    row_number: articleData.row_number || null,
    DATE_PUBLISHED: articleData['DATE PUBLISHED'] || '',
  },
  pairedItem: { item: 0 }
}];
```

#### 4. Fixed `Message a model` node — was completely unconfigured
- **Problem:** Node was typeVersion 2.1 (Responses API) with `responses.values: [{}]` — no system message, no user message. Model received an empty prompt and replied "Hi! How can I help?" instead of generating an article
- **Fix:** Changed to typeVersion 1.8 (Chat API, same as `Refine Article`), added full system prompt + user message referencing `$json.CONTENT`, `$json.TITLE`, `$json.URL`, `$json.date`
- System prompt: First-pass CMCA article writer — Canadian SME audience, no "loan/loans", Canadian spelling, outputs same JSON structure
- User message: `Write an SEO blog article based on: Title: {{ $json.TITLE }}, Source URL: {{ $json.URL }}, Date: {{ $json.date }}, SOURCE CONTENT: {{ $json.CONTENT }}`

#### 5. Fixed `Check First Pass` routing
- **Problem:** `isNotEmpty` and `isEmpty` operators were both routing all items to the same branch (unreliable unary string operators)
- **Fix:** Changed to explicit string comparison: `content equals ""` (empty string)
  - `content = ""` → TRUE → branch 0 → Loop (skip, no article generated)
  - `content = "real article..."` → FALSE → branch 1 → `Refine Article` ✓

#### 6. Fixed `Parse First Pass` — invalid JSON crash
- Added try/catch around `JSON.parse()` so if model returns non-JSON (e.g., "Hi!"), it sets `_firstPassError: "invalid_response"` instead of crashing

#### 7. Fixed `Create a post` — WordPress categories bug
- **Problem:** `categories` field was passing `"Cash Flow"` / `"Business Tips"` (plain strings). WordPress REST API requires **numeric term IDs** (e.g., `[4]`). This caused a 400 error on every WP post creation
- **Fix:** Removed `categories` field. Added `status: "draft"` explicitly. Posts are created uncategorized for now
- **Future improvement:** Add a Code node before `Create a post` that maps category names to numeric WP IDs once the actual IDs are known

#### 8. Added `pairedItem: { item: 0 }` to Code nodes
- Required for correct item tracking across `splitInBatches` loop cycles
- Applied to `Extract Article Text` and `Convert DateTime format`

---

## Current Node Chain (P3+P4+P5)

```
Schedule Trigger
→ Read Sheet
→ Code in JavaScript (filter: APPROVED rows, no existing Doc/WP link, valid status)
→ Loop Over Items: APPROVED (splitInBatches)
  → Fetch Article Page (HTTP)
  → Extract Article Text (Code)
  → Check Content Extracted (IF)
      [true / branch 0] → Write content failure (Sheets) → Loop
      [false / branch 1] → Convert DateTime format (Code)
                         → Message a model (OpenAI first pass)
                         → Parse First Pass (Code)
                         → Check First Pass (IF)
                             [true / branch 0 — content empty] → Loop (skip)
                             [false / branch 1 — content present] → Refine Article (OpenAI)
                                                                   → Create a document (Google Docs)
                                                                   → Insert text to document (Google Docs)
                                                                   → Create a post (WordPress)
                                                                       [success] → Updated Status Log (Sheets) → Loop
                                                                       [error]   → Error: WP Post Failed (Sheets) → Loop
```

---

## Pending — Clean Test Run Required

The last test run hit the WordPress categories bug (now fixed). Two rows have `STATUS LOG = "2026-03-26 14:31 | ERROR - WordPress post creation failed"` in the sheet.

**Before re-running, reset those rows:**
1. Clear `STATUS LOG` for the 2 failed rows
2. Clear `LINK TO GOOGLE DOC` if populated (filter skips rows with existing doc link)
3. Clear `LINK TO WORDPRESS BACKEND` if populated
4. Keep `ADMIN ACTION = Approve`
5. Re-run workflow manually

Note: Orphaned Google Docs were created during the failed run — delete them from Google Drive after confirming the clean run works.

---

## Work Item 2 — Reliability Improvements (COMPLETE — 2026-03-27)

All three sub-items were approved by Melissa on Mar 25.

### 2a — Clearer Error Notifications ✅ DONE
**Workflow:** CMCA Error Handler — ID: `bg8o5L8lUqPtR450cJsEu`
> ⚠️ NOTE: The handoff previously listed `foILvSy2LhUGBqkQ` — that is the **CUAL** error handler, not CMCA. CMCA handler is `bg8o5L8lUqPtR450cJsEu`.

Changes applied to `bg8o5L8lUqPtR450cJsEu`:
- `Normalize Error Data` code node: added `priority` (HIGH/LOW), `priorityLabel`, `recommendedAction` fields based on error message signals (503/500/429/ECONNRESET = LOW; all others = HIGH)
- Gmail node subject updated: `CMCA Alert [{{ $json.priority }}]: {{ $json.workflowName }} failed`
- Gmail body updated: shows PRIORITY, priorityLabel, recommendedAction before technical details

---

### 2b — Retry Logic on Google Sheets Nodes ✅ DONE

Applied `retryOnFail: true, maxTries: 3, waitBetweenTries: 3000` to all Google Sheets nodes:

| Workflow | ID | Notes |
|----------|----|-------|
| P1+P2 RSS scraping | `2brfJUoikPtQ0ZWO` | Was already done (skipped) |
| P3+P4+P5 content pipeline | `wbLgyQrVlroyVo0f` | 4 nodes updated |
| P0 manual URL enrichment | `d8sLKDe2RRDUsInf` | 4 nodes updated |
| P2 Send emails for APPROVE/REJECT | `Gmu3sjNEhcTk3squ` | 3 nodes updated |
| P2 Send reminder emails | `TtULG9dkROqOH1l4` | 3 nodes updated |

---

### 2c — Error Handling on Key Nodes ✅ DONE

Applied `retryOnFail: true, maxTries: 3, waitBetweenTries: 5000` to:
- P3+P4+P5: `Message a model` and `Refine Article` (OpenAI nodes)
- P2 APPROVE/REJECT: `Send Approved Email`, `Send Rejected` (Gmail nodes)
- P2 Reminder: `Send reminder email after 24 hours`, `Send reminder email after 72 hours` (Gmail nodes)

Set `errorWorkflow: bg8o5L8lUqPtR450cJsEu` on all 6 workflows that were missing it:
- P3+P4+P5 (`wbLgyQrVlroyVo0f`), P0 (`d8sLKDe2RRDUsInf`), P2 APPROVE/REJECT (`Gmu3sjNEhcTk3squ`), P2 Reminder (`TtULG9dkROqOH1l4`), P3 DocuSign (`4jbCc1zM1gzua5xM`), P1 GravityForms (`cGUopZq66zmIAF0e`)

Note: `Fetch Article Page` in P3+P4+P5 was already `onError: continueRegularOutput` — failures flow through `Check Content Extracted` as designed.

---

## Future Improvements (Not in Current Scope)

- **WordPress category mapping:** Add a Code node before `Create a post` that maps category string names (e.g., "Cash Flow") to numeric WP term IDs. Need the actual category IDs from the CMCA WordPress instance
- **Tornatech reliability improvements:** Same retry logic + node hardening for Tornatech workflows (approved in same email thread, ~1.5 hrs estimated)

---

## Critical Lessons Learned — Do NOT Repeat These

### 1. `Date & Time` node (typeVersion 2) strips all input fields
It outputs ONLY `{currentDate: "..."}`. Never use it in a chain where you need to pass article data through. Use inline JavaScript (`new Date()` with `Intl.DateTimeFormat`) inside a Code node instead.

### 2. `$('NodeName').item` cross-chain references fail in loops
In a `splitInBatches` loop, `$('SomeEarlierNode').item.json` only resolves reliably for item 0 (first cycle). For cycle 2+, pairedItem chain resolution fails silently — the expression returns null/empty with no error thrown. Always restructure the chain so `$input.first().json` has the data you need directly.

### 3. Always include `pairedItem: { item: 0 }` in Code node return statements inside loops
Without it, the pairedItem chain breaks and any downstream node using `$('ThisCodeNode').item` gets null.

### 4. OpenAI node typeVersion 2.1 (Responses API) vs 1.8 (Chat API)
- typeVersion 1.8: messages in `parameters.messages.values` — format: `[{role: "system", content: "..."}, {content: "user message"}]`
- typeVersion 2.1: uses `parameters.responses.values` — completely different structure, poorly documented in n8n MCP tools
- **Always use typeVersion 1.8** for standard chat completions unless you specifically need the Responses API. Check `Refine Article` as the known-working reference config.

### 5. WordPress REST API `categories` field requires numeric IDs, not strings
Passing `"Cash Flow"` causes a 400 error. Must use integer term IDs like `[4]`. If you don't have the IDs, remove the field — uncategorized posts are better than failing posts.

### 6. `n8n_update_partial_workflow` — `addConnection`/`rewireConnection` with special characters
Node names containing `&` (e.g., `Date & Time`) cannot be found by name in some operations. Use the node's UUID instead (get it from `n8n_get_workflow`). However, different operation types (rewireConnection vs removeNode) behave differently — `removeNode` requires the name, `rewireConnection` requires the ID for the `from` parameter. Test with `validateOnly: true` first, but note that `validateOnly` behavior can be inconsistent. When in doubt, break into separate single-operation calls.

### 7. n8n batch operations are atomic by default
If ANY operation in a batch fails validation, the ENTIRE batch is NOT saved. Use `continueOnError: true` if you want partial saves, or break into separate calls for safer incremental updates.

### 8. `Check First Pass` IF node — avoid unary string operators
`isNotEmpty` and `isEmpty` operators on string values were unreliable in this context — both were routing all items to the same branch. Use explicit value comparison instead: `content equals ""` (empty string) is reliable and predictable.

---

## Key Node Reference

| Node | Purpose | Key Detail |
|------|---------|------------|
| `Code in JavaScript` | Filter APPROVED rows | Skips rows with existing Doc/WP link or non-empty STATUS LOG (unless "rejected" or "ready for review") |
| `Extract Article Text` | Scrape + clean HTML | Returns `{...originalData, CONTENT, _extractFailed}` with `pairedItem: {item: 0}` |
| `Check Content Extracted` | Route on extraction success | branch 0 (true = failed) → Write content failure; branch 1 (false = success) → Convert DateTime format |
| `Convert DateTime format` | Prep data for model | Uses `$input.first().json` directly. Outputs `{date, time, CONTENT, TITLE, URL, row_number}` |
| `Message a model` | First-pass article draft | typeVersion 1.8, jsonOutput: true. Credentials: CMCA OpenAI |
| `Parse First Pass` | Parse OpenAI JSON response | Sets `_firstPassError: "invalid_response"` if model returns non-JSON |
| `Check First Pass` | Route on article quality | branch 0 (content = "") → Loop skip; branch 1 (content ≠ "") → Refine Article |
| `Refine Article` | Second-pass editorial rewrite | typeVersion 1.8, jsonOutput: true. Credentials: SpilledMilk OpenAI |
| `Create a document` | Create Google Doc | References `$('Refine Article').item.json.message.content` fields |
| `Insert text to document` | Fill Google Doc with content | References `$('Refine Article').item.json.message.content.content` |
| `Create a post` | WordPress draft | References `$('Refine Article').item.json.message.content`. No categories field (needs WP IDs). status: draft |
| `Updated Status Log` | Write success to sheet | Logs Doc URL, WP URL, timestamp |
| `Error: WP Post Failed` | Log WP failure to sheet | Logs error status |
| `Write content failure` | Log extraction failure | Logs extraction error status |

---

## Credentials Reference

| Credential | ID | Used By |
|------------|-----|---------|
| CMCA OpenAI | `bGDlX6HiAGhitXLG` | `Message a model` |
| SpilledMilk OpenAI | `cGgSXZ6cb8m5Q3gj` | `Refine Article` |
| CMCA WordPress | `apu6UY3Ke6WNXjpp` | `Create a post` |

---

## Recommended Next Session Order

1. **Clean test run** — Reset the 2 failed rows in the sheet, re-run, confirm full end-to-end cycle produces Google Doc + WordPress draft with refined content (Work Items 1, 2a–2c are all complete)
2. **Tornatech** — Same reliability improvements for Tornatech workflows (same approval from Melissa)
3. **WP Category mapping** — Once category IDs are known from CMCA WordPress admin, add Code node to map string → ID before `Create a post`
