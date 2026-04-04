'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import type { Comment, ContentBlock } from '@/lib/types';
import { getUserCommentBorder } from '@/lib/user-colors';

const REACTION_EMOJIS = ['👍', '✅', '❤️', '👀', '🎯'];

interface CommentPanelProps {
  open: boolean;
  comments: Comment[];
  blocks: ContentBlock[];
  teamMembers: string[];
  onClose: () => void;
  onAddComment: (blockId: string | null, text: string, selectedText?: string) => void;
  onAddReply: (parentId: string, text: string) => void;
  onResolveComment: (commentId: string, resolved: boolean) => void;
  onDeleteComment: (commentId: string) => void;
  onEditComment: (commentId: string, text: string) => void;
  onReaction: (commentId: string, emoji: string) => void;
  onScrollToHighlight: (commentId: string) => void;
  typingUsers: string[];
  onTypingChange: (isTyping: boolean) => void;
  currentUser: string;
  currentUserId: string;
  isOwner: boolean;
}

export default function CommentPanel({
  open,
  comments,
  blocks,
  teamMembers,
  onClose,
  onAddReply,
  onResolveComment,
  onDeleteComment,
  onEditComment,
  onReaction,
  onScrollToHighlight,
  typingUsers,
  onTypingChange,
  currentUser,
  currentUserId,
  isOwner,
}: CommentPanelProps) {
  const [showResolved, setShowResolved] = useState(false);

  // Memoize thread computations — these run on every render otherwise (P2)
  const topLevel = useMemo(
    () => comments.filter((c) => !c.parent_id && !c.resolved),
    [comments],
  );
  const resolved = useMemo(
    () => comments.filter((c) => !c.parent_id && c.resolved),
    [comments],
  );
  const repliesMap = useMemo(() => {
    const map = new Map<string, Comment[]>();
    comments.filter((c) => c.parent_id).forEach((c) => {
      // Always attach to the ROOT parent (flatten all sub-sub-replies)
      let rootId = c.parent_id!;
      let parent = comments.find((p) => p.id === rootId);
      while (parent?.parent_id) {
        rootId = parent.parent_id;
        parent = comments.find((p) => p.id === rootId);
      }
      const list = map.get(rootId) || [];
      list.push(c);
      map.set(rootId, list);
    });
    return map;
  }, [comments]);

  // Hooks MUST be declared before any conditional return
  if (!open) return null;

  function getBlockLabel(blockId: string): string {
    const block = blocks.find((b) => b.id === blockId);
    return block?.label || `Block ${(block?.block_order || 0) + 1}`;
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30 animate-in" onClick={onClose} />

      <div className="fixed top-14 right-0 bottom-0 z-50 w-full sm:w-[380px] bg-zinc-900 border-l border-zinc-800 flex flex-col animate-slide-right">
        {/* Header */}
        <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between shrink-0">
          <h3 className="text-white text-sm font-medium">
            Comments ({topLevel.length})
          </h3>
          <button onClick={onClose} className="text-zinc-400 hover:text-white text-lg leading-none transition-colors">&times;</button>
        </div>

        {/* Typing indicator */}
        {typingUsers.length > 0 && (
          <div className="px-4 py-1.5 border-b border-zinc-800/50 bg-zinc-800/30">
            <p className="text-[11px] text-blue-400 animate-pulse">
              {typingUsers.map((u) => u.split('@')[0]).join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing...
            </p>
          </div>
        )}

        {/* Comment list */}
        <div className="flex-1 overflow-y-auto">
          {topLevel.map((comment) => (
            <CommentThread
              key={comment.id}
              comment={comment}
              replies={repliesMap.get(comment.id) || []}
              blockLabel={comment.block_id ? getBlockLabel(comment.block_id) : undefined}
              onResolve={() => onResolveComment(comment.id, true)}
              onDelete={() => onDeleteComment(comment.id)}
              onDeleteReply={(replyId) => onDeleteComment(replyId)}
              onEdit={(text) => onEditComment(comment.id, text)}
              onEditReply={(replyId, text) => onEditComment(replyId, text)}
              onReply={(text) => onAddReply(comment.id, text)}
              onReaction={onReaction}
              onScrollToHighlight={comment.selected_text ? () => onScrollToHighlight(comment.id) : undefined}
              onTypingChange={onTypingChange}
              currentUser={currentUser}
              currentUserId={currentUserId}
              isOwner={isOwner}
              teamMembers={teamMembers}
            />
          ))}

          {topLevel.length === 0 && (
            <div className="text-center py-16 px-6">
              <p className="text-zinc-500 text-sm">No comments yet</p>
              <p className="text-zinc-600 text-xs mt-1">Select text in the proposal to add a comment</p>
            </div>
          )}

          {/* Resolved */}
          {resolved.length > 0 && (
            <div className="border-t border-zinc-800 px-4 py-3">
              <button
                onClick={() => setShowResolved(!showResolved)}
                className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                {showResolved ? 'Hide' : 'Show'} resolved ({resolved.length})
              </button>
              {showResolved && (
                <div className="mt-2 space-y-1">
                  {resolved.map((comment) => (
                    <div key={comment.id} className="px-3 py-2 rounded bg-zinc-800/30 border border-zinc-800">
                      {comment.selected_text && (
                        <p className="text-zinc-600 text-[11px] italic truncate mb-0.5">&ldquo;{comment.selected_text.slice(0, 60)}&rdquo;</p>
                      )}
                      <p className="text-xs text-zinc-500 line-through">{comment.text}</p>
                      <button
                        onClick={() => onResolveComment(comment.id, false)}
                        className="text-[10px] text-zinc-600 hover:text-amber-400 transition-colors mt-1"
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

/** Render @mentions as blue badges */
function renderText(text: string, teamMembers: string[]) {
  const parts = text.split(/(@\w+)/g);
  return parts.map((part, i) => {
    if (part.startsWith('@') && teamMembers.includes(part.slice(1).toLowerCase())) {
      return (
        <span key={i} className="text-blue-400 font-medium bg-blue-500/10 px-0.5 rounded">
          {part}
        </span>
      );
    }
    return part;
  });
}

/**
 * Google Docs-style comment thread:
 * - One parent comment with highlighted text context
 * - Flat replies underneath (all same level, no deep nesting)
 * - Single reply input at the bottom
 * - Resolve button as checkmark on the parent
 * - Edit (pencil) is AUTHOR-ONLY — never shown on other people's comments
 */
function CommentThread({
  comment,
  replies,
  blockLabel,
  onResolve,
  onDelete,
  onDeleteReply,
  onEdit,
  onEditReply,
  onReply,
  onReaction,
  onScrollToHighlight,
  onTypingChange,
  currentUser,
  currentUserId,
  isOwner,
  teamMembers,
}: {
  comment: Comment;
  replies: Comment[];
  blockLabel?: string;
  onResolve: () => void;
  onDelete: () => void;
  onDeleteReply: (replyId: string) => void;
  onEdit: (text: string) => void;
  onEditReply: (replyId: string, text: string) => void;
  onReply: (text: string) => void;
  onReaction: (commentId: string, emoji: string) => void;
  onScrollToHighlight?: () => void;
  onTypingChange: (isTyping: boolean) => void;
  currentUser: string;   // email prefix, used for display only
  currentUserId: string; // Supabase UUID — used for authoritative edit/delete gating
  isOwner: boolean;
  teamMembers: string[];
}) {
  const [replyText, setReplyText] = useState('');
  const [showMentions, setShowMentions] = useState(false);
  const [showReactions, setShowReactions] = useState(false);
  const [focused, setFocused] = useState(false);
  const [replySending, setReplySending] = useState(false);

  // Edit state for the parent comment
  const [editingParent, setEditingParent] = useState(false);
  const [editParentText, setEditParentText] = useState('');
  const [editParentSaving, setEditParentSaving] = useState(false);

  // Edit state for replies: keyed by reply id
  const [editingReplyId, setEditingReplyId] = useState<string | null>(null);
  const [editReplyText, setEditReplyText] = useState('');
  const [editReplySaving, setEditReplySaving] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const editParentRef = useRef<HTMLTextAreaElement>(null);
  const editReplyRef = useRef<HTMLTextAreaElement>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const borderClass = getUserCommentBorder(comment.author_name || 'unknown');

  const reactions = comment.reactions || {};

  // Use UUID comparison — immune to name casing / display-name changes.
  // Falls back to name comparison for legacy comments that may lack author_id.
  const isParentAuthor = currentUserId
    ? comment.author_id === currentUserId
    : comment.author_name === currentUser;

  function startEditParent() {
    setEditParentText(comment.text);
    setEditingParent(true);
    // Focus after render
    setTimeout(() => editParentRef.current?.focus(), 0);
  }

  function cancelEditParent() {
    setEditingParent(false);
    setEditParentText('');
  }

  async function saveEditParent() {
    const trimmed = editParentText.trim();
    if (!trimmed || trimmed === comment.text || editParentSaving) return;
    setEditParentSaving(true);
    await onEdit(trimmed);
    setEditingParent(false);
    setEditParentSaving(false);
  }

  function startEditReply(reply: Comment) {
    setEditingReplyId(reply.id);
    setEditReplyText(reply.text);
    setTimeout(() => editReplyRef.current?.focus(), 0);
  }

  function cancelEditReply() {
    setEditingReplyId(null);
    setEditReplyText('');
  }

  async function saveEditReply(replyId: string) {
    const trimmed = editReplyText.trim();
    if (!trimmed || editReplySaving) return;
    setEditReplySaving(true);
    await onEditReply(replyId, trimmed);
    setEditingReplyId(null);
    setEditReplySaving(false);
  }

  async function handleReply() {
    if (!replyText.trim() || replySending) return;
    setReplySending(true);
    await onReply(replyText.trim());
    setReplyText('');
    onTypingChange(false);
    setReplySending(false);
  }

  const handleInputChange = useCallback((value: string) => {
    setReplyText(value);
    onTypingChange(true);
    clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => onTypingChange(false), 2000);
    const lastWord = value.split(/\s/).pop() || '';
    setShowMentions(lastWord.startsWith('@') && lastWord.length > 1);
  }, [onTypingChange]);

  function insertMention(name: string) {
    const words = replyText.split(/\s/);
    words[words.length - 1] = `@${name} `;
    setReplyText(words.join(' '));
    setShowMentions(false);
    inputRef.current?.focus();
  }

  // Auto-scroll to new replies
  const prevCount = useRef(replies.length);
  useEffect(() => {
    if (replies.length > prevCount.current) {
      const el = document.querySelector(`[data-comment-thread="${comment.id}"] [data-reply]:last-child`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    prevCount.current = replies.length;
  }, [replies.length, comment.id]);

  return (
    <div
      data-comment-thread={comment.id}
      className={`border-l-2 ${borderClass} border-b border-zinc-800/60 transition-all duration-200`}
    >
      {/* Highlighted text context — clickable to scroll to highlight */}
      {comment.selected_text && onScrollToHighlight && (
        <button
          onClick={onScrollToHighlight}
          className="w-full text-left px-4 pt-3 pb-1 group/hl"
        >
          <p className="text-zinc-500 text-[11px] italic leading-relaxed group-hover/hl:text-zinc-300 transition-colors truncate">
            &ldquo;{comment.selected_text.slice(0, 100)}&rdquo;
          </p>
          <p className="text-[10px] text-zinc-600 group-hover/hl:text-blue-400 transition-colors">
            Click to scroll to highlight{blockLabel ? ` · ${blockLabel}` : ''}
          </p>
        </button>
      )}

      {/* Parent comment */}
      <div className="px-4 py-2.5">
        <div className="flex items-start gap-2.5">
          {/* Avatar */}
          <div className="w-7 h-7 rounded-full bg-zinc-700 flex items-center justify-center text-white text-[11px] font-medium shrink-0 mt-0.5">
            {(comment.author_name || '?')[0].toUpperCase()}
          </div>

          <div className="flex-1 min-w-0">
            {/* Name + time + actions */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xs text-zinc-300 font-medium truncate">{comment.author_name}</span>
                <span className="text-[10px] text-zinc-600 shrink-0">{new Date(comment.created_at).toLocaleDateString()}</span>
                {comment.edited_at && (
                  <span className="text-[10px] text-zinc-600 italic shrink-0">(edited)</span>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {/* Edit — author only, never shown on other people's comments */}
                {isParentAuthor && !editingParent && (
                  <button
                    onClick={startEditParent}
                    className="text-zinc-700 hover:text-blue-400 transition-colors p-0.5 rounded"
                    title="Edit comment"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" />
                    </svg>
                  </button>
                )}
                {/* Delete — author or proposal owner */}
                {(isOwner || isParentAuthor) && !editingParent && (
                  <button
                    onClick={onDelete}
                    className="text-zinc-700 hover:text-red-400 transition-colors p-0.5 rounded"
                    title="Delete comment"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                    </svg>
                  </button>
                )}
                {!editingParent && (
                  <button
                    onClick={onResolve}
                    className="text-zinc-600 hover:text-emerald-400 transition-colors p-0.5 rounded"
                    title="Resolve"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                  </button>
                )}
              </div>
            </div>

            {/* Comment text — or inline edit textarea */}
            {editingParent ? (
              <div className="mt-1.5">
                <textarea
                  ref={editParentRef}
                  value={editParentText}
                  onChange={(e) => setEditParentText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveEditParent(); }
                    if (e.key === 'Escape') cancelEditParent();
                  }}
                  rows={3}
                  className="w-full bg-zinc-800 border border-zinc-600 rounded-md text-sm text-zinc-100 px-2.5 py-1.5 focus:outline-none focus:border-blue-500 resize-none"
                  placeholder="Edit your comment…"
                />
                <div className="flex items-center gap-2 mt-1.5">
                  <button
                    onClick={saveEditParent}
                    disabled={editParentSaving || !editParentText.trim()}
                    className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-md transition-colors"
                  >
                    {editParentSaving ? 'Saving…' : 'Save'}
                  </button>
                  <button
                    onClick={cancelEditParent}
                    className="px-3 py-1 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-zinc-200 leading-relaxed mt-0.5">
                {renderText(comment.text, teamMembers)}
              </p>
            )}

            {/* Reactions */}
            {!editingParent && Object.keys(reactions).length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1.5">
                {Object.entries(reactions).map(([emoji, users]) => (
                  <button
                    key={emoji}
                    onClick={() => onReaction(comment.id, emoji)}
                    className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] border transition-all active:scale-95 ${
                      users.includes(currentUser)
                        ? 'bg-blue-500/15 border-blue-500/30 text-blue-300'
                        : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-600'
                    }`}
                    title={users.join(', ')}
                  >
                    {emoji} {users.length}
                  </button>
                ))}
              </div>
            )}

            {/* Reaction trigger */}
            {!editingParent && (
              <div className="mt-1.5">
                <button
                  onClick={() => setShowReactions(!showReactions)}
                  className="text-zinc-600 hover:text-zinc-400 transition-colors"
                  title="React"
                >
                  <span className="text-xs">😊</span>
                </button>
                {showReactions && (
                  <div className="inline-flex gap-0.5 ml-1 p-1 bg-zinc-800 rounded-lg border border-zinc-700 animate-scale-in">
                    {REACTION_EMOJIS.map((e) => (
                      <button
                        key={e}
                        onClick={() => { onReaction(comment.id, e); setShowReactions(false); }}
                        className="w-6 h-6 flex items-center justify-center rounded hover:bg-zinc-700 text-xs active:scale-90 transition-colors"
                      >
                        {e}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Flat replies (all at same level — Google Docs style) */}
      {replies.map((reply) => {
        const isReplyAuthor = currentUserId
          ? reply.author_id === currentUserId
          : reply.author_name === currentUser;
        const isEditingThisReply = editingReplyId === reply.id;

        return (
          <div key={reply.id} data-reply className="px-4 py-2 border-t border-zinc-800/40">
            <div className="flex items-start gap-2.5">
              <div className="w-6 h-6 rounded-full bg-zinc-700 flex items-center justify-center text-white text-[10px] font-medium shrink-0 mt-0.5">
                {(reply.author_name || '?')[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-zinc-400 font-medium">{reply.author_name}</span>
                    <span className="text-[10px] text-zinc-600">{new Date(reply.created_at).toLocaleDateString()}</span>
                    {reply.edited_at && (
                      <span className="text-[10px] text-zinc-600 italic">(edited)</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {/* Edit — reply author only */}
                    {isReplyAuthor && !isEditingThisReply && (
                      <button
                        onClick={() => startEditReply(reply)}
                        className="text-zinc-700 hover:text-blue-400 transition-colors p-0.5 rounded"
                        title="Edit reply"
                      >
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" />
                        </svg>
                      </button>
                    )}
                    {/* Delete — reply author or proposal owner */}
                    {(isOwner || isReplyAuthor) && !isEditingThisReply && (
                      <button
                        onClick={() => onDeleteReply(reply.id)}
                        className="text-zinc-700 hover:text-red-400 transition-colors p-0.5 rounded shrink-0"
                        title="Delete reply"
                      >
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>

                {/* Reply text — or inline edit */}
                {isEditingThisReply ? (
                  <div className="mt-1.5">
                    <textarea
                      ref={editReplyRef}
                      value={editReplyText}
                      onChange={(e) => setEditReplyText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveEditReply(reply.id); }
                        if (e.key === 'Escape') cancelEditReply();
                      }}
                      rows={2}
                      className="w-full bg-zinc-800 border border-zinc-600 rounded-md text-[13px] text-zinc-100 px-2.5 py-1.5 focus:outline-none focus:border-blue-500 resize-none"
                      placeholder="Edit your reply…"
                    />
                    <div className="flex items-center gap-2 mt-1">
                      <button
                        onClick={() => saveEditReply(reply.id)}
                        disabled={editReplySaving || !editReplyText.trim()}
                        className="px-2.5 py-0.5 text-[11px] bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-md transition-colors"
                      >
                        {editReplySaving ? 'Saving…' : 'Save'}
                      </button>
                      <button
                        onClick={cancelEditReply}
                        className="px-2.5 py-0.5 text-[11px] text-zinc-400 hover:text-zinc-200 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-[13px] text-zinc-300 leading-relaxed mt-0.5">
                    {renderText(reply.text, teamMembers)}
                  </p>
                )}
              </div>
            </div>
          </div>
        );
      })}

      {/* Single reply input at the bottom — Google Docs style */}
      <div className="px-4 py-2 border-t border-zinc-800/30 relative">
        {/* @mention dropdown */}
        {showMentions && (
          <div className="absolute bottom-full left-4 mb-1 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl py-1 z-10 animate-scale-in max-h-28 overflow-y-auto min-w-[140px]">
            {teamMembers.filter((m) => {
              const lastWord = replyText.split(/\s/).pop() || '';
              return m.startsWith(lastWord.slice(1).toLowerCase());
            }).map((name) => (
              <button
                key={name}
                onClick={() => insertMention(name)}
                className="w-full text-left px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-700 hover:text-white transition-colors"
              >
                <span className="text-blue-400">@</span>{name}
              </button>
            ))}
          </div>
        )}

        <div className={`flex items-center gap-2 rounded-full border transition-all duration-150 px-3 py-1.5 ${
          focused ? 'border-zinc-600 bg-zinc-800' : 'border-zinc-700/50 bg-zinc-800/50'
        }`}>
          <input
            ref={inputRef}
            type="text"
            value={replyText}
            onChange={(e) => handleInputChange(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && replyText.trim()) handleReply();
            }}
            placeholder="Reply or add others with @"
            className="flex-1 bg-transparent text-xs text-white placeholder:text-zinc-500 focus:outline-none min-w-0"
          />
          {replyText.trim() && (
            <button
              onClick={handleReply}
              className="text-blue-400 hover:text-blue-300 transition-colors shrink-0"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M3.105 2.289a.75.75 0 0 0-.826.95l1.414 4.925A1.5 1.5 0 0 0 5.135 9.25h6.115a.75.75 0 0 1 0 1.5H5.135a1.5 1.5 0 0 0-1.442 1.086l-1.414 4.926a.75.75 0 0 0 .826.95 28.896 28.896 0 0 0 15.293-7.154.75.75 0 0 0 0-1.115A28.897 28.897 0 0 0 3.105 2.289Z" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
