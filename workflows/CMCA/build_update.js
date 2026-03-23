const fs = require('fs');
const raw = fs.readFileSync('C:/Users/owenq/.claude/projects/C--Users-owenq-OneDrive-Documents-N8N-Automation/cd1f2b72-d10a-4f61-a631-fc9dc1ab8f1f/tool-results/toolu_01Ji3i2jZZw4mga2RBSSGsNq.json', 'utf8');
const arr = JSON.parse(raw);
const wf = JSON.parse(arr[0].text).data;

// ============================================================
// FIX 1: Updated Status Log — fix broken pairedItem expression
// $('Read Sheet').item is unresolvable because Extract Article Text
// creates a new item with no pairedItem link back to Read Sheet.
// Extract Article Text explicitly spreads originalData (URL included)
// so $('Extract Article Text').item.json.URL is always resolvable.
// ============================================================
const statusLogNode = wf.nodes.find(n => n.name === 'Updated Status Log');
statusLogNode.parameters.columns.value['URL'] = "={{ $('Extract Article Text').item.json.URL }}";

// ============================================================
// FIX 2: Create a post — enable error output branch
// Without this, a WordPress failure throws and skips Updated Status Log,
// leaving the sheet row unmarked, causing the 5-min poll to reprocess
// the same row indefinitely (the retry loop seen in 10821-10828).
// ============================================================
const createPostNode = wf.nodes.find(n => n.name === 'Create a post');
createPostNode.onError = 'continueErrorOutput';

// ============================================================
// FIX 3: New node — Error: WP Post Failed
// Writes an error status to STATUS LOG so Code JS filter excludes
// this row on subsequent polls, breaking the retry loop permanently.
// Also routes back to Loop Over Items: APPROVED to continue processing
// any remaining approved rows in the same execution.
// ============================================================
const errorNode = {
  id: 'e1a2b3c4-d5e6-7f89-ab01-cd23ef456789',
  name: 'Error: WP Post Failed',
  type: 'n8n-nodes-base.googleSheets',
  typeVersion: 4,
  position: [1152, -48],
  credentials: statusLogNode.credentials,
  parameters: {
    operation: 'appendOrUpdate',
    documentId: {
      __rl: true,
      value: '1O7jBME_Vmh0ORs5vchKfWvAo0Ayn0wjWeBJbDJdpfas',
      mode: 'list',
      cachedResultName: 'CMCA Blog Topics - AUTOMATION TEST',
      cachedResultUrl: 'https://docs.google.com/spreadsheets/d/1O7jBME_Vmh0ORs5vchKfWvAo0Ayn0wjWeBJbDJdpfas/edit?usp=drivesdk'
    },
    sheetName: {
      __rl: true,
      value: 'gid=0',
      mode: 'list',
      cachedResultName: 'Sheet1',
      cachedResultUrl: 'https://docs.google.com/spreadsheets/d/1O7jBME_Vmh0ORs5vchKfWvAo0Ayn0wjWeBJbDJdpfas/edit#gid=0'
    },
    columns: {
      mappingMode: 'defineBelow',
      value: {
        'URL': "={{ $('Extract Article Text').item.json.URL }}",
        'STATUS LOG': "={{ $now.setZone('America/Toronto').toFormat('yyyy-MM-dd HH:mm') }} | ERROR - WordPress post creation failed"
      },
      matchingColumns: ['URL'],
      schema: [
        { id: 'URL', displayName: 'URL', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true, removed: false },
        { id: 'TITLE', displayName: 'TITLE', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true, removed: true },
        { id: 'DATE PUBLISHED', displayName: 'DATE PUBLISHED', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true, removed: true },
        { id: 'ADMIN ACTION', displayName: 'ADMIN ACTION', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true, removed: true },
        { id: 'STATUS LOG', displayName: 'STATUS LOG', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true, removed: false },
        { id: 'LINK TO GOOGLE DOC', displayName: 'LINK TO GOOGLE DOC', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true, removed: true },
        { id: 'LINK TO WORDPRESS BACKEND', displayName: 'LINK TO WORDPRESS BACKEND', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true, removed: true }
      ],
      attemptToConvertTypes: false,
      convertFieldsToString: false
    },
    options: {}
  }
};
wf.nodes.push(errorNode);

// Add connections: Create a post error output → Error: WP Post Failed
if (!wf.connections['Create a post'].main[1]) {
  wf.connections['Create a post'].main[1] = [];
}
wf.connections['Create a post'].main[1].push({
  node: 'Error: WP Post Failed',
  type: 'main',
  index: 0
});

// Error: WP Post Failed → Loop Over Items: APPROVED (continue to next row)
wf.connections['Error: WP Post Failed'] = {
  main: [
    [
      { node: 'Loop Over Items: APPROVED', type: 'main', index: 0 }
    ]
  ]
};

// ============================================================
// VERIFY
// ============================================================
const sl = wf.nodes.find(n => n.name === 'Updated Status Log');
console.log('Fix 1 URL expr:', sl.parameters.columns.value.URL);
const cp = wf.nodes.find(n => n.name === 'Create a post');
console.log('Fix 2 onError:', cp.onError);
const en = wf.nodes.find(n => n.name === 'Error: WP Post Failed');
console.log('Fix 3 error node:', en ? 'EXISTS' : 'MISSING');
console.log('Fix 3 Create a post connections:', JSON.stringify(wf.connections['Create a post'], null, 2));
console.log('Fix 3 Error node connections:', JSON.stringify(wf.connections['Error: WP Post Failed'], null, 2));
console.log('Total nodes:', wf.nodes.length);

// Save payload (strip read-only fields)
const { id, createdAt, updatedAt, ...payload } = wf;
fs.writeFileSync(
  'C:/Users/owenq/OneDrive/Documents/N8N Automation/workflows/CMCA/P3-P4-P5_update_payload.json',
  JSON.stringify(payload, null, 2)
);
console.log('Payload saved successfully');
