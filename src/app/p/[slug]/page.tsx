import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import type { Metadata } from 'next';
import type { ContentBlock } from '@/lib/types';
import ProposalRenderer from '@/components/proposal/proposal-renderer';
import { recordView } from '@/lib/analytics/record-view';

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: proposal } = await supabase
    .from('proposals')
    .select('title')
    .eq('slug', slug)
    .eq('status', 'published')
    .single();

  return {
    title: proposal?.title || 'Proposal',
    description: proposal ? `${proposal.title} — Design Shopp` : undefined,
  };
}

export default async function PublicProposalPage({ params }: Props) {
  const { slug } = await params;
  const supabase = await createClient();

  // Only published proposals are accessible
  const { data: proposal } = await supabase
    .from('proposals')
    .select('*')
    .eq('slug', slug)
    .eq('status', 'published')
    .single();

  if (!proposal) {
    notFound();
  }

  // Record view — non-blocking, must not delay page render
  const hdrs = await headers();
  const rawIp = hdrs.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '';
  void recordView(proposal.id, rawIp);

  const { data: blocks } = await supabase
    .from('content_blocks')
    .select('*')
    .eq('proposal_id', proposal.id)
    .order('block_order', { ascending: true })
    .returns<ContentBlock[]>();

  return (
    <div className="min-h-screen bg-white">
      <ProposalRenderer
        stylesheet={proposal.stylesheet}
        blocks={blocks || []}
        scripts={proposal.scripts}
        mode="view"
      />
    </div>
  );
}
