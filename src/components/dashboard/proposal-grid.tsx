'use client';

import { useState, useMemo, useRef } from 'react';
import type { Proposal } from '@/lib/types';
import ProposalCard from '@/components/dashboard/proposal-card';

interface Props {
  proposals: (Proposal & { content_blocks: { id: string }[] })[];
}

const ALL_STATUSES = ['draft', 'published'] as const;

export default function ProposalGrid({ proposals }: Props) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const searchInputRef = useRef<HTMLInputElement>(null);

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
          <button
            type="button"
            onClick={() => searchInputRef.current?.focus()}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
            tabIndex={-1}
            aria-label="Focus search"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
            </svg>
          </button>
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search proposals…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm bg-white border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-colors shadow-sm"
          />
        </div>

        <div className="flex gap-1.5 flex-wrap">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 text-xs rounded-lg border transition-colors font-medium ${
              statusFilter === 'all'
                ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                : 'bg-white border-gray-200 text-gray-500 hover:text-gray-900 hover:border-gray-300 shadow-sm'
            }`}
          >
            All
          </button>
          {ALL_STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 text-xs rounded-lg border transition-colors capitalize font-medium ${
                statusFilter === s
                  ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                  : 'bg-white border-gray-200 text-gray-500 hover:text-gray-900 hover:border-gray-300 shadow-sm'
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
          <p className="text-gray-400 text-sm">
            {search || statusFilter !== 'all'
              ? 'No proposals match your filters.'
              : 'No proposals yet.'}
          </p>
          {(search || statusFilter !== 'all') && (
            <button
              onClick={() => { setSearch(''); setStatusFilter('all'); }}
              className="mt-3 text-xs text-blue-600 hover:text-blue-500 transition-colors"
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
            />
          ))}
        </div>
      )}

      {/* Result count */}
      {proposals.length > 0 && (
        <p className="text-xs text-gray-400 mt-4 text-center">
          {filtered.length === proposals.length
            ? `${proposals.length} proposal${proposals.length !== 1 ? 's' : ''}`
            : `${filtered.length} of ${proposals.length} proposals`}
        </p>
      )}
    </>
  );
}
