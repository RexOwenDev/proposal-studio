const fs = require('fs');

// Load P2 full workflow from cached file
const raw = fs.readFileSync(
  'C:/Users/owenq/.claude/projects/C--Users-owenq-OneDrive-Documents-N8N-Automation/cd1f2b72-d10a-4f61-a631-fc9dc1ab8f1f/tool-results/mcp-n8n-mcp-n8n_get_workflow-1773696184931.txt',
  'utf8'
);
const arr = JSON.parse(raw);
const wf = JSON.parse(arr[0].text).data;

// ============================================================
// FIX: Replace Google Sheets Trigger with Schedule Trigger
// The existing "Get row(s) in sheet" node already reads all rows.
// The "Status is NOT Sent email of approval/rejection" IF nodes
// already prevent duplicate emails — no other changes needed.
// ============================================================
const triggerNode = wf.nodes.find(n => n.name === 'Google Sheets Trigger');
triggerNode.type = 'n8n-nodes-base.scheduleTrigger';
triggerNode.typeVersion = 1.2;
triggerNode.name = 'Schedule Trigger';
triggerNode.parameters = {
  rule: {
    interval: [{ field: 'minutes', minutesInterval: 5 }]
  }
};
delete triggerNode.credentials;
delete triggerNode.executeOnce;

// Update connections key (node name changed)
wf.connections['Schedule Trigger'] = wf.connections['Google Sheets Trigger'];
delete wf.connections['Google Sheets Trigger'];

// ============================================================
// VERIFY
// ============================================================
const t = wf.nodes.find(n => n.name === 'Schedule Trigger');
console.log('Trigger type:', t.type, '| typeVersion:', t.typeVersion);
console.log('Trigger params:', JSON.stringify(t.parameters));
console.log('Schedule Trigger connection:', JSON.stringify(wf.connections['Schedule Trigger']));
console.log('Old trigger connections still exist?', !!wf.connections['Google Sheets Trigger']);
console.log('Total nodes:', wf.nodes.length);
const emailNodes = wf.nodes.filter(n => n.type === 'n8n-nodes-base.gmail');
console.log('Gmail nodes (unchanged):', emailNodes.map(n => n.name));

// Save payload (strip read-only fields)
const { id, createdAt, updatedAt, ...payload } = wf;
fs.writeFileSync(
  'C:/Users/owenq/OneDrive/Documents/N8N Automation/workflows/CMCA/P2_update_payload.json',
  JSON.stringify(payload, null, 2)
);
console.log('P2 payload saved successfully');
