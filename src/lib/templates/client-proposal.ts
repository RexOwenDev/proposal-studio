/**
 * Template 1: Client Proposal
 * Generates static HTML for a Spilled Milk / Design Shopp client-facing proposal.
 * JavaScript in output is interaction-only (accordion, count-up, scroll animations).
 * All section content is rendered server-side from structured AI data.
 */

import type {
  ClientProposalData,
  FlowStep,
  FlowBranch,
  PhaseData,
  TimelinePhase,
} from './types';

// ─── HTML escape helper ───────────────────────────────────────────────────────

function esc(val: string | number | undefined | null): string {
  if (val === undefined || val === null) return '';
  return String(val)
    .replace(/--+/g, '\u2013')   // collapse double-hyphens to en-dash
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Sanitize href values — only allow safe URL schemes to prevent javascript: XSS */
function safeHref(val: string | undefined | null): string {
  if (!val) return '#';
  const trimmed = val.trim();
  if (/^(https?:|mailto:|#)/i.test(trimmed)) return trimmed;
  return '#';
}

// ─── Interaction-only JavaScript (no content rendering) ───────────────────────
// All functions use `function foo()` declaration syntax so wrapScripts() hoists
// them to global scope. The bare calls at the bottom are deferred to DOMContentLoaded.

const INTERACTION_JS = `
// Count-up animation for hero stats
function initCountUp() {
  var els = document.querySelectorAll('[data-count]');
  if (!els.length) return;
  var observer = new IntersectionObserver(function(entries) {
    entries.forEach(function(entry) {
      if (!entry.isIntersecting) return;
      var el = entry.target;
      observer.unobserve(el);
      var raw = el.getAttribute('data-count') || '0';
      var digits = raw.replace(/[^0-9.]/g, '');
      var suffix = raw.replace(/[0-9.]/g, '');
      var target = parseFloat(digits) || 0;
      if (!digits) { el.textContent = raw; return; }
      var start = null;
      var duration = 1400;
      function step(ts) {
        if (!start) start = ts;
        var p = Math.min((ts - start) / duration, 1);
        var ease = 1 - Math.pow(1 - p, 3);
        var cur = target * ease;
        el.textContent = (Number.isInteger(target) ? Math.round(cur) : cur.toFixed(1)) + suffix;
        if (p < 1) requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    });
  }, { threshold: 0.5 });
  els.forEach(function(el) { observer.observe(el); });
}

// Scroll-reveal animations
function initReveal() {
  var els = document.querySelectorAll('.ps-reveal');
  if (!els.length) return;
  if (!window.IntersectionObserver) {
    els.forEach(function(el) { el.classList.add('ps-visible'); });
    return;
  }
  var observer = new IntersectionObserver(function(entries) {
    entries.forEach(function(entry, i) {
      if (!entry.isIntersecting) return;
      var el = entry.target;
      var delay = parseInt(el.getAttribute('data-delay') || '0', 10);
      setTimeout(function() { el.classList.add('ps-visible'); }, delay);
      observer.unobserve(el);
    });
  }, { threshold: 0.12 });
  els.forEach(function(el) { observer.observe(el); });
}

// Phase accordion
function initAccordions() {
  var isEditMode = document.body.getAttribute('data-edit-mode') === 'true';
  var headers = document.querySelectorAll('.ps-phase-header');
  headers.forEach(function(header, idx) {
    var body = header.nextElementSibling;
    if (!body) return;
    // In the editor all phases must be fully visible — skip JS collapse
    if (isEditMode) {
      header.setAttribute('aria-expanded', 'true');
      body.style.height = 'auto';
      return;
    }
    body.style.overflow = 'hidden';
    body.style.transition = 'height 0.28s ease';
    if (idx === 0) {
      body.style.height = body.scrollHeight + 'px';
      header.setAttribute('aria-expanded', 'true');
    } else {
      body.style.height = '0';
      header.setAttribute('aria-expanded', 'false');
    }
    header.addEventListener('click', function() {
      var isOpen = header.getAttribute('aria-expanded') === 'true';
      document.querySelectorAll('.ps-phase-header').forEach(function(h) {
        h.setAttribute('aria-expanded', 'false');
        var b = h.nextElementSibling;
        if (b) b.style.height = '0';
      });
      if (!isOpen) {
        header.setAttribute('aria-expanded', 'true');
        body.style.height = body.scrollHeight + 'px';
      }
    });
  });
}

// Capability card hover — reveal outcome text
function initCapabilityCards() {
  if (document.body.getAttribute('data-edit-mode') === 'true') return;
  var cards = document.querySelectorAll('.ps-cap-card');
  cards.forEach(function(card) {
    var front = card.querySelector('.ps-cap-front');
    var outcome = card.querySelector('.ps-cap-outcome');
    if (!front || !outcome) return;
    // Desktop hover
    card.addEventListener('mouseenter', function() {
      front.style.opacity = '0';
      front.style.transform = 'translateY(-6px)';
      outcome.style.opacity = '1';
      outcome.style.transform = 'translateY(0)';
    });
    card.addEventListener('mouseleave', function() {
      front.style.opacity = '1';
      front.style.transform = 'translateY(0)';
      outcome.style.opacity = '0';
      outcome.style.transform = 'translateY(6px)';
    });
    // Touch device: tap to toggle outcome (hover: hover does not match touch-only)
    card.addEventListener('click', function() {
      if (window.matchMedia('(hover: hover)').matches) return;
      var isFlipped = card.getAttribute('data-flipped') === 'true';
      card.setAttribute('data-flipped', isFlipped ? 'false' : 'true');
      front.style.opacity = isFlipped ? '1' : '0';
      front.style.transform = isFlipped ? 'translateY(0)' : 'translateY(-6px)';
      outcome.style.opacity = isFlipped ? '0' : '1';
      outcome.style.transform = isFlipped ? 'translateY(6px)' : 'translateY(0)';
    });
  });
}

// Flow step expand on click
function initFlowSteps() {
  if (document.body.getAttribute('data-edit-mode') === 'true') return;
  var steps = document.querySelectorAll('.ps-flow-step');
  steps.forEach(function(step) {
    var tooltip = step.querySelector('.ps-step-desc');
    if (!tooltip) return;
    step.addEventListener('click', function() {
      var isOpen = step.getAttribute('data-open') === 'true';
      document.querySelectorAll('.ps-flow-step').forEach(function(s) {
        s.setAttribute('data-open', 'false');
        s.setAttribute('aria-expanded', 'false');
        var t = s.querySelector('.ps-step-desc');
        if (t) t.style.maxHeight = '0';
      });
      if (!isOpen) {
        step.setAttribute('data-open', 'true');
        step.setAttribute('aria-expanded', 'true');
        tooltip.style.maxHeight = tooltip.scrollHeight + 'px';
      }
    });
  });
}

// Timeline hover tooltips
function initTimeline() {
  var blocks = document.querySelectorAll('.ps-tl-block[data-tip]');
  blocks.forEach(function(block) {
    var tip = block.querySelector('.ps-tl-tip');
    if (!tip) return;
    block.addEventListener('mouseenter', function() { tip.style.opacity = '1'; tip.style.visibility = 'visible'; });
    block.addEventListener('mouseleave', function() { tip.style.opacity = '0'; tip.style.visibility = 'hidden'; });
  });
}

initCountUp();
initReveal();
initAccordions();
initCapabilityCards();
initFlowSteps();
initTimeline();
`;

// ─── CSS ──────────────────────────────────────────────────────────────────────

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=Inter:wght@400;500;600;700&display=swap');

/* Edit-mode override — forces all content visible in Proposal Studio editor */
body[data-edit-mode] * {
  opacity: 1 !important;
  animation: none !important;
  transition: none !important;
}
/* Capability card outcome panels are hover-only reveals — keep them hidden in
   the editor so the front (editable) face stays visible, not the outcome overlay. */
body[data-edit-mode] .ps-cap-outcome {
  opacity: 0 !important;
  transform: translateY(6px) !important;
}

/* ── Reset & base ──────────────────────────────────────────────────────────── */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html { scroll-behavior: smooth; }
body { font-family: 'Inter', system-ui, sans-serif; background: #fafafa; color: #09090b; -webkit-font-smoothing: antialiased; }
h1,h2,h3,h4,h5,h6 { line-height: 1.15; }
p { line-height: 1.7; }
ul { list-style: none; }
a { color: inherit; text-decoration: none; }
img { max-width: 100%; display: block; }

/* ── CSS custom properties ─────────────────────────────────────────────────── */
:root {
  --purple: #6c3fff;
  --blue: #3b82f6;
  --teal: #14b8a6;
  --dark: #09090b;
  --dark-2: #18181b;
  --border-dark: #27272a;
  --border-light: #e4e4e7;
  --light: #fafafa;
  --off-white: #f4f4f5;
  --text: #09090b;
  --muted: #52525b;
  --subtle: #a1a1aa;
}

/* ── Scroll reveal animations ──────────────────────────────────────────────── */
.ps-reveal {
  opacity: 0;
  transform: translateY(18px);
  transition: opacity 0.55s ease, transform 0.55s ease;
}
.ps-reveal.ps-visible {
  opacity: 1;
  transform: translateY(0);
}

/* ── Utility ───────────────────────────────────────────────────────────────── */
.ps-overline {
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  opacity: 0.6;
  margin-bottom: 0.75rem;
}
.ps-section-title {
  font-family: 'Playfair Display', Georgia, serif;
  font-size: clamp(1.6rem, 3vw, 2.5rem);
  font-weight: 700;
  color: var(--text);
  margin-bottom: 0.5rem;
}
.ps-section-overview {
  color: var(--muted);
  font-size: 1.05rem;
  max-width: 640px;
  margin-bottom: 2.5rem;
}

/* ── Shared section padding ────────────────────────────────────────────────── */
.ps-hero,
.ps-solution,
.ps-flow,
.ps-phases,
.ps-timeline,
.ps-investment,
.ps-next-steps,
.ps-footer {
  padding: 56px 20px;
}
@media (min-width: 640px) {
  .ps-hero,
  .ps-solution,
  .ps-flow,
  .ps-phases,
  .ps-timeline,
  .ps-investment,
  .ps-next-steps,
  .ps-footer {
    padding: 72px 36px;
  }
}
@media (min-width: 960px) {
  .ps-hero,
  .ps-solution,
  .ps-flow,
  .ps-phases,
  .ps-timeline,
  .ps-investment,
  .ps-next-steps,
  .ps-footer {
    padding: 80px 48px;
  }
}
.ps-inner {
  max-width: 760px;
  margin: 0 auto;
}

/* ── Hero ──────────────────────────────────────────────────────────────────── */
.ps-hero {
  background: #fff;
  color: var(--text);
  border-bottom: 1px solid var(--border-light);
  display: flex;
  flex-direction: column;
  position: relative;
}
.ps-hero-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 32px;
}
.ps-logo-wordmark {
  font-family: 'Playfair Display', Georgia, serif;
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--text);
  letter-spacing: -0.01em;
}
.ps-logo-sub {
  font-size: 0.65rem;
  font-weight: 500;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--purple);
  margin-top: 2px;
}
.ps-client-tag {
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--muted);
  border: 1px solid var(--border-light);
  padding: 6px 14px;
  border-radius: 99px;
}
.ps-hero-body { flex: 1; display: flex; flex-direction: column; justify-content: center; padding-top: 8px; }
.ps-hero .ps-overline { color: var(--purple); opacity: 1; }
.ps-hero-headline {
  font-family: 'Playfair Display', Georgia, serif;
  font-size: clamp(1.85rem, 4vw, 3rem);
  font-weight: 900;
  line-height: 1.1;
  color: var(--text);
  max-width: 680px;
  margin-bottom: 1.25rem;
}
.ps-hero-subtext {
  font-size: 1rem;
  color: var(--muted);
  max-width: 540px;
  line-height: 1.65;
  margin-bottom: 2.5rem;
}
.ps-stats-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0;
  margin-top: auto;
  padding-top: 2rem;
  border-top: 1px solid var(--border-light);
}
.ps-stat {
  display: flex;
  align-items: baseline;
  gap: 10px;
  flex-direction: row;
  flex-wrap: wrap;
  row-gap: 4px;
  min-width: 0;
  padding-right: 24px;
}
.ps-stat-val {
  font-family: 'Playfair Display', Georgia, serif;
  font-size: 2rem;
  font-weight: 700;
  line-height: 1;
}
.ps-stat-before { color: var(--subtle); }
.ps-stat-arrow { color: var(--purple); font-size: 1.25rem; font-weight: 400; align-self: center; }
.ps-stat-after { color: var(--text); }
.ps-stat-label {
  width: 100%;
  font-size: 0.75rem;
  color: var(--subtle);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin-top: 2px;
}
@media (max-width: 540px) {
  /* Single column — each stat full-width, values stay on one line, label below */
  .ps-stats-row { grid-template-columns: 1fr; gap: 14px 0; padding-top: 1.25rem; }
  .ps-stat { padding-right: 0; align-items: baseline; }
  .ps-stat-val { font-size: 1.6rem; }
  .ps-stat-label { font-size: 0.7rem; }
}

