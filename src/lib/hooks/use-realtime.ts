'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Comment, ContentBlock } from '@/lib/types';

interface PresenceUser {
  email: string;
  joinedAt: string;
  isTyping?: boolean;
}

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

/**
 * Subscribes to content_blocks UPDATE events for a proposal.
 * Fires whenever any block's visible, current_html, or other fields change.
 * Consumers can use this to surgically update the iframe DOM without a full re-render.
 */
export function useRealtimeBlocks(proposalId: string | null) {
  const [liveBlockUpdates, setLiveBlockUpdates] = useState<ContentBlock[]>([]);

  useEffect(() => {
    if (!proposalId) return;

    const supabase = createClient();

    const channel = supabase
      .channel(`blocks:${proposalId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'content_blocks',
          filter: `proposal_id=eq.${proposalId}`,
        },
        (payload) => {
          setLiveBlockUpdates((prev) => [...prev, payload.new as ContentBlock]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [proposalId]);

  return { liveBlockUpdates };
}

export function usePresence(proposalId: string | null, userEmail: string | null) {
  const [onlineUsers, setOnlineUsers] = useState<PresenceUser[]>([]);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>['channel']> | null>(null);

  useEffect(() => {
    if (!proposalId || !userEmail) return;

    const supabase = createClient();

    const channel = supabase.channel(`presence:${proposalId}`, {
      config: { presence: { key: userEmail } },
    });

    channelRef.current = channel;

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<PresenceUser>();

        // DEDUPLICATE: each email should appear only once.
        // Supabase presence can have multiple entries per key (tabs, reconnects).
        // Take the latest entry per unique email.
        const uniqueUsers = new Map<string, PresenceUser>();
        const typingSet = new Set<string>();

        Object.values(state).forEach((presences) => {
          presences.forEach((p) => {
            // Keep the most recent entry per email
            const existing = uniqueUsers.get(p.email);
            if (!existing || p.joinedAt > existing.joinedAt) {
              uniqueUsers.set(p.email, {
                email: p.email,
                joinedAt: p.joinedAt,
                isTyping: p.isTyping,
              });
            }
            // If ANY entry for this user is typing, they're typing
            if (p.isTyping && p.email !== userEmail) {
              typingSet.add(p.email);
            }
          });
        });

        setOnlineUsers(Array.from(uniqueUsers.values()));
        setTypingUsers(Array.from(typingSet));
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            email: userEmail,
            joinedAt: new Date().toISOString(),
            isTyping: false,
          });
        }
      });

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [proposalId, userEmail]);

  const setTyping = useCallback(async (isTyping: boolean) => {
    if (!channelRef.current || !userEmail) return;
    await channelRef.current.track({
      email: userEmail,
      joinedAt: new Date().toISOString(),
      isTyping,
    });
  }, [userEmail]);

  return { onlineUsers, typingUsers, setTyping };
}
