/**
 * Audit log writer — server-side only.
 *
 * Writes structured events to the `proposal_events` table via the service role
 * client so that Row Level Security cannot block the insert.
 *
 * All writes are fire-and-forget (`void writeAuditEvent(...)`) — a logging
 * failure should never block a user action. Errors are caught and logged to
 * the structured logger.
 */

import { createClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';

export type AuditEventType =
  | 'proposal_created'
  | 'proposal_updated'
  | 'proposal_published'
  | 'proposal_unpublished'
  | 'proposal_deleted'
  | 'proposal_restored'
  | 'proposal_accepted'
  | 'block_edited'
  | 'comment_added'
  | 'comment_resolved'
  | 'comment_deleted';

interface AuditEventParams {
  proposalId: string;
  userId: string | null;
  userEmail: string | null;
  eventType: AuditEventType;
  metadata?: Record<string, unknown>;
}

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * Writes a single audit event. Always call with `void` — never await.
 * Failures are logged but never thrown.
 */
export async function writeAuditEvent({
  proposalId,
  userId,
  userEmail,
  eventType,
  metadata = {},
}: AuditEventParams): Promise<void> {
  try {
    const serviceClient = getServiceClient();
    const { error } = await serviceClient.from('proposal_events').insert({
      proposal_id: proposalId,
      user_id: userId,
      user_email: userEmail,
      event_type: eventType,
      metadata,
    });

    if (error) {
      logger.warn('Audit log write failed', { eventType, proposalId, code: error.code });
    }
  } catch (err) {
    logger.error('Audit log unexpected error', err instanceof Error ? err : undefined, {
      eventType,
      proposalId,
    });
  }
}
