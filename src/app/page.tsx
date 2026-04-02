import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import type { Proposal } from '@/lib/types';
import ProposalCard from '@/components/dashboard/proposal-card';

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: proposals } = await supabase
    .from('proposals')
    .select('*')
    .order('updated_at', { ascending: false })
    .returns<Proposal[]>();

  return (
    <div className="min-h-screen bg-zinc-950">
      {/* Header */}
      <header className="border-b border-zinc-800 px-6 py-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-white">Proposal Studio</h1>
        <Link
          href="/import"
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-md transition-colors"
        >
          Import New
        </Link>
      </header>

      {/* Content */}
      <main className="max-w-6xl mx-auto px-6 py-8">
        {!proposals || proposals.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-zinc-400 text-lg">No proposals yet.</p>
            <p className="text-zinc-500 text-sm mt-1">
              Import your first HTML proposal to get started.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {proposals.map((proposal) => (
              <ProposalCard key={proposal.id} proposal={proposal} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
