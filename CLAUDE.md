# N8N Automation — Claude Code Expert Context

## My n8n Instance
- URL: https://designshopp.app.n8n.cloud
- MCP: n8n-mcp (czlonkowski) — 1,084 nodes available
- Platform: n8n Cloud (hosted)

## Mandatory Rules — Follow Every Session
1. Always run `search_nodes` BEFORE configuring any node — never guess node names
2. Always run `n8n_validate_workflow` BEFORE deploying any workflow
3. Always use `n8n_update_partial_workflow` for edits — never rewrite full workflows unless explicitly asked
4. Webhook data lives at `$json.body` — NOT `$json` directly
5. Always prefer native n8n nodes over HTTP Request when a dedicated integration node exists
6. Always activate workflows after creating unless explicitly told otherwise
7. Always add error handling on any node that touches an external API

## Active Client Projects

### CMCA (SEO Automation)
- Multi-phase workflow: P0, P2, P3-P4-P5
- Files: workflows/CMCA/
- Key files: build_update.js, p0_build_update.js, p2_build_update.js
- Payloads: P0_update_payload.json, P2_update_payload.json, P3-P4-P5_update_payload.json
- Status: Phase 1 complete (see SEO_Report_Automation_Phase1_Summary.md)
- Phase 2 brief: .claude/worktrees/epic-villani/SEO_Automation_Phase2_WorkBrief.md

### Tornatech
- Translation Phase 2 automated
- File: workflows/Tornatech/TORNATECH-Translation-Phase2-Automated.json

## Workflow File Conventions
- `_nodes.json` — node definitions
- `_connections.json` — connection maps
- `*_build_update.js` — build scripts
- `*_update_payload.json` — API update payloads
- `_p0_*`, `_p2_*` — phase-specific files

## Code Preferences
- JavaScript in Code nodes (not Python unless specifically requested)
- Always use try/catch on external API calls
- Use `$input.all()` for multi-item processing
- Use `$input.first()` for single-item processing

## n8n Expression Quick Reference
- Current item data: `{{ $json.fieldName }}`
- Webhook body data: `{{ $json.body.fieldName }}`
- Previous node data: `{{ $node["NodeName"].json.fieldName }}`
- Current timestamp: `{{ $now }}`
- Environment variable: `{{ $env.VAR_NAME }}`
- All items from node: `{{ $items("NodeName") }}`

## MCP Tools Priority Order
1. `search_nodes` — find correct node before anything else
2. `get_node` — get full node schema and properties
3. `n8n_validate_workflow` — validate before every deploy
4. `n8n_update_partial_workflow` — preferred update method
5. `n8n_create_workflow` — only for new workflows

### CUAL
- Error notification handler active: foILvSy2LhUGBqkQ
- Status: Active client, error handler running
