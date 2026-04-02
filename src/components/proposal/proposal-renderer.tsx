'use client';

import { useRef, useEffect } from 'react';
import type { ContentBlock } from '@/lib/types';

interface ProposalRendererProps {
  stylesheet: string | null;
  blocks: ContentBlock[];
  scripts: string | null;
  mode: 'view' | 'edit';
}

/**
 * Renders a proposal inside an iframe for perfect CSS isolation.
 * In 'view' mode: renders only visible blocks, fills viewport.
 * In 'edit' mode: renders all blocks (hidden ones at reduced opacity),
 *   and exposes the iframe document for Tiptap integration.
 */
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

  // Build the full HTML document for the iframe
  const htmlContent = buildIframeHTML(stylesheet, visibleBlocks, scripts, mode);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const doc = iframe.contentDocument;
    if (!doc) return;

    doc.open();
    doc.write(htmlContent);
    doc.close();

    // Auto-resize iframe to content height
    const resizeObserver = new ResizeObserver(() => {
      const body = doc.body;
      if (body) {
        iframe.style.height = `${body.scrollHeight}px`;
      }
    });

    // Wait for content to render before observing
    const timer = setTimeout(() => {
      if (doc.body) {
        resizeObserver.observe(doc.body);
        iframe.style.height = `${doc.body.scrollHeight}px`;
      }
    }, 100);

    return () => {
      clearTimeout(timer);
      resizeObserver.disconnect();
    };
  }, [htmlContent]);

  return (
    <iframe
      ref={iframeRef}
      className="w-full border-0"
      style={{ minHeight: '100vh' }}
      title="Proposal Preview"
      sandbox="allow-same-origin allow-scripts"
    />
  );
}

function buildIframeHTML(
  stylesheet: string | null,
  blocks: ContentBlock[],
  scripts: string | null,
  mode: 'view' | 'edit',
): string {
  // Extract preconnect links from stylesheet (they're HTML, not CSS)
  let preconnectLinks = '';
  let cssContent = stylesheet || '';

  if (cssContent.includes('<!-- Font preconnects -->')) {
    const parts = cssContent.split('\n\n');
    const preconnectPart = parts.find((p) => p.includes('<link'));
    if (preconnectPart) {
      preconnectLinks = preconnectPart
        .replace('<!-- Font preconnects -->', '')
        .trim();
      cssContent = parts.filter((p) => !p.includes('<link')).join('\n\n');
    }
  }

  const editStyles = mode === 'edit'
    ? `
    [data-block-id][data-hidden="true"] {
      opacity: 0.35;
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

  const blocksHTML = blocks
    .map((block) => {
      const wrapper = mode === 'edit'
        ? `<div data-block-id="${block.id}" data-hidden="${!block.visible}">${block.current_html}</div>`
        : block.current_html;
      return wrapper;
    })
    .join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  ${preconnectLinks}
  <style>${cssContent}${editStyles}</style>
</head>
<body>
  ${blocksHTML}
  ${scripts ? `<script>${scripts}<\/script>` : ''}
</body>
</html>`;
}
