import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import type { Proposal } from '@/lib/types';
import { formatDate } from '@/lib/utils';

const statusColors: Record<string, string> = {
  draft: 'bg-yellow-900/50 text-yellow-300 border-yellow-700',
  review: 'bg-blue-900/50 text-blue-300 border-blue-700',
  published: 'bg-emerald-900/50 text-emerald-300 border-emerald-700',
};

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
              <Link
                key={proposal.id}
                href={`/p/${proposal.slug}/edit`}
                className="block bg-zinc-900 border border-zinc-800 rounded-lg p-5 hover:border-zinc-600 transition-colors group"
              >
                <div className="flex items-start justify-between mb-3">
                  <h2 className="text-white font-medium group-hover:text-blue-400 transition-colors truncate pr-2">
                    {proposal.title}
                  </h2>
                  <span
                    className={`text-xs px-2 py-0.5 rounded border shrink-0 ${statusColors[proposal.status]}`}
                  >
                    {proposal.status}
                  </span>
                </div>
                <p className="text-zinc-500 text-xs">
                  Updated {formatDate(proposal.updated_at)}
                </p>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
