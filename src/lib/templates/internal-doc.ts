/**
 * Template 2: Internal Automation Doc
 * Generates a Notion-inspired internal reference document.
 * Light, high-density, collapsible sections — optimized for scanning.
 * JavaScript is interaction-only (accordion/collapse toggles).
 */

import type {
  InternalDocData,
  WorkflowStep,
  TechEntry,
  PhaseStatus,
  NoteEntry,
  PhaseStatusValue,
  WorkflowStepType,
} from './types';

function esc(val: string | number | undefined | null): string {
  if (val === undefined || val === null) return '';
  return String(val)
    .replace(/--+/g, '\u2013')   // collapse double-hyphens to en-dash
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Strip markdown bold/italic markers that AI sometimes injects into plain-text fields. */
function stripMd(val: string | undefined | null): string {
  if (!val) return '';
  return val.replace(/\*\*/g, '').replace(/\*/g, '');
}

// ─── Interaction JS ───────────────────────────────────────────────────────────

const INTERACTION_JS = `
function initWorkflowToggles() {
  var isEditMode = document.body.getAttribute('data-edit-mode') === 'true';
  var headers = document.querySelectorAll('.id-wf-header');
  headers.forEach(function(header) {
    var body = header.nextElementSibling;
    if (!body) return;
    // In the editor all steps must be visible — open all, skip collapse
    if (isEditMode) {
      header.setAttribute('aria-expanded', 'true');
      body.style.height = 'auto';
      return;
    }
    body.style.overflow = 'hidden';
    body.style.transition = 'height 0.22s ease';
    body.style.height = '0';
    header.setAttribute('aria-expanded', 'false');
    header.addEventListener('click', function() {
      var isOpen = header.getAttribute('aria-expanded') === 'true';
      if (isOpen) {
        header.setAttribute('aria-expanded', 'false');
        body.style.height = '0';
      } else {
        header.setAttribute('aria-expanded', 'true');
        body.style.height = body.scrollHeight + 'px';
      }
    });
  });
}

function initNoteToggles() {
  if (document.body.getAttribute('data-edit-mode') === 'true') return;
  var items = document.querySelectorAll('.id-note-item');
  items.forEach(function(item) {
    var text = item.querySelector('.id-note-text');
    if (!text) return;
    var isLong = text.scrollHeight > 60;
    if (!isLong) return;
    text.style.maxHeight = '48px';
    text.style.overflow = 'hidden';
    var toggle = document.createElement('button');
    toggle.textContent = 'Read more';
    toggle.className = 'id-note-toggle';
    item.appendChild(toggle);
    toggle.addEventListener('click', function() {
      if (text.style.maxHeight === 'none') {
        text.style.maxHeight = '48px';
        toggle.textContent = 'Read more';
      } else {
        text.style.maxHeight = 'none';
        toggle.textContent = 'Show less';
      }
    });
  });
}

initWorkflowToggles();
initNoteToggles();
`;

// ─── CSS ──────────────────────────────────────────────────────────────────────

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

/* Edit-mode override */
body[data-edit-mode] * {
  opacity: 1 !important;
  animation: none !important;
  transition: none !important;
}

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
body {
  font-family: 'Inter', system-ui, sans-serif;
  background: #f8f9fa;
  color: #1a1a2e;
  font-size: 14px;
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
}
h1,h2,h3,h4,h5,h6 { line-height: 1.25; }
ul { list-style: none; }
a { color: inherit; text-decoration: none; }

:root {
  --purple: #6c3fff;
  --green: #16a34a;
  --amber: #d97706;
  --red: #dc2626;
  --gray: #6b7280;
  --border: #e5e7eb;
  --bg: #f8f9fa;
  --white: #ffffff;
  --text: #1a1a2e;
  --muted: #6b7280;
  --subtle: #9ca3af;
}

.id-page { max-width: 860px; margin: 0 auto; padding: 32px 24px 80px; }
.id-section { background: var(--white); border: 1px solid var(--border); border-radius: 10px; margin-bottom: 16px; overflow: hidden; }
.id-section-title {
  font-size: 11px; font-weight: 700;
  letter-spacing: 0.1em; text-transform: uppercase;
  color: var(--subtle); padding: 16px 20px 0;
}

/* ── Header ────────────────────────────────────────────────────────────────── */
.id-header { padding: 28px 20px 20px; }
.id-header-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
.id-project-name { font-size: 1.4rem; font-weight: 700; color: var(--text); line-height: 1.2; }
.id-project-client { font-size: 0.9rem; color: var(--muted); margin-top: 2px; }
.id-status-badge {
  font-size: 0.7rem; font-weight: 600;
  letter-spacing: 0.06em; text-transform: uppercase;
  padding: 4px 12px; border-radius: 99px;
  flex-shrink: 0; white-space: nowrap;
}
.id-status-draft { background: #f3f4f6; color: var(--gray); }
.id-status-in-progress { background: #fef3c7; color: var(--amber); }
.id-status-complete { background: #dcfce7; color: var(--green); }
.id-header-meta {
  display: flex; flex-wrap: wrap; gap: 16px;
  padding-top: 12px; border-top: 1px solid var(--border);
}
.id-meta-item { display: flex; flex-direction: column; gap: 2px; }
.id-meta-label { font-size: 0.65rem; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: var(--subtle); }
.id-meta-value { font-size: 0.85rem; font-weight: 500; color: var(--text); }

/* ── Goal ──────────────────────────────────────────────────────────────────── */
.id-goal { padding: 16px 20px 20px; }
.id-goal-summary { font-size: 1rem; font-weight: 600; color: var(--text); margin-bottom: 12px; }
.id-goal-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
@media (max-width: 560px) { .id-goal-grid { grid-template-columns: 1fr; } }
.id-goal-block-label { font-size: 0.68rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--subtle); margin-bottom: 4px; }
.id-goal-block-text { font-size: 0.85rem; color: var(--muted); line-height: 1.6; }

/* ── Workflow ──────────────────────────────────────────────────────────────── */
.id-workflow { padding: 16px 20px 20px; }
.id-wf-item { border: 1px solid var(--border); border-radius: 8px; margin-bottom: 8px; overflow: hidden; }
.id-wf-header {
  display: flex; align-items: center; gap: 10px;
  padding: 12px 14px; cursor: pointer;
  user-select: none; transition: background 0.15s;
}
.id-wf-header:hover { background: #f9fafb; }
.id-wf-header:focus-visible { outline: 2px solid var(--purple); outline-offset: -2px; border-radius: 8px; }
.id-wf-num {
  width: 24px; height: 24px; border-radius: 50%;
  background: var(--purple); color: #fff;
  font-size: 0.7rem; font-weight: 700;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.id-wf-title { font-size: 0.9rem; font-weight: 600; color: var(--text); flex: 1; }
.id-wf-type-badge {
  font-size: 0.65rem; font-weight: 600;
  padding: 3px 8px; border-radius: 99px;
  white-space: nowrap;
}
.id-type-automation { background: #ede9fe; color: #5b21b6; }
.id-type-ai { background: #dbeafe; color: #1d4ed8; }
.id-type-human { background: #d1fae5; color: #065f46; }
.id-type-automation-ai { background: #fce7f3; color: #9d174d; }
.id-wf-chevron { width: 14px; height: 14px; color: var(--subtle); transition: transform 0.2s; flex-shrink: 0; }
.id-wf-header[aria-expanded="true"] .id-wf-chevron { transform: rotate(180deg); }
.id-wf-body { padding: 0 14px; }
.id-wf-body-inner { padding: 4px 0 14px; }
.id-wf-desc { font-size: 0.85rem; color: var(--muted); margin-bottom: 10px; line-height: 1.55; }
.id-wf-details { display: flex; flex-direction: column; gap: 4px; }
.id-wf-detail {
  display: flex; align-items: flex-start; gap: 8px;
  font-size: 0.8rem; color: var(--muted); line-height: 1.45;
}
.id-wf-detail::before { content: '·'; color: var(--purple); flex-shrink: 0; font-weight: 700; }

/* ── Tech Stack ────────────────────────────────────────────────────────────── */
.id-tech { padding: 16px 20px 20px; }
.id-tech-table { width: 100%; border-collapse: collapse; }
.id-tech-table th {
  text-align: left; padding: 8px 12px;
  font-size: 0.68rem; font-weight: 700;
  letter-spacing: 0.08em; text-transform: uppercase;
  color: var(--subtle);
  border-bottom: 2px solid var(--border);
}
.id-tech-table td {
  padding: 10px 12px; font-size: 0.85rem;
  border-bottom: 1px solid #f3f4f6;
  vertical-align: top;
}
.id-tech-table tr:last-child td { border-bottom: none; }
.id-tech-tool { font-weight: 600; color: var(--text); }
.id-tech-purpose { color: var(--muted); }
.id-tech-notes { color: var(--subtle); font-size: 0.78rem; }

/* ── Phase Status ──────────────────────────────────────────────────────────── */
.id-status { padding: 16px 20px 20px; }
.id-status-list { display: flex; flex-direction: column; gap: 8px; }
.id-status-row {
  display: flex; align-items: center; gap: 12px;
  padding: 10px 14px; border: 1px solid var(--border);
  border-radius: 8px; background: #fff;
}
.id-status-phase-name { font-size: 0.88rem; font-weight: 600; color: var(--text); flex: 1; }
.id-status-pill {
  font-size: 0.65rem; font-weight: 700;
  letter-spacing: 0.06em; text-transform: uppercase;
  padding: 3px 10px; border-radius: 99px;
  flex-shrink: 0;
}
.id-pill-done { background: #dcfce7; color: #16a34a; }
.id-pill-in-progress { background: #fef3c7; color: #d97706; }
.id-pill-pending { background: #f3f4f6; color: #6b7280; }
.id-pill-blocked { background: #fee2e2; color: #dc2626; }
.id-status-date { font-size: 0.75rem; color: var(--subtle); flex-shrink: 0; }
.id-status-notes { font-size: 0.75rem; color: var(--muted); }

/* ── Notes ─────────────────────────────────────────────────────────────────── */
.id-notes { padding: 16px 20px 20px; }
.id-notes-list { display: flex; flex-direction: column; gap: 12px; }
.id-note-item { border-left: 3px solid var(--purple); padding-left: 14px; }
.id-note-meta { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
.id-note-date { font-size: 0.72rem; color: var(--subtle); }
.id-note-author { font-size: 0.72rem; font-weight: 600; color: var(--muted); }
.id-note-text { font-size: 0.85rem; color: var(--muted); line-height: 1.55; transition: max-height 0.2s ease; }
.id-note-toggle {
  font-size: 0.72rem; color: var(--purple);
  background: none; border: none; cursor: pointer;
  padding: 4px 0; display: block; margin-top: 6px;
}

/* ── Tech table column widths ───────────────────────────────────────────────── */
.id-tech-table th:nth-child(1) { width: 28%; min-width: 70px; }
.id-tech-table th:nth-child(2) { width: 47%; min-width: 100px; }
.id-tech-table th:nth-child(3) { width: 25%; min-width: 70px; }

/* ── Mobile overrides (<= 560px) ────────────────────────────────────────────── */
@media (max-width: 560px) {
  .id-page { padding: 20px 16px 60px; }
  .id-section { margin-bottom: 12px; }

  /* Tech table: shrink text, reduce padding, hide Notes column on small screens */
  .id-tech-table { font-size: 0.78rem; }
  .id-tech-table th, .id-tech-table td { padding: 8px 8px; }
  .id-tech-table th:nth-child(3),
  .id-tech-table td:nth-child(3) { display: none; }

  /* Phase status: wrap onto two lines */
  .id-status-row { flex-wrap: wrap; align-items: flex-start; gap: 6px 8px; }
  .id-status-phase-name { flex-basis: 100%; margin-bottom: 2px; }
  .id-status-notes { flex-basis: 100%; margin-top: 2px; }

  /* Workflow header: tighter */
  .id-wf-header { padding: 10px 10px; gap: 6px; }
  .id-wf-type-badge { font-size: 0.6rem; padding: 2px 6px; }

  /* Goal / notes */
  .id-goal { padding: 12px 16px 16px; }
  .id-notes { padding: 12px 16px 16px; }
  .id-workflow { padding: 12px 16px 16px; }
  .id-tech { padding: 12px 16px 16px; }
  .id-status { padding: 12px 16px 16px; }
}
`;

// ─── Section builders ─────────────────────────────────────────────────────────

const STATUS_CLASS_MAP: Record<string, string> = {
  'Draft': 'id-status-draft',
  'In Progress': 'id-status-in-progress',
  'Complete': 'id-status-complete',
};

const TYPE_CLASS_MAP: Record<WorkflowStepType, string> = {
  'Automation': 'id-type-automation',
  'AI': 'id-type-ai',
  'Human': 'id-type-human',
  'Automation & AI': 'id-type-automation-ai',
};

const PILL_CLASS_MAP: Record<PhaseStatusValue, string> = {
  'Done': 'id-pill-done',
  'In Progress': 'id-pill-in-progress',
  'Pending': 'id-pill-pending',
  'Blocked': 'id-pill-blocked',
};

function buildHeader(data: InternalDocData): string {
  const statusClass = STATUS_CLASS_MAP[data.project.status] || 'id-status-draft';
  return `<section id="project-header" class="id-section">
  <div class="id-header">
    <div class="id-header-top">
      <div>
        <div class="id-project-name">${esc(data.project.name)}</div>
        <div class="id-project-client">${esc(data.project.client)}</div>
      </div>
      <span class="id-status-badge ${statusClass}" title="Project phase">${esc(data.project.status)}</span>
    </div>
    <div class="id-header-meta">
      <div class="id-meta-item">
        <span class="id-meta-label">Current Phase</span>
        <span class="id-meta-value">${esc(data.project.phase)}</span>
      </div>
      <div class="id-meta-item">
        <span class="id-meta-label">Owner</span>
        <span class="id-meta-value">${esc(data.project.owner)}</span>
      </div>
      <div class="id-meta-item">
        <span class="id-meta-label">Date</span>
        <span class="id-meta-value">${esc(data.project.date)}</span>
      </div>
    </div>
  </div>
</section>`;
}

function buildGoal(data: InternalDocData): string {
  return `<section id="goal-overview" class="id-section">
  <div class="id-section-title">Goal &amp; Overview</div>
  <div class="id-goal">
    <div class="id-goal-summary">${esc(stripMd(data.goal.summary))}</div>
    <div class="id-goal-grid">
      <div>
        <div class="id-goal-block-label">Problem</div>
        <div class="id-goal-block-text">${esc(data.goal.problem)}</div>
      </div>
      <div>
        <div class="id-goal-block-label">Desired Outcome</div>
        <div class="id-goal-block-text">${esc(data.goal.outcome)}</div>
      </div>
    </div>
  </div>
</section>`;
}

function buildWorkflow(data: InternalDocData): string {
  if (!data.workflow?.length) return '';
  const stepsHTML = data.workflow.map((step: WorkflowStep) => {
    const typeClass = TYPE_CLASS_MAP[step.type] || 'id-type-automation';
    const detailsHTML = (step.details || [])
      .map((d) => `<div class="id-wf-detail">${esc(d)}</div>`)
      .join('');
    return `<div class="id-wf-item">
      <div class="id-wf-header" aria-expanded="false">
        <div class="id-wf-num">${step.number}</div>
        <div class="id-wf-title">${esc(step.title)}</div>
        <span class="id-wf-type-badge ${typeClass}">${esc(step.type)}</span>
        <svg class="id-wf-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" d="m6 9 6 6 6-6"/>
        </svg>
      </div>
      <div class="id-wf-body">
        <div class="id-wf-body-inner">
          <p class="id-wf-desc">${esc(step.desc)}</p>
          ${detailsHTML ? `<div class="id-wf-details">${detailsHTML}</div>` : ''}
        </div>
      </div>
    </div>`;
  }).join('');

  return `<section id="workflow-steps" class="id-section">
  <div class="id-section-title">Workflow Steps</div>
  <div class="id-workflow">${stepsHTML}</div>
</section>`;
}

function buildTechStack(data: InternalDocData): string {
  if (!data.tech?.length) return '';
  const rowsHTML = data.tech.map((t: TechEntry) => `
    <tr>
      <td class="id-tech-tool">${esc(t.tool)}</td>
      <td class="id-tech-purpose">${esc(t.purpose)}</td>
      <td class="id-tech-notes">${t.notes ? esc(t.notes) : '—'}</td>
    </tr>`).join('');

  return `<section id="tech-stack" class="id-section">
  <div class="id-section-title">Tech Stack</div>
  <div class="id-tech">
    <table class="id-tech-table">
      <thead>
        <tr>
          <th>Tool</th>
          <th>Purpose</th>
          <th>Notes</th>
        </tr>
      </thead>
      <tbody>${rowsHTML}</tbody>
    </table>
  </div>
</section>`;
}

function buildPhaseStatus(data: InternalDocData): string {
  if (!data.status?.phases?.length) return '';
  const rowsHTML = data.status.phases.map((p: PhaseStatus) => {
    const pillClass = PILL_CLASS_MAP[p.status] || 'id-pill-pending';
    return `<div class="id-status-row">
      <div class="id-status-phase-name">${esc(p.name)}</div>
      <span class="id-status-pill ${pillClass}">${esc(p.status)}</span>
      <div class="id-status-date">${esc(p.dueDate)}</div>
      ${p.notes ? `<div class="id-status-notes">${esc(p.notes)}</div>` : ''}
    </div>`;
  }).join('');

  return `<section id="phase-status" class="id-section">
  <div class="id-section-title">Phase Status</div>
  <div class="id-status">
    <div class="id-status-list">${rowsHTML}</div>
  </div>
</section>`;
}

function buildNotes(data: InternalDocData): string {
  if (!data.notes?.length) return '';
  const notesHTML = data.notes.map((n: NoteEntry) => `
    <div class="id-note-item">
      <div class="id-note-meta">
        <span class="id-note-date">${esc(n.date)}</span>
        <span class="id-note-author">· ${esc(n.author)}</span>
      </div>
      <div class="id-note-text">${esc(n.note)}</div>
    </div>`).join('');

  return `<section id="notes-decisions" class="id-section">
  <div class="id-section-title">Notes &amp; Decisions</div>
  <div class="id-notes">
    <div class="id-notes-list">${notesHTML}</div>
  </div>
</section>`;
}

// ─── Main assembler ───────────────────────────────────────────────────────────

export function buildInternalDocHTML(data: InternalDocData): string {
  const title = `${data.project.name} — Internal Doc`;
  const body = [
    buildHeader(data),
    buildGoal(data),
    buildWorkflow(data),
    buildTechStack(data),
    buildPhaseStatus(data),
    buildNotes(data),
  ].filter(Boolean).join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(title)}</title>
  <style>${CSS}</style>
</head>
<body>
<div class="id-page">
${body}
</div>
<script>
${INTERACTION_JS}
</script>
</body>
</html>`;
}
