# CMCA n8n Workflows — Full QA Report

**Generated:** 2026-03-16
**Analyst:** Claude (read-only analysis, no changes made)
**Scope:** 8 CMCA workflows, node-by-node review + last 10 executions each

---

## Executive Summary

| # | Workflow | Health | Critical Issues |
|---|----------|--------|-----------------|
| 1 | P1+P2 RSS Feeds | GREEN | None |
| 2 | CMCA Error Notification Handler | RED | Bug Log sheet tab missing (100% error rate today) |
| 3 | P0: Manual URL Enrichment (Sophia) | RED | `sheetName` parameter broken — 100% error rate today |
| 4 | P3+P4+P5 Create Draft Posts | RED | OpenAI credential deleted — workflow breaks on every item |
| 5 | [CMCA] P3 - Receive DocuSign | AMBER | No errorWorkflow; IF false branch silent drop |
| 6 | [CMCA] P2 - Send APPROVE/REJECT emails | AMBER | No errorWorkflow; IF false branches silent drop |
| 7 | [CMCA] P2 - Send reminder emails | AMBER | No errorWorkflow; 2 IF false branches unconnected; loop-end branch unconnected |
| 8 | [CMCA] P1 - GravityForms to Google Sheet | AMBER | No errorWorkflow; IF false branch silent drop; `Update row in sheet` terminal dead-end |

---

---

## Workflow 1: P1+P2 RSS Feeds

**ID:** `2brfJUoikPtQ0ZWO`
**Active:** Yes
**Error workflow:** `bg8o5L8lUqPtR450cJsEu` (Error Notification Handler — correctly set)
**Last updated:** 2026-03-08

### Execution Stats (last 10)
- **10 successes, 0 errors**
- Last run: 2026-03-16 @ 20:29 (manual)
- Scheduled trigger fires daily at 16:00 UTC — consistent

### Node-by-Node Table

| Node Name | Type | Version | onError | Credentials | Issues Found |
|-----------|------|---------|---------|-------------|--------------|
| Schedule Trigger | scheduleTrigger | 1.2 | stopWorkflow | — | None |
| URLs | set | 3.4 | stopWorkflow | — | None |
| Split Out URLs | splitOut | 1 | stopWorkflow | — | None |
| Loop Over URLs | splitInBatches | 3 | stopWorkflow | — | Loop-back from RSS Read output[0] → Loop input[0]; loop-done output[0] feeds Filter — correct |
| RSS Read | rssFeedRead | 1.2 | **continueRegularOutput** | — | `retryOnFail: true`. Good fault tolerance for flaky RSS feeds |
| Filter by keywords and change date format | code | 2 | stopWorkflow | — | See code notes below |
| Append or update row in sheet | googleSheets | 4.7 | stopWorkflow | `8UYwvprhMGHKF6ra` (automation@spilledmilkagency.com) | No onError handler on a critical write node |

**Connection map:**
- `URLs` → both `Split Out URLs` AND `Loop Over URLs` (dual connection — this causes each URL to be fed twice to the loop, meaning the first URL is processed once from Split Out and a second time from the direct connection; effectively all URLs process once because `splitInBatches` deduplicates its internal batch index, but the direct `URLs → Loop` edge is redundant and confusing)

**Code node analysis — "Filter by keywords and change date format":**
- Logic is sound: include keywords → exclude keywords → deduplicate by link → sort latest-10 → re-sort earliest-latest
- `content.includes(keyword)` is broad-match on include list — intentional per comment
- Word-boundary regex on exclude list — correct
- `new Date(b.json.pubDate)` — if `pubDate` is missing or malformed, `NaN` comparison silently breaks sort order (no crash, just incorrect ordering)
- Code does **not** crash on empty results — returns `[]` cleanly
- `formatPubDate` has no timezone handling — uses server local time

**Risky expressions:** None flagged. All values come from `$json.*` which is safe in this context.

### Summary — GREEN

**Issues:**
- WARNING: `Append or update row in sheet` has no `onError` set. A Google Sheets quota error or auth expiry will kill the whole execution silently (no partial success logging). A `continueErrorOutput` with logging would be safer.
- INFO: `URLs` node has a redundant direct connection to `Loop Over URLs` in addition to going through `Split Out URLs`. The loop still works correctly because `splitInBatches` manages its own index, but removing the redundant edge would make the flow clearer.
- INFO: `pubDate` sort uses `new Date()` with no guard — invalid dates sort as `NaN`, pushing them to unpredictable positions. Low risk since pubDate comes from RSS feed standard field, but edge cases exist.

---

---

## Workflow 2: CMCA Error Notification Handler

**ID:** `bg8o5L8lUqPtR450cJsEu`
**Active:** Yes
**Error workflow:** None (error handlers do not chain — this is correct behaviour)
**Last updated:** 2026-03-13

### Execution Stats (last 10)
- **0 successes, 10 errors**
- All 10 executions today errored in rapid succession (19:30–20:20)
- Error is consistent and reproducible

### Root Cause (confirmed from execution 10864)
```
NodeOperationError: Sheet with ID gid=2084648493 not found
Node: Log to Bug Log (googleSheets)
Document: 11yWjBmTvO_-cHHcWPJ2jT4PiRDN3nsjWyqSEnc7P_PI
```
The "Bug Log" tab (`gid=2084648493`) no longer exists in the target spreadsheet. This means **every time any other CMCA workflow errors, the error handler itself crashes** — errors go entirely unnotified and unlogged.

The upstream error being reported (from execution 10863) was:
```
Credential with ID "YXb9X7xQCHvDzVz1" does not exist for type "openAiApi"
Node: Message a model (P3+P4+P5 workflow)
```
So P3+P4+P5 is also failing, and the error handler is broken, meaning that failure goes completely unreported.

