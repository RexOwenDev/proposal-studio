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

  const { data: proposals } = await supabase
    .from('proposals')
    .select('*, content_blocks(id)')
    .order('updated_at', { ascending: false })
    .returns<(Proposal & { content_blocks: { id: string }[] })[]>();

  return (
    <>
      <LiveRefresh />
      <DashboardShell
        proposals={proposals || []}
        userEmail={user.email || 'Unknown'}
      />
    </>
  );
}
