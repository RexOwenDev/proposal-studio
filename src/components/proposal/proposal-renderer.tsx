'use client';

import { useRef, useEffect } from 'react';
import type { ContentBlock } from '@/lib/types';

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

  const visibleBlocks = mode === 'view'
    ? blocks.filter((b) => b.visible)
    : blocks;

  const srcdoc = buildIframeHTML(stylesheet, visibleBlocks, scripts, mode);

  // Auto-resize iframe to match content height
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    let resizeObserver: ResizeObserver | null = null;
    let mutationObserver: MutationObserver | null = null;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    function syncHeight() {
      if (!iframe) return;
      const doc = iframe.contentDocument;
      if (doc?.body) {
        const h = Math.max(doc.body.scrollHeight, doc.documentElement.scrollHeight);
        iframe.style.height = `${h + 20}px`;
      }
    }

    function onLoad() {
      if (!iframe) return;
      const doc = iframe.contentDocument;
      if (!doc?.body) return;

      // Initial size
      syncHeight();

      // Watch for DOM mutations (JS adding classes, content changes)
      mutationObserver = new MutationObserver(syncHeight);
      mutationObserver.observe(doc.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class', 'style'],
      });

      // Watch for body resize (images loading, fonts rendering)
      resizeObserver = new ResizeObserver(syncHeight);
      resizeObserver.observe(doc.body);

      // Periodic fallback for animations that change height over time
      intervalId = setInterval(syncHeight, 1000);
      // Stop periodic checks after 10 seconds
      setTimeout(() => {
        if (intervalId) clearInterval(intervalId);
        intervalId = null;
      }, 10000);
    }

    iframe.addEventListener('load', onLoad);

    return () => {
      iframe.removeEventListener('load', onLoad);
      resizeObserver?.disconnect();
      mutationObserver?.disconnect();
      if (intervalId) clearInterval(intervalId);
    };
  }, [srcdoc]);

  return (
    <iframe
      ref={iframeRef}
      srcDoc={srcdoc}
      className="w-full border-0"
      style={{ minHeight: '100vh' }}
      title="Proposal Preview"
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
    const blockHTML = mode === 'edit'
      ? `<div data-block-id="${block.id}" data-hidden="${!block.visible}">${block.current_html}</div>`
      : block.current_html;

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

  // Wrap scripts in DOMContentLoaded so DOM is fully ready
  const wrappedScripts = scripts
    ? `<script>
document.addEventListener('DOMContentLoaded', function() {
${scripts}
});
<\/script>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  ${headLinks}
  <style>${css}${editStyles}</style>
</head>
<body>
  ${bodyParts.join('\n')}
  ${wrappedScripts}
</body>
</html>`;
}
