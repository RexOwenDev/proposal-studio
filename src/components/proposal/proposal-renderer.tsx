'use client';

import { useRef, useEffect, useMemo } from 'react';
import type { ContentBlock } from '@/lib/types';
import { wrapScripts } from '@/lib/utils/wrap-scripts';
import { stripEditorArtifacts } from '@/lib/utils/strip-editor-artifacts';

interface ProposalRendererProps {
  stylesheet: string | null;
  blocks: ContentBlock[];
  scripts: string | null;
  mode: 'view' | 'edit';
}

export default function ProposalRenderer({
  stylesheet,
  blocks,
  scripts,
  mode,
}: ProposalRendererProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Memoize to prevent iframe reload on unrelated parent re-renders
  const srcdoc = useMemo(() => {
    const visibleBlocks = mode === 'view'
      ? blocks.filter((b) => b.visible)
      : blocks;
    return buildIframeHTML(stylesheet, visibleBlocks, scripts, mode);
  }, [stylesheet, blocks, scripts, mode]);

  // Auto-resize iframe to match content height
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    let resizeObserver: ResizeObserver | null = null;
    let mutationObserver: MutationObserver | null = null;

    // Debounced sync: coalesces rapid calls into one update (100ms)
    let syncTimer: ReturnType<typeof setTimeout>;
    function syncHeight() {
      if (!iframe) return;
      clearTimeout(syncTimer);
      syncTimer = setTimeout(() => {
        const doc = iframe.contentDocument;
        if (doc?.body) {
          const h = Math.max(doc.body.scrollHeight, doc.documentElement.scrollHeight);
          iframe.style.height = `${h + 20}px`;
        }
      }, 100);
    }

    function onLoad() {
      if (!iframe) return;
      const doc = iframe.contentDocument;
      if (!doc?.body) return;

      // Initial size
      syncHeight();

      // ResizeObserver: catches image loads, font swaps, layout shifts
      resizeObserver = new ResizeObserver(syncHeight);
      resizeObserver.observe(doc.body);

      // MutationObserver: catches JS-driven class/style changes (reveal animations)
      mutationObserver = new MutationObserver(syncHeight);
      mutationObserver.observe(doc.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class', 'style'],
      });
    }

    iframe.addEventListener('load', onLoad);

    return () => {
      iframe.removeEventListener('load', onLoad);
      resizeObserver?.disconnect();
      mutationObserver?.disconnect();
      clearTimeout(syncTimer);
    };
  }, [srcdoc]);

  return (
    <iframe
      ref={iframeRef}
      srcDoc={srcdoc}
      className="w-full border-0"
      style={{ minHeight: '100vh' }}
      title="Proposal Preview"
      sandbox="allow-scripts allow-same-origin"
    />
  );
}

/**
 * Extract head links (fonts, preconnects) and CSS from the stored stylesheet.
 * The parser stores them with <!--HEAD_LINKS-->...<!--/HEAD_LINKS--> markers.
 * Also handles the legacy format (<!-- Font preconnects -->).
 */
function parseStylesheet(raw: string | null): { headLinks: string; css: string } {
  if (!raw) return { headLinks: '', css: '' };

  // New format: <!--HEAD_LINKS-->...<!/HEAD_LINKS-->
  const newMatch = raw.match(/<!--HEAD_LINKS-->\n([\s\S]*?)\n<!--\/HEAD_LINKS-->/);
  if (newMatch) {
    const headLinks = newMatch[1].trim();
    const css = raw.replace(/<!--HEAD_LINKS-->[\s\S]*?<!--\/HEAD_LINKS-->\n?/, '').trim();
    return { headLinks, css };
  }

  // Legacy format: <!-- Font preconnects --> with \n\n splitting
  if (raw.includes('<!-- Font preconnects -->')) {
    const parts = raw.split('\n\n');
    const linkParts = parts.filter((p) => p.includes('<link'));
    const cssParts = parts.filter((p) => !p.includes('<link') && !p.includes('<!-- Font'));
    return {
      headLinks: linkParts.map((p) => p.replace('<!-- Font preconnects -->', '').trim()).join('\n'),
      css: cssParts.join('\n\n'),
    };
  }

  return { headLinks: '', css: raw };
}

/**
 * Build the full HTML document for the iframe.
 * Key design decisions:
 * - Uses srcdoc (not doc.write) for reliable script execution
 * - Wraps all scripts in DOMContentLoaded so DOM is ready
 * - In edit mode: overrides opacity:0/reveal patterns so all content is visible
 * - Groups blocks by wrapper_class to preserve layout containers
 */
function buildIframeHTML(
  stylesheet: string | null,
  blocks: ContentBlock[],
  scripts: string | null,
  mode: 'view' | 'edit',
): string {
  const { headLinks, css } = parseStylesheet(stylesheet);

  const editStyles = mode === 'edit'
    ? `
    /* Force all content visible in editor — overrides reveal/animation patterns */
    .reveal, [class*="reveal"], [class*="animate"], [class*="fade"] {
      opacity: 1 !important;
      transform: none !important;
      transition: none !important;
      animation: none !important;
    }
    /* Kill SVG declarative animations in edit mode */
    animate, animateTransform, animateMotion, set {
      display: none !important;
    }
    svg path, svg rect, svg circle, svg text, svg g {
      opacity: 1 !important;
    }
    [data-block-id][data-hidden="true"] {
      opacity: 0.35 !important;
      position: relative;
    }
    [data-block-id][data-hidden="true"]::after {
      content: 'HIDDEN';
      position: absolute;
      top: 8px;
      right: 8px;
      background: rgba(0,0,0,0.7);
      color: #fff;
      font-size: 10px;
      padding: 2px 8px;
      border-radius: 4px;
      font-family: system-ui;
      letter-spacing: 1px;
      z-index: 1000;
    }
    `
    : '';

  // Group consecutive blocks by wrapper_class
  const bodyParts: string[] = [];
  let currentWrapper: string | null = null;
  let wrapperBuffer: string[] = [];

  function flushWrapper() {
    if (wrapperBuffer.length > 0 && currentWrapper) {
      bodyParts.push(`<div class="${currentWrapper}">\n${wrapperBuffer.join('\n')}\n</div>`);
      wrapperBuffer = [];
    }
    currentWrapper = null;
  }

  for (const block of blocks) {
    // In view mode, strip ALL editor artifacts (marks, data-editable, contenteditable,
    // etc.) as a final safety net against anything that slipped past the save-time strip.
    const html = mode === 'view'
      ? stripEditorArtifacts(block.current_html)
      : block.current_html;
    const blockHTML = mode === 'edit'
      ? `<div data-block-id="${block.id}" data-hidden="${!block.visible}">${html}</div>`
      : html;

    const wrapper = block.wrapper_class || null;

    if (wrapper !== currentWrapper) {
      flushWrapper();
      if (wrapper) {
        currentWrapper = wrapper;
        wrapperBuffer.push(blockHTML);
      } else {
        bodyParts.push(blockHTML);
      }
    } else if (wrapper) {
      wrapperBuffer.push(blockHTML);
    } else {
      bodyParts.push(blockHTML);
    }
  }
  flushWrapper();

  // Split scripts: function declarations stay global (for inline handlers like
  // oninput="calc()"), execution code wraps in DOMContentLoaded
  const wrappedScripts = scripts ? wrapScripts(scripts) : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  ${headLinks}
  <style>${css}${editStyles}</style>
</head>
<body${mode === 'edit' ? ' data-edit-mode="true"' : ''}>
  ${bodyParts.join('\n')}
  ${wrappedScripts}
</body>
</html>`;
}

