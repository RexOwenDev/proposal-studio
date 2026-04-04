/**
 * AI proposal generation utility.
 * Uses Vercel AI SDK v6 + Anthropic claude-sonnet-4-5 with generateText + Output.object()
 * to extract structured proposal data from a sales rep's raw draft text.
 *
 * generateObject was removed in AI SDK v6. Use generateText with output: Output.object({ schema })
 * Zod schemas act as both TypeScript type sources AND structured output schemas.
 */

import { generateText, Output } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { z } from 'zod';
import type { ClientProposalData, InternalDocData } from '@/lib/templates/types';

// ─── Zod Schemas ─────────────────────────────────────────────────────────────

const HeroStatSchema = z.object({
  before: z.string().describe('Numeric string for the current/bad state, e.g. "4" or "40%". Digits + optional suffix only.'),
  after: z.string().describe('Numeric string for the improved state, e.g. "0.5" or "92%". Digits + optional suffix only.'),
  label: z.string().describe('Short label, e.g. "Hours per lead" or "Response time".'),
});

const CapabilityCardSchema = z.object({
  icon: z.string().describe('A single Unicode emoji. No SVG, no text icon names.'),
  title: z.string().describe('Short capability name, 2-5 words.'),
  detail: z.string().describe('1-2 sentence explanation of what this capability does.'),
  outcome: z.string().describe('1-2 sentence "how this helps the client" — shown on hover.'),
});

const FlowStepSchema = z.object({
  type: z.enum(['auto', 'human']).describe('"auto" for automated/AI steps, "human" for steps requiring human action.'),
  icon: z.string().describe('Single Unicode emoji for this step.'),
  title: z.string().describe('Short step name, 2-4 words.'),
  desc: z.string().describe('1-2 sentence description shown when step is clicked.'),
  time: z.string().describe('Estimated time, e.g. "~2 min" or "~1 day".'),
});

const FlowBranchSchema = z.object({
  title: z.string().describe('Short branch outcome title.'),
  desc: z.string().describe('1 sentence describing what happens in this branch.'),
  stat: z.string().describe('A statistic or outcome relevant to this branch.'),
});

const PhaseSchema = z.object({
  number: z.number().describe('Sequential phase number starting at 1.'),
  title: z.string().describe('Phase name, e.g. "Discovery & Setup".'),
  duration: z.string().describe('Time estimate, e.g. "Week 1-2" or "2 weeks".'),
  description: z.string().describe('2-3 sentences describing what happens in this phase.'),
  deliverables: z.array(z.string()).describe('3-6 specific deliverables the team will produce.'),
  clientNeeds: z.array(z.string()).describe('2-4 things the client must provide or decide.'),
});

const TimelinePhaseSchema = z.object({
  name: z.string().describe('Phase name — must match the corresponding phases[] entry exactly.'),
  weeks: z.number().describe('Duration in weeks as a number.'),
  color: z.string().optional().describe('Optional hex color. Omit to use default purple.'),
});

export const ClientProposalSchema = z.object({
  meta: z.object({
    client_name: z.string().describe('The client company or person name.'),
    project_name: z.string().describe('Short project name.'),
    projectType: z.string().describe('Short type label, e.g. "Automation Proposal".'),
    date: z.string().describe('Today\'s date as "Month D, YYYY".'),
    preparedBy: z.string().describe('The sales rep\'s name.'),
  }),
  hero: z.object({
    headline: z.string().describe('8-15 word headline restating the client\'s pain as a transformation statement.'),
    subtext: z.string().describe('1-2 sentences of empathetic context in client language.'),
    stats: z.array(HeroStatSchema).min(2).max(3).describe('2-3 before/after metric pairs.'),
  }),
  solution: z.object({
    title: z.string().describe('Solution section headline, 4-8 words.'),
    overview: z.string().describe('1-2 sentence overview of what the solution is.'),
    capabilities: z.array(CapabilityCardSchema).min(2).max(6),
  }),
  flow: z.object({
    steps: z.array(FlowStepSchema).min(3).max(8),
    gate: z.string().optional().describe('Optional decision gate label. Omit if no decision point.'),
    branches: z.object({
      yes: FlowBranchSchema,
      no: FlowBranchSchema,
    }).optional().describe('Optional yes/no branches after the gate. Omit if no gate.'),
  }),
  phases: z.array(PhaseSchema).min(2).max(5).describe('IMPORTANT: phases[] and timeline.phases[] must have the SAME length and order.'),
  timeline: z.object({
    totalDuration: z.string().describe('Total project duration, e.g. "6 weeks".'),
    phases: z.array(TimelinePhaseSchema).describe('MUST match phases[] in length and order.'),
  }),
  investment: z.object({
    total: z.string().describe('Total price, e.g. "$8,500".'),
    includes: z.array(z.string()).min(3).max(8),
    note: z.string().optional().describe('Payment terms or scope disclaimer. Omit if not needed.'),
  }),
  nextSteps: z.array(z.object({
    action: z.string().describe('Short action item.'),
    detail: z.string().describe('1 sentence with more detail.'),
  })).min(2).max(4),
  cta: z.object({
    label: z.string().describe('CTA button text, e.g. "Book a Call".'),
    href: z.string().describe('URL for the CTA. Use "#" if none provided.'),
  }),
});

