'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { Proposal } from '@/lib/types';
import { formatDate } from '@/lib/utils';

const statusColors: Record<string, string> = {
  draft: 'bg-yellow-900/50 text-yellow-300 border-yellow-700',
  review: 'bg-blue-900/50 text-blue-300 border-blue-700',
  published: 'bg-emerald-900/50 text-emerald-300 border-emerald-700',
};

export default function ProposalCard({ proposal }: { proposal: Proposal }) {
  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const router = useRouter();

  async function handleDelete(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setShowDelete(true);
  }

  async function confirmDelete() {
    setDeleting(true);
    const supabase = createClient();
    await supabase.from('proposals').delete().eq('id', proposal.id);
    setShowDelete(false);
    router.refresh();
  }

  return (
    <>
      <div
        onClick={() => router.push(`/p/${proposal.slug}/edit`)}
        className="block bg-zinc-900 border border-zinc-800 rounded-lg p-5 hover:border-zinc-600 transition-colors group cursor-pointer relative"
      >
        <div className="flex items-start justify-between mb-3">
          <h2 className="text-white font-medium group-hover:text-blue-400 transition-colors truncate pr-2">
            {proposal.title}
          </h2>
          <div className="flex items-center gap-2 shrink-0">
            <span
              className={`text-xs px-2 py-0.5 rounded border ${statusColors[proposal.status]}`}
            >
              {proposal.status}
            </span>
            <button
              onClick={handleDelete}
              className="opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-red-400 transition-all text-xs px-1.5 py-0.5 rounded hover:bg-red-950/50"
              title="Delete proposal"
            >
              Delete
            </button>
          </div>
        </div>
        <p className="text-zinc-500 text-xs">
          Updated {formatDate(proposal.updated_at)}
        </p>
      </div>

      {/* Delete confirmation */}
      {showDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onClick={(e) => { e.stopPropagation(); setShowDelete(false); }}
        >
          <div
            className="bg-zinc-900 border border-zinc-700 rounded-lg p-6 max-w-sm mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-white font-medium mb-2">Delete this proposal?</h3>
            <p className="text-zinc-400 text-sm mb-1 font-medium">{proposal.title}</p>
            <p className="text-zinc-500 text-xs mb-4">
              This will permanently remove the proposal and all its blocks, comments, and edits. This cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowDelete(false)}
                className="px-4 py-2 text-sm text-zinc-300 hover:text-white bg-zinc-800 rounded-md transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleting}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-500 disabled:opacity-50 rounded-md transition-colors"
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
