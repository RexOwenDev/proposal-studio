'use client';

import { useState, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import type { Proposal } from '@/lib/types';
import ProposalCard from '@/components/dashboard/proposal-card';

interface Props {
  proposals: (Proposal & { content_blocks: { id: string }[] })[];
}

const ALL_STATUSES = ['draft', 'published'] as const;

type SortKey = 'newest' | 'oldest' | 'title-az';

export default function ProposalGrid({ proposals }: Props) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortKey, setSortKey] = useState<SortKey>('newest');
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkWorking, setBulkWorking] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const displayed = useMemo(() => {
    const q = search.toLowerCase().trim();
    const list = proposals.filter((p) => {
      const matchesSearch = !q || p.title.toLowerCase().includes(q);
      const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
      return matchesSearch && matchesStatus;
    });

    switch (sortKey) {
      case 'oldest':
        return [...list].sort((a, b) => a.created_at.localeCompare(b.created_at));
      case 'title-az':
        return [...list].sort((a, b) => a.title.localeCompare(b.title));
      default: // newest
        return [...list].sort((a, b) => b.updated_at.localeCompare(a.updated_at));
    }
  }, [proposals, search, statusFilter, sortKey]);

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function exitBulkMode() {
    setBulkMode(false);
    setSelectedIds(new Set());
  }

  async function handleBulkDelete() {
    if (selectedIds.size === 0 || bulkWorking) return;
    setBulkWorking(true);
    await Promise.all(
      Array.from(selectedIds).map((id) =>
        fetch(`/api/proposals/${id}`, { method: 'DELETE' })
      )
    );
    setBulkWorking(false);
    exitBulkMode();
    router.refresh();
  }

  async function handleBulkPublish() {
    if (selectedIds.size === 0 || bulkWorking) return;
    setBulkWorking(true);
    await Promise.all(
      Array.from(selectedIds).map((id) =>
        fetch(`/api/proposals/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'published' }),
        })
      )
    );
    setBulkWorking(false);
    exitBulkMode();
    router.refresh();
  }

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

        <div className="flex gap-1.5 flex-wrap items-center">
          {/* Bulk select toggle */}
          <button
            onClick={() => { setBulkMode((v) => !v); setSelectedIds(new Set()); }}
            className={`px-3 py-1.5 text-xs rounded-lg border transition-colors font-medium ${
              bulkMode
                ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                : 'bg-white border-gray-200 text-gray-500 hover:text-gray-900 hover:border-gray-300 shadow-sm'
            }`}
          >
            {bulkMode ? 'Cancel' : 'Select'}
          </button>

          {/* Status filter buttons */}
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

          {/* Sort dropdown */}
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
            className="px-3 py-1.5 text-xs rounded-lg border bg-white border-gray-200 text-gray-600 font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-colors"
            aria-label="Sort proposals"
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="title-az">Title A→Z</option>
          </select>
        </div>
      </div>

      {/* Results */}
      {displayed.length === 0 ? (
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
          {displayed.map((proposal) => (
            <ProposalCard
              key={proposal.id}
              proposal={proposal}
              blockCount={proposal.content_blocks?.length || 0}
              isSelected={bulkMode ? selectedIds.has(proposal.id) : undefined}
              onToggleSelect={bulkMode ? toggleSelect : undefined}
            />
          ))}
        </div>
      )}

      {/* Result count */}
      {proposals.length > 0 && (
        <p className="text-xs text-gray-400 mt-4 text-center">
          {displayed.length === proposals.length
            ? `${proposals.length} proposal${proposals.length !== 1 ? 's' : ''}`
            : `${displayed.length} of ${proposals.length} proposals`}
        </p>
      )}

      {/* Sticky bulk action bar */}
      {bulkMode && selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-zinc-900 border border-zinc-700 rounded-xl px-5 py-3 shadow-2xl">
          <span className="text-sm text-zinc-300 font-medium">
            {selectedIds.size} selected
          </span>
          <button
            onClick={handleBulkPublish}
            disabled={bulkWorking}
            className="px-3 py-1.5 text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white rounded-md transition-colors disabled:opacity-50"
          >
            Publish
          </button>
          <button
            onClick={handleBulkDelete}
            disabled={bulkWorking}
            className="px-3 py-1.5 text-xs font-medium bg-red-700 hover:bg-red-600 text-white rounded-md transition-colors disabled:opacity-50"
          >
            {bulkWorking ? 'Working…' : 'Delete'}
          </button>
          <button onClick={exitBulkMode} className="text-xs text-zinc-400 hover:text-white transition-colors">
            Cancel
          </button>
        </div>
      )}
    </>
  );
}
