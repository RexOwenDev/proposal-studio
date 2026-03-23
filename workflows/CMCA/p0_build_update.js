const fs = require('fs');

// P0 workflow data — fetched live 2026-03-16
// Full workflow JSON saved inline to avoid re-fetch dependency
const raw = fs.readFileSync(
  'C:/Users/owenq/.claude/projects/C--Users-owenq-OneDrive-Documents-N8N-Automation/cd1f2b72-d10a-4f61-a631-fc9dc1ab8f1f/tool-results/mcp-n8n-mcp-n8n_get_workflow-1773696184931.txt',
  'utf8'
);

// This file is P2 — for P0 we use the inline data captured from the API response
// P0 full workflow is embedded below
const wf = {
  "id": "d8sLKDe2RRDUsInf",
  "name": "P0: Manual URL Enrichment (Sophia)",
  "active": true,
  "settings": { "executionOrder": "v1", "binaryMode": "separate", "availableInMCP": false },
  "nodes": [
    {
      "parameters": {
        "pollTimes": { "item": [{ "mode": "everyMinute" }] },
        "documentId": { "__rl": true, "value": "1O7jBME_Vmh0ORs5vchKfWvAo0Ayn0wjWeBJbDJdpfas", "mode": "list", "cachedResultName": "CMCA Blog Topics - AUTOMATION TEST", "cachedResultUrl": "https://docs.google.com/spreadsheets/d/1O7jBME_Vmh0ORs5vchKfWvAo0Ayn0wjWeBJbDJdpfas/edit?usp=drivesdk" },
        "sheetName": { "__rl": true, "value": "gid=0", "mode": "list", "cachedResultName": "Sheet1", "cachedResultUrl": "https://docs.google.com/spreadsheets/d/1O7jBME_Vmh0ORs5vchKfWvAo0Ayn0wjWeBJbDJdpfas/edit#gid=0" },
        "event": "rowUpdate",
        "options": { "columnsToWatch": ["URL"] }
      },
      "type": "n8n-nodes-base.googleSheetsTrigger",
      "typeVersion": 1,
      "position": [0, 0],
      "id": "b1a86500-213e-44e0-a900-6e2e99d2a4a2",
      "name": "Google Sheets Trigger",
      "retryOnFail": true,
      "waitBetweenTries": 5000,
      "credentials": { "googleSheetsTriggerOAuth2Api": { "id": "0b6nrZSaUQxfUH04", "name": "automation@spilledmilkagency.com" } }
    },
    {
      "parameters": { "jsCode": "const items = $input.all();\nconst filtered = items.filter(item => {\n  const row = item.json;\n  return (\n    row[\"URL\"] && row[\"URL\"].trim() !== \"\" &&\n    (!row[\"TITLE\"] || row[\"TITLE\"].trim() === \"\") &&\n    (!row[\"STATUS LOG\"] || row[\"STATUS LOG\"].trim() === \"\")\n  );\n});\nreturn filtered;" },
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [288, 0],
      "id": "baed67f0-8261-4544-b930-ccae72bd9550",
      "name": "Filter: Manual Submissions Only",
      "alwaysOutputData": false
    },
    {
      "parameters": {
        "url": "={{ $json.URL }}",
        "sendHeaders": true,
        "specifyHeaders": "json",
        "jsonHeaders": "{\n  \"User-Agent\": \"Mozilla/5.0 (compatible; CMCABot/1.0)\"\n}",
        "options": { "redirect": { "redirect": {} }, "response": { "response": { "responseFormat": "text" } }, "timeout": 3000 }
      },
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.4,
      "position": [560, 0],
      "id": "87696ded-832e-4622-aebb-f106111fd5bd",
      "name": "Fetch Article Page",
      "alwaysOutputData": false
    },
    {
      "parameters": { "jsCode": "const html = $input.first().json.data || $input.first().json.body || \"\";\nconst originalData = $('Filter: Manual Submissions Only').item.json;\n\n// Stop if fetch returned nothing useful\nif (!html || html.length < 100) {\n  return []; // Skip this item\n}\n\n// Extract page title from <title> tag\nconst titleMatch = html.match(/<title[^>]*>([^<]+)<\\/title>/i);\nconst pageTitle = titleMatch ? titleMatch[1].trim() : \"\";\n\n// Remove non-article elements\nlet cleaned = html\n  .replace(/<script[\\s\\S]*?<\\/script>/gi, \"\")\n  .replace(/<style[\\s\\S]*?<\\/style>/gi, \"\")\n  .replace(/<nav[\\s\\S]*?<\\/nav>/gi, \"\")\n  .replace(/<header[\\s\\S]*?<\\/header>/gi, \"\")\n  .replace(/<footer[\\s\\S]*?<\\/footer>/gi, \"\")\n  .replace(/<aside[\\s\\S]*?<\\/aside>/gi, \"\")\n  .replace(/<figure[\\s\\S]*?<\\/figure>/gi, \"\");\n\n// Try to extract from <article> tag first\nconst articleMatch = cleaned.match(/<article[\\s\\S]*?<\\/article>/i);\nif (articleMatch) {\n  cleaned = articleMatch[0];\n}\n\n// Strip remaining HTML tags\ncleaned = cleaned.replace(/<[^>]+>/g, \" \");\n\n// Clean HTML entities and whitespace\ncleaned = cleaned\n  .replace(/&nbsp;/g, \" \")\n  .replace(/&amp;/g, \"&\")\n  .replace(/&lt;/g, \"<\")\n  .replace(/&gt;/g, \">\")\n  .replace(/&#39;/g, \"'\")\n  .replace(/&quot;/g, '\"')\n  .replace(/\\s+/g, \" \")\n  .trim();\n\n// Take first 4000 characters\nconst truncated = cleaned.substring(0, 4000);\n\n// Format today's date to match sheet format: Jan 14, 2026 @ 15:20\nconst now = new Date();\nconst monthNames = [\"Jan\",\"Feb\",\"Mar\",\"Apr\",\"May\",\"Jun\",\"Jul\",\"Aug\",\"Sep\",\"Oct\",\"Nov\",\"Dec\"];\nconst formattedDate = monthNames[now.getMonth()] + \" \" +\n  now.getDate() + \", \" +\n  now.getFullYear() + \" @ \" +\n  String(now.getHours()).padStart(2,\"0\") + \":\" +\n  String(now.getMinutes()).padStart(2,\"0\");\n\nreturn [{\n  json: {\n    ...originalData,\n    TITLE: pageTitle,\n    DATE_PUBLISHED: formattedDate,\n    CONTENT: truncated\n  }\n}];\n" },
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [800, 0],
      "id": "18a4c17a-c488-44d9-a525-58ac4c6d99d9",
      "name": "Extract Article Text + Page Title"
    },
    {
      "parameters": {
        "modelId": { "__rl": true, "value": "gpt-4.1-mini", "mode": "list", "cachedResultName": "GPT-4.1-MINI" },
        "responses": { "values": [{ "content": "You are a content evaluator for CMCA Finance, a Canadian small business working capital provider.\n\nEvaluate the article below against these 5 criteria. Answer YES or NO for each. Then give a PASS or FAIL verdict.\n\nRules:\n- FAIL if more than one answer is NO\n- FAIL if the article is primarily about US business, investment portfolios, wealth management, cryptocurrency, or is not relevant to Canadian SMEs\n\n1. Does this article focus on Canadian small businesses (SMEs) or their operating environment?\n2. Does it include credible statistics, data, or research findings?\n3. Does it highlight financial pressure, cost increases, revenue instability, or lending challenges?\n4. Is the source reputable (CFIB, Statistics Canada, Bank of Canada, BDC, major Canadian news outlet, industry association)?\n5. Can this be reframed into a working capital or cash flow discussion that will still feel relevant in 6-12 months?\n\nArticle Title: {{ $json.TITLE }}\nArticle Content: {{ $json.CONTENT }}\n\nReturn ONLY valid JSON with no text before or after:\n{\n  \"q1\": \"YES or NO\",\n  \"q2\": \"YES or NO\",\n  \"q3\": \"YES or NO\",\n  \"q4\": \"YES or NO\",\n  \"q5\": \"YES or NO\",\n  \"verdict\": \"PASS or FAIL\",\n  \"fail_reason\": \"Brief reason if FAIL, empty string if PASS\"\n}\n" }] },
        "builtInTools": {},
        "options": {}
      },
      "type": "@n8n/n8n-nodes-langchain.openAi",
      "typeVersion": 2.1,
      "position": [1104, 0],
      "id": "860ae0b0-d567-4938-8390-4a9f75062979",
      "name": "Message a model",
      "credentials": { "openAiApi": { "id": "cGgSXZ6cb8m5Q3gj", "name": "[SpilledMilk - billing@spilledmilk.com] OpenAi account" } }
    },
    {
      "parameters": { "jsCode": "const aiOutput = $input.first();\nconst originalData = $('Extract Article Text + Page Title').item.json;\n\n// Extract text from AI response\nlet rawText = \"\";\nif (aiOutput.json.message && aiOutput.json.message.content) {\n  rawText = aiOutput.json.message.content\n    .filter(block => block.type === \"text\")\n    .map(block => block.text)\n    .join(\"\");\n} else if (aiOutput.json.text) {\n  rawText = aiOutput.json.text;\n}\n\n// Clean any markdown fences (replace backtick sequences)\nrawText = rawText.replace(/```json|```/g, \"\").trim();\n\nlet parsed;\ntry {\n  parsed = JSON.parse(rawText);\n} catch (e) {\n  // If parsing fails, treat as FAIL\n  parsed = {\n    verdict: \"FAIL\",\n    fail_reason: \"AI response could not be parsed\"\n  };\n}\n\nreturn [{\n  json: {\n    ...originalData,\n    verdict: parsed.verdict || \"FAIL\",\n    fail_reason: parsed.fail_reason || \"\"\n  }\n}];\n" },
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [1520, 0],
      "id": "85810451-a1b8-40ac-9a4a-ec942bc03a79",
      "name": "Parse AI Reponse"
    },
    {
      "parameters": {
        "conditions": {
          "options": { "caseSensitive": true, "leftValue": "", "typeValidation": "strict", "version": 3 },
          "conditions": [{ "id": "1fb74b36-9887-4049-ab16-4ebc95801fec", "leftValue": "={{ $json.verdict }}", "rightValue": "PASS", "operator": { "type": "string", "operation": "equals" } }],
          "combinator": "and"
        },
        "options": {}
      },
      "type": "n8n-nodes-base.if",
      "typeVersion": 2.3,
      "position": [1792, 0],
      "id": "e58585eb-c775-4141-9da7-66f7490d0ee3",
      "name": "Check Verdict"
    },
    {
      "parameters": {
        "operation": "appendOrUpdate",
        "documentId": { "__rl": true, "value": "1O7jBME_Vmh0ORs5vchKfWvAo0Ayn0wjWeBJbDJdpfas", "mode": "list", "cachedResultName": "CMCA Blog Topics - AUTOMATION TEST", "cachedResultUrl": "https://docs.google.com/spreadsheets/d/1O7jBME_Vmh0ORs5vchKfWvAo0Ayn0wjWeBJbDJdpfas/edit?usp=drivesdk" },
        "sheetName": { "__rl": true, "value": "gid=0", "mode": "list", "cachedResultName": "Sheet1", "cachedResultUrl": "https://docs.google.com/spreadsheets/d/1O7jBME_Vmh0ORs5vchKfWvAo0Ayn0wjWeBJbDJdpfas/edit#gid=0" },
        "columns": {
          "mappingMode": "defineBelow",
          "value": { "URL": "={{ $json.URL }}", "TITLE": "={{ $json.TITLE }}", "DATE PUBLISHED": "={{ $json.DATE_PUBLISHED }}", "CONTENT": "={{ $json.CONTENT }}", "STATUS LOG": "Ready for review" },
          "matchingColumns": ["URL"],
          "schema": [
            { "id": "URL", "displayName": "URL", "required": false, "defaultMatch": false, "display": true, "type": "string", "canBeUsedToMatch": true, "removed": false },
            { "id": "TITLE", "displayName": "TITLE", "required": false, "defaultMatch": false, "display": true, "type": "string", "canBeUsedToMatch": true },
            { "id": "DATE PUBLISHED", "displayName": "DATE PUBLISHED", "required": false, "defaultMatch": false, "display": true, "type": "string", "canBeUsedToMatch": true },
            { "id": "ADMIN ACTION", "displayName": "ADMIN ACTION", "required": false, "defaultMatch": false, "display": true, "type": "string", "canBeUsedToMatch": true, "removed": true },
            { "id": "STATUS LOG", "displayName": "STATUS LOG", "required": false, "defaultMatch": false, "display": true, "type": "string", "canBeUsedToMatch": true },
            { "id": "LINK TO GOOGLE DOC", "displayName": "LINK TO GOOGLE DOC", "required": false, "defaultMatch": false, "display": true, "type": "string", "canBeUsedToMatch": true, "removed": true },
            { "id": "LINK TO WORDPRESS BACKEND", "displayName": "LINK TO WORDPRESS BACKEND", "required": false, "defaultMatch": false, "display": true, "type": "string", "canBeUsedToMatch": true, "removed": true },
            { "id": "CONTENT", "displayName": "CONTENT", "required": false, "defaultMatch": false, "display": true, "type": "string", "canBeUsedToMatch": true }
          ],
          "attemptToConvertTypes": false,
          "convertFieldsToString": false
        },
        "options": {}
      },
      "type": "n8n-nodes-base.googleSheets",
      "typeVersion": 4.7,
      "position": [2112, -96],
      "id": "722f99d7-fefb-46e0-8003-c104dd0cc92b",
      "name": "Write PASS to Sheet",
      "credentials": { "googleSheetsOAuth2Api": { "id": "8UYwvprhMGHKF6ra", "name": "automation@spilledmilkagency.com" } }
    },
    {
      "parameters": {
        "operation": "appendOrUpdate",
        "documentId": { "__rl": true, "value": "1O7jBME_Vmh0ORs5vchKfWvAo0Ayn0wjWeBJbDJdpfas", "mode": "list", "cachedResultName": "CMCA Blog Topics - AUTOMATION TEST", "cachedResultUrl": "https://docs.google.com/spreadsheets/d/1O7jBME_Vmh0ORs5vchKfWvAo0Ayn0wjWeBJbDJdpfas/edit?usp=drivesdk" },
        "sheetName": { "__rl": true, "value": "gid=0", "mode": "list", "cachedResultName": "Sheet1", "cachedResultUrl": "https://docs.google.com/spreadsheets/d/1O7jBME_Vmh0ORs5vchKfWvAo0Ayn0wjWeBJbDJdpfas/edit#gid=0" },
        "columns": {
          "mappingMode": "defineBelow",
          "value": { "URL": "={{ $json.URL }}", "STATUS LOG": "=Rejected — {{ $json.fail_reason }}" },
          "matchingColumns": ["URL"],
          "schema": [
            { "id": "URL", "displayName": "URL", "required": false, "defaultMatch": false, "display": true, "type": "string", "canBeUsedToMatch": true, "removed": false },
            { "id": "TITLE", "displayName": "TITLE", "required": false, "defaultMatch": false, "display": true, "type": "string", "canBeUsedToMatch": true, "removed": true },
            { "id": "DATE PUBLISHED", "displayName": "DATE PUBLISHED", "required": false, "defaultMatch": false, "display": true, "type": "string", "canBeUsedToMatch": true, "removed": true },
            { "id": "ADMIN ACTION", "displayName": "ADMIN ACTION", "required": false, "defaultMatch": false, "display": true, "type": "string", "canBeUsedToMatch": true, "removed": true },
            { "id": "STATUS LOG", "displayName": "STATUS LOG", "required": false, "defaultMatch": false, "display": true, "type": "string", "canBeUsedToMatch": true },
            { "id": "LINK TO GOOGLE DOC", "displayName": "LINK TO GOOGLE DOC", "required": false, "defaultMatch": false, "display": true, "type": "string", "canBeUsedToMatch": true, "removed": true },
            { "id": "LINK TO WORDPRESS BACKEND", "displayName": "LINK TO WORDPRESS BACKEND", "required": false, "defaultMatch": false, "display": true, "type": "string", "canBeUsedToMatch": true, "removed": true },
            { "id": "CONTENT", "displayName": "CONTENT", "required": false, "defaultMatch": false, "display": true, "type": "string", "canBeUsedToMatch": true, "removed": true }
          ],
          "attemptToConvertTypes": false,
          "convertFieldsToString": false
        },
        "options": {}
      },
      "type": "n8n-nodes-base.googleSheets",
      "typeVersion": 4.7,
      "position": [2112, 112],
      "id": "ea03f6ea-409d-4ee0-b05d-958a7cd0c57f",
      "name": "Write FAIL to Sheet",
      "credentials": { "googleSheetsOAuth2Api": { "id": "8UYwvprhMGHKF6ra", "name": "automation@spilledmilkagency.com" } }
    }
  ],
  "connections": {
    "Google Sheets Trigger": {
      "main": [[{ "node": "Filter: Manual Submissions Only", "type": "main", "index": 0 }]]
    },
    "Filter: Manual Submissions Only": {
      "main": [[{ "node": "Fetch Article Page", "type": "main", "index": 0 }]]
    },
    "Fetch Article Page": {
      "main": [[{ "node": "Extract Article Text + Page Title", "type": "main", "index": 0 }]]
    },
    "Extract Article Text + Page Title": {
      "main": [[{ "node": "Message a model", "type": "main", "index": 0 }]]
    },
    "Message a model": {
      "main": [[{ "node": "Parse AI Reponse", "type": "main", "index": 0 }]]
    },
    "Parse AI Reponse": {
      "main": [[{ "node": "Check Verdict", "type": "main", "index": 0 }]]
    },
    "Check Verdict": {
      "main": [
        [{ "node": "Write PASS to Sheet", "type": "main", "index": 0 }],
        [{ "node": "Write FAIL to Sheet", "type": "main", "index": 0 }]
      ]
    }
  }
};