### Node-by-Node Table

| Node Name | Type | Version | onError | Credentials | Issues Found |
|-----------|------|---------|---------|-------------|--------------|
| Error Trigger | errorTrigger | 1 | — | — | None |
| Normalize Error Data | code | 2 | stopWorkflow | — | Code handles both schema variants (execution vs trigger). Solid. |
| Is Real Error? | if | 2 | stopWorkflow | — | Filters out "Service unavailable" and "service was not able to process" — correct. **FALSE branch has no connection** (items silently dropped — this is intentional for suppressed errors, acceptable). |
| Send a message | gmail | 2.2 | stopWorkflow | `NMxhzXsSqk1u0lKF` (automation@spilledmilkagency.com) | No onError. If Gmail fails, the bug log write is also skipped. |
| Log to Bug Log | googleSheets | 4.5 | stopWorkflow | `NuvxHNUd8fNqRvXJ` (automation@spilledmilkagency.com) | **BROKEN: sheet tab gid=2084648493 not found.** This is the current crash point. |

**Note:** `Send a message` and `Log to Bug Log` both receive output from the TRUE branch of `Is Real Error?` simultaneously (parallel fan-out). If `Log to Bug Log` crashes first, `Send a message` may have already succeeded or may be skipped depending on execution order. The email IS being attempted — but the bug log append fails immediately after.

**Credentials:**
- `NMxhzXsSqk1u0lKF` — automation@spilledmilkagency.com Gmail (Send a message)
- `NuvxHNUd8fNqRvXJ` — automation@spilledmilkagency.com Google Sheets (Log to Bug Log) — DIFFERENT credential ID from the RSS/P3 workflows which use `8UYwvprhMGHKF6ra`. Both are named "automation@spilledmilkagency.com" but are distinct credential records. Verify both are still valid.

### Summary — RED

**Issues:**
- CRITICAL: `Log to Bug Log` node references sheet tab `gid=2084648493` which no longer exists. Every execution fails. The entire error notification system is broken. Fix: re-point to the correct sheet tab GID, or recreate the "Bug Log" tab.
- CRITICAL: Because this handler is broken, P3+P4+P5's ongoing OpenAI credential failure (see Workflow 4) has been firing repeatedly with no notification reaching the team.
- WARNING: `Send a message` has no `onError` handler. If Gmail auth expires, errors will be silently swallowed.
- INFO: Two different credential IDs for "automation@spilledmilkagency.com" Google Sheets are in use across the CMCA workflows (`NuvxHNUd8fNqRvXJ` here vs `8UYwvprhMGHKF6ra` elsewhere). Verify both are alive.

---

---

## Workflow 3: P0: Manual URL Enrichment (Sophia)

**ID:** `d8sLKDe2RRDUsInf`
**Active:** Yes
**Error workflow:** None — **not set**
**Last updated:** 2026-03-16 (reactivated today)

### Execution Stats (last 10)
- **0 successes, 10 errors**
- All 10 errors today: 23:05–23:50, every 5 minutes (matching the schedule interval)
- Duration: ~30ms — crashes immediately at node 2

### Root Cause (confirmed from execution 10965)
```
Error: Could not get parameter
parameterName: "sheetName"
Node: Read Sheet (googleSheets)
```
The `sheetName` parameter is failing to resolve at runtime. The node definition shows `mode: "list"` with `cachedResultName: "Sheet1"` and `value: "gid=0"`. This error (`Could not get parameter`) typically indicates the credential or sheet reference can no longer be resolved — likely the Google Sheets OAuth token for credential `8UYwvprhMGHKF6ra` has expired, or the sheet reference itself is broken.

**Note:** The `staticData` for this workflow contains a stale `node:Google Sheets Trigger` key with `lastRevision: 660` — this is a leftover from when the workflow previously used a Google Sheets Trigger (since replaced with Schedule Trigger). Not a functional issue but indicates the trigger was recently migrated.

### Node-by-Node Table

| Node Name | Type | Version | onError | Credentials | Issues Found |
|-----------|------|---------|---------|-------------|--------------|
| Schedule Trigger | scheduleTrigger | 1.2 | stopWorkflow | — | Fires every 5 minutes — high frequency for a manual enrichment workflow |
| Read Sheet | googleSheets | 4.7 | stopWorkflow | `8UYwvprhMGHKF6ra` | **BROKEN: crashes on every execution with "Could not get parameter: sheetName"** |
| Filter: Manual Submissions Only | code | 2 | stopWorkflow | — | Code looks correct: filters for rows with URL but no TITLE and no STATUS LOG |
| Fetch Article Page | httpRequest | 4.4 | stopWorkflow | — | 3000ms timeout — very short. Pages that take >3s will fail silently (alwaysOutputData: false). No onError. |
| Extract Article Text + Page Title | code | 2 | stopWorkflow | — | Uses `$('Filter: Manual Submissions Only').item.json` — **risky pairedItem reference**. If the pairedItem chain breaks (e.g. after httpRequest adds/removes items), this will throw. |
| Message a model | openAi (langchain) | 2.1 | stopWorkflow | `cGgSXZ6cb8m5Q3gj` ([SpilledMilk] OpenAI) | AI prompt uses `{{ $json.TITLE }}` and `{{ $json.CONTENT }}` — safe. |
| Parse AI Response | code | 2 | stopWorkflow | — | Has try/catch around JSON.parse — good. Falls back to FAIL verdict on parse error. Uses `$('Extract Article Text + Page Title').item.json` — **risky pairedItem ref**. |
| Check Verdict | if | 2.3 | stopWorkflow | — | TRUE → Write PASS, FALSE → Write FAIL. Both branches connected — correct. |
| Write PASS to Sheet | googleSheets | 4.7 | stopWorkflow | `8UYwvprhMGHKF6ra` | No onError on a write node |
| Write FAIL to Sheet | googleSheets | 4.7 | stopWorkflow | `8UYwvprhMGHKF6ra` | `STATUS LOG` value uses `=Rejected — {{ $json.fail_reason }}` — note the `=` prefix; in Google Sheets context the `=` here is the n8n expression prefix, NOT a spreadsheet formula, so this is fine. |

