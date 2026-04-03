'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
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
  onReaction: (commentId: string, emoji: string) => void;
  onScrollToHighlight: (commentId: string) => void;
  typingUsers: string[];
  onTypingChange: (isTyping: boolean) => void;
  currentUser: string;
}

export default function CommentPanel({
  open,
  comments,
  blocks,
  teamMembers,
  onClose,
  onAddReply,
  onResolveComment,
  onReaction,
  onScrollToHighlight,
  typingUsers,
  onTypingChange,
  currentUser,
}: CommentPanelProps) {
  const [showResolved, setShowResolved] = useState(false);

  if (!open) return null;

  // Top-level = parent comments (no parent_id)
  const topLevel = comments.filter((c) => !c.parent_id && !c.resolved);
  const resolved = comments.filter((c) => !c.parent_id && c.resolved);

  // Flat replies by parent_id (Google Docs style — no deep nesting)
  const repliesMap = new Map<string, Comment[]>();
  comments.filter((c) => c.parent_id).forEach((c) => {
    // Always attach to the ROOT parent (flatten all sub-sub-replies)
    let rootId = c.parent_id!;
    let parent = comments.find((p) => p.id === rootId);
    while (parent?.parent_id) {
      rootId = parent.parent_id;
      parent = comments.find((p) => p.id === rootId);
    }
    const list = repliesMap.get(rootId) || [];
    list.push(c);
    repliesMap.set(rootId, list);
  });

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
              onReply={(text) => onAddReply(comment.id, text)}
              onReaction={onReaction}
              onScrollToHighlight={comment.selected_text ? () => onScrollToHighlight(comment.id) : undefined}
              onTypingChange={onTypingChange}
              currentUser={currentUser}
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
 */
function CommentThread({
  comment,
  replies,
  blockLabel,
  onResolve,
  onReply,
  onReaction,
  onScrollToHighlight,
  onTypingChange,
  currentUser,
  teamMembers,
}: {
  comment: Comment;
  replies: Comment[];
  blockLabel?: string;
  onResolve: () => void;
  onReply: (text: string) => void;
  onReaction: (commentId: string, emoji: string) => void;
  onScrollToHighlight?: () => void;
  onTypingChange: (isTyping: boolean) => void;
  currentUser: string;
  teamMembers: string[];
}) {
  const [replyText, setReplyText] = useState('');
  const [showMentions, setShowMentions] = useState(false);
  const [showReactions, setShowReactions] = useState(false);
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const borderClass = getUserCommentBorder(comment.author_name || 'unknown');

  const reactions = comment.reactions || {};

  function handleReply() {
    if (!replyText.trim()) return;
    onReply(replyText.trim());
    setReplyText('');
    onTypingChange(false);
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
            {/* Name + time + resolve */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xs text-zinc-300 font-medium truncate">{comment.author_name}</span>
                <span className="text-[10px] text-zinc-600 shrink-0">{new Date(comment.created_at).toLocaleDateString()}</span>
              </div>
              <button
                onClick={onResolve}
                className="text-zinc-600 hover:text-emerald-400 transition-colors shrink-0"
                title="Resolve"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                </svg>
              </button>
            </div>

            {/* Comment text */}
            <p className="text-sm text-zinc-200 leading-relaxed mt-0.5">
              {renderText(comment.text, teamMembers)}
            </p>

            {/* Reactions */}
            {Object.keys(reactions).length > 0 && (
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
          </div>
        </div>
      </div>

      {/* Flat replies (all at same level — Google Docs style) */}
      {replies.map((reply) => (
        <div key={reply.id} data-reply className="px-4 py-2 border-t border-zinc-800/40">
          <div className="flex items-start gap-2.5">
            <div className="w-6 h-6 rounded-full bg-zinc-700 flex items-center justify-center text-white text-[10px] font-medium shrink-0 mt-0.5">
              {(reply.author_name || '?')[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-zinc-400 font-medium">{reply.author_name}</span>
                <span className="text-[10px] text-zinc-600">{new Date(reply.created_at).toLocaleDateString()}</span>
              </div>
              <p className="text-[13px] text-zinc-300 leading-relaxed mt-0.5">
                {renderText(reply.text, teamMembers)}
              </p>
            </div>
          </div>
        </div>
      ))}

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
