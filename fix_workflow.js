/**
 * Tornatech Translation Phase 2 — Full Fix Script
 * Fetches live workflow, applies all fixes, pushes back with correct versionId
 */

const https = require('https');

const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIwMDc3MDc3MS04YjEyLTRhYWUtOTViOC01Y2Q4ZWM3ODdjZTEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiM2RhZTliYjUtMGIzZC00NTYwLTgwOWItZjJhNDU4MjZhNDlhIiwiaWF0IjoxNzczMDU4NDQ3fQ.5gj1vO_Qu84I-1svy_47-jttfke3CdElDDL9U26PA-s';
const BASE_URL = 'https://designshopp.app.n8n.cloud';
const WORKFLOW_ID = 'iRbsq15eNqQvgDYg';
const WP_CRED = { id: 'kcKRdIUs4AzcomCH', name: '[Live] Tornatech WP Admin Account - qa@designshopp' };
const GMAIL_CRED = { id: 'NMxhzXsSqk1u0lKF', name: 'automation@spilledmilkagency.com' };
const SHEETS_CRED = { id: 'NuvxHNUd8fNqRvXJ', name: 'automation@spilledmilkagency.com' };

function apiRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const options = {
      hostname: 'designshopp.app.n8n.cloud',
      path: '/api/v1' + path,
      method,
      headers: {
        'X-N8N-API-KEY': API_KEY,
        'Content-Type': 'application/json',
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {})
      }
    };
    const req = https.request(options, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(JSON.parse(data));
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data.substring(0, 300)}`));
        }
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function findNode(nodes, id) {
  return nodes.find(n => n.id === id);
}

async function main() {
  console.log('Fetching live workflow...');
  const wf = await apiRequest('GET', `/workflows/${WORKFLOW_ID}`);
  console.log(`Got workflow: "${wf.name}" | versionId: ${wf.versionId} | nodes: ${wf.nodes.length}`);

  const nodes = JSON.parse(JSON.stringify(wf.nodes));
  const connections = JSON.parse(JSON.stringify(wf.connections));

  // ─── FIX 1: Fetch Tagged Posts → upgrade to v4.4 + add credentials ───────
  const fetchTagged = findNode(nodes, 't2-002');
  fetchTagged.typeVersion = 4.4;
  fetchTagged.parameters = {
    method: 'GET',
    url: 'https://www.tornatech.com/wp-json/wp/v2/posts?tags=985&status=publish&per_page=20',
    authentication: 'predefinedCredentialType',
    nodeCredentialType: 'wordpressApi',
    options: {}
  };
  fetchTagged.credentials = { wordpressApi: WP_CRED };
  fetchTagged.onError = 'continueRegularOutput';
  console.log('✓ Fixed: Fetch Tagged Posts');

  // ─── FIX 2: Fetch Full Post → upgrade to v4.4 + add credentials ──────────
  const fetchFull = findNode(nodes, 't2-005');
  fetchFull.typeVersion = 4.4;
  fetchFull.parameters = {
    method: 'GET',
    url: '=https://www.tornatech.com/wp-json/wp/v2/posts/{{ $json.id }}',
    authentication: 'predefinedCredentialType',
    nodeCredentialType: 'wordpressApi',
    options: {}
  };
  fetchFull.credentials = { wordpressApi: WP_CRED };
  fetchFull.onError = 'continueRegularOutput';
  console.log('✓ Fixed: Fetch Full Post');

  // ─── FIX 3: Create FR Draft → v4.4 + credentials + POST body ─────────────
  const createFR = findNode(nodes, 't2-011');
  createFR.typeVersion = 4.4;
  createFR.parameters = {
    method: 'POST',
    url: 'https://www.tornatech.com/wp-json/wp/v2/posts?lang=fr',
    authentication: 'predefinedCredentialType',
    nodeCredentialType: 'wordpressApi',
    sendBody: true,
    specifyBody: 'json',
    jsonBody: "={{ JSON.stringify({ title: $('Validate FR JSON').item.json.title_fr, content: $('Validate FR JSON').item.json.content_fr, status: 'draft' }) }}",
    options: {}
  };
  createFR.credentials = { wordpressApi: WP_CRED };
  createFR.onError = 'continueRegularOutput';
  console.log('✓ Fixed: Create FR Draft');

  // ─── FIX 4: Link FR Translation → v4.4 + credentials + POST body ─────────
  const linkFR = findNode(nodes, 't2-011b');
  linkFR.typeVersion = 4.4;
  linkFR.parameters = {
    method: 'POST',
    url: 'https://www.tornatech.com/wp-json/tornatech/v1/link-translation',
    authentication: 'predefinedCredentialType',
    nodeCredentialType: 'wordpressApi',
    sendBody: true,
    specifyBody: 'json',
    jsonBody: "={{ JSON.stringify({ original_id: $('Fetch Full Post').item.json.id, translation_id: $('Create FR Draft').item.json.id, lang: 'fr' }) }}",
    options: {}
  };
  linkFR.credentials = { wordpressApi: WP_CRED };
  linkFR.onError = 'continueRegularOutput';
  console.log('✓ Fixed: Link FR Translation');

  // ─── FIX 5: Create ES Draft → v4.4 + credentials + POST body ─────────────
  const createES = findNode(nodes, 't2-012');
  createES.typeVersion = 4.4;
  createES.parameters = {
    method: 'POST',
    url: 'https://www.tornatech.com/wp-json/wp/v2/posts?lang=es',
    authentication: 'predefinedCredentialType',
    nodeCredentialType: 'wordpressApi',
    sendBody: true,
    specifyBody: 'json',
    jsonBody: "={{ JSON.stringify({ title: $('Validate ES JSON').item.json.title_es, content: $('Validate ES JSON').item.json.content_es, status: 'draft' }) }}",
    options: {}
  };
  createES.credentials = { wordpressApi: WP_CRED };
  createES.onError = 'continueRegularOutput';
  console.log('✓ Fixed: Create ES Draft');

  // ─── FIX 6: Link ES Translation → v4.4 + credentials + POST body ─────────
  const linkES = findNode(nodes, 't2-012b');
  linkES.typeVersion = 4.4;
  linkES.parameters = {
    method: 'POST',
    url: 'https://www.tornatech.com/wp-json/tornatech/v1/link-translation',
    authentication: 'predefinedCredentialType',
    nodeCredentialType: 'wordpressApi',
    sendBody: true,
    specifyBody: 'json',
    jsonBody: "={{ JSON.stringify({ original_id: $('Fetch Full Post').item.json.id, translation_id: $('Create ES Draft').item.json.id, lang: 'es' }) }}",
    options: {}
  };
  linkES.credentials = { wordpressApi: WP_CRED };
  linkES.onError = 'continueRegularOutput';
  console.log('✓ Fixed: Link ES Translation');

  // ─── FIX 7: Append or update row in sheet → add all 15 column mappings ────
  const sheetNode = nodes.find(n => n.id === '87e242a8-2bdd-4ac5-920c-c19b4789d88d');
  sheetNode.parameters.columns.value = {
    'Date': "={{ $now.toISO() }}",
    'Post ID': "={{ $('Fetch Full Post').item.json.id }}",
    'Post Title EN': "={{ $('Fetch Full Post').item.json.title.rendered }}",
    'Post URL': "={{ $('Fetch Full Post').item.json.link }}",
    'Title FR': "={{ $('Validate FR JSON').item.json.title_fr }}",
    'Title ES': "={{ $('Validate ES JSON').item.json.title_es }}",
    'SEO Title FR': "={{ $('Validate Yoast JSON').item.json.seo_title_fr }}",
    'SEO Desc FR': "={{ $('Validate Yoast JSON').item.json.seo_desc_fr }}",
    'SEO Title ES': "={{ $('Validate Yoast JSON').item.json.seo_title_es }}",
    'SEO Desc ES': "={{ $('Validate Yoast JSON').item.json.seo_desc_es }}",
    'FR Draft ID': "={{ $('Create FR Draft').item.json.id }}",
    'FR Draft URL': "={{ 'https://www.tornatech.com/wp-admin/post.php?post=' + $('Create FR Draft').item.json.id + '&action=edit' }}",
    'ES Draft ID': "={{ $('Create ES Draft').item.json.id }}",
    'ES Draft URL': "={{ 'https://www.tornatech.com/wp-admin/post.php?post=' + $('Create ES Draft').item.json.id + '&action=edit' }}",
    'Status': 'Translated - Pending Review'
  };
  sheetNode.parameters.columns.matchingColumns = ['Post ID'];
  sheetNode.onError = 'continueRegularOutput';
  console.log('✓ Fixed: Append or update row in sheet (15 columns mapped)');

  // ─── FIX 8: Configure "Send a message" (Gmail v2.2) ──────────────────────
  const sendMsg = nodes.find(n => n.id === '3178b8e6-f30e-4436-9867-7da74d647c2f');
  sendMsg.parameters = {
    resource: 'message',
    operation: 'send',
    sendTo: 'owen.quintenta@designshopp.com,melissa@designshopp.com',
    subject: "=Translation Ready for Review: {{ $('Fetch Full Post').item.json.title.rendered }}",
    emailType: 'html',
    message: "=<p>Hi Team,</p>\n\n<p>A post has been automatically translated to <strong>French</strong> and <strong>Spanish</strong> and is ready for review.</p>\n\n<h3>Original Post</h3>\n<p><strong>Title:</strong> {{ $('Fetch Full Post').item.json.title.rendered }}<br>\n<strong>URL:</strong> <a href=\"{{ $('Fetch Full Post').item.json.link }}\">{{ $('Fetch Full Post').item.json.link }}</a></p>\n\n<h3>French Draft</h3>\n<p><strong>Title:</strong> {{ $('Validate FR JSON').item.json.title_fr }}<br>\n<strong>Edit Link:</strong> <a href=\"https://www.tornatech.com/wp-admin/post.php?post={{ $('Create FR Draft').item.json.id }}&action=edit\">Review &amp; Edit French Draft</a><br>\n<em>Reviewer: HR team / Marketing</em></p>\n\n<h3>Spanish Draft</h3>\n<p><strong>Title:</strong> {{ $('Validate ES JSON').item.json.title_es }}<br>\n<strong>Edit Link:</strong> <a href=\"https://www.tornatech.com/wp-admin/post.php?post={{ $('Create ES Draft').item.json.id }}&action=edit\">Review &amp; Edit Spanish Draft</a><br>\n<em>Reviewer: Sales team</em></p>\n\n<h3>After Review</h3>\n<p>Once approved, copy the translations into WPML. All translations are also logged in the <a href=\"https://docs.google.com/spreadsheets/d/18M5kXYvM_VmyJ9uRzfTWyyPdgkB1ViSL61rYFRfBzuQ\">Translation Sheet</a>.</p>\n\n<p style=\"font-size:12px;color:#888;\">Automated by Spilled Milk Agency</p>",
    options: { appendAttribution: false }
  };
  sendMsg.credentials = { gmailOAuth2: GMAIL_CRED };
  sendMsg.onError = 'continueRegularOutput';
  console.log('✓ Fixed: Send a message (Gmail v2.2 fully configured)');

  // ─── FIX 9: onError on all remaining nodes ────────────────────────────────
  const noOnError = ['t2-001','t2-003','t2-004','t2-006','t2-007','t2-008','t2-009','t2-010','t2-010b','t2-013'];
  noOnError.forEach(id => {
    const n = findNode(nodes, id);
    if (n) { n.onError = 'continueRegularOutput'; }
  });
  console.log('✓ Fixed: onError set on all remaining nodes');

  // ─── FIX 10: Remove old Notify Reviewers node entirely ───────────────────
  const notifyIdx = nodes.findIndex(n => n.id === 't2-015');
  if (notifyIdx !== -1) {
    nodes.splice(notifyIdx, 1);
    console.log('✓ Removed: old Notify Reviewers node (Gmail v1)');
  }

  // ─── FIX 11: Fix connection chain ────────────────────────────────────────
  // Remove Notify Reviewers from connections
  delete connections['Notify Reviewers'];

  // Fix: Append or update row in sheet → Send a message (not Notify Reviewers)
  const sheetNodeName = 'Append or update row in sheet';
  connections[sheetNodeName] = {
    main: [[{ node: 'Send a message', type: 'main', index: 0 }]]
  };

  // Fix: Send a message → Loop Over Posts (loop back)
  connections['Send a message'] = {
    main: [[{ node: 'Loop Over Posts', type: 'main', index: 0 }]]
  };
  console.log('✓ Fixed: Connection chain — Append or update row → Send a message → Loop Over Posts');

  // ─── PUSH ─────────────────────────────────────────────────────────────────
  const payload = {
    name: wf.name,
    nodes,
    connections,
    settings: wf.settings
  };

  console.log(`\nPushing ${nodes.length} nodes to n8n (versionId: ${wf.versionId})...`);
  const result = await apiRequest('PUT', `/workflows/${WORKFLOW_ID}`, payload);
  console.log(`\n✅ SUCCESS — Workflow updated!`);
  console.log(`   Name: ${result.name}`);
  console.log(`   Nodes: ${result.nodes.length}`);
  console.log(`   New versionId: ${result.versionId}`);
  console.log(`   Active: ${result.active}`);

  // Re-activate if it was deactivated during update
  if (!result.active) {
    await apiRequest('POST', `/workflows/${WORKFLOW_ID}/activate`);
    console.log('✅ Workflow re-activated');
  }
}

main().catch(err => {
  console.error('\n❌ FAILED:', err.message);
  process.exit(1);
});
