'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Comment } from '@/lib/types';
import type { SelectionData } from '@/components/editor/comment-trigger';

interface CommentPanelProps {
  open: boolean;
  proposalId: string;
  currentUserEmail: string | null;
  currentUserId: string | null;
  pendingSelection: SelectionData | null;
  onClose: () => void;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function CommentPanel({
  open,
  proposalId,
  currentUserEmail: _currentUserEmail,
  currentUserId,
  pendingSelection,
  onClose,
}: CommentPanelProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(false);
  const [newText, setNewText] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadComments = useCallback(async () => {
    if (!proposalId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/comments?proposalId=${proposalId}`);
      if (!res.ok) return;
      const data = await res.json();
      setComments(data.comments ?? []);
    } finally {
      setLoading(false);
    }
  }, [proposalId]);

  useEffect(() => { if (open) loadComments(); }, [open, loadComments]);
  useEffect(() => { setNewText(''); }, [pendingSelection]);

  async function handleSubmitNew() {
    if (!newText.trim() || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proposal_id: proposalId,
          block_id: pendingSelection?.blockId ?? null,
          text: newText.trim(),
          selected_text: pendingSelection?.text ?? null,
        }),
      });
      if (!res.ok) return;
      const created: Comment = await res.json();
      setComments((prev) => [...prev, created]);
      setNewText('');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSubmitReply(parentId: string) {
    if (!replyText.trim() || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proposal_id: proposalId, parent_id: parentId, text: replyText.trim() }),
      });
      if (!res.ok) return;
      const created: Comment = await res.json();
      setComments((prev) => [...prev, created]);
      setReplyText('');
      setReplyingTo(null);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResolve(commentId: string, resolved: boolean) {
    const res = await fetch(`/api/comments/${commentId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resolved }),
    });
    if (!res.ok) return;
    const updated: Comment = await res.json();
    setComments((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
  }

  async function handleDelete(commentId: string) {
    const res = await fetch(`/api/comments/${commentId}`, { method: 'DELETE' });
    if (!res.ok) return;
    setComments((prev) => prev.filter((c) => c.id !== commentId && c.parent_id !== commentId));
  }

  const topLevel = comments.filter((c) => !c.parent_id);
  const repliesFor = (parentId: string) => comments.filter((c) => c.parent_id === parentId);
  const unresolvedCount = topLevel.filter((c) => !c.resolved).length;

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/20"
          onClick={onClose}
          aria-hidden="true"
        />
      )}
      <div
        role="complementary"
        aria-label="Comments"
        className={`fixed top-14 right-0 bottom-0 z-40 w-80 bg-white border-l border-gray-200 flex flex-col shadow-xl transition-transform duration-200 ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 shrink-0">
          <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            Comments
            {unresolvedCount > 0 && (
              <span className="text-xs bg-blue-100 text-blue-700 rounded-full px-1.5 py-0.5 font-medium">
                {unresolvedCount}
              </span>
            )}
          </h2>
          <button
            onClick={onClose}
            aria-label="Close comments"
            className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* New comment input */}
        <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 shrink-0">
          {pendingSelection?.text && (
            <blockquote className="text-xs text-gray-400 italic border-l-2 border-blue-300 pl-2 mb-2 line-clamp-2">
              &ldquo;{pendingSelection.text}&rdquo;
            </blockquote>
          )}
          <textarea
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSubmitNew(); }}
            placeholder={pendingSelection ? 'Comment on selection\u2026 (\u2318\u21b5)' : 'Add a comment\u2026 (\u2318\u21b5)'}
            rows={3}
            className="w-full text-sm px-3 py-2 bg-white border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 resize-none"
          />
          <div className="flex justify-end mt-2">
            <button
              onClick={handleSubmitNew}
              disabled={!newText.trim() || submitting}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-200 disabled:text-gray-400 text-white text-xs font-medium rounded-lg transition-colors"
            >
              {submitting ? 'Posting\u2026' : 'Post'}
            </button>
          </div>
        </div>

        {/* Comment threads */}
        <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
          {loading && (
            <div className="flex justify-center py-8">
              <div className="w-5 h-5 border-2 border-gray-200 border-t-blue-500 rounded-full animate-spin" />
            </div>
          )}
          {!loading && topLevel.length === 0 && (
            <p className="text-center text-xs text-gray-400 py-10">No comments yet. Select text to comment.</p>
          )}

          {topLevel.map((comment) => (
            <div key={comment.id} className={`px-4 py-3 ${comment.resolved ? 'opacity-40' : ''}`}>
              {comment.selected_text && (
                <blockquote className="text-xs text-gray-400 italic border-l-2 border-blue-200 pl-2 mb-2 line-clamp-2">
                  &ldquo;{comment.selected_text}&rdquo;
                </blockquote>
              )}
              <p className="text-xs font-semibold text-gray-700">
                {comment.author_name}
                <span className="font-normal text-gray-400 ml-1.5">{formatTime(comment.created_at)}</span>
                {comment.edited_at && <span className="font-normal text-gray-400 ml-1">(edited)</span>}
              </p>
              <p className="text-sm text-gray-800 mt-1 break-words whitespace-pre-wrap">{comment.text}</p>
              <div className="flex items-center gap-3 mt-2 flex-wrap">
                <button onClick={() => setReplyingTo(replyingTo === comment.id ? null : comment.id)} className="text-xs text-gray-400 hover:text-gray-600 transition-colors">Reply</button>
                <button onClick={() => handleResolve(comment.id, !comment.resolved)} className={`text-xs transition-colors ${comment.resolved ? 'text-green-600 hover:text-gray-500' : 'text-gray-400 hover:text-green-600'}`}>
                  {comment.resolved ? '\u2713 Resolved' : 'Resolve'}
                </button>
                {comment.author_id === currentUserId && (
                  <button onClick={() => handleDelete(comment.id)} className="text-xs text-gray-300 hover:text-red-500 transition-colors ml-auto">Delete</button>
                )}
              </div>

              {/* Replies */}
              {repliesFor(comment.id).map((reply) => (
                <div key={reply.id} className="ml-4 mt-2 pl-3 border-l-2 border-gray-100">
                  <p className="text-xs font-semibold text-gray-700">
                    {reply.author_name}
                    <span className="font-normal text-gray-400 ml-1.5">{formatTime(reply.created_at)}</span>
                  </p>
                  <p className="text-sm text-gray-800 mt-0.5 break-words">{reply.text}</p>
                  {reply.author_id === currentUserId && (
                    <button onClick={() => handleDelete(reply.id)} className="text-xs text-gray-300 hover:text-red-500 transition-colors mt-1">Delete</button>
                  )}
                </div>
              ))}

              {/* Reply input */}
              {replyingTo === comment.id && (
                <div className="ml-4 mt-2">
                  <textarea
                    value={replyText}
                    autoFocus
                    onChange={(e) => setReplyText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSubmitReply(comment.id); }}
                    placeholder="Reply\u2026 (\u2318\u21b5)"
                    rows={2}
                    className="w-full text-xs px-2.5 py-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-400 resize-none"
                  />
                  <div className="flex gap-2 mt-1.5">
                    <button onClick={() => handleSubmitReply(comment.id)} disabled={!replyText.trim() || submitting} className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-200 text-white text-xs font-medium rounded-md transition-colors">Reply</button>
                    <button onClick={() => { setReplyingTo(null); setReplyText(''); }} className="px-2.5 py-1 text-gray-500 hover:text-gray-700 text-xs rounded-md transition-colors">Cancel</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
