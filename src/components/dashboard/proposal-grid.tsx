'use client';

import { useState, useMemo } from 'react';
import type { Proposal } from '@/lib/types';
import ProposalCard from '@/components/dashboard/proposal-card';

interface Props {
  proposals: (Proposal & { content_blocks: { id: string }[] })[];
  unresolvedCounts: Record<string, number>;
}

const ALL_STATUSES = ['draft', 'review', 'approved', 'published'] as const;

export default function ProposalGrid({ proposals, unresolvedCounts }: Props) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return proposals.filter((p) => {
      const matchesSearch = !q || p.title.toLowerCase().includes(q);
      const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [proposals, search, statusFilter]);

  return (
    <>
      {/* Search + filter bar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none"
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
          </svg>
          <input
            type="text"
            placeholder="Search proposals…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm bg-zinc-900 border border-zinc-700 rounded-md text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-colors"
          />
        </div>

        <div className="flex gap-1.5 flex-wrap">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 text-xs rounded-md border transition-colors ${
              statusFilter === 'all'
                ? 'bg-blue-600 border-blue-500 text-white'
                : 'bg-zinc-900 border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-600'
            }`}
          >
            All
          </button>
          {ALL_STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 text-xs rounded-md border transition-colors capitalize ${
                statusFilter === s
                  ? 'bg-blue-600 border-blue-500 text-white'
                  : 'bg-zinc-900 border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-600'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Results */}
      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-zinc-500 text-sm">
            {search || statusFilter !== 'all'
              ? 'No proposals match your filters.'
              : 'No proposals yet.'}
          </p>
          {(search || statusFilter !== 'all') && (
            <button
              onClick={() => { setSearch(''); setStatusFilter('all'); }}
              className="mt-3 text-xs text-blue-400 hover:text-blue-300 transition-colors"
            >
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 stagger-children">
          {filtered.map((proposal) => (
            <ProposalCard
              key={proposal.id}
              proposal={proposal}
              blockCount={proposal.content_blocks?.length || 0}
              unresolvedComments={unresolvedCounts[proposal.id] || 0}
            />
          ))}
        </div>
      )}

      {/* Result count */}
      {proposals.length > 0 && (
        <p className="text-xs text-zinc-600 mt-4 text-center">
          {filtered.length === proposals.length
            ? `${proposals.length} proposal${proposals.length !== 1 ? 's' : ''}`
            : `${filtered.length} of ${proposals.length} proposals`}
        </p>
      )}
    </>
  );
}
