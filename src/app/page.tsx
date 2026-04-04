import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import type { Proposal } from '@/lib/types';
import DashboardShell from '@/components/dashboard/dashboard-shell';
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
    <>
      <LiveRefresh />
      <DashboardShell
        proposals={proposals || []}
        unresolvedCounts={unresolvedCounts}
        userEmail={user.email || 'Unknown'}
      />
    </>
  );
}
