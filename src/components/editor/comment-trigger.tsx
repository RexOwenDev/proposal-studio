'use client';

import { useEffect, useState, useCallback } from 'react';

export interface SelectionData {
  text: string;
  blockId: string | null;
  x: number; // page-absolute center of selection
  y: number; // page-absolute top of selection
}

interface CommentTriggerProps {
  iframeRef: React.RefObject<HTMLIFrameElement | null>;
  onAddComment: (data: SelectionData) => void;
}

/** Walk up the iframe DOM to find the nearest [data-block-id] ancestor. */
function detectBlockId(node: Node | null): string | null {
  let current: Node | null = node;
  while (current && current.nodeType !== Node.DOCUMENT_NODE) {
    if (current instanceof Element) {
      const id = current.getAttribute('data-block-id');
      if (id) return id;
    }
    current = current.parentNode;
  }
  return null;
}

export default function CommentTrigger({ iframeRef, onAddComment }: CommentTriggerProps) {
  const [selection, setSelection] = useState<SelectionData | null>(null);

  const handleMouseUp = useCallback(() => {
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) return;

    const sel = iframe.contentWindow.getSelection();
    if (!sel || sel.isCollapsed || !sel.toString().trim()) {
      setSelection(null);
      return;
    }

    const text = sel.toString().trim();
    if (text.length < 2) { setSelection(null); return; }

    const range = sel.getRangeAt(0);
    const selRect = range.getBoundingClientRect();   // relative to iframe viewport
    const iframeRect = iframe.getBoundingClientRect(); // relative to page viewport

    // Convert to page-absolute coordinates
    const x = iframeRect.left + selRect.left + selRect.width / 2;
    const y = iframeRect.top + selRect.top + window.scrollY;

    setSelection({ text, blockId: detectBlockId(range.commonAncestorContainer), x, y });
  }, [iframeRef]);

  const handleMouseDown = useCallback((e: MouseEvent) => {
    const btn = document.getElementById('ps-comment-trigger');
    if (btn?.contains(e.target as Node)) return;
    setSelection(null);
  }, []);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    function attach() {
      iframe!.contentDocument?.addEventListener('mouseup', handleMouseUp);
    }

    iframe.addEventListener('load', attach);
    attach(); // in case already loaded

    document.addEventListener('mousedown', handleMouseDown);

    return () => {
      iframe.removeEventListener('load', attach);
      iframe.contentDocument?.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('mousedown', handleMouseDown);
    };
  }, [iframeRef, handleMouseUp, handleMouseDown]);

  if (!selection) return null;

  return (
    <button
      id="ps-comment-trigger"
      onClick={() => { onAddComment(selection); setSelection(null); }}
      style={{
        position: 'absolute',
        left: `${selection.x}px`,
        top: `${selection.y - 44}px`,
        transform: 'translateX(-50%)',
        zIndex: 100,
      }}
      className="flex items-center gap-1.5 px-2.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded-lg shadow-lg transition-colors whitespace-nowrap"
      aria-label="Add comment to selection"
    >
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 0 1 .865-.501 48.172 48.172 0 0 0 3.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
      </svg>
      Comment
    </button>
  );
}
