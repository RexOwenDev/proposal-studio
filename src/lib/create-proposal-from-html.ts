/**
 * Shared utility for inserting a parsed HTML proposal into the database.
 * Used by both /api/import (existing HTML upload) and /api/generate (AI-generated HTML).
 * Extracted here to avoid duplicating the slug + DB insert logic.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { parseHTML } from '@/lib/parser/html-parser';
import { slugify } from '@/lib/utils';

interface CreateProposalOptions {
  html: string;
  title?: string;
  userId: string;
  userEmail: string | null;
}

interface CreateProposalResult {
  proposal: Record<string, unknown>;
  blocks: Record<string, unknown>[];
  warnings: string[];
}

export async function createProposalFromHTML(
  supabase: SupabaseClient,
  options: CreateProposalOptions,
): Promise<CreateProposalResult> {
  const { html, userId, userEmail } = options;

  // Parse: extract stylesheet, scripts, and body blocks
  const parsed = parseHTML(html);
  const title = options.title || parsed.title;

  // Generate slug with collision check
  let slug = slugify(title);
  const { data: existing } = await supabase
    .from('proposals')
    .select('slug')
    .eq('slug', slug)
    .single();

  if (existing) {
    slug = `${slug}-${Math.random().toString(36).substring(2, 6)}`;
  }

  // Create the proposal row
  const { data: proposal, error: proposalError } = await supabase
    .from('proposals')
    .insert({
      slug,
      title,
      original_html: html,
      stylesheet: parsed.stylesheet,
      scripts: parsed.scripts,
      created_by: userId,
      created_by_email: userEmail,
    })
    .select()
    .single();

  if (proposalError || !proposal) {
    throw new Error('Failed to create proposal');
  }

  // Create content blocks
  const blockInserts = parsed.blocks.map((block) => ({
    proposal_id: proposal.id,
    block_order: block.order,
    label: block.label,
    original_html: block.html,
    current_html: block.html,
    wrapper_class: block.wrapperClass || null,
  }));

  const { data: blocks, error: blocksError } = await supabase
    .from('content_blocks')
    .insert(blockInserts)
    .select();

  if (blocksError || !blocks) {
    throw new Error('Failed to create content blocks');
  }

  return { proposal, blocks, warnings: parsed.warnings };
}