export const InternalDocSchema = z.object({
  project: z.object({
    client: z.string(),
    name: z.string(),
    status: z.enum(['Draft', 'In Progress', 'Complete']),
    phase: z.string().describe('Current phase name or number.'),
    owner: z.string(),
    date: z.string().describe('Date as "Month D, YYYY".'),
  }),
  goal: z.object({
    summary: z.string().describe('1-sentence bold summary of what this project achieves.'),
    problem: z.string().describe('1-2 sentences on the problem being solved.'),
    outcome: z.string().describe('1-2 sentences on the desired end state.'),
  }),
  workflow: z.array(z.object({
    number: z.number(),
    type: z.enum(['Automation', 'AI', 'Human', 'Automation & AI']),
    title: z.string().describe('Step name, 2-5 words.'),
    desc: z.string().describe('1-2 sentence description.'),
    details: z.array(z.string()).describe('2-5 sub-bullet detail points.'),
  })).min(2).max(10),
  tech: z.array(z.object({
    tool: z.string(),
    purpose: z.string(),
    notes: z.string().describe('Relevant notes. Empty string if none.'),
  })),
  status: z.object({
    phases: z.array(z.object({
      name: z.string(),
      status: z.enum(['Done', 'In Progress', 'Pending', 'Blocked']),
      dueDate: z.string().describe('Due date or "TBD".'),
      notes: z.string().describe('Short note. Empty string if none.'),
    })),
  }),
  notes: z.array(z.object({
    date: z.string(),
    author: z.string(),
    note: z.string(),
  })).describe('Key decisions and observations. Can be empty array.'),
});

// ─── System prompts ───────────────────────────────────────────────────────────

const CLIENT_PROPOSAL_SYSTEM = `You are a senior sales proposal writer for Spilled Milk / Design Shopp, a design and automation agency.

Your job: extract structured proposal data from a sales rep's draft notes to populate a client-facing proposal template.

Rules:
- Use plain English the client can understand — no jargon, no internal terms
- Hero headline should be emotionally resonant: restate the client's pain as a transformation statement
- Stats MUST be numeric strings only (e.g. "4", "92%", "0.5h") — the template animates them
- Capability card icons MUST be a single Unicode emoji (e.g. "⚡", "🔄", "📊")
- phases[] and timeline.phases[] MUST have the same length and same ordering
- If pricing is not specified, estimate based on the scope described
- If no CTA URL is provided, use "#"
- Today's date formatted as "Month D, YYYY" (e.g. "April 5, 2026")
- Be generous with content — fill in reasonable details where the draft is thin`;

const INTERNAL_DOC_SYSTEM = `You are a technical project manager for Spilled Milk / Design Shopp, a design and automation agency.

Your job: extract structured project documentation from team notes to populate an internal automation doc template.

Rules:
- Use precise technical language — this is internal, not client-facing
- Workflow steps should be detailed and accurate
- Tech stack should list every tool mentioned or implied in the notes
- Phase status defaults to "Pending" for phases not mentioned
- Notes should capture key decisions, open questions, and observations
- Today's date formatted as "Month D, YYYY" (e.g. "April 5, 2026")`;

// ─── Generation functions ─────────────────────────────────────────────────────

export async function generateClientProposal(
  draftText: string,
  overrides?: { title?: string; clientName?: string; preparedBy?: string },
): Promise<ClientProposalData> {
  const contextLines: string[] = [];
  if (overrides?.clientName) contextLines.push(`Client name: ${overrides.clientName}`);
  if (overrides?.title) contextLines.push(`Project name: ${overrides.title}`);
  if (overrides?.preparedBy) contextLines.push(`Prepared by: ${overrides.preparedBy}`);

  const contextNote = contextLines.length
    ? `\n\nAdditional context:\n${contextLines.join('\n')}`
    : '';

  const { output } = await generateText({
    model: anthropic('claude-sonnet-4-6'),
    system: CLIENT_PROPOSAL_SYSTEM,
    prompt: `Here are the sales rep's draft notes for a client proposal:\n\n${draftText}${contextNote}`,
    output: Output.object({ schema: ClientProposalSchema }),
  });

  return output as ClientProposalData;
}

export async function generateInternalDoc(
  draftText: string,
  overrides?: { title?: string; owner?: string },
): Promise<InternalDocData> {
  const contextLines: string[] = [];
  if (overrides?.title) contextLines.push(`Project name: ${overrides.title}`);
  if (overrides?.owner) contextLines.push(`Project owner: ${overrides.owner}`);

  const contextNote = contextLines.length
    ? `\n\nAdditional context:\n${contextLines.join('\n')}`
    : '';

  const { output } = await generateText({
    model: anthropic('claude-sonnet-4-6'),
    system: INTERNAL_DOC_SYSTEM,
    prompt: `Here are the team notes for an internal automation doc:\n\n${draftText}${contextNote}`,
    output: Output.object({ schema: InternalDocSchema }),
  });

  return output as InternalDocData;
}
