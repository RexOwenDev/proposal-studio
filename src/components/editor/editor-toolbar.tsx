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
  onToggleComments: () => void;
  onPublish: (publish: boolean) => void;
  onSetStatus?: (status: string) => void; // T2: advance workflow status
  onExportPDF?: () => void;               // Print iframe content as PDF
  onBack: () => void;
  slug: string;
  proposalId?: string; // T1: for export link
  onlineUsers?: PresenceUser[];
  currentUserEmail?: string | null;
  isPublishing?: boolean;
}

const statusColors: Record<string, string> = {
  draft: 'bg-yellow-900/50 text-yellow-300 border-yellow-700',
  review: 'bg-blue-900/50 text-blue-300 border-blue-700',
  approved: 'bg-purple-900/50 text-purple-300 border-purple-700',
  published: 'bg-emerald-900/50 text-emerald-300 border-emerald-700',
};

// T2: next logical status in the review workflow
const nextStatus: Record<string, { label: string; value: string }> = {
  draft: { label: 'Submit for Review', value: 'review' },
  review: { label: 'Approve', value: 'approved' },
  approved: { label: 'Publish', value: 'published' },
};

export default function EditorToolbar({
  title,
  status,
  saveStatus,
  onToggleSections,
  onToggleComments,
  onPublish,
  onSetStatus,
  onExportPDF,
  onBack,
  slug,
  proposalId,
  onlineUsers = [],
  currentUserEmail,
  isPublishing = false,
}: EditorToolbarProps) {
  const [showPublishDialog, setShowPublishDialog] = useState(false);
  const [showUrlCopied, setShowUrlCopied] = useState(false);
  const isPublished = status === 'published';

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
          <span className="text-white text-sm font-medium truncate max-w-[100px] sm:max-w-[200px]">
            {title}
          </span>
          <span className={`text-xs px-2 py-0.5 rounded border shrink-0 ${statusColors[status] || ''}`}>
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
            className="px-2 sm:px-3 py-1.5 text-xs sm:text-sm text-zinc-300 hover:text-white hover:bg-zinc-800 rounded-md transition-colors"
          >
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

        {/* Right: Status + actions */}
        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
          <span className="text-xs text-zinc-500 hidden sm:inline">
            {saveStatus === 'saving' && 'Saving...'}
            {saveStatus === 'saved' && 'Saved'}
            {saveStatus === 'error' && (
              <span className="text-red-400">Failed</span>
            )}
          </span>

          {/* T1: Export — HTML download + PDF print */}
          {proposalId && (
            <a
              href={`/api/proposals/${proposalId}/export`}
              download
              className="hidden sm:inline-flex px-2.5 py-1.5 text-xs text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-700 rounded-md transition-colors border border-zinc-700"
              title="Download as static HTML file"
            >
              HTML
            </a>
          )}
          {onExportPDF && (
            <button
              onClick={onExportPDF}
              className="hidden sm:inline-flex px-2.5 py-1.5 text-xs text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-700 rounded-md transition-colors border border-zinc-700"
              title="Print / Save as PDF"
            >
              PDF
            </button>
          )}

          {isPublished && (
            <button
              onClick={copyPublicUrl}
              className="hidden sm:inline-flex px-2.5 py-1.5 text-xs text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-700 rounded-md transition-colors border border-zinc-700"
            >
              {showUrlCopied ? 'Copied!' : 'Copy URL'}
            </button>
          )}

          {/* T2: Workflow advance button (draft→review→approved) */}
          {!isPublished && nextStatus[status] && onSetStatus && (
            <button
              onClick={() => onSetStatus(nextStatus[status].value)}
              disabled={isPublishing}
              className="inline-flex px-3 py-1.5 text-xs font-medium text-zinc-200 bg-zinc-700 hover:bg-zinc-600 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {nextStatus[status].label}
            </button>
          )}

          <button
            onClick={handlePublishClick}
            disabled={isPublishing}
            className={`px-3 sm:px-4 py-1.5 text-xs sm:text-sm font-medium rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
              isPublished
                ? 'bg-zinc-700 hover:bg-zinc-600 text-zinc-200'
                : status === 'approved'
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                  : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700'
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