**Risky expressions:**
- `$('Filter: Manual Submissions Only').item.json` in `Extract Article Text + Page Title` — cross-node `.item` reference. Breaks if pairedItem chain is disrupted.
- `$('Extract Article Text + Page Title').item.json` in `Parse AI Response` — same risk.

### Summary — RED

**Issues:**
- CRITICAL: Workflow crashes on every execution (every 5 minutes). `Read Sheet` cannot resolve its `sheetName` parameter. The workflow has been actively broken since at least 23:05 today. Likely cause: credential `8UYwvprhMGHKF6ra` has expired, or the sheet/tab was deleted.
- CRITICAL: No `errorWorkflow` set — failures go completely unreported since the Error Handler is also broken.
- WARNING: `Fetch Article Page` timeout is 3000ms — very aggressive. Many news sites take 3–5s to respond. Consider 8000–10000ms.
- WARNING: `$('Filter: Manual Submissions Only').item.json` and `$('Extract Article Text + Page Title').item.json` are cross-node `.item` pairedItem references. These will throw `"Cannot read properties of undefined"` if a preceding node produces 0 items or the pairedItem chain is broken.
- INFO: 5-minute polling interval may be excessive for a manual enrichment workflow. Consider 15–30 minutes.
- INFO: Stale `staticData` from old `googleSheetsTrigger` node still in workflow state — harmless but should be cleaned up.

---

---

## Workflow 4: P3+P4+P5 Create Draft Posts

**ID:** `wbLgyQrVlroyVo0f`
**Active:** Yes
**Error workflow:** `bg8o5L8lUqPtR450cJsEu` (set — but that handler is also broken, see Workflow 2)
**Last updated:** 2026-03-16

### Execution Stats (last 10)
- **10 successes, 0 errors** (in last 10 shown)
- However: execution 10863 (today, 20:20) was an ERROR with credential failure
- The executions marked "success" complete because when there are no APPROVED items in the sheet, the workflow exits cleanly at the loop's done branch — these are not truly "successful article creations", they are no-op runs

### Root Cause of Recent Error (execution 10863)
```
NodeOperationError: Credential with ID "YXb9X7xQCHvDzVz1" does not exist for type "openAiApi"
Node: Message a model
```
The OpenAI credential `YXb9X7xQCHvDzVz1` (named "OpenAi account") was deleted from n8n. The current live workflow uses credential `bGDlX6HiAGhitXLG` (named "CMCA") — which is correctly set in the current node definition. However the execution 10863 used the old deleted credential, suggesting this was an execution of an older version or there was a version mismatch. **The current live version uses `bGDlX6HiAGhitXLG` which appears valid.**

### Node-by-Node Table

| Node Name | Type | Version | onError | Credentials | Issues Found |
|-----------|------|---------|---------|-------------|--------------|
| Schedule Trigger | scheduleTrigger | 1.2 | stopWorkflow | — | None |
| Read Sheet | googleSheets | 4 | stopWorkflow | `jr25MKfV6H2zSwxO` (Google Sheets account) | No onError. Sheet doc: `1O7jBME_Vmh0ORs5vchKfWvAo0Ayn0wjWeBJbDJdpfas` |
| Code in JavaScript | code | 2 | stopWorkflow | — | Filters for rows with ADMIN ACTION = "Approve" and empty STATUS LOG. Good. `$input.all()` usage is safe. |
| Loop Over Items: APPROVED | splitInBatches | 3 | stopWorkflow | — | Done branch (output[0]) has **no connection** — this is the loop-complete signal and it correctly terminates. Loop branch (output[1]) → Fetch Article Page. Correct structure. |
| Fetch Article Page | httpRequest | 4 | stopWorkflow | — | No onError. No timeout set explicitly. If a URL 404s or hangs, the whole loop item fails. |
| Extract Article Text | code | 2 | stopWorkflow | — | Uses `$('Loop Over Items: APPROVED').item.json` — **risky pairedItem ref**. Returns `[]` if HTML < 100 chars, silently skipping item. |
| Date & Time | dateTime | 2 | stopWorkflow | — | None |
| Convert DateTime format | code | 2 | stopWorkflow | — | Returns a plain object `{ date, time }` not wrapped in array — this is valid for code node single-item output. |
| Message a model | openAi (langchain) | 1 | stopWorkflow | `bGDlX6HiAGhitXLG` (CMCA) | Uses `$('Read Sheet').item.json.TITLE` and `$('Read Sheet').item.json.URL` — **risky cross-node `.item` references** that will break if pairedItem chain is interrupted. typeVersion 1 (check if newer version available). |
| Create a document | googleDocs | 2 | stopWorkflow | `Vdifwq9lKoSXdEIj` | No onError on critical external API call |
| Insert text to document | googleDocs | 2 | stopWorkflow | `Vdifwq9lKoSXdEIj` | Uses `$('Message a model').item.json.message.content.content` — **risky double `.item` + nested property chain**. If AI returns unexpected structure, this throws. |
| Create a post | wordpress | 1 | **continueErrorOutput** | `apu6UY3Ke6WNXjpp` ([CMCA - dstheme] WordPress) | Good: error output connected to `Error: WP Post Failed`. Uses `$('Message a model').item.json.message.content.wp_content` etc — **risky nested access**. |
| Error: WP Post Failed | googleSheets | 4 | stopWorkflow | `jr25MKfV6H2zSwxO` | Uses `$('Extract Article Text').item.json.URL` — **risky cross-node `.item` ref**. Loops back to `Loop Over Items: APPROVED` — correct. |
| Updated Status Log | googleSheets | 4 | stopWorkflow | `jr25MKfV6H2zSwxO` | Uses `$('Extract Article Text').item.json.URL` and `$('Convert DateTime format').item.json.date` — **risky cross-node `.item` refs**. Loops back correctly. |

