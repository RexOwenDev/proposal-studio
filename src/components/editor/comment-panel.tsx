'use client';

import { useState, useRef, useEffect } from 'react';
import type { Comment, ContentBlock } from '@/lib/types';
import { getUserCommentBorder } from '@/lib/user-colors';

interface CommentPanelProps {
  open: boolean;
  comments: Comment[];
  blocks: ContentBlock[];
  onClose: () => void;
  onAddComment: (blockId: string | null, text: string, selectedText?: string) => void;
  onAddReply: (parentId: string, text: string) => void;
  onResolveComment: (commentId: string, resolved: boolean) => void;
  onScrollToHighlight: (commentId: string) => void;
}

export default function CommentPanel({
  open,
  comments,
  blocks,
  onClose,
  onAddComment,
  onAddReply,
  onResolveComment,
  onScrollToHighlight,
}: CommentPanelProps) {
  const [showResolved, setShowResolved] = useState(false);

  if (!open) return null;

  // Build a tree from flat comments
  const topLevel = comments.filter((c) => !c.parent_id && !c.resolved);
  const resolved = comments.filter((c) => !c.parent_id && c.resolved);

  // Map all replies by parent_id (supports infinite depth)
  const childrenMap = new Map<string, Comment[]>();
  comments.filter((c) => c.parent_id).forEach((c) => {
    const list = childrenMap.get(c.parent_id!) || [];
    list.push(c);
    childrenMap.set(c.parent_id!, list);
  });

  const highlightComments = topLevel.filter((c) => c.selected_text);
  const generalComments = topLevel.filter((c) => !c.selected_text);

  function getBlockLabel(blockId: string): string {
    const block = blocks.find((b) => b.id === blockId);
    return block?.label || `Block ${(block?.block_order || 0) + 1}`;
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30 animate-in" onClick={onClose} />

      <div className="fixed top-14 right-0 bottom-0 z-50 w-96 bg-zinc-900 border-l border-zinc-800 overflow-y-auto flex flex-col animate-slide-right">
        <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between shrink-0">
          <h3 className="text-white text-sm font-medium">
            Comments ({topLevel.length})
          </h3>
          <button onClick={onClose} className="text-zinc-400 hover:text-white text-sm transition-colors">&times;</button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {highlightComments.map((comment) => (
            <CommentThread
              key={comment.id}
              comment={comment}
              childrenMap={childrenMap}
              depth={0}
              blockLabel={comment.block_id ? getBlockLabel(comment.block_id) : undefined}
              onResolve={() => onResolveComment(comment.id, true)}
              onReply={onAddReply}
              onScrollToHighlight={() => onScrollToHighlight(comment.id)}
            />
          ))}

          {generalComments.length > 0 && (
            <>
              {highlightComments.length > 0 && (
                <div className="border-t border-zinc-800 pt-3 mt-3">
                  <p className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider mb-2">General</p>
                </div>
              )}
              {generalComments.map((comment) => (
                <CommentThread
                  key={comment.id}
                  comment={comment}
                  childrenMap={childrenMap}
                  depth={0}
                  blockLabel={comment.block_id ? getBlockLabel(comment.block_id) : undefined}
                  onResolve={() => onResolveComment(comment.id, true)}
                  onReply={onAddReply}
                />
              ))}
            </>
          )}

          {topLevel.length === 0 && (
            <div className="text-center py-12">
              <p className="text-zinc-500 text-sm">No comments yet</p>
              <p className="text-zinc-600 text-xs mt-1">Select text in the proposal to add a comment</p>
            </div>
          )}

          {resolved.length > 0 && (
            <div className="border-t border-zinc-800 pt-3 mt-3">
              <button
                onClick={() => setShowResolved(!showResolved)}
                className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                {showResolved ? 'Hide' : 'Show'} resolved ({resolved.length})
              </button>
              {showResolved && (
                <div className="space-y-2 mt-2 opacity-60">
                  {resolved.map((comment) => (
                    <div key={comment.id} className="bg-zinc-800/30 border border-zinc-800 rounded-md p-3">
                      {comment.selected_text && (
                        <p className="text-zinc-500 text-xs italic mb-1 truncate">&ldquo;{comment.selected_text.slice(0, 80)}&rdquo;</p>
                      )}
                      <p className="text-sm text-zinc-400 line-through">{comment.text}</p>
                      <button
                        onClick={() => onResolveComment(comment.id, false)}
                        className="mt-1 text-xs text-zinc-600 hover:text-amber-400 transition-colors"
                      >
                        Unresolve
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

/** Recursive comment thread — supports infinite nesting */
function CommentThread({
  comment,
  childrenMap,
  depth,
  blockLabel,
  onResolve,
  onReply,
  onScrollToHighlight,
}: {
  comment: Comment;
  childrenMap: Map<string, Comment[]>;
  depth: number;
  blockLabel?: string;
  onResolve: () => void;
  onReply: (parentId: string, text: string) => void;
  onScrollToHighlight?: () => void;
}) {
  const [replyText, setReplyText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const replies = childrenMap.get(comment.id) || [];
  const borderClass = depth === 0
    ? getUserCommentBorder(comment.author_name || 'unknown')
    : 'border-l-zinc-700';

  function handleReply() {
    if (!replyText.trim()) return;
    onReply(comment.id, replyText.trim());
    setReplyText('');
  }

  // Auto-scroll to new replies
  const prevReplyCount = useRef(replies.length);
  useEffect(() => {
    if (replies.length > prevReplyCount.current) {
      // New reply appeared — scroll it into view
      const el = document.querySelector(`[data-comment-thread="${replies[replies.length - 1].id}"]`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    prevReplyCount.current = replies.length;
  }, [replies.length, replies]);

  return (
    <div
      data-comment-thread={comment.id}
      className={`${depth === 0 ? `border-l-2 ${borderClass} rounded-md overflow-hidden` : ''} transition-all duration-200`}
    >
      <div className={`${depth === 0 ? 'bg-zinc-800/40' : 'bg-zinc-800/20 border-t border-zinc-800/50'} p-3`}>
        {/* Highlighted text context — only on root comment */}
        {depth === 0 && comment.selected_text && onScrollToHighlight && (
          <button
            onClick={onScrollToHighlight}
            className="w-full text-left mb-2 pb-2 border-b border-zinc-700/50 group/highlight"
          >
            <p className="text-zinc-400 text-xs italic leading-relaxed group-hover/highlight:text-zinc-200 transition-colors">
              &ldquo;{comment.selected_text.slice(0, 120)}{comment.selected_text.length > 120 ? '...' : ''}&rdquo;
            </p>
            <p className="text-[10px] text-zinc-600 mt-0.5 group-hover/highlight:text-blue-400 transition-colors">
              Click to scroll to highlight{blockLabel ? ` · ${blockLabel}` : ''}
            </p>
          </button>
        )}

        {/* Author + date */}
        <div className="flex items-center justify-between mb-1">
          <span className={`font-medium ${depth === 0 ? 'text-xs text-zinc-400' : 'text-[11px] text-zinc-500'}`}>
            {comment.author_name}
          </span>
          <span className="text-[10px] text-zinc-600">
            {new Date(comment.created_at).toLocaleDateString()}
          </span>
        </div>

        {/* Comment text */}
        <p className={`leading-relaxed ${depth === 0 ? 'text-sm text-zinc-200' : 'text-xs text-zinc-300'}`}>
          {comment.text}
        </p>

        {/* Actions — only on root */}
        {depth === 0 && (
          <div className="flex items-center gap-3 mt-2">
            <button onClick={onResolve} className="text-xs text-zinc-500 hover:text-emerald-400 transition-colors">
              Resolve
            </button>
          </div>
        )}
      </div>

      {/* Recursive replies */}
      {replies.length > 0 && (
        <div className={depth > 0 ? 'ml-3 border-l border-zinc-800' : ''}>
          {replies.map((reply) => (
            <CommentThread
              key={reply.id}
              comment={reply}
              childrenMap={childrenMap}
              depth={depth + 1}
              onResolve={onResolve}
              onReply={onReply}
            />
          ))}
        </div>
      )}

      {/* Always-visible reply input at the bottom of the thread */}
      <div className={`px-3 py-2 ${depth === 0 ? 'bg-zinc-850/30 border-t border-zinc-700/30' : 'bg-zinc-800/10'}`}>
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && replyText.trim()) handleReply();
            }}
            placeholder={depth === 0 ? 'Reply to this thread...' : 'Reply...'}
            className="flex-1 px-2.5 py-1.5 bg-zinc-800 border border-zinc-700/50 rounded text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-blue-500/50 focus:border-zinc-600 transition-all duration-150"
          />
          {replyText.trim() && (
            <button
              onClick={handleReply}
              className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded transition-all duration-150 active:scale-95 animate-scale-in"
            >
              Send
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
