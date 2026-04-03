'use client';

import { useState } from 'react';
import type { Comment, ContentBlock } from '@/lib/types';

interface CommentPanelProps {
  open: boolean;
  comments: Comment[];
  blocks: ContentBlock[];
  onClose: () => void;
  onAddComment: (blockId: string | null, text: string) => void;
  onResolveComment: (commentId: string, resolved: boolean) => void;
}

export default function CommentPanel({
  open,
  comments,
  blocks,
  onClose,
  onAddComment,
  onResolveComment,
}: CommentPanelProps) {
  const [newComment, setNewComment] = useState('');
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [showResolved, setShowResolved] = useState(false);

  if (!open) return null;

  const activeComments = comments.filter((c) => !c.resolved);
  const resolvedComments = comments.filter((c) => c.resolved);

  // Group comments by block
  const groupedComments = activeComments.reduce<Record<string, Comment[]>>((acc, comment) => {
    const key = comment.block_id || 'general';
    if (!acc[key]) acc[key] = [];
    acc[key].push(comment);
    return acc;
  }, {});

  function getBlockLabel(blockId: string): string {
    const block = blocks.find((b) => b.id === blockId);
    return block?.label || `Block ${(block?.block_order ?? 0) + 1}`;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!newComment.trim()) return;
    onAddComment(selectedBlockId, newComment.trim());
    setNewComment('');
    setSelectedBlockId(null);
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/30 animate-in"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed top-14 right-0 bottom-0 z-50 w-96 bg-zinc-900 border-l border-zinc-800 overflow-y-auto flex flex-col animate-slide-right">
        <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between shrink-0">
          <h3 className="text-white text-sm font-medium">
            Comments ({activeComments.length})
          </h3>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-white text-sm"
          >
            &times;
          </button>
        </div>

        {/* Comment list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {Object.entries(groupedComments).map(([blockId, blockComments]) => (
            <div key={blockId}>
              <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider mb-2">
                {blockId === 'general' ? 'General' : getBlockLabel(blockId)}
              </p>
              <div className="space-y-2">
                {blockComments.map((comment) => (
                  <div
                    key={comment.id}
                    className="bg-zinc-800/50 border border-zinc-700/50 rounded-md p-3"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-zinc-400 font-medium">
                        {comment.author_name}
                      </span>
                      <span className="text-xs text-zinc-600">
                        {new Date(comment.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-sm text-zinc-200">{comment.text}</p>
                    <button
                      onClick={() => onResolveComment(comment.id, true)}
                      className="mt-2 text-xs text-zinc-500 hover:text-emerald-400 transition-colors"
                    >
                      Resolve
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {activeComments.length === 0 && (
            <p className="text-zinc-500 text-sm text-center py-8">No comments yet.</p>
          )}

          {/* Resolved comments */}
          {resolvedComments.length > 0 && (
            <div>
              <button
                onClick={() => setShowResolved(!showResolved)}
                className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                {showResolved ? 'Hide' : 'Show'} resolved ({resolvedComments.length})
              </button>
              {showResolved && (
                <div className="mt-2 space-y-2">
                  {resolvedComments.map((comment) => (
                    <div
                      key={comment.id}
                      className="bg-zinc-800/30 border border-zinc-800 rounded-md p-3 opacity-60"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-zinc-500 font-medium line-through">
                          {comment.author_name}
                        </span>
                      </div>
                      <p className="text-sm text-zinc-400 line-through">{comment.text}</p>
                      <button
                        onClick={() => onResolveComment(comment.id, false)}
                        className="mt-2 text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
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

        {/* Add comment form */}
        <div className="shrink-0 border-t border-zinc-800 p-4">
          <form onSubmit={handleSubmit} className="space-y-3">
            <select
              value={selectedBlockId || ''}
              onChange={(e) => setSelectedBlockId(e.target.value || null)}
              className="w-full px-3 py-1.5 bg-zinc-800 border border-zinc-700 rounded-md text-zinc-300 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">General comment</option>
              {blocks.map((block) => (
                <option key={block.id} value={block.id}>
                  {block.label || `Block ${block.block_order + 1}`}
                </option>
              ))}
            </select>
            <div className="flex gap-2">
              <input
                type="text"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Add a comment..."
                className="flex-1 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-md text-white placeholder:text-zinc-500 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <button
                type="submit"
                disabled={!newComment.trim()}
                className="px-3 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm rounded-md transition-colors"
              >
                Send
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
