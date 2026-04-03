'use client';

import { useState, useRef, useEffect } from 'react';

interface CommentTriggerProps {
  selectionData: {
    text: string;
    blockId: string;
    rect: { top: number; right: number; bottom: number; left: number };
  };
  onSubmit: (blockId: string, commentText: string, selectedText: string) => void;
  onDismiss: () => void;
}

export default function CommentTrigger({ selectionData, onSubmit, onDismiss }: CommentTriggerProps) {
  const [expanded, setExpanded] = useState(false);
  const [commentText, setCommentText] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (expanded && inputRef.current) {
      inputRef.current.focus();
    }
  }, [expanded]);

  // Position the trigger near the selection
  const style: React.CSSProperties = {
    position: 'fixed',
    top: `${selectionData.rect.bottom + 8}px`,
    left: `${selectionData.rect.left}px`,
    zIndex: 100,
  };

  function handleSubmit() {
    if (!commentText.trim()) return;
    onSubmit(selectionData.blockId, commentText.trim(), selectionData.text);
    setCommentText('');
    setExpanded(false);
  }

  if (!expanded) {
    return (
      <button
        style={style}
        onClick={() => setExpanded(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-white text-xs font-medium rounded-lg shadow-lg transition-all duration-150 animate-scale-in active:scale-95"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 0 1 .865-.501 48.172 48.172 0 0 0 3.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
        </svg>
        Comment
      </button>
    );
  }

  return (
    <>
      {/* Click-away backdrop */}
      <div className="fixed inset-0 z-[99]" onClick={onDismiss} />

      <div
        style={{ ...style, zIndex: 101 }}
        className="w-72 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl animate-scale-in overflow-hidden"
      >
        {/* Selected text preview */}
        <div className="px-3 py-2 bg-amber-950/30 border-b border-zinc-800">
          <p className="text-amber-300/70 text-[10px] font-medium uppercase tracking-wider mb-1">Commenting on</p>
          <p className="text-zinc-300 text-xs italic truncate">
            &ldquo;{selectionData.text.slice(0, 80)}{selectionData.text.length > 80 ? '...' : ''}&rdquo;
          </p>
        </div>

        {/* Comment input */}
        <div className="p-3">
          <textarea
            ref={inputRef}
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
              if (e.key === 'Escape') {
                onDismiss();
              }
            }}
            placeholder="Add your comment..."
            rows={2}
            className="w-full px-2.5 py-2 bg-zinc-800 border border-zinc-700 rounded-md text-white placeholder:text-zinc-500 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50 resize-none"
          />
          <div className="flex justify-end gap-2 mt-2">
            <button
              onClick={onDismiss}
              className="px-3 py-1 text-xs text-zinc-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={!commentText.trim()}
              className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-white text-xs font-medium rounded-md transition-colors active:scale-95"
            >
              Comment
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
