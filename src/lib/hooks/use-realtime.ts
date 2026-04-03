'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Comment } from '@/lib/types';

interface PresenceUser {
  email: string;
  joinedAt: string;
}

/**
 * Supabase Realtime hook for live collaboration.
 *
 * Provides:
 * 1. Live comments — auto-updates when anyone adds/resolves a comment
 * 2. Presence — tracks who's currently viewing the same proposal
 */
export function useRealtimeComments(proposalId: string | null) {
  const [liveComments, setLiveComments] = useState<Comment[]>([]);

  useEffect(() => {
    if (!proposalId) return;

    const supabase = createClient();

    const channel = supabase
      .channel(`comments:${proposalId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'comments',
          filter: `proposal_id=eq.${proposalId}`,
        },
        (payload) => {
          setLiveComments((prev) => [...prev, payload.new as Comment]);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'comments',
          filter: `proposal_id=eq.${proposalId}`,
        },
        (payload) => {
          setLiveComments((prev) =>
            prev.map((c) => (c.id === (payload.new as Comment).id ? (payload.new as Comment) : c))
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [proposalId]);

  // Merge initial comments with live updates
  const mergeComments = useCallback(
    (initial: Comment[]): Comment[] => {
      const map = new Map<string, Comment>();
      initial.forEach((c) => map.set(c.id, c));
      liveComments.forEach((c) => map.set(c.id, c));
      return Array.from(map.values()).sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
    },
    [liveComments]
  );

  return { liveComments, mergeComments };
}

export function usePresence(proposalId: string | null, userEmail: string | null) {
  const [onlineUsers, setOnlineUsers] = useState<PresenceUser[]>([]);

  useEffect(() => {
    if (!proposalId || !userEmail) return;

    const supabase = createClient();

    const channel = supabase.channel(`presence:${proposalId}`, {
      config: { presence: { key: userEmail } },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<PresenceUser>();
        const users: PresenceUser[] = [];
        Object.values(state).forEach((presences) => {
          presences.forEach((p) => {
            users.push({ email: p.email, joinedAt: p.joinedAt });
          });
        });
        setOnlineUsers(users);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            email: userEmail,
            joinedAt: new Date().toISOString(),
          });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [proposalId, userEmail]);

  return onlineUsers;
}