// ============================================================
// FIX 1: Replace Google Sheets Trigger with Schedule Trigger
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
delete triggerNode.retryOnFail;
delete triggerNode.waitBetweenTries;

// ============================================================
// FIX 2: Add Read Sheet node between Schedule Trigger and Filter
// ============================================================
const readSheetNode = {
  id: 'f2a3b4c5-d6e7-8f90-ab12-cd34ef567890',
  name: 'Read Sheet',
  type: 'n8n-nodes-base.googleSheets',
  typeVersion: 4.7,
  position: [144, 0],
  credentials: {
    googleSheetsOAuth2Api: {
      id: '8UYwvprhMGHKF6ra',
      name: 'automation@spilledmilkagency.com'
    }
  },
  parameters: {
    operation: 'getAll',
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
    options: {}
  }
};
wf.nodes.push(readSheetNode);

// ============================================================
// FIX 3: Update connections
// Schedule Trigger → Read Sheet → Filter: Manual Submissions Only
// ============================================================
// Remove old trigger connection key, add new ones
delete wf.connections['Google Sheets Trigger'];

wf.connections['Schedule Trigger'] = {
  main: [[{ node: 'Read Sheet', type: 'main', index: 0 }]]
};

wf.connections['Read Sheet'] = {
  main: [[{ node: 'Filter: Manual Submissions Only', type: 'main', index: 0 }]]
};

// ============================================================
// VERIFY
// ============================================================
const t = wf.nodes.find(n => n.name === 'Schedule Trigger');
console.log('Trigger type:', t.type, '| typeVersion:', t.typeVersion);
console.log('Trigger params:', JSON.stringify(t.parameters));
const rs = wf.nodes.find(n => n.name === 'Read Sheet');
console.log('Read Sheet:', rs ? 'EXISTS' : 'MISSING', '| pos:', rs.position);
console.log('Schedule Trigger connections:', JSON.stringify(wf.connections['Schedule Trigger']));
console.log('Read Sheet connections:', JSON.stringify(wf.connections['Read Sheet']));
console.log('Old trigger connections still exist?', !!wf.connections['Google Sheets Trigger']);
console.log('Total nodes:', wf.nodes.length);

// Save payload (strip read-only fields)
const { id, createdAt, updatedAt, ...payload } = wf;
fs.writeFileSync(
  'C:/Users/owenq/OneDrive/Documents/N8N Automation/workflows/CMCA/P0_update_payload.json',
  JSON.stringify(payload, null, 2)
);
console.log('P0 payload saved successfully');
