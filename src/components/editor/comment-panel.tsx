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

  const topLevel = comments.filter((c) => !c.parent_id && !c.resolved);
  const resolved = comments.filter((c) => !c.parent_id && c.resolved);

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

      <div className="fixed top-14 right-0 bottom-0 z-50 w-full sm:w-96 bg-zinc-900 border-l border-zinc-800 overflow-y-auto flex flex-col animate-slide-right">
        <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between shrink-0">
          <h3 className="text-white text-sm font-medium">
            Comments ({topLevel.length})
          </h3>
          <button onClick={onClose} className="text-zinc-400 hover:text-white text-sm transition-colors">&times;</button>
        </div>

        {typingUsers.length > 0 && (
          <div className="px-4 py-2 border-b border-zinc-800/50 bg-zinc-800/30">
            <p className="text-xs text-blue-400 animate-pulse">
              {typingUsers.map((u) => u.split('@')[0]).join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing...
            </p>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3">
          {highlightComments.map((comment) => (
            <CommentThread
              key={comment.id}
              comment={comment}
              childrenMap={childrenMap}
              depth={0}
              blockLabel={comment.block_id ? getBlockLabel(comment.block_id) : undefined}
              onResolve={onResolveComment}
              onReply={onAddReply}
              onReaction={onReaction}
              onScrollToHighlight={() => onScrollToHighlight(comment.id)}
              onTypingChange={onTypingChange}
              currentUser={currentUser}
              teamMembers={teamMembers}
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
                  onResolve={onResolveComment}
                  onReply={onAddReply}
                  onReaction={onReaction}
                  onTypingChange={onTypingChange}
                  currentUser={currentUser}
                  teamMembers={teamMembers}
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

/** Render comment text with @mentions highlighted */
function renderCommentText(text: string, teamMembers: string[]) {
  const parts = text.split(/(@\w+)/g);
  return parts.map((part, i) => {
    if (part.startsWith('@') && teamMembers.includes(part.slice(1).toLowerCase())) {
      return (
        <span key={i} className="text-blue-400 font-medium bg-blue-500/10 px-1 rounded">
          {part}
        </span>
      );
    }
    return part;
  });
}

/** Recursive comment thread — reply + resolve at EVERY depth */
function CommentThread({
  comment,
  childrenMap,
  depth,
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
  childrenMap: Map<string, Comment[]>;
  depth: number;
  blockLabel?: string;
  onResolve: (id: string, resolved: boolean) => void;
  onReply: (parentId: string, text: string) => void;
  onReaction: (commentId: string, emoji: string) => void;
  onScrollToHighlight?: () => void;
  onTypingChange: (isTyping: boolean) => void;
  currentUser: string;
  teamMembers: string[];
}) {
  const [replyText, setReplyText] = useState('');
  const [showMentions, setShowMentions] = useState(false);
  const [showReactions, setShowReactions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const replies = childrenMap.get(comment.id) || [];
  const borderClass = depth === 0
    ? getUserCommentBorder(comment.author_name || 'unknown')
    : 'border-l-zinc-700';

  const reactions = comment.reactions || {};

  // Cap visual depth to prevent infinite shrinking
  const visualDepth = Math.min(depth, 4);
  const indent = depth > 0 ? `ml-${Math.min(depth * 3, 12)}` : '';

  function handleReply() {
    if (!replyText.trim()) return;
    onReply(comment.id, replyText.trim());
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

  const prevReplyCount = useRef(replies.length);
  useEffect(() => {
    if (replies.length > prevReplyCount.current) {
      const el = document.querySelector(`[data-comment-thread="${replies[replies.length - 1].id}"]`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    prevReplyCount.current = replies.length;
  }, [replies.length, replies]);

  return (
    <div
      data-comment-thread={comment.id}
      className={`${depth === 0 ? `border-l-2 ${borderClass} rounded-md overflow-hidden` : indent} transition-all duration-200`}
    >
      <div className={`p-2.5 sm:p-3 ${
        depth === 0
          ? 'bg-zinc-800/40'
          : 'bg-zinc-800/20 border-l-2 border-zinc-700/50 rounded-r-md mt-1.5'
      }`}>
        {/* Highlighted text — root only */}
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

        {/* Comment text with @mention rendering */}
        <p className={`leading-relaxed ${
          depth === 0 ? 'text-sm text-zinc-200' :
          depth === 1 ? 'text-[13px] text-zinc-300' :
          'text-xs text-zinc-400'
        }`}>
          {renderCommentText(comment.text, teamMembers)}
        </p>

        {/* Reactions */}
        {Object.keys(reactions).length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {Object.entries(reactions).map(([emoji, users]) => (
              <button
                key={emoji}
                onClick={() => onReaction(comment.id, emoji)}
                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[11px] border transition-all duration-150 active:scale-95 ${
                  users.includes(currentUser)
                    ? 'bg-blue-500/15 border-blue-500/30 text-blue-300'
                    : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-600'
                }`}
                title={users.join(', ')}
              >
                <span>{emoji}</span>
                <span className="font-medium">{users.length}</span>
              </button>
            ))}
          </div>
        )}

        {/* Actions — Reply + Resolve at EVERY depth */}
        <div className="flex items-center gap-2 mt-2">
          <button
            onClick={() => setShowReactions(!showReactions)}
            className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
            title="Add reaction"
          >
            😊
          </button>
          <button
            onClick={() => onResolve(comment.id, true)}
            className="text-xs text-zinc-500 hover:text-emerald-400 transition-colors"
          >
            Resolve
          </button>
        </div>

        {/* Reaction picker */}
        {showReactions && (
          <div className="flex gap-1 mt-2 p-1.5 bg-zinc-800 rounded-lg border border-zinc-700 animate-scale-in w-fit">
            {REACTION_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => { onReaction(comment.id, emoji); setShowReactions(false); }}
                className="w-7 h-7 flex items-center justify-center rounded hover:bg-zinc-700 transition-colors text-sm active:scale-90"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Recursive replies with proper indentation */}
      {replies.map((reply) => (
        <CommentThread
          key={reply.id}
          comment={reply}
          childrenMap={childrenMap}
          depth={depth + 1}
          onResolve={onResolve}
          onReply={onReply}
          onReaction={onReaction}
          onTypingChange={onTypingChange}
          currentUser={currentUser}
          teamMembers={teamMembers}
        />
      ))}

      {/* Reply input with @mention autocomplete */}
      <div className={`px-2.5 sm:px-3 py-2 relative ${depth === 0 ? 'border-t border-zinc-700/30' : `${indent} mt-1`}`}>
        {showMentions && (
          <div className="absolute bottom-full left-3 mb-1 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl py-1 z-10 animate-scale-in max-h-32 overflow-y-auto">
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

        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={replyText}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && replyText.trim()) handleReply();
            }}
            placeholder={depth === 0 ? 'Reply... (@ to mention)' : 'Reply...'}
            className={`flex-1 px-2.5 py-1.5 bg-zinc-800 border border-zinc-700/50 rounded text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-blue-500/50 focus:border-zinc-600 transition-all duration-150 ${
              depth > 2 ? 'text-[11px]' : ''
            }`}
          />
          {replyText.trim() && (
            <button
              onClick={handleReply}
              className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded transition-all duration-150 active:scale-95 animate-scale-in shrink-0"
            >
              Send
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
