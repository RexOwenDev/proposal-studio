'use client';

import { useState } from 'react';
import type { Proposal } from '@/lib/types';
import DashboardHeader from '@/components/dashboard/dashboard-header';
import ProposalGrid from '@/components/dashboard/proposal-grid';
import CreateProposalModal from '@/components/dashboard/create-proposal-modal';

interface Props {
  proposals: (Proposal & { content_blocks: { id: string }[] })[];
  unresolvedCounts: Record<string, number>;
  userEmail: string;
}

export default function DashboardShell({ proposals, unresolvedCounts, userEmail }: Props) {
  const [showModal, setShowModal] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardHeader
        userEmail={userEmail}
        onNewProposal={() => setShowModal(true)}
      />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {!proposals || proposals.length === 0 ? (
          <div className="text-center py-20 max-w-md mx-auto">
            <div className="w-16 h-16 bg-white border border-gray-200 shadow-sm rounded-2xl flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
              </svg>
            </div>
            <h2 className="text-gray-900 text-lg font-semibold mb-2">No proposals yet</h2>
            <p className="text-gray-500 text-sm mb-6">
              Generate an AI proposal from your draft notes. Your team can then edit text, toggle sections, leave comments, and publish shareable links.
            </p>
            <button
              onClick={() => setShowModal(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors shadow-sm"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
              </svg>
              Create your first proposal
            </button>
          </div>
        ) : (
          <ProposalGrid proposals={proposals} unresolvedCounts={unresolvedCounts} />
        )}
      </main>

      {showModal && <CreateProposalModal onClose={() => setShowModal(false)} />}
    </div>
  );
}
