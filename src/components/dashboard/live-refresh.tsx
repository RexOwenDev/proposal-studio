'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

/**
 * Invisible component that listens for new/updated/deleted proposals
 * via Supabase Realtime and triggers a Next.js router.refresh() to
 * re-fetch the server component data without a full page reload.
 */
export default function LiveRefresh() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel('dashboard-proposals')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'proposals' },
        () => router.refresh()
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'proposals' },
        () => router.refresh()
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'proposals' },
        () => router.refresh()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [router]);

  return null; // Invisible — just subscribes
}
