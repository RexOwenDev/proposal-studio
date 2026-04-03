import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import type { Proposal } from '@/lib/types';
import DashboardHeader from '@/components/dashboard/dashboard-header';
import ProposalGrid from '@/components/dashboard/proposal-grid';
import LiveRefresh from '@/components/dashboard/live-refresh';

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Run both queries in parallel — proposals + unresolved top-level comment counts
  const [{ data: proposals }, { data: unresolvedRows }] = await Promise.all([
    supabase
      .from('proposals')
      .select('*, content_blocks(id)')
      .order('updated_at', { ascending: false })
      .returns<(Proposal & { content_blocks: { id: string }[] })[]>(),
    supabase
      .from('comments')
      .select('proposal_id')
      .eq('resolved', false)
      .is('parent_id', null), // only count top-level threads
  ]);

  // Build a serialisable lookup: proposal_id → unresolved count
  // (plain Record, not Map, so it passes across the RSC → Client Component boundary)
  const unresolvedCounts: Record<string, number> = {};
  for (const row of unresolvedRows || []) {
    unresolvedCounts[row.proposal_id] = (unresolvedCounts[row.proposal_id] || 0) + 1;
  }

  return (
    <div className="min-h-screen bg-zinc-950">
      <LiveRefresh />
      <DashboardHeader userEmail={user.email || 'Unknown'} />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {!proposals || proposals.length === 0 ? (
          <div className="text-center py-20 max-w-md mx-auto">
            <div className="w-16 h-16 bg-zinc-800 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
              </svg>
            </div>
            <h2 className="text-white text-lg font-medium mb-2">No proposals yet</h2>
            <p className="text-zinc-500 text-sm mb-6">
              Import an HTML proposal to get started. Your team can then edit text, toggle sections, leave comments, and publish shareable links.
            </p>
            <a
              href="/import"
              className="inline-flex px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-md transition-colors"
            >
              Import your first proposal
            </a>
          </div>
        ) : (
          <ProposalGrid proposals={proposals} unresolvedCounts={unresolvedCounts} />
        )}
      </main>
    </div>
  );
}
