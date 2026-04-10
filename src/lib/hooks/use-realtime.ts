'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { ContentBlock } from '@/lib/types';

export interface PresenceUser {
  email: string;
  joinedAt: string;
  isTyping?: boolean;
  editingBlockId?: string; // R1: which block this user is currently editing
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
  // R1: map of email → blockId for users actively editing a section
  const [editingUsers, setEditingUsers] = useState<Map<string, string>>(new Map());
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
        const editingMap = new Map<string, string>(); // email → blockId

        Object.values(state).forEach((presences) => {
          presences.forEach((p) => {
            // Keep the most recent entry per email
            const existing = uniqueUsers.get(p.email);
            if (!existing || p.joinedAt > existing.joinedAt) {
              uniqueUsers.set(p.email, {
                email: p.email,
                joinedAt: p.joinedAt,
                isTyping: p.isTyping,
                editingBlockId: p.editingBlockId,
              });
            }
            // If ANY entry for this user is typing, they're typing
            if (p.isTyping && p.email !== userEmail) {
              typingSet.add(p.email);
            }
            // R1: track which block each other user is editing
            if (p.editingBlockId && p.email !== userEmail) {
              editingMap.set(p.email, p.editingBlockId);
            }
          });
        });

        setOnlineUsers(Array.from(uniqueUsers.values()));
        setTypingUsers(Array.from(typingSet));
        setEditingUsers(new Map(editingMap));
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

  // R1: broadcast which block the current user is actively editing
  const setEditingBlock = useCallback(async (blockId: string | null) => {
    if (!channelRef.current || !userEmail) return;
    await channelRef.current.track({
      email: userEmail,
      joinedAt: new Date().toISOString(),
      isTyping: false,
      editingBlockId: blockId ?? undefined,
    });
  }, [userEmail]);

  return { onlineUsers, typingUsers, editingUsers, setTyping, setEditingBlock };
}
