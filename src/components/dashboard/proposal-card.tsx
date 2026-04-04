'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { Proposal } from '@/lib/types';
import { formatDate } from '@/lib/utils';

const statusColors: Record<string, string> = {
  draft: 'bg-amber-50 text-amber-700 border-amber-200',
  review: 'bg-blue-50 text-blue-700 border-blue-200',
  approved: 'bg-purple-50 text-purple-700 border-purple-200',
  published: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

interface Props {
  proposal: Proposal;
  blockCount: number;
  unresolvedComments?: number;
}

export default function ProposalCard({ proposal, blockCount, unresolvedComments = 0 }: Props) {
  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [duplicateLabel, setDuplicateLabel] = useState('Duplicate');
  const [copied, setCopied] = useState(false);
  const router = useRouter();
  const isPublished = proposal.status === 'published';

  const handleDelete = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowDelete(true);
  }, []);

  const confirmDelete = useCallback(async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/proposals/${proposal.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
    } catch {
      setDeleting(false);
      setShowDelete(false);
      return;
    }
    setShowDelete(false);
    router.refresh();
  }, [proposal.id, router]);

  const handleCopyLink = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    navigator.clipboard.writeText(`${window.location.origin}/p/${proposal.slug}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [proposal.slug]);

  const handlePreview = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    window.open(`/p/${proposal.slug}`, '_blank', 'noopener');
  }, [proposal.slug]);

  const handleDuplicate = useCallback(async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDuplicating(true);
    setDuplicateLabel('Duplicating…');
    try {
      const res = await fetch(`/api/proposals/${proposal.id}/duplicate`, { method: 'POST' });
      if (res.ok) {
        setDuplicateLabel('Done ✓');
        router.refresh();
        setTimeout(() => setDuplicateLabel('Duplicate'), 2000);
      } else {
        setDuplicateLabel('Failed');
        setTimeout(() => setDuplicateLabel('Duplicate'), 2000);
      }
    } catch {
      setDuplicateLabel('Failed');
      setTimeout(() => setDuplicateLabel('Duplicate'), 2000);
    } finally {
      setDuplicating(false);
    }
  }, [proposal.id, router]);

  return (
    <>
      <div
        onClick={() => router.push(`/p/${proposal.slug}/edit`)}
        className="bg-white border border-gray-200 rounded-xl p-5 hover:border-gray-300 hover:shadow-md transition-all duration-200 ease-out group cursor-pointer relative flex flex-col hover:-translate-y-0.5 active:translate-y-0 active:shadow-none"
      >
        <div className="flex items-start justify-between mb-3">
          <h2 className="text-gray-900 font-semibold group-hover:text-blue-600 transition-colors duration-150 truncate pr-2 text-sm leading-snug">
            {proposal.title}
          </h2>
          <span className={`text-xs px-2 py-0.5 rounded-full border shrink-0 capitalize font-medium ${statusColors[proposal.status] || 'bg-gray-100 text-gray-500 border-gray-200'}`}>
            {proposal.status}
          </span>
        </div>

        <div className="flex items-center gap-2.5 text-gray-400 text-xs mt-auto pt-2 flex-wrap">
          {proposal.created_by_email && (
            <>
              <span className="truncate max-w-[120px]" title={proposal.created_by_email}>
                {proposal.created_by_email.split('@')[0]}
              </span>
              <span className="text-gray-300">·</span>
            </>
          )}
          <span>{blockCount} sections</span>
          {unresolvedComments > 0 && (
            <>
              <span className="text-gray-300">·</span>
              <span className="inline-flex items-center gap-1 text-amber-500 font-medium">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z" />
                </svg>
                {unresolvedComments}
              </span>
            </>
          )}
          <span className="text-gray-300">·</span>
          <span>{formatDate(proposal.updated_at)}</span>
        </div>

        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100 opacity-0 group-hover:opacity-100 transition-all duration-200 translate-y-1 group-hover:translate-y-0">
          {isPublished && (
            <button
              onClick={handleCopyLink}
              className="text-xs px-2.5 py-1 text-gray-500 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors duration-150 active:scale-95"
            >
              {copied ? 'Copied!' : 'Copy link'}
            </button>
          )}
          {isPublished && (
            <button
              onClick={handlePreview}
              className="text-xs px-2.5 py-1 text-gray-500 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors duration-150 active:scale-95"
            >
              Preview ↗
            </button>
          )}
          <div className="flex-1" />
          <button
            onClick={handleDuplicate}
            disabled={duplicating}
            className="text-xs px-2 py-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors duration-150 active:scale-95 disabled:opacity-50"
            title="Duplicate as new draft"
          >
            {duplicateLabel}
          </button>
          <button
            onClick={handleDelete}
            className="text-xs px-2 py-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors duration-150 active:scale-95"
          >
            Delete
          </button>
        </div>
      </div>

      {showDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 animate-in fade-in duration-150"
          onClick={(e) => { e.stopPropagation(); setShowDelete(false); }}
        >
          <div
            className="bg-white border border-gray-200 rounded-xl p-6 max-w-sm mx-4 shadow-xl animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-gray-900 font-semibold mb-1">Delete this proposal?</h3>
            <p className="text-gray-700 text-sm mb-1 font-medium">{proposal.title}</p>
            <p className="text-gray-400 text-xs mb-5">
              This will permanently remove the proposal, all sections, and comments.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowDelete(false)}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors duration-150 active:scale-95"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleting}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-500 disabled:opacity-50 rounded-lg transition-colors duration-150 active:scale-95"
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