**Credentials summary:**
- `bGDlX6HiAGhitXLG` — "CMCA" OpenAI account (current, appears valid)
- `jr25MKfV6H2zSwxO` — "Google Sheets account" (generic name — verify it's the CMCA account)
- `Vdifwq9lKoSXdEIj` — "Google Docs account" (generic name — verify)
- `apu6UY3Ke6WNXjpp` — "[CMCA - dstheme] WordPress account"

**Risky expression hotspots:**
1. `{{ $('Read Sheet').item.json.TITLE }}` and `{{ $('Read Sheet').item.json.URL }}` in "Message a model" prompt — these refer back to a node many steps upstream; pairedItem must be intact across the entire HTTP request + code node chain
2. `{{ $('Message a model').item.json.message.content.wp_content }}` — deeply nested; if AI JSON is malformed or `message.content` is an array (not object), this throws undefined
3. `{{ $('Message a model').item.json.message.content.content }}` in "Insert text to document" — same issue

### Summary — RED (degraded but intermittent)

**Issues:**
- CRITICAL: OpenAI credential `YXb9X7xQCHvDzVz1` referenced in a recent execution was deleted. Current node uses `bGDlX6HiAGhitXLG` which appears valid, but this suggests there was a credential swap recently. Confirm the current credential is working end-to-end.
- CRITICAL: Most `$('NodeName').item.json.*` expressions throughout this workflow will fail if any pairedItem chain is broken — particularly across the HTTP request node which creates a new data context.
- WARNING: `Create a document`, `Read Sheet`, `Extract Article Text`, and `Updated Status Log` have no `onError` handler — a Google API quota hit or auth expiry stops the loop without logging which item failed.
- WARNING: `Message a model` accesses `$('Message a model').item.json.message.content.wp_content` (nested property) without null-checking. If AI response format changes, this throws a TypeError.
- INFO: `Message a model` is typeVersion 1; current latest is 2.x. Consider upgrading.
- INFO: `Fetch Article Page` has no explicit timeout — defaults to n8n global timeout. Consider setting 8000ms explicitly.

---

---

## Workflow 5: [CMCA] P3 - Receive DocuSign

**ID:** `4jbCc1zM1gzua5xM`
**Active:** Yes
**Error workflow:** **NOT SET**
**Last updated:** 2025-12-19

### Execution Stats (last 10)
- **10 successes, 0 errors**
- Last run: 2026-03-16 @ 21:44 (trigger — Gmail poll)
- Most runs complete in 1–8 seconds; runs at 19:45 completed in 35ms (no matching emails — quick exit)

### Node-by-Node Table

| Node Name | Type | Version | onError | Credentials | Issues Found |
|-----------|------|---------|---------|-------------|--------------|
| Trigger: Receive Emails | gmailTrigger | 1.3 | stopWorkflow | `LfULPgXZiOMRS3r5` ([CMCA - admin@cmcafinance.com] Gmail) | Polls every minute — no filters set (`filters: {}`). Fetches ALL emails. Relies on downstream `If` to filter. |
| Loop Over Items | splitInBatches | 3 | stopWorkflow | — | Done branch (output[0]) unconnected — correct loop termination. Processes branch (output[1]) → Extract email addresses. |
| Extract email addresses | code | 2 | stopWorkflow | — | **Bug:** `const email = $input.first().json.subject || ""` — extracts from `subject`, not a separate email field. Regex then runs on subject line to find an email address. This is fragile — DocuSign emails put the applicant's email in the subject, so it works, but any change in DocuSign subject format would break it silently. |
| If | if | 2.2 | stopWorkflow | — | Checks `subject_line` contains "Complete with Docusign" AND `email` is not empty. **FALSE branch has no connection** — emails that don't match are silently dropped. No logging. |
| Send a message | gmail | 2.1 | stopWorkflow | `LfULPgXZiOMRS3r5` | No onError. Sends notification for matched DocuSign email. |
| Get row(s) in sheet | googleSheets | 4.7 | stopWorkflow | `gnjqsanqJmpgUgbn` ([CMCA - admin@cmcafinance.com] Google Sheets) | Uses `$('If').item.json.email` — **risky `.item` ref**. |
| Get last item | code | 2 | stopWorkflow | — | `return [ items[items.length - 1] ]` — **will throw if `items` is empty** (no guard on `items.length`). If `Get row(s) in sheet` returns 0 rows, this crashes. |
| Date & Time | dateTime | 2 | stopWorkflow | — | None |
| Get Log Date and Time | code | 2 | stopWorkflow | — | Parses ISO date, formats for Toronto timezone. Solid. |
| Update row in sheet | googleSheets | 4.7 | stopWorkflow | `gnjqsanqJmpgUgbn` | Uses `$('Get last item').item.json.row_number` — **risky `.item` ref**. No onError on critical write. Updates loop back to `Loop Over Items` — correct. |

**Code node bug — "Extract email addresses":**
```js
const email = $input.first().json.subject || "";  // reads subject, not email field!
const match = email.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[A-Z]{2,}/i);
```
The variable is named `email` but reads from `subject`. This only works because DocuSign happens to embed the applicant email in the subject line. If DocuSign changes their subject format, the match will return null and `email: null` will flow downstream.

**Code node bug — "Get last item":**
```js
return [ items[items.length - 1] ];
```
If `items` is empty (no matching rows in sheet), `items[-1]` is `undefined`, and the return wraps `undefined` — n8n will likely throw `"Cannot convert undefined to object"`.

### Summary — AMBER

**Issues:**
- WARNING: No `errorWorkflow` set. Any failure in Gmail trigger, Google Sheets, or Gmail send goes unnotified.
- WARNING: `Get last item` code node crashes if `Get row(s) in sheet` returns 0 rows. No guard on empty array. Add: `if (items.length === 0) return [];`
- WARNING: `Extract email addresses` reads email from `subject` field — fragile coupling to DocuSign subject format.
- WARNING: `$('If').item.json.email` and `$('Get last item').item.json.row_number` are cross-node `.item` references that will break if pairedItem chain is disrupted.
- WARNING: `If` false branch is unconnected — non-DocuSign emails are silently dropped with no log. Consider logging filtered items.
- INFO: Gmail trigger has no filters (`filters: {}`), polling ALL emails every minute. Adding a subject filter at the trigger level would reduce unnecessary processing.

---

---

## Workflow 6: [CMCA] P2 - Send APPROVE and REJECT emails

**ID:** `Gmu3sjNEhcTk3squ`
**Active:** Yes
**Error workflow:** **NOT SET**
**Last updated:** 2026-03-16

### Execution Stats (last 10)
- **10 successes, 0 errors**
- Last 10 all today (23:05–23:50), every 5 minutes (schedule trigger)
- Most complete in 2–5 seconds — likely no-op runs (no leads to action)

### Node-by-Node Table

| Node Name | Type | Version | onError | Credentials | Issues Found |
|-----------|------|---------|---------|-------------|--------------|
| Schedule Trigger | scheduleTrigger | 1.2 | stopWorkflow | — | None |
| Get Date & Time | dateTime | 2 | stopWorkflow | — | None |
| Convert Date & Time | code | 2 | stopWorkflow | — | Produces `entry_datetime` and `log_datetime`. Solid. |
| Get row(s) in sheet | googleSheets | 4.7 | stopWorkflow | `gnjqsanqJmpgUgbn` ([CMCA - admin@cmcafinance.com] Google Sheets) | Sheet: `12ykIh8SyE2gZ1JRzAeBdEch5vrY_YczuTbPmMIZBnEw`, tab: Leads. No onError. |
| Switch | switch | 3.3 | stopWorkflow | — | Routes on `$json['Admin Action']`: "Approve" → branch[0], "Reject" → branch[1]. **No fallback/default branch** — any other value (empty, "Pending", typo) is silently dropped. |
| Status is NOT "Sent email of approval" | if | 2.2 | stopWorkflow | — | Checks `Automation Status` not contains "Sent email of approval". FALSE branch (already sent) has **no connection** — silently drops. Acceptable as idempotency guard. |
| Status is NOT "Sent email of rejection" | if | 2.2 | stopWorkflow | — | Same pattern. FALSE branch unconnected — acceptable. |
| Loop leads = APPROVED | splitInBatches | 3 | stopWorkflow | — | Done branch (output[0]) unconnected — correct. |
| Set fields from leads: Approved | set | 3.4 | stopWorkflow | — | Uses `$('Convert Date & Time').item.json.log_datetime` — **risky cross-node `.item` ref**. |
| Send Approved Email | gmail | 2.1 | stopWorkflow | `LfULPgXZiOMRS3r5` ([CMCA] Gmail) | No onError. Loops back to both `Loop leads = APPROVED` AND `Update Automation Status: Sent approval email` simultaneously. |
| Update Automation Status: Sent approval email | googleSheets | 4.7 | stopWorkflow | `gnjqsanqJmpgUgbn` | Uses `$('Set fields from leads: Approved').item.json['Row Number']` — **risky `.item` ref**. No onError on write. |
| Loop leads = REJECT | splitInBatches | 3 | stopWorkflow | — | Done branch (output[0]) unconnected — correct. |
| Set fields from leads: Rejected | set | 3.4 | stopWorkflow | — | Same `.item` ref pattern as Approved side. |
| Send Rejected | gmail | 2.1 | stopWorkflow | `LfULPgXZiOMRS3r5` | No onError. Loops back to both loop node and update node simultaneously. |
| Update Automation Status: Sent rejected email | googleSheets | 4.7 | stopWorkflow | `gnjqsanqJmpgUgbn` | Same risky `.item` ref pattern. No onError. |

**Connection concern — dual output from Send nodes:**
Both `Send Approved Email` and `Send Rejected` output to BOTH the loop node AND the update node from output[0]. This means the loop-back and the sheet-write happen simultaneously, which is fine since they're independent. But it does mean if the sheet write fails, the loop still continues — leading to a lead being emailed but not logged. No recovery path for partial failure.

**Switch node — no fallback:**
The `Switch` node routes "Approve" and "Reject" but has no `else`/fallback output. Any lead with `Admin Action = ""` (empty), "Pending", "Hold", or a typo is silently dropped.

### Summary — AMBER

**Issues:**
- WARNING: No `errorWorkflow` set — failures (Gmail send, Google Sheets write) go completely unnotified.
- WARNING: `Switch` node has no fallback branch. Rows with unexpected `Admin Action` values are silently dropped.
- WARNING: Multiple `$('NodeName').item.json[...]` risky cross-node refs throughout (`Convert Date & Time`, `Set fields from leads: Approved`, `Set fields from leads: Rejected`).
- WARNING: If `Send Approved Email` or `Send Rejected` node fails (Gmail quota, auth expiry), the sheet update is also skipped — the lead is not marked as "email sent", so it will be retried on next run, causing duplicate emails.
- INFO: 5-minute schedule frequency — very high for an email workflow. Consider checking whether this is intentional or if hourly would suffice.

---

---

## Workflow 7: [CMCA] P2 - Send Reminder Emails

**ID:** `TtULG9dkROqOH1l4`
**Active:** Yes
**Error workflow:** **NOT SET**
**Last updated:** Unknown (not in response)

### Execution Stats (last 10)
- **10 successes, 0 errors**
- Runs hourly (last 10 cover 14:00–23:00 today)
- All complete in 1–4 seconds — likely no-op runs (no qualifying leads)

### Node-by-Node Table

| Node Name | Type | Version | onError | Credentials | Issues Found |
|-----------|------|---------|---------|-------------|--------------|
| Schedule Trigger | scheduleTrigger | 1.2 | stopWorkflow | — | Hourly — appropriate |
| Get Date & Time | dateTime | 2 | stopWorkflow | — | None |
| Convert Date & Time | code | 2 | stopWorkflow | — | Identical to P2 Send emails. Solid. |
| Get row(s) in sheet | googleSheets | 4.7 | stopWorkflow | `gnjqsanqJmpgUgbn` ([CMCA] Google Sheets) | Same sheet as P2 Approve/Reject |
| If admin action IS empty | if | 2.2 | stopWorkflow | — | **FALSE branch (admin action NOT empty) has no connection** — leads with a non-empty admin action are silently dropped without routing to any other path. |
| Switch for Admin Actions | switch | 3.3 | stopWorkflow | — | Routes "DocuSign email sent" → Loop 24h, "DocuSign received" → Loop 72h. No fallback branch for other values. |
| Loop leads = DocuSign email sent | splitInBatches | 3 | stopWorkflow | — | Done branch (output[0]) unconnected — correct loop termination. |
| Loop leads = DocuSign received | splitInBatches | 3 | stopWorkflow | — | Done branch (output[0]) unconnected — correct. |
| Set fields from leads: DocuSign email sent | set | 3.4 | stopWorkflow | — | `$('Convert Date & Time').item.json.log_datetime` — **risky `.item` ref** |
| Compare Logged DateTime with Current DateTime: 24 hours | code | 2 | stopWorkflow | — | Reads `$input.first().json['Log Date and Time']` and `['Current Date and Time']`. Returns the item with added comparison fields. Solid logic. Connects to BOTH `If 24 hours has passed` AND `Loop leads = DocuSign email sent` simultaneously — dual fan-out, questionable (see below). |
| If 24 hours has passed | if | 2.2 | stopWorkflow | — | TRUE → Send 24h reminder. **FALSE branch unconnected** — items that haven't waited 24h are silently dropped. This is intentional. |
| Send reminder email after 24 hours | gmail | 2.1 | stopWorkflow | `LfULPgXZiOMRS3r5` | No onError. Uses `$('Set fields from leads: DocuSign email sent').item.json['Email Address']` — **risky `.item` ref**. |
| Update Automation Status: DocuSign email reminder created | googleSheets | 4.7 | stopWorkflow | `gnjqsanqJmpgUgbn` | No onError. Uses `$('Set fields from leads: DocuSign email sent').item.json['Row Number']` — **risky `.item` ref**. **Terminal dead-end — output[0] unconnected, does NOT loop back.** Items processed here do not return the loop to iterate. |
| Set fields from leads: DocuSign received | set | 3.4 | stopWorkflow | — | Same `.item` ref pattern |
| Compare Logged DateTime with Current DateTime: 72 hours | code | 2 | stopWorkflow | — | Same dual fan-out pattern as 24h compare. |
| If 72 hours has passed | if | 2.2 | stopWorkflow | — | TRUE → Send 72h reminder. **FALSE branch unconnected** — intentional. |
| Send reminder email after 72 hours | gmail | 2.1 | stopWorkflow | `LfULPgXZiOMRS3r5` | No onError. Risky `.item` ref. |
| Update Automation Status: DocuSign follow up email sent | googleSheets | 4.7 | stopWorkflow | `gnjqsanqJmpgUgbn` | No onError. Risky `.item` refs. Output not connected — **correct terminal end for 72h path**. |

**Structural concern — loop-back path:**
The `Compare Logged DateTime...` node fans out to BOTH `If X hours has passed` AND `Loop leads = DocuSign...`. This means every item, regardless of whether it passed the time check, is sent back into the loop from the Compare node's output. This creates a situation where the loop receives items from TWO sources simultaneously on each iteration, which could cause double-processing or unexpected item counts. The intended pattern would typically be: `Loop → Set → Compare → If [TRUE: Send + Update] [FALSE: back to Loop]`.

**Dead-end on `Update Automation Status: DocuSign email reminder created`:**
The 24-hour update node has no output connection — it does not route back to `Loop leads = DocuSign email sent`. This means after sending a 24h reminder, the loop does not continue to the next item — it terminates. Subsequent items in the batch are never processed in that run.

### Summary — AMBER

**Issues:**
- WARNING: No `errorWorkflow` set.
- WARNING: `Update Automation Status: DocuSign email reminder created` is a dead-end — does not loop back to `Loop leads = DocuSign email sent`. Only the first qualifying lead per run gets a 24h reminder email. All subsequent leads in the same run are skipped.
- WARNING: `Compare Logged DateTime` fans out to BOTH `If X hours has passed` AND the loop node simultaneously — this architectural pattern sends items back to the loop head regardless of the time check result, potentially causing double processing.
- WARNING: `If admin action IS empty` FALSE branch is unconnected — leads with an admin action value that doesn't match "DocuSign email sent" or "DocuSign received" are silently dropped.
- WARNING: Multiple risky `$('NodeName').item.json[...]` cross-node refs throughout.
- INFO: No Gmail `onError` — a quota hit or auth expiry will silently skip the reminder without logging.

---

---

## Workflow 8: [CMCA] P1 - GravityForms to Google Sheet

**ID:** `cGUopZq66zmIAF0e`
**Active:** Yes
**Error workflow:** **NOT SET**
**Last updated:** Unknown

### Execution Stats (last 10)
- **10 successes, 0 errors**
- Runs via webhook (form submissions)
- Last 10 cover 2026-03-14 to 2026-03-16; 3 ran within seconds of each other today at 20:23 (likely test submissions)
- Average duration: 5–9 seconds

### Node-by-Node Table

| Node Name | Type | Version | onError | Credentials | Issues Found |
|-----------|------|---------|---------|-------------|--------------|
| Webhook | webhook | 2.1 | stopWorkflow | — | Entry point for GravityForms submissions |
| Trigger GravityForm submission | set | 3.4 | stopWorkflow | — | Maps form fields to clean field names. Uses `$('Trigger GravityForm submission').item.json.*` in downstream nodes — see below. |
| Convert Entry Date to another format | code | 2 | stopWorkflow | — | Parses `entry_date` as `'YYYY-MM-DD HH:mm:ss'` UTC string. Solid. |
| Check if Company is a Startup | if | 2.2 | stopWorkflow | — | Checks `$('Trigger GravityForm submission').item.json.duration` equals `"Less than 3 months"`. **Risky `.item` ref**. Case-sensitive exact match — if form dropdown value changes, this silently fails. |
| Append row in sheet (startup) | googleSheets | 4.7 | stopWorkflow | `gnjqsanqJmpgUgbn` | Writes startup lead. All fields use `$('Trigger GravityForm submission').item.json.*` — **multiple risky `.item` refs**. No onError. |
| Send Reject (Startup) email | gmail | 2.1 | stopWorkflow | `LfULPgXZiOMRS3r5` | No onError. Sends rejection to startup. |
| Append row in sheet (Non-startup) | googleSheets | 4.7 | stopWorkflow | `gnjqsanqJmpgUgbn` | Same risky ref pattern. No onError. |
| Send DocuSign email | gmail | 2.1 | stopWorkflow | `LfULPgXZiOMRS3r5` | No onError. |
| Get row(s) in sheet | googleSheets | 4.7 | stopWorkflow | `gnjqsanqJmpgUgbn` | Reads all rows after append. No onError. |
| Check for duplicates | code | 2 | stopWorkflow | — | Reads `items.map(item => item.json)` — correct, no `$input` needed here. Marks duplicates by email count. Sets `Status = 'Rejected (Startup)'` for "less than 3 months" business age. **Note:** uses `item.json['Email Address']` (from sheet) vs upstream `item.json.email` (from form) — these are different field names. Code correctly references the sheet column. |
| If | if | 2.2 | stopWorkflow | — | Checks `$json['Duplicate?'] === "Duplicate Entry"`. TRUE → Update row. **FALSE branch (not duplicate) has NO connection** — non-duplicate leads exit here silently. This appears intentional (non-duplicates are already appended) but produces a silent terminal end. |
| Update row in sheet | googleSheets | 4.7 | stopWorkflow | `gnjqsanqJmpgUgbn` | Updates duplicate lead row. **Output[0] (success) has NO connection** — this is a terminal dead-end after duplicate update. |

**Critical flow issue — `If` FALSE branch:**
When a lead is NOT a duplicate, it falls to the FALSE branch of `If`, which has no connection. The lead has already been appended to the sheet and the DocuSign/rejection email sent, so functionally this may be correct. However, the duplicate-check path (Get row(s), Check for duplicates, If) executes after the email is sent — the duplicate detection happens AFTER the DocuSign email has already been dispatched. If a duplicate lead submits, the email goes out, THEN the row is flagged as duplicate.

**Execution timing concern:**
The 3 simultaneous webhook executions at 20:23 today (IDs 10865, 10866, 10867) suggest a test batch or a form that submitted multiple times. Each ran successfully. No deduplication at webhook entry — the race condition could allow two nearly simultaneous identical submissions to both append rows before either's duplicate check runs.

### Summary — AMBER

**Issues:**
- WARNING: No `errorWorkflow` set — webhook failures, Gmail errors, and Google Sheets write failures go completely unnotified.
- WARNING: Duplicate check runs **after** the DocuSign email is sent — a duplicate lead receives the DocuSign email before being flagged. If this is acceptable business logic, it should be documented; otherwise, check-before-send should be implemented.
- WARNING: Race condition: near-simultaneous form submissions (as seen in today's test) can both pass the duplicate check since neither row exists yet when the other is checking. The `Check for duplicates` code only deduplicates within a single execution's data.
- WARNING: Multiple `$('Trigger GravityForm submission').item.json.*` risky cross-node `.item` refs in `Check if Company is a Startup`, `Append row in sheet (startup)`, and `Append row in sheet (Non-startup)`.
- WARNING: `If` FALSE branch (non-duplicate) is unconnected — silent terminal end. OK if intentional, but should be documented.
- WARNING: `Update row in sheet` output is unconnected — silent terminal end.
- INFO: All Gmail nodes lack `onError` — a send failure means DocuSign email is not sent but the row is already appended. Lead would be stuck with no status update and no retry.

---

---

## Cross-Workflow Credential Audit

| Credential ID | Name | Type | Used By |
|---------------|------|------|---------|
| `8UYwvprhMGHKF6ra` | automation@spilledmilkagency.com | googleSheetsOAuth2Api | P1+P2 RSS, P0 Enrichment |
| `NMxhzXsSqk1u0lKF` | automation@spilledmilkagency.com | gmailOAuth2 | Error Handler |
| `NuvxHNUd8fNqRvXJ` | automation@spilledmilkagency.com | googleSheetsOAuth2Api | Error Handler (Bug Log — BROKEN sheet ref) |
| `cGgSXZ6cb8m5Q3gj` | [SpilledMilk] OpenAI | openAiApi | P0 Enrichment |
| `bGDlX6HiAGhitXLG` | CMCA | openAiApi | P3+P4+P5 |
| `YXb9X7xQCHvDzVz1` | OpenAi account | openAiApi | **DELETED** — was in old P3+P4+P5 version |
| `jr25MKfV6H2zSwxO` | Google Sheets account | googleSheetsOAuth2Api | P3+P4+P5 |
| `Vdifwq9lKoSXdEIj` | Google Docs account | googleDocsOAuth2Api | P3+P4+P5 |
| `apu6UY3Ke6WNXjpp` | [CMCA - dstheme] WordPress | wordpressApi | P3+P4+P5 |
| `LfULPgXZiOMRS3r5` | [CMCA - admin@cmcafinance.com] Gmail | gmailOAuth2 | P3 DocuSign, P2 Approve/Reject, P2 Reminder, P1 GravityForms |
| `gnjqsanqJmpgUgbn` | [CMCA - admin@cmcafinance.com] Google Sheets | googleSheetsOAuth2Api | P3 DocuSign, P2 Approve/Reject, P2 Reminder, P1 GravityForms |

**Note:** Credentials `8UYwvprhMGHKF6ra` and `NuvxHNUd8fNqRvXJ` are both named "automation@spilledmilkagency.com" but are different records — one is used for the RSS/content workflows, the other for the error handler. Both need to be verified as alive.

---

## Priority Action List

### CRITICAL — Fix Immediately

1. **Error Handler (bg8o5L8lUqPtR450cJsEu) — Bug Log sheet tab missing**
   Fix: Update `Log to Bug Log` node's `sheetName` to the correct GID for the Bug Log tab in spreadsheet `11yWjBmTvO_-cHHcWPJ2jT4PiRDN3nsjWyqSEnc7P_PI`. Until this is fixed, no CMCA workflow failures are being logged or notified.

2. **P0 Enrichment (d8sLKDe2RRDUsInf) — `Read Sheet` crash every 5 minutes**
   Fix: Open the `Read Sheet` node, re-authenticate/re-select the sheet and tab to refresh the credential binding. The likely cause is an expired OAuth token for `8UYwvprhMGHKF6ra` or a stale cached sheet reference.

3. **P3+P4+P5 (wbLgyQrVlroyVo0f) — OpenAI credential**
   The current live version uses `bGDlX6HiAGhitXLG` ("CMCA") — verify this is working by running a manual test. The deleted credential `YXb9X7xQCHvDzVz1` appeared in a recent execution, suggesting there may be a cached/old execution version causing the error.

### HIGH — Fix This Week

4. **Add `errorWorkflow` to P3 DocuSign, P2 Approve/Reject, P2 Reminder, P1 GravityForms, P0 Enrichment**
   None of these 5 workflows have `errorWorkflow` set. Failures go completely silent.

5. **P2 Reminder (TtULG9dkROqOH1l4) — `Update Automation Status: DocuSign email reminder created` is a dead-end**
   The 24h reminder path does not loop back after updating the sheet. Only the first qualifying lead per run gets a 24h reminder. Add a connection from `Update Automation Status: DocuSign email reminder created` back to `Loop leads = DocuSign email sent` input.

6. **P3 DocuSign (4jbCc1zM1gzua5xM) — `Get last item` crash on empty array**
   Add guard: `if (items.length === 0) return [];` before `return [ items[items.length - 1] ];`

### MEDIUM — Fix Within Sprint

7. **P1 GravityForms — Duplicate check runs after email**
   The DocuSign email is sent before the duplicate check runs. Reorder or add a pre-check.

8. **P2 Approve/Reject — Switch node has no fallback**
   Add a fallback/else output to log unrecognised `Admin Action` values.

9. **P3+P4+P5 — Risky `.item` cross-node refs**
   `$('Read Sheet').item.json.TITLE` etc inside the AI prompt should be replaced with data passed through the item context (e.g., merge data into the item before the AI call).

10. **P2 Reminder — Dual fan-out from Compare nodes**
    The architectural pattern of sending items back to the loop head AND to the IF node simultaneously should be reviewed — this likely causes double-processing.

### LOW — Cleanup / Info

11. **P1+P2 RSS — Redundant direct connection from `URLs` to `Loop Over URLs`**
    Remove the direct `URLs → Loop Over URLs` connection; route only through `Split Out URLs`.

12. **P0 Enrichment — 5-minute polling interval**
    Consider reducing to 15–30 minutes for a manually-triggered enrichment workflow.

13. **P3+P4+P5 — `Message a model` still on typeVersion 1**
    Upgrade to latest version when convenient.

14. **Stale staticData in P0 Enrichment**
    `node:Google Sheets Trigger` key in `staticData` is a leftover from the old trigger — harmless but can be cleared.

---

*Report end. All analysis is read-only. No workflow changes were made.*