/* ── Solution ──────────────────────────────────────────────────────────────── */
.ps-solution { background: var(--light); }
.ps-cap-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}
@media (max-width: 540px) {
  .ps-cap-grid { grid-template-columns: 1fr; }
}
.ps-cap-card {
  background: #fff;
  border: 1px solid var(--border-light);
  border-radius: 12px;
  padding: 24px;
  cursor: default;
  position: relative;
  min-height: 160px;
  overflow: hidden;
  box-shadow: 0 1px 4px rgba(0,0,0,0.04);
  transition: box-shadow 0.2s, border-color 0.2s;
}
.ps-cap-card:hover {
  box-shadow: 0 4px 24px rgba(108,63,255,0.1);
  border-color: rgba(108,63,255,0.3);
}
.ps-cap-front, .ps-cap-outcome {
  transition: opacity 0.22s ease, transform 0.22s ease;
}
.ps-cap-icon { font-size: 1.75rem; margin-bottom: 10px; line-height: 1; }
.ps-cap-title { font-size: 0.95rem; font-weight: 600; color: var(--text); margin-bottom: 6px; }
.ps-cap-detail { font-size: 0.85rem; color: var(--muted); line-height: 1.55; }
.ps-cap-outcome {
  position: absolute;
  inset: 0;
  padding: 20px;
  background: linear-gradient(135deg, var(--purple), #3b0fc4);
  color: #fff;
  display: flex;
  flex-direction: column;
  justify-content: center;
  opacity: 0;
  transform: translateY(6px);
  border-radius: 12px;
}
.ps-cap-outcome-label {
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  opacity: 0.7;
  margin-bottom: 8px;
}
.ps-cap-outcome-text { font-size: 0.9rem; line-height: 1.55; }

/* ── Flow / Pipeline ───────────────────────────────────────────────────────── */
.ps-flow { background: var(--off-white); }
.ps-flow-pipeline {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 0;
  margin-bottom: 2rem;
}
@media (max-width: 540px) {
  .ps-flow-pipeline {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }
  .ps-flow-connector { display: none; }
  .ps-flow-step {
    flex-direction: row !important;
    align-items: flex-start !important;
    text-align: left !important;
    width: 100%;
    flex: none !important;
    gap: 12px;
    padding: 0 !important;
  }
  .ps-step-node { margin-bottom: 0 !important; flex-shrink: 0; }
  .ps-step-title, .ps-step-time { text-align: left; }
  .ps-step-desc { margin-top: 4px; }
}
.ps-flow-step {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  cursor: pointer;
  flex: 1;
  min-width: 100px;
  position: relative;
  padding: 0 8px;
}
.ps-step-node {
  width: 52px;
  height: 52px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.3rem;
  position: relative;
  z-index: 1;
  margin-bottom: 10px;
  transition: transform 0.2s;
}
.ps-flow-step:hover .ps-step-node { transform: scale(1.08); }
.ps-step-auto .ps-step-node { background: var(--purple); box-shadow: 0 0 0 4px rgba(108,63,255,0.15); }
.ps-step-human .ps-step-node { background: var(--teal); box-shadow: 0 0 0 4px rgba(20,184,166,0.15); }
.ps-step-title { font-size: 0.8rem; font-weight: 600; color: var(--text); margin-bottom: 3px; }
.ps-step-time { font-size: 0.7rem; color: var(--subtle); }
.ps-step-desc {
  max-height: 0;
  overflow: hidden;
  transition: max-height 0.28s ease;
  background: #fff;
  border: 1px solid var(--border-light);
  border-radius: 8px;
  font-size: 0.78rem;
  color: var(--muted);
  text-align: left;
  padding: 0 12px;
  margin-top: 8px;
  width: 100%;
  position: relative;
  z-index: 2;
  line-height: 1.5;
}
.ps-flow-step[data-open="true"] .ps-step-desc { padding: 10px 12px; }
.ps-flow-connector {
  flex: 0 0 auto;
  width: 32px;
  height: 2px;
  background: var(--border-light);
  margin-top: 26px;
  position: relative;
}
.ps-flow-connector::after {
  content: '';
  position: absolute;
  right: -4px;
  top: -4px;
  width: 0;
  height: 0;
  border-style: solid;
  border-width: 5px 0 5px 7px;
  border-color: transparent transparent transparent var(--border-light);
}
.ps-flow-gate {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: #fff;
  border: 2px solid var(--purple);
  color: var(--purple);
  font-size: 0.8rem;
  font-weight: 600;
  padding: 8px 20px;
  border-radius: 99px;
  margin: 24px auto;
  width: fit-content;
}
.ps-flow-branches {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-top: 8px;
}
@media (max-width: 540px) {
  .ps-flow-branches { grid-template-columns: 1fr; }
}
.ps-branch {
  border: 1px solid var(--border-light);
  background: #fff;
  border-radius: 10px;
  padding: 20px;
}
.ps-branch-label {
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  margin-bottom: 8px;
}
.ps-branch-yes .ps-branch-label { color: var(--teal); }
.ps-branch-no .ps-branch-label { color: var(--subtle); }
.ps-branch-title { font-size: 0.9rem; font-weight: 600; color: var(--text); margin-bottom: 4px; }
.ps-branch-desc { font-size: 0.8rem; color: var(--muted); margin-bottom: 8px; line-height: 1.5; }
.ps-branch-stat { font-size: 0.75rem; font-weight: 600; color: var(--purple); }

/* ── Phases Accordion ──────────────────────────────────────────────────────── */
.ps-phases { background: var(--light); }
.ps-phase-list { display: flex; flex-direction: column; gap: 12px; }
.ps-phase-card { border: 1px solid var(--border-light); border-radius: 12px; overflow: hidden; background: #fff; }
.ps-phase-header {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 18px 20px;
  cursor: pointer;
  user-select: none;
  transition: background 0.15s;
}
.ps-phase-header:hover { background: var(--off-white); }
.ps-phase-number {
  width: 32px; height: 32px;
  background: var(--off-white);
  border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 0.8rem; font-weight: 700; color: var(--purple);
  flex-shrink: 0;
}
.ps-phase-header[aria-expanded="true"] .ps-phase-number { background: var(--purple); color: #fff; }
.ps-phase-name { font-size: 0.95rem; font-weight: 600; color: var(--text); flex: 1; }
.ps-phase-duration {
  font-size: 0.72rem; font-weight: 600;
  background: var(--off-white); color: var(--muted);
  padding: 4px 10px; border-radius: 99px;
  white-space: nowrap;
}
.ps-phase-chevron {
  width: 16px; height: 16px;
  color: var(--subtle);
  transition: transform 0.25s;
  flex-shrink: 0;
}
.ps-phase-header[aria-expanded="true"] .ps-phase-chevron { transform: rotate(180deg); }
.ps-phase-body { padding: 0 20px; }
.ps-phase-body-inner { padding: 4px 0 20px; }
.ps-phase-desc { font-size: 0.9rem; color: var(--muted); line-height: 1.65; margin-bottom: 16px; }
.ps-phase-lists { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
@media (max-width: 540px) { .ps-phase-lists { grid-template-columns: 1fr; } }
.ps-phase-header:focus-visible { outline: 2px solid var(--purple); outline-offset: -2px; border-radius: 4px; }
.ps-flow-step:focus-visible { outline: 2px solid var(--purple); outline-offset: 2px; border-radius: 8px; }
.ps-phase-list-label {
  font-size: 0.65rem; font-weight: 700;
  letter-spacing: 0.1em; text-transform: uppercase;
  color: var(--subtle); margin-bottom: 8px;
}
.ps-phase-items { display: flex; flex-direction: column; gap: 5px; }
.ps-phase-item {
  display: flex; align-items: flex-start; gap: 8px;
  font-size: 0.82rem; color: var(--muted); line-height: 1.4;
}
.ps-phase-item::before { content: '—'; color: var(--purple); flex-shrink: 0; margin-top: 1px; }

/* ── Timeline ──────────────────────────────────────────────────────────────── */
.ps-timeline { background: var(--off-white); }
.ps-tl-duration {
  font-size: 0.8rem; font-weight: 600;
  color: var(--muted); margin-bottom: 20px;
}
.ps-tl-duration span { color: var(--purple); }
.ps-tl-bar {
  display: flex; gap: 4px;
  height: 44px; border-radius: 8px; overflow: hidden;
  margin-bottom: 12px;
}
.ps-tl-block {
  display: flex; align-items: center; justify-content: center;
  color: #fff; font-size: 0.7rem; font-weight: 600;
  border-radius: 6px; position: relative; cursor: default;
  min-width: 36px; padding: 0 8px; text-align: center;
  white-space: nowrap; overflow: hidden;
  transition: opacity 0.18s;
}
.ps-tl-block:hover { opacity: 0.88; }
.ps-tl-tip {
  position: absolute; bottom: calc(100% + 8px); left: 50%;
  transform: translateX(-50%);
  background: var(--dark); color: #fff;
  font-size: 0.7rem; font-weight: 400; line-height: 1.4;
  padding: 6px 10px; border-radius: 6px;
  max-width: 160px; white-space: normal;
  opacity: 0; visibility: hidden;
  transition: opacity 0.18s;
  pointer-events: none; z-index: 10;
}
.ps-tl-legend {
  display: flex; flex-wrap: wrap; gap: 12px; margin-top: 12px;
}
.ps-tl-legend-item {
  display: flex; align-items: center; gap: 6px;
  font-size: 0.75rem; color: var(--muted);
}
.ps-tl-legend-dot {
  width: 10px; height: 10px; border-radius: 50%;
}
@media (max-width: 540px) {
  /* Stack timeline blocks vertically on mobile so phase names have full width and never clip. */
  .ps-tl-bar { flex-direction: column; height: auto; overflow: visible; border-radius: 8px; gap: 4px; }
  .ps-tl-block { flex: none !important; width: 100%; min-width: 0; height: 44px; border-radius: 6px; justify-content: flex-start; padding: 0 14px; font-size: 0.75rem; }
  .ps-tl-block > span { display: block; }
  .ps-tl-tip { display: none !important; }
  .ps-tl-legend-item { font-size: 0.82rem; }
  .ps-tl-legend { gap: 10px 16px; }
}

/* ── Investment ────────────────────────────────────────────────────────────── */
.ps-investment {
  background: var(--off-white);
  color: var(--text);
  text-align: center;
  border-top: 1px solid var(--border-light);
  border-bottom: 1px solid var(--border-light);
}
.ps-investment .ps-overline { color: var(--purple); opacity: 1; text-align: center; }
.ps-investment .ps-section-title { color: var(--text); text-align: center; }
.ps-price-tag {
  font-family: 'Playfair Display', Georgia, serif;
  font-size: clamp(2.5rem, 6vw, 4rem);
  font-weight: 900;
  color: var(--text);
  margin: 1.25rem 0 1.75rem;
  letter-spacing: -0.02em;
}
.ps-price-accent { color: var(--purple); }
.ps-includes-list {
  display: flex; flex-direction: column; align-items: center;
  gap: 10px; margin: 0 auto 2rem; max-width: 480px;
}
.ps-includes-item {
  display: flex; align-items: center; gap: 10px;
  font-size: 0.9rem; color: var(--muted);
}
.ps-includes-check { color: var(--teal); font-size: 1rem; flex-shrink: 0; }
.ps-investment-note {
  font-size: 0.8rem;
  color: var(--subtle);
  max-width: 400px;
  margin: 0 auto;
  line-height: 1.6;
}

/* ── Next Steps ────────────────────────────────────────────────────────────── */
.ps-next-steps { background: var(--light); }
.ps-steps-list { display: flex; flex-direction: column; gap: 16px; margin-bottom: 3rem; }
.ps-step-item { display: flex; align-items: flex-start; gap: 16px; }
.ps-step-num {
  width: 32px; height: 32px; flex-shrink: 0;
  background: var(--purple); color: #fff;
  border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 0.8rem; font-weight: 700;
}
.ps-step-content { flex: 1; padding-top: 4px; }
.ps-step-action { font-size: 0.95rem; font-weight: 600; color: var(--text); margin-bottom: 2px; }
.ps-step-detail { font-size: 0.85rem; color: var(--muted); line-height: 1.55; }
.ps-cta-wrap { text-align: center; }
.ps-cta-btn {
  display: inline-flex; align-items: center; gap: 8px;
  background: var(--purple); color: #fff;
  font-size: 0.95rem; font-weight: 600;
  padding: 14px 36px; border-radius: 99px;
  text-decoration: none;
  transition: opacity 0.2s, transform 0.2s;
  box-shadow: 0 4px 20px rgba(108,63,255,0.35);
}
.ps-cta-btn:hover { opacity: 0.9; transform: translateY(-1px); }
.ps-cta-arrow { font-size: 1.1rem; }

/* ── Footer ────────────────────────────────────────────────────────────────── */
.ps-footer {
  background: var(--off-white);
  color: var(--subtle);
  padding: 36px 20px;
  border-top: 1px solid var(--border-light);
}
.ps-footer-inner {
  max-width: 760px; margin: 0 auto;
  display: flex; flex-wrap: wrap;
  align-items: center; justify-content: space-between;
  gap: 12px;
}
.ps-footer-brand { font-family: 'Playfair Display', Georgia, serif; color: var(--text); font-size: 0.95rem; font-weight: 700; }
.ps-footer-meta { font-size: 0.75rem; text-align: right; }
@media (max-width: 480px) {
  .ps-footer-inner { flex-direction: column; align-items: flex-start; gap: 6px; }
  .ps-footer-meta { text-align: left; }
}
`;

// ─── Section builders ─────────────────────────────────────────────────────────

function buildHeroSection(data: ClientProposalData): string {
  const { hero, meta } = data;
  const statsHTML = (hero.stats || []).length
    ? `<div class="ps-stats-row">${(hero.stats).map((s) => `
        <div class="ps-stat ps-reveal" data-delay="200">
          <span class="ps-stat-val ps-stat-before" data-count="${esc(s.before)}">${esc(s.before)}</span>
          <span class="ps-stat-arrow">→</span>
          <span class="ps-stat-val ps-stat-after" data-count="${esc(s.after)}">${esc(s.after)}</span>
          <span class="ps-stat-label">${esc(s.label)}</span>
        </div>`).join('')}</div>`
    : '';

  return `<section id="hero-section" class="ps-hero">
  <div class="ps-inner" style="width:100%;display:flex;flex-direction:column;">
    <div class="ps-hero-nav">
      <div>
        <div class="ps-logo-wordmark">Spilled Milk</div>
        <div class="ps-logo-sub">Design Shopp</div>
      </div>
      <div class="ps-client-tag">${esc(meta.client_name)}</div>
    </div>
    <div class="ps-hero-body">
      <div class="ps-overline ps-reveal">${esc(meta.projectType)}</div>
      <h1 class="ps-hero-headline ps-reveal" data-delay="80">${esc(hero.headline)}</h1>
      <p class="ps-hero-subtext ps-reveal" data-delay="140">${esc(hero.subtext)}</p>
    </div>
    ${statsHTML}
  </div>
</section>`;
}

function buildSolutionSection(data: ClientProposalData): string {
  const { solution } = data;
  if (!solution) return '';
  const cardsHTML = (solution.capabilities || []).map((cap, i) => `
    <div class="ps-cap-card ps-reveal" data-delay="${i * 60}">
      <div class="ps-cap-front">
        <div class="ps-cap-icon">${esc(cap.icon)}</div>
        <div class="ps-cap-title">${esc(cap.title)}</div>
        <div class="ps-cap-detail">${esc(cap.detail)}</div>
      </div>
      <div class="ps-cap-outcome">
        <div class="ps-cap-outcome-label">How this helps you</div>
        <div class="ps-cap-outcome-text">${esc(cap.outcome)}</div>
      </div>
    </div>`).join('');

  return `<section id="solution-section" class="ps-solution">
  <div class="ps-inner">
    <div class="ps-overline ps-reveal">The Solution</div>
    <h2 class="ps-section-title ps-reveal">${esc(solution.title)}</h2>
    <p class="ps-section-overview ps-reveal">${esc(solution.overview)}</p>
    <div class="ps-cap-grid">${cardsHTML}</div>
  </div>
</section>`;
}

function buildFlowSection(data: ClientProposalData): string {
  const { flow } = data;
  if (!flow || !flow.steps?.length) return '';

  const stepsHTML = flow.steps.map((step: FlowStep, i: number) => {
    const connectorHTML = i < flow.steps.length - 1
      ? '<div class="ps-flow-connector"></div>'
      : '';
    return `<div class="ps-flow-step ps-step-${step.type} ps-reveal" data-delay="${i * 80}" data-open="false" role="button" aria-expanded="false" tabindex="0">
      <div class="ps-step-node">${esc(step.icon)}</div>
      <div class="ps-step-title">${esc(step.title)}</div>
      <div class="ps-step-time">${esc(step.time)}</div>
      <div class="ps-step-desc">${esc(step.desc)}</div>
    </div>${connectorHTML}`;
  }).join('');

  const gateHTML = flow.gate
    ? `<div style="text-align:center">
        <div class="ps-flow-gate">⬡ ${esc(flow.gate)}</div>
       </div>`
    : '';

  const branchesHTML = flow.branches
    ? buildBranches(flow.branches.yes, flow.branches.no)
    : '';

  return `<section id="how-it-works" class="ps-flow">
  <div class="ps-inner">
    <div class="ps-overline ps-reveal">How It Works</div>
    <h2 class="ps-section-title ps-reveal">The Automation Pipeline</h2>
    <p class="ps-section-overview ps-reveal" style="margin-bottom:2rem">Click any step to learn more.</p>
    <div class="ps-flow-pipeline">${stepsHTML}</div>
    ${gateHTML}
    ${branchesHTML}
  </div>
</section>`;
}

function buildBranches(yes: FlowBranch, no: FlowBranch): string {
  return `<div class="ps-flow-branches">
    <div class="ps-branch ps-branch-yes ps-reveal">
      <div class="ps-branch-label">✓ Yes</div>
      <div class="ps-branch-title">${esc(yes.title)}</div>
      <div class="ps-branch-desc">${esc(yes.desc)}</div>
      <div class="ps-branch-stat">${esc(yes.stat)}</div>
    </div>
    <div class="ps-branch ps-branch-no ps-reveal" data-delay="80">
      <div class="ps-branch-label">✕ No</div>
      <div class="ps-branch-title">${esc(no.title)}</div>
      <div class="ps-branch-desc">${esc(no.desc)}</div>
      <div class="ps-branch-stat">${esc(no.stat)}</div>
    </div>
  </div>`;
}

function buildPhasesSection(data: ClientProposalData): string {
  const { phases } = data;
  if (!phases?.length) return '';

  const phasesHTML = phases.map((phase: PhaseData) => {
    const deliverables = (phase.deliverables || [])
      .map((d) => `<div class="ps-phase-item">${esc(d)}</div>`)
      .join('');
    const clientNeeds = (phase.clientNeeds || [])
      .map((n) => `<div class="ps-phase-item">${esc(n)}</div>`)
      .join('');

    return `<div class="ps-phase-card">
      <div class="ps-phase-header" aria-expanded="false">
        <div class="ps-phase-number">${phase.number}</div>
        <div class="ps-phase-name">${esc(phase.title)}</div>
        <div class="ps-phase-duration">${esc(phase.duration)}</div>
        <svg class="ps-phase-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" d="m6 9 6 6 6-6"/>
        </svg>
      </div>
      <div class="ps-phase-body">
        <div class="ps-phase-body-inner">
          <p class="ps-phase-desc">${esc(phase.description)}</p>
          <div class="ps-phase-lists">
            ${deliverables ? `<div>
              <div class="ps-phase-list-label">Deliverables</div>
              <div class="ps-phase-items">${deliverables}</div>
            </div>` : ''}
            ${clientNeeds ? `<div>
              <div class="ps-phase-list-label">What we need from you</div>
              <div class="ps-phase-items">${clientNeeds}</div>
            </div>` : ''}
          </div>
        </div>
      </div>
    </div>`;
  }).join('');

  return `<section id="phases-section" class="ps-phases">
  <div class="ps-inner">
    <div class="ps-overline ps-reveal">Implementation</div>
    <h2 class="ps-section-title ps-reveal">Project Phases</h2>
    <p class="ps-section-overview ps-reveal">Click a phase to see deliverables and what we need from you.</p>
    <div class="ps-phase-list">${phasesHTML}</div>
  </div>
</section>`;
}

function buildTimelineSection(data: ClientProposalData): string {
  const { timeline, phases } = data;
  if (!timeline?.phases?.length) return '';

  const totalWeeks = timeline.phases.reduce((sum: number, p: TimelinePhase) => sum + (p.weeks || 0), 0);
  const colors = ['#6c3fff', '#3b82f6', '#14b8a6', '#f59e0b', '#ef4444', '#8b5cf6'];

  const blocksHTML = timeline.phases.map((tp: TimelinePhase, i: number) => {
    const pct = totalWeeks > 0 ? ((tp.weeks / totalWeeks) * 100).toFixed(1) : '0';
    const color = tp.color || colors[i % colors.length];
    const deliverablesList = phases[i]?.deliverables?.slice(0, 3).join(', ') || '';
    return `<div class="ps-tl-block ps-reveal" data-delay="${i * 60}"
      style="flex:${tp.weeks} 1 0;background:${color}"
      data-tip="${esc(tp.name)}">
      <span>${esc(tp.name)}</span>
      <div class="ps-tl-tip">${esc(tp.name)}: ${tp.weeks}w${deliverablesList ? ' — ' + esc(deliverablesList) : ''}</div>
    </div>`;
  }).join('');

  const legendHTML = timeline.phases.map((tp: TimelinePhase, i: number) => {
    const color = tp.color || colors[i % colors.length];
    return `<div class="ps-tl-legend-item">
      <div class="ps-tl-legend-dot" style="background:${color}"></div>
      <span>${esc(tp.name)} (${tp.weeks}w)</span>
    </div>`;
  }).join('');

  return `<section id="timeline-section" class="ps-timeline">
  <div class="ps-inner">
    <div class="ps-overline ps-reveal">Schedule</div>
    <h2 class="ps-section-title ps-reveal">Project Timeline</h2>
    <div class="ps-tl-duration ps-reveal">Total duration: <span>${esc(timeline.totalDuration)}</span></div>
    <div class="ps-tl-bar">${blocksHTML}</div>
    <div class="ps-tl-legend">${legendHTML}</div>
  </div>
</section>`;
}

function buildInvestmentSection(data: ClientProposalData): string {
  const { investment } = data;
  if (!investment) return '';

  const includesHTML = (investment.includes || [])
    .map((item) => `<div class="ps-includes-item">
      <span class="ps-includes-check">✓</span>
      <span>${esc(item)}</span>
    </div>`).join('');

  const noteHTML = investment.note
    ? `<p class="ps-investment-note">${esc(investment.note)}</p>`
    : '';

  // Split price at first digit for accent styling on the number
  const priceDisplay = investment.total
    ? `<span class="ps-price-accent">${esc(investment.total)}</span>`
    : '';

  return `<section id="investment-section" class="ps-investment">
  <div class="ps-inner" style="text-align:center">
    <div class="ps-overline ps-reveal">Investment</div>
    <h2 class="ps-section-title ps-reveal">What It Costs</h2>
    <div class="ps-price-tag ps-reveal">${priceDisplay}</div>
    <div class="ps-includes-list">${includesHTML}</div>
    ${noteHTML}
  </div>
</section>`;
}

function buildNextStepsSection(data: ClientProposalData): string {
  const { nextSteps } = data;
  if (!nextSteps?.length) return '';

  const stepsHTML = nextSteps.map((step, i) => `
    <div class="ps-step-item ps-reveal" data-delay="${i * 60}">
      <div class="ps-step-num">${i + 1}</div>
      <div class="ps-step-content">
        <div class="ps-step-action">${esc(step.action)}</div>
        <div class="ps-step-detail">${esc(step.detail)}</div>
      </div>
    </div>`).join('');

  return `<section id="next-steps" class="ps-next-steps">
  <div class="ps-inner">
    <div class="ps-overline ps-reveal">Getting Started</div>
    <h2 class="ps-section-title ps-reveal">Next Steps</h2>
    <div class="ps-steps-list">${stepsHTML}</div>
  </div>
</section>`;
}

function buildFooter(data: ClientProposalData): string {
  const { meta } = data;
  return `<footer id="footer-section" class="ps-footer">
  <div class="ps-footer-inner">
    <div>
      <div class="ps-footer-brand">Spilled Milk · Design Shopp</div>
      <div style="font-size:0.75rem;margin-top:4px">${esc(meta.projectType)} for ${esc(meta.client_name)}</div>
    </div>
    <div class="ps-footer-meta">
      <div>Prepared by ${esc(meta.preparedBy)}</div>
      <div>${esc(meta.date)}</div>
    </div>
  </div>
</footer>`;
}

// ─── Main assembler ───────────────────────────────────────────────────────────

export function buildClientProposalHTML(data: ClientProposalData): string {
  const title = `${data.meta.project_name} — ${data.meta.client_name} Proposal`;
  const body = [
    buildHeroSection(data),
    buildSolutionSection(data),
    buildFlowSection(data),
    buildPhasesSection(data),
    buildTimelineSection(data),
    buildInvestmentSection(data),
    buildNextStepsSection(data),
    buildFooter(data),
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
${body}
<script>
${INTERACTION_JS}
</script>
</body>
</html>`;
}
