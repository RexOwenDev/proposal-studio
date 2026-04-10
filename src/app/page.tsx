import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import type { Proposal, ViewStats } from '@/lib/types';
import DashboardShell from '@/components/dashboard/dashboard-shell';
import LiveRefresh from '@/components/dashboard/live-refresh';

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: proposals } = await supabase
    .from('proposals')
    .select('*, content_blocks(id)')
    .order('updated_at', { ascending: false })
    .returns<(Proposal & { content_blocks: { id: string }[] })[]>();

  const { data: statsRows } = await supabase.rpc('get_proposal_view_stats', {
    owner_id: user.id,
  });

  const statsMap = new Map<string, ViewStats>(
    (statsRows ?? []).map((r: { proposal_id: string; total_views: number; unique_views: number; last_viewed_at: string | null }) => [
      r.proposal_id,
      {
        total_views: Number(r.total_views),
        unique_views: Number(r.unique_views),
        last_viewed_at: r.last_viewed_at,
      },
    ])
  );

  const proposalList = proposals || [];
  const { data: acceptances } = proposalList.length > 0
    ? await supabase
        .from('proposal_acceptances')
        .select('proposal_id, client_name')
        .in('proposal_id', proposalList.map((p) => p.id))
    : { data: [] };

  const acceptanceMap = new Map<string, string>(
    (acceptances ?? []).map((a: { proposal_id: string; client_name: string }) => [
      a.proposal_id,
      a.client_name,
    ])
  );

  return (
    <>
      <LiveRefresh />
      <DashboardShell
        proposals={proposalList}
        userEmail={user.email || 'Unknown'}
        viewStatsMap={statsMap}
        acceptanceMap={acceptanceMap}
      />
    </>
  );
}
