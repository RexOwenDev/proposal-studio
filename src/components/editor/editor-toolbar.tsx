'use client';

import { useState } from 'react';

interface PresenceUser {
  email: string;
  joinedAt: string;
}

interface EditorToolbarProps {
  title: string;
  status: string;
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
  onToggleSections: () => void;
  onPublish: (publish: boolean) => void;
  onExportPDF?: () => void;
  onExportWarning?: () => void;
  onBack: () => void;
  slug: string;
  proposalId?: string;
  onlineUsers?: PresenceUser[];
  typingUsers?: string[];
  currentUserEmail?: string | null;
  isPublishing?: boolean;
  onToggleComments?: () => void;
}

const statusColors: Record<string, string> = {
  draft: 'bg-yellow-900/50 text-yellow-300 border-yellow-700',
  published: 'bg-emerald-900/50 text-emerald-300 border-emerald-700',
};

export default function EditorToolbar({
  title,
  status,
  saveStatus,
  onToggleSections,
  onPublish,
  onExportPDF,
  onExportWarning,
  onBack,
  slug,
  proposalId,
  onlineUsers = [],
  typingUsers,
  currentUserEmail,
  isPublishing = false,
  onToggleComments,
}: EditorToolbarProps) {
  const [showPublishDialog, setShowPublishDialog] = useState(false);
  const [showUrlCopied, setShowUrlCopied] = useState(false);
  const isPublished = status === 'published';

  async function handleExport() {
    if (!proposalId) return;
    const res = await fetch(`/api/proposals/${proposalId}/export`);
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title ?? 'proposal'}.html`;
    a.click();
    URL.revokeObjectURL(url);
    if (res.headers.get('X-Has-Scripts') === '1') {
      onExportWarning?.();
    }
  }

  function handlePublishClick() {
    if (isPublished) {
      // Unpublish immediately
      onPublish(false);
    } else {
      setShowPublishDialog(true);
    }
  }

  function confirmPublish() {
    onPublish(true);
    setShowPublishDialog(false);
  }

  function copyPublicUrl() {
    const url = `${window.location.origin}/p/${slug}`;
    navigator.clipboard.writeText(url);
    setShowUrlCopied(true);
    setTimeout(() => setShowUrlCopied(false), 2000);
  }

  return (
    <>
      <div className="fixed top-0 left-0 right-0 z-50 h-14 bg-zinc-900/95 backdrop-blur border-b border-zinc-800 px-2 sm:px-4 flex items-center justify-between gap-1 sm:gap-2">
        {/* Left: Nav + title */}
        <div className="flex items-center gap-1.5 sm:gap-3 min-w-0">
          <button
            onClick={onBack}
            className="px-2 py-1 text-xs text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-md transition-colors border border-zinc-700 shrink-0"
          >
            Back
          </button>
          <a
            href="/"
            className="hidden sm:inline-flex px-2 py-1 text-xs text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-md transition-colors border border-zinc-700 shrink-0"
          >
            Home
          </a>
          <span className="text-white text-sm font-medium truncate max-w-[72px] sm:max-w-[200px]">
            {title}
          </span>
          <span className={`hidden sm:inline text-xs px-2 py-0.5 rounded border shrink-0 ${statusColors[status] || ''}`}>
            {status}
          </span>
        </div>

        {/* Center: Panel toggles */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          <button
            onClick={onToggleSections}
            className="px-2 sm:px-3 py-1.5 text-xs sm:text-sm text-zinc-300 hover:text-white hover:bg-zinc-800 rounded-md transition-colors"
          >
            Sections
          </button>
          <button
            onClick={onToggleComments}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg text-xs transition-colors"
            aria-label="Toggle comments"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 0 1 .865-.501 48.172 48.172 0 0 0 3.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
            </svg>
            Comments
          </button>
        </div>

        {/* Presence: who's online */}
        {onlineUsers.length > 0 && (
          <div className="hidden sm:flex items-center gap-0.5 shrink-0">
            {onlineUsers
              .filter((u) => u.email !== currentUserEmail)
              .slice(0, 4)
              .map((u) => (
                <div
                  key={u.email}
                  className="w-6 h-6 rounded-full bg-emerald-600 flex items-center justify-center text-white text-[10px] font-medium border-2 border-zinc-900 -ml-1 first:ml-0 transition-all duration-200"
                  title={`${u.email} is viewing`}
                >
                  {u.email[0].toUpperCase()}
                </div>
              ))}
            {onlineUsers.filter((u) => u.email !== currentUserEmail).length > 0 && (
              <span className="text-[10px] text-emerald-400 ml-1.5 font-medium">
                {onlineUsers.filter((u) => u.email !== currentUserEmail).length} online
              </span>
            )}
          </div>
        )}

        {/* Typing indicator */}
        {typingUsers && typingUsers.length > 0 && (
          <div aria-live="polite" aria-atomic="true" className="hidden sm:flex items-center gap-1.5 text-xs text-zinc-400 shrink-0">
            <span aria-hidden="true" className="flex gap-0.5 items-end">
              <span className="w-1 h-1 bg-zinc-400 rounded-full animate-bounce [animation-delay:0ms]" />
              <span className="w-1 h-1 bg-zinc-400 rounded-full animate-bounce [animation-delay:150ms]" />
              <span className="w-1 h-1 bg-zinc-400 rounded-full animate-bounce [animation-delay:300ms]" />
            </span>
            <span>
              {typingUsers[0].split('@')[0]}
              {typingUsers.length > 1 ? ` +${typingUsers.length - 1}` : ''}
              {' '}typing&hellip;
            </span>
          </div>
        )}

        {/* Right: Status + actions */}
        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
          <span className="text-xs text-zinc-500 hidden sm:inline">
            {saveStatus === 'saving' && 'Saving...'}
            {saveStatus === 'saved' && 'Saved'}
            {saveStatus === 'error' && (
              <span className="text-red-400">Failed</span>
            )}
          </span>

          {isPublished && (
            <button
              onClick={copyPublicUrl}
              className="hidden sm:inline-flex px-2.5 py-1.5 text-xs text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-700 rounded-md transition-colors border border-zinc-700"
            >
              {showUrlCopied ? 'Copied!' : 'Copy URL'}
            </button>
          )}

          {proposalId && (
            <button
              onClick={handleExport}
              className="hidden sm:inline-flex px-2.5 py-1.5 text-xs text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-700 rounded-md transition-colors border border-zinc-700"
            >
              Export HTML
            </button>
          )}

          <button
            onClick={handlePublishClick}
            disabled={isPublishing}
            className={`px-3 sm:px-4 py-1.5 text-xs sm:text-sm font-medium rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
              isPublished
                ? 'bg-zinc-700 hover:bg-zinc-600 text-zinc-200'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white'
            }`}
          >
            {isPublishing ? '...' : isPublished ? 'Unpublish' : 'Publish'}
          </button>
        </div>
      </div>

      {/* Publish confirmation dialog */}
      {showPublishDialog && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60">
          <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-6 max-w-sm mx-4">
            <h3 className="text-white font-medium mb-2">Publish this proposal?</h3>
            <p className="text-zinc-400 text-sm mb-4">
              It will be accessible to anyone with the link.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowPublishDialog(false)}
                className="px-4 py-2 text-sm text-zinc-300 hover:text-white bg-zinc-800 rounded-md transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmPublish}
                className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-500 rounded-md transition-colors"
              >
                Publish
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
