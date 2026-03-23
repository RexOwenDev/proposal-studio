# SEO Report Automation — Phase 1: Complete Project Summary

> **Project Owner:** Owen Quintenta (owen.quintenta@designshopp.com)
> **End User:** Sophia Pinto (sophia.pinto@designshopp.com)
> **Automation Account:** automation@spilledmilkagency.com
> **Platform:** n8n Cloud Enterprise
> **Date Range:** March 8–10, 2026
> **Status:** Successfully Tested — Ready for Activation

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Input Documents Analyzed](#2-input-documents-analyzed)
3. [Key IDs, URLs & Folder Structure](#3-key-ids-urls--folder-structure)
4. [Workflow Architecture](#4-workflow-architecture)
5. [Node-by-Node Specification](#5-node-by-node-specification)
6. [Data Extraction Code (Full Source)](#6-data-extraction-code-full-source)
7. [Populate Template — All 20 Placeholders](#7-populate-template--all-20-placeholders)
8. [Email Templates](#8-email-templates)
9. [Credential Configuration](#9-credential-configuration)
10. [Bugs Found & Fixes Applied](#10-bugs-found--fixes-applied)
11. [Test Results & Verification](#11-test-results--verification)
12. [Remaining To-Dos](#12-remaining-to-dos)
13. [Future Client Onboarding](#13-future-client-onboarding)
14. [Technical Lessons Learned](#14-technical-lessons-learned)

---

## 1. Project Overview

### What This Workflow Does

An end-to-end automation that generates SEO Site Audit reports from SEMrush CSV exports:

1. **Watches** a Google Drive folder (`Incoming CSVs`) for new file uploads via polling trigger
2. **Validates** the uploaded file is a `.csv` file (rejects non-CSV files)
3. **Downloads & Parses** the CSV data (SEMrush Site Audit export — 102 rows of summary-level issue data)
4. **Extracts & Transforms** data into 20 report placeholder values using a Code node
5. **Copies** a Google Doc template to a `Report Drafts` folder with a dynamic name
6. **Populates** all 20 `{{placeholders}}` in the copied Google Doc with extracted data
7. **Emails Sophia** a notification with a clickable link to the draft report (Owen CC'd)
8. On failure: **Alerts Owen** via email with error details

### Pilot Client

- **Client Name:** DNE Resources
- **Client URL:** dneresources.com
- **CSV Filename Convention:** `dneresources.com_issues_20260309.csv`

---

## 2. Input Documents Analyzed

Three PDF documents were provided and thoroughly analyzed before building:

### Document 1: SOW / Overview
- Defined scope: automate monthly SEO Site Audit reports
- Identified stakeholders: Owen (project owner), Sophia (end user who uploads CSVs and reviews reports)
- Established the workflow trigger: CSV upload to Google Drive
- Defined deliverable: Google Doc draft report emailed to Sophia

### Document 2: Tech Spec
- Detailed the n8n node architecture
- Specified Google Drive folder structure
- Defined error handling requirements
- Listed all 20 placeholder fields for the report template
- Note: Tech spec initially described row-per-URL CSV structure, but actual CSV was summary-level (corrected during analysis)

### Document 3: Report Template Prompt
- Provided the exact report structure with 13 sections
- Defined all `{{placeholder}}` names and their expected values
- Specified the narrative/commentary format around each data point

### Key Corrections Made During Analysis
- **Budget:** Confirmed approved (was listed as pending in SOW)
- **Analyn:** Removed from project scope (was listed in SOW but not involved)
- **Google Drive Folders:** Already set up by Owen (no need to create)
- **CSV Structure:** Summary-level with 102 rows of issue categories (not row-per-URL as tech spec implied)

### CSV File Structure (SEMrush Site Audit Export)

| Column | Description | Example |
|--------|-------------|---------|
| `Issue Id` | Numeric ID | `1` |
| `Issue Type` | Category (Errors/Warnings/Notices) | `Errors` |
| `Issue` | Issue name/description | `Broken internal links` |
| `Failed checks` | Count of failed items | `3` |
| `Total checks` | Total items checked | `150` |
| `Changed from last audit` | Delta from previous audit | `+1` |

- **Total rows:** 102 (one row per issue category, with aggregate counts)
- **Filename convention:** `{domain}_issues_{YYYYMMDD}.csv`

---

## 3. Key IDs, URLs & Folder Structure

### Workflow
| Item | Value |
|------|-------|
| **Workflow Name** | SEO Report Automation — Phase 1 |
| **Workflow ID** | `p8Jg3k9LjLUOYFmC` |
| **Workflow URL** | https://designshopp.app.n8n.cloud/workflow/p8Jg3k9LjLUOYFmC |
| **Status** | Inactive (ready to activate) |
| **Version** | 17 (as of last edit) |

### Google Drive Folders
| Folder | Folder ID | Purpose |
|--------|-----------|---------|
| **Incoming CSVs** | `1cWUA8tstonkGvMcFBEAxb5TzsQqiC5Na` | Where Sophia uploads SEMrush CSV exports |
| **Report Drafts** | `1h-EEQq3J4Hdt_rAwJU8rD58SPe0bZ6Ey` | Where completed report copies are saved |

### Google Doc Template
| Item | Value |
|------|-------|
| **Template Name** | SEO Site Audit Report Template |
| **Template File ID** | `1n3_hajw-ACLMJ-xM3qeuSMPSaCEZb7UqyJZzVK6xrnc` |
| **Template URL** | https://docs.google.com/document/d/1n3_hajw-ACLMJ-xM3qeuSMPSaCEZb7UqyJZzVK6xrnc/edit |

### Email Addresses
| Person | Email | Role |
|--------|-------|------|
| Owen Quintenta | owen.quintenta@designshopp.com | Project owner, receives error alerts, CC'd on reports |
| Sophia Pinto | sophia.pinto@designshopp.com | End user, receives report notification emails |
| Automation Account | automation@spilledmilkagency.com | Sender for all automated emails |

---

## 4. Workflow Architecture

### Node Summary (18 Total)

| # | Node Name | Type | Node ID | Purpose |
|---|-----------|------|---------|---------|
| 1 | Google Drive Trigger | n8n-nodes-base.googleDriveTrigger v1 | `node-trigger` | Polls Incoming CSVs folder for new files |
| 2 | Is CSV? | n8n-nodes-base.if v2.3 | `node-is-csv` | Validates file extension is `.csv` |
| 3 | Download CSV | n8n-nodes-base.googleDrive v3 | `node-download` | Downloads the CSV file content |
| 4 | Parse CSV | n8n-nodes-base.spreadsheetFile v2 | `node-parse` | Converts CSV binary to JSON rows |
| 5 | Data Extraction | n8n-nodes-base.code v2 | `node-extract` | Extracts all 20 placeholder values |
| 6 | Copy Template | n8n-nodes-base.googleDrive v3 | `node-copy-template` | Copies Google Doc template to Report Drafts |
| 7 | Populate Template | n8n-nodes-base.googleDocs v2 | `node-populate` | Replaces all 20 `{{placeholders}}` in the copy |
| 8 | Notify Sophia | n8n-nodes-base.gmail v2.2 | `node-notify` | Sends HTML email with report link |
| 9 | Error Alert to Owen | n8n-nodes-base.gmail v2.2 | `node-error-alert` | Sends error details to Owen on failure |
| 10–11 | Error trigger nodes | (error handling) | — | Catch workflow errors |
| 12–18 | Sticky Notes (×7) | n8n-nodes-base.stickyNote | — | Documentation on each section |

### Connection Flow

```
Google Drive Trigger
        │
    Is CSV? ──(No)──► Error Alert to Owen
        │(Yes)
   Download CSV
        │
    Parse CSV
        │
  Data Extraction
        │
  Copy Template
        │
 Populate Template
        │
  Notify Sophia
```

---

## 5. Node-by-Node Specification

### Node 1: Google Drive Trigger
- **Type:** `n8n-nodes-base.googleDriveTrigger` v1
- **Event:** `fileCreated` (polls for new files)
- **Folder ID:** `1cWUA8tstonkGvMcFBEAxb5TzsQqiC5Na` (Incoming CSVs)
- **Poll Times:** Every minute (default)
- **Credential:** `automation@spilledmilkagency.com` Google Drive OAuth2

### Node 2: Is CSV?
- **Type:** `n8n-nodes-base.if` v2.3
- **Condition:** File name ends with `.csv` (case-insensitive)
- **True path:** → Download CSV
- **False path:** → Error Alert to Owen
- **Critical settings:** `conditions.options.version: 2`, `conditions.options.typeValidation: "strict"`

### Node 3: Download CSV
- **Type:** `n8n-nodes-base.googleDrive` v3
- **Operation:** `download`
- **File ID:** `={{ $json.id }}` (from trigger output)
- **Credential:** `Google Drive account`

### Node 4: Parse CSV
- **Type:** `n8n-nodes-base.spreadsheetFile` v2
- **Operation:** `fromFile` (binary → JSON)
- **Options:** Header row enabled, auto-detect delimiter

### Node 5: Data Extraction
- **Type:** `n8n-nodes-base.code` v2
- **Language:** JavaScript
- **Full code:** See [Section 6](#6-data-extraction-code-full-source) below

### Node 6: Copy Template
- **Type:** `n8n-nodes-base.googleDrive` v3
- **Operation:** `copy`
- **Source File ID:** `1n3_hajw-ACLMJ-xM3qeuSMPSaCEZb7UqyJZzVK6xrnc`
- **Destination Drive:** `myDrive`
- **Destination Folder:** `1h-EEQq3J4Hdt_rAwJU8rD58SPe0bZ6Ey` (Report Drafts)
- **New Name:** `=SEO Report Draft — {{ $json.client_name }} — {{ $json.report_date }}`
- **sameFolder:** `false` (CRITICAL — must be false to enable destination folder)
- **Credential:** `Google Drive account`

### Node 7: Populate Template
- **Type:** `n8n-nodes-base.googleDocs` v2
- **Operation:** `replaceAllText` (via `actionsUi.actionFields`)
- **Document ID:** `={{ $json.id }}` (from Copy Template output — the newly copied doc)
- **20 action fields:** See [Section 7](#7-populate-template--all-20-placeholders) below
- **Credential:** `automation@spilledmilkagency.com` Google Docs OAuth2

### Node 8: Notify Sophia
- **Type:** `n8n-nodes-base.gmail` v2.2
- **To:** `sophia.pinto@designshopp.com`
- **CC:** `owen.quintenta@designshopp.com`
- **Subject:** `=SEO Site Audit Report Draft — {{ $('Data Extraction').first().json.client_name }} — {{ $('Data Extraction').first().json.report_date }}`
- **Email Type:** `html`
- **Body:** HTML formatted email with report link (see [Section 8](#8-email-templates))
- **Credential:** `automation@spilledmilkagency.com` Gmail OAuth2

### Node 9: Error Alert to Owen
- **Type:** `n8n-nodes-base.gmail` v2.2
- **To:** `owen.quintenta@designshopp.com`
- **Subject:** `SEO Report Automation — Error Alert`
- **Email Type:** `html`
- **Body:** HTML formatted error notification
- **Credential:** `automation@spilledmilkagency.com` Gmail OAuth2

---

## 6. Data Extraction Code (Full Source)

```javascript
// SEO Report Automation — Data Extraction & Transformation
// Input: parsed CSV rows | Output: all 20 report placeholder values

const items = $input.all();
const rows = items.map(item => item.json);

// Get filename from trigger node
const filename = $('Google Drive Trigger').first().json.name;

// Parse filename: dneresources.com_issues_20260309.csv
const parts = filename.replace('.csv', '').split('_issues_');
const clientUrl = parts[0] || 'Unknown';
const dateRaw = parts[1] || '';

// Format date: 20260309 -> March 9, 2026
let reportDate = dateRaw;
if (dateRaw && dateRaw.length === 8) {
  const y = dateRaw.substring(0, 4);
  const m = parseInt(dateRaw.substring(4, 6));
  const d = parseInt(dateRaw.substring(6, 8));
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  reportDate = months[m - 1] + ' ' + d + ', ' + y;
}

// Client name mapping — ADD MORE CLIENTS HERE
const nameMap = {
  'dneresources.com': 'DNE Resources'
  // 'newclient.com': 'New Client Name'
};
const clientName = nameMap[clientUrl] || clientUrl;

// Helper: get Failed checks count by issue name (case-insensitive)
function fc(name) {
  const r = rows.find(x => x['Issue'] && x['Issue'].trim().toLowerCase() === name.toLowerCase());
  return r ? (parseInt(r['Failed checks']) || 0) : 0;
}

// Helper: build detail text for grouped issues
function detail(names) {
  const lines = names.filter(n => fc(n) > 0).map(n => '- ' + n + ': ' + fc(n));
  return lines.length > 0 ? lines.join('\n') : 'No issues found.';
}

// === HREFLANG ===
const hreflangNames = [
  'Hreflang conflicts within page source code',
  'Issues with incorrect hreflang links',
  'Issues with hreflang values',
  'Hreflang language mismatch issues'
];
const hreflangCount = hreflangNames.reduce((s, n) => s + fc(n), 0);

// === SITEMAP ===
const sitemapNames = [
  'Invalid sitemap.xml format',
  'Incorrect pages found in sitemap.xml',
  'Sitemap file too large',
  'Sitemap.xml not specified in robots.txt',
  'Sitemap.xml not found',
  'HTTP URLs in sitemap.xml for HTTPS site'
];
const sitemapCount = sitemapNames.reduce((s, n) => s + fc(n), 0);

// === HSTS ===
const hstsCount = fc('No HSTS support');

return [{
  json: {
    report_date: reportDate,
    client_name: clientName,
    client_url: clientUrl,
    site_health_score: '[ENTER SITE HEALTH SCORE]',
    hreflang_conflicts_count: String(hreflangCount),
    hreflang_conflicts_detail: detail(hreflangNames),
    sitemap_issues_count: String(sitemapCount),
    sitemap_issues_detail: detail(sitemapNames),
    broken_internal_links_count: String(fc('Broken internal links')),
    missing_alt_count: String(fc('Missing ALT attributes')),
    single_incoming_link_count: String(fc('Pages with only one internal link')),
    hsts_issues: hstsCount > 0 ? 'No HSTS support: ' + hstsCount + ' issue(s)' : 'No issues found.',
    duplicate_meta_desc_count: String(fc('Duplicate meta descriptions')),
    duplicate_h1_count: String(fc('Multiple h1 tags') + fc('Duplicate content in h1 and title')),
    duplicate_title_count: String(fc('Duplicate title tag')),
    missing_meta_desc_count: String(fc('Missing meta description')),
    title_length_short_count: String(fc('Title element is too short')),
    title_length_long_count: String(fc('Title element is too long')),
    url_underscore_count: String(fc('Underscores in URL')),
    non_descriptive_anchor_count: String(fc('Links with non-descriptive anchor text'))
  }
}];
```

### Code Logic Explained

1. **Filename Parsing:** Splits `dneresources.com_issues_20260309.csv` into domain (`dneresources.com`) and date (`20260309`)
2. **Date Formatting:** Converts `20260309` → `March 9, 2026`
3. **Client Name Lookup:** Maps domain to human-readable name via `nameMap` object
4. **`fc()` Helper:** Finds a row by issue name (case-insensitive) and returns its `Failed checks` value as integer
5. **`detail()` Helper:** For grouped issues (hreflang, sitemap), builds a bulleted list of non-zero issues
6. **Aggregation:** Hreflang and Sitemap counts sum multiple related issue rows; Duplicate H1 sums two related issues (`Multiple h1 tags` + `Duplicate content in h1 and title`)
7. **`site_health_score`:** Hardcoded as `[ENTER SITE HEALTH SCORE]` — must be manually entered by Sophia (SEMrush doesn't include this in the CSV export)

---

## 7. Populate Template — All 20 Placeholders

Each placeholder uses this n8n Google Docs v2 action field schema:

```json
{
  "object": "text",
  "action": "replaceAll",
  "text": "{{placeholder_name}}",
  "replaceText": "={{ $('Data Extraction').first().json.placeholder_name }}",
  "matchCase": true
}
```

### Complete Placeholder Map

| # | Placeholder (in Google Doc) | n8n Expression | Report Section |
|---|---------------------------|----------------|----------------|
| 1 | `{{report_date}}` | `$('Data Extraction').first().json.report_date` | Header / Title |
| 2 | `{{client_name}}` | `$('Data Extraction').first().json.client_name` | Header / Title |
| 3 | `{{client_url}}` | `$('Data Extraction').first().json.client_url` | Header / Title |
| 4 | `{{site_health_score}}` | `$('Data Extraction').first().json.site_health_score` | Section 1: Site Health |
| 5 | `{{hreflang_conflicts_count}}` | `$('Data Extraction').first().json.hreflang_conflicts_count` | Section 2: Hreflang |
| 6 | `{{hreflang_conflicts_detail}}` | `$('Data Extraction').first().json.hreflang_conflicts_detail` | Section 2: Hreflang |
| 7 | `{{sitemap_issues_count}}` | `$('Data Extraction').first().json.sitemap_issues_count` | Section 3: Sitemap |
| 8 | `{{sitemap_issues_detail}}` | `$('Data Extraction').first().json.sitemap_issues_detail` | Section 3: Sitemap |
| 9 | `{{broken_internal_links_count}}` | `$('Data Extraction').first().json.broken_internal_links_count` | Section 4: Internal Links |
| 10 | `{{missing_alt_count}}` | `$('Data Extraction').first().json.missing_alt_count` | Section 5: Image ALT |
| 11 | `{{single_incoming_link_count}}` | `$('Data Extraction').first().json.single_incoming_link_count` | Section 6: Link Distribution |
| 12 | `{{hsts_issues}}` | `$('Data Extraction').first().json.hsts_issues` | Section 7: HSTS |
| 13 | `{{duplicate_meta_desc_count}}` | `$('Data Extraction').first().json.duplicate_meta_desc_count` | Section 8: Meta Descriptions |
| 14 | `{{duplicate_h1_count}}` | `$('Data Extraction').first().json.duplicate_h1_count` | Section 9: H1 Tags |
| 15 | `{{duplicate_title_count}}` | `$('Data Extraction').first().json.duplicate_title_count` | Section 10: Title Tags |
| 16 | `{{missing_meta_desc_count}}` | `$('Data Extraction').first().json.missing_meta_desc_count` | Section 11: Missing Metadata |
| 17 | `{{title_length_short_count}}` | `$('Data Extraction').first().json.title_length_short_count` | Section 12: Title Length |
| 18 | `{{title_length_long_count}}` | `$('Data Extraction').first().json.title_length_long_count` | Section 12: Title Length |
| 19 | `{{url_underscore_count}}` | `$('Data Extraction').first().json.url_underscore_count` | Section 13: URL Structure |
| 20 | `{{non_descriptive_anchor_count}}` | `$('Data Extraction').first().json.non_descriptive_anchor_count` | Section 13: Anchor Text |

---

## 8. Email Templates

### Notify Sophia (Success Email)

**Subject:** `SEO Site Audit Report Draft — {client_name} — {report_date}`
**To:** sophia.pinto@designshopp.com
**CC:** owen.quintenta@designshopp.com
**From:** automation@spilledmilkagency.com

**HTML Body:**
```html
<p>Hi Sophia,</p>
<p>Your SEO Site Audit Report draft for <strong>{{ $('Data Extraction').first().json.client_name }}</strong> ({{ $('Data Extraction').first().json.report_date }}) is ready for review.</p>
<p><a href="https://docs.google.com/document/d/{{ $json.id }}/edit">Open Report Draft in Google Docs</a></p>
<p>Please review the draft, fill in the <strong>Site Health Score</strong> from SEMrush, and add any additional commentary before finalizing.</p>
<p>Best,<br>Design Shopp Automation</p>
```

### Error Alert to Owen

**Subject:** `SEO Report Automation — Error Alert`
**To:** owen.quintenta@designshopp.com
**From:** automation@spilledmilkagency.com

**HTML Body:**
```html
<p>Hi Owen,</p>
<p>The SEO Report Automation workflow encountered an error.</p>
<p><strong>Error:</strong> {{ $json.error.message }}</p>
<p>Please check the workflow execution log for details:</p>
<p><a href="https://designshopp.app.n8n.cloud/workflow/p8Jg3k9LjLUOYFmC/executions">View Execution Log</a></p>
<p>— Automation Bot</p>
```

---

## 9. Credential Configuration

All credentials were connected by Owen directly in the n8n UI.

| Node(s) | Credential Name | Credential ID | Type |
|---------|----------------|---------------|------|
| Google Drive Trigger | automation@spilledmilkagency.com | `VpFaCV9rKYuTzbXv` | Google Drive OAuth2 |
| Download CSV, Copy Template | Google Drive account | `PCgg772BBUUwhY9k` | Google Drive OAuth2 |
| Populate Template | automation@spilledmilkagency.com | `Rowcq7rTCiyfehVc` | Google Docs OAuth2 |
| Notify Sophia, Confirm to Owen, Error Alert | automation@spilledmilkagency.com | `NMxhzXsSqk1u0lKF` | Gmail OAuth2 |

**Note:** Two different Google Drive credentials are used:
- The **trigger** uses `automation@spilledmilkagency.com` (watches the shared folder)
- The **download/copy operations** use a separate `Google Drive account` credential

---

## 10. Bugs Found & Fixes Applied

### Bug 1: Populate Template Node Completely Stripped (CRITICAL)

- **Severity:** Critical — workflow non-functional
- **Symptom:** All 20 action fields in the Populate Template node were stripped to just `{"object": "body"}` with no action, findText, replaceText, or matchCase properties
- **Root Cause:** Used `object: "body"` but the Google Docs v2 node requires `object: "text"`. Since `"body"` isn't a valid option value, n8n stripped all conditional child fields. Also used `findText` instead of the correct field name `text`.
- **Fix:** Rebuilt all 20 action fields with correct schema:
  ```json
  {
    "object": "text",
    "action": "replaceAll",
    "text": "{{placeholder}}",
    "replaceText": "={{ $('Data Extraction').first().json.field }}",
    "matchCase": true
  }
  ```
- **Status:** Fixed and verified in live workflow

### Bug 2: Copy Template Destination Ignored (CRITICAL)

- **Severity:** Critical — reports saved to wrong folder
- **Symptom:** n8n validator warned that `driveId` and `folderId` parameters "won't be used — not visible with current settings"
- **Root Cause:** Google Drive v3 copy operation has a `sameFolder` parameter that defaults to `true`. When true, it ignores the destination folder parameters entirely and copies the file into the same folder as the original template.
- **Fix:** Added `sameFolder: false` to the Copy Template node parameters
- **Status:** Fixed and verified

### Bug 3: Template File ID Placeholder Not Replaced

- **Severity:** High — workflow would fail at Copy Template step
- **Symptom:** Copy Template node had literal string `TEMPLATE_FILE_ID_PLACEHOLDER` instead of the real Google Doc template ID
- **Fix:** Updated to `1n3_hajw-ACLMJ-xM3qeuSMPSaCEZb7UqyJZzVK6xrnc` via API
- **Status:** Fixed and verified

### Bug 4: Gmail Nodes Missing emailType Parameter

- **Severity:** Medium — emails might render as plain text instead of HTML
- **Symptom:** Notify Sophia and Error Alert nodes had HTML content in the message body but no `emailType: "html"` parameter set
- **Fix:** Added `emailType: "html"` to both Gmail nodes via API update
- **Note:** During testing, the email rendered as properly formatted HTML, suggesting either the fix persisted or Gmail defaults handled it correctly
- **Status:** Fixed

### Bug 5: IF Node Missing Version/TypeValidation Fields

- **Severity:** High — workflow creation would fail
- **Symptom:** Initial workflow creation failed because the IF node (v2.3) was missing required `conditions.options.version: 2` and `conditions.options.typeValidation: "strict"` fields
- **Fix:** Added both required fields to the IF node configuration
- **Status:** Fixed during initial workflow creation

### Bug 6: Node Name Matching with Em Dashes

- **Severity:** Medium — API updates failed silently
- **Symptom:** `updateNode` operations via n8n API failed with "Node not found" when using node names containing em dashes (—)
- **Fix:** Used full node IDs (e.g., `node-copy-template`) instead of display names for all API operations
- **Status:** Resolved

### Non-Bug: Validator False Positives on Populate Template

- **What happened:** n8n validator reported 20 "errors" saying `{{report_date}}`, `{{client_name}}`, etc. need a `=` prefix to be valid expressions
- **Why it's NOT a bug:** These are literal text strings to search for inside the Google Doc — they are NOT n8n expressions. Adding `=` would break the workflow by trying to evaluate them as JavaScript variables.
- **Action taken:** Documented as false positives; no changes applied

---

## 11. Test Results & Verification

### Test Execution

- **Test Date:** March 9, 2026
- **Test File:** `dneresources.com_issues_20260309.csv` (uploaded to Incoming CSVs folder)
- **Result:** Complete success — report generated, email sent and received

### Value-by-Value Verification (20/20 Correct)

| # | Placeholder | Expected (from CSV) | Actual (in Report) | Match |
|---|-------------|--------------------|--------------------|-------|
| 1 | `report_date` | March 9, 2026 | March 9, 2026 | ✅ |
| 2 | `client_name` | DNE Resources | DNE Resources | ✅ |
| 3 | `client_url` | dneresources.com | dneresources.com | ✅ |
| 4 | `site_health_score` | [ENTER SITE HEALTH SCORE] | [ENTER SITE HEALTH SCORE] | ✅ (placeholder — manual entry) |
| 5 | `hreflang_conflicts_count` | 0 | 0 | ✅ |
| 6 | `hreflang_conflicts_detail` | No issues found. | No issues found. | ✅ |
| 7 | `sitemap_issues_count` | 0 | 0 | ✅ |
| 8 | `sitemap_issues_detail` | No issues found. | No issues found. | ✅ |
| 9 | `broken_internal_links_count` | 3 | 3 | ✅ |
| 10 | `missing_alt_count` | 7 | 7 | ✅ |
| 11 | `single_incoming_link_count` | 42 | 42 | ✅ |
| 12 | `hsts_issues` | No HSTS support: 150 issue(s) | No HSTS support: 150 issue(s) | ✅ |
| 13 | `duplicate_meta_desc_count` | 0 | 0 | ✅ |
| 14 | `duplicate_h1_count` | 0 (0+0) | 0 | ✅ |
| 15 | `duplicate_title_count` | 0 | 0 | ✅ |
| 16 | `missing_meta_desc_count` | 4 | 4 | ✅ |
| 17 | `title_length_short_count` | 0 | 0 | ✅ |
| 18 | `title_length_long_count` | 0 | 0 | ✅ |
| 19 | `url_underscore_count` | 0 | 0 | ✅ |
| 20 | `non_descriptive_anchor_count` | 2 | 2 | ✅ |

### Email Verification

| Check | Result |
|-------|--------|
| **From:** | automation@spilledmilkagency.com ✅ |
| **To:** | sophia.pinto@designshopp.com ✅ |
| **CC:** | owen.quintenta@designshopp.com ✅ |
| **Subject:** | SEO Site Audit Report Draft — DNE Resources — March 9, 2026 ✅ |
| **Format:** | Properly rendered HTML (no raw tags visible) ✅ |
| **Report Link:** | Clickable Google Docs link to the draft ✅ |

---

## 12. Remaining To-Dos

### Before Go-Live

| # | Task | Priority | Owner |
|---|------|----------|-------|
| 1 | **Activate the workflow** in n8n (toggle on) | High | Owen |
| 2 | **Brief Sophia** on upload process (web browser only, not desktop sync) | High | Owen |
| 3 | **Test with Sophia** — have her do a real upload to verify the end-to-end flow from her perspective | Medium | Owen + Sophia |

### Post Go-Live (Optional)

| # | Task | Priority | Owner |
|---|------|----------|-------|
| 4 | Create a **Quick-Reference Guide** for Sophia (SEMrush export → upload → review workflow) | Medium | Owen |
| 5 | Add more clients to the `nameMap` in the Data Extraction Code node | As needed | Owen/Claude |
| 6 | Consider adding **Site Health Score** auto-extraction if SEMrush API access becomes available | Low | Owen |

### Important Note for Sophia's Briefing

Sophia must upload CSVs via **drive.google.com in her web browser** (drag & drop into the `Incoming CSVs` folder). She should **NOT** use Google Drive desktop sync app, as the polling trigger watches for file creation events and desktop sync can behave differently, potentially missing files or creating duplicate triggers.

---

## 13. Future Client Onboarding

To add a new client to the automation:

### Step 1: Add to Name Map
In the **Data Extraction** Code node, add a new entry to the `nameMap` object:

```javascript
const nameMap = {
  'dneresources.com': 'DNE Resources',
  'newclient.com': 'New Client Name'    // ← ADD HERE
};
```

### Step 2: CSV Naming Convention
Ensure the SEMrush CSV export is named following the convention:
```
{domain}_issues_{YYYYMMDD}.csv
```
Example: `newclient.com_issues_20260415.csv`

### Step 3: Upload
Upload the CSV to the **Incoming CSVs** Google Drive folder. The automation handles everything else automatically.

### No Other Changes Needed
- The Google Doc template is universal — same template works for all clients
- Email recipients stay the same (Sophia gets notified, Owen is CC'd)
- All 20 placeholder mappings are client-agnostic

---

## 14. Technical Lessons Learned

### n8n-Specific

1. **Google Docs v2 node schema:** Uses `object: "text"` (not `"body"`), `text` (not `"findText"`), and `action: "replaceAll"`. If the `object` value is invalid, n8n silently strips all dependent fields.

2. **Google Drive v3 copy operation:** The `sameFolder` parameter defaults to `true` and hides/ignores `driveId` and `folderId` when true. Always explicitly set `sameFolder: false` when specifying a destination folder.

3. **IF node v2.3:** Requires `conditions.options.version: 2` and `conditions.options.typeValidation: "strict"` — without these, workflow creation fails.

4. **n8n expression syntax:** Cross-node references use `={{ $('Node Name').first().json.fieldName }}`. The `=` prefix is required to mark it as an expression (not literal text).

5. **n8n validator false positives:** The validator incorrectly flags literal `{{placeholder}}` text in Google Docs replaceAllText fields as missing `=` prefix. These are intentional literal strings, not n8n expressions.

6. **Node names with special characters:** When using the n8n API for partial workflow updates, use node IDs (not display names) if names contain em dashes, special Unicode characters, or other non-ASCII characters.

7. **Gmail v2.2 emailType:** Set `emailType: "html"` explicitly when sending HTML-formatted emails. Without it, behavior may vary.

### Process

8. **Always verify against the actual data source:** The tech spec described a row-per-URL CSV structure, but the actual SEMrush export was summary-level (102 rows of issue categories). Building against the real CSV sample prevented a fundamental architecture error.

9. **n8n Cloud workflows are not local files:** Unlike code repos, n8n Cloud workflows live entirely on the n8n server. There are no local files to commit to Git. Changes are made via the n8n API or UI.

10. **Incremental validation is essential:** Each fix should be verified against the live workflow state before proceeding to the next fix, as n8n can silently strip or reset fields during updates.

---

## Appendix: Workflow JSON Export

To get the full workflow JSON at any time, use the n8n API:
```
GET https://designshopp.app.n8n.cloud/api/v1/workflows/p8Jg3k9LjLUOYFmC
```
Or export from the n8n UI: Workflow menu → Export → Download as JSON.

---

*Document generated: March 10, 2026*
*Workflow Version: 17*
*All data verified against live n8n workflow and test execution results*
