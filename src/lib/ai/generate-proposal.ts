/**
 * AI proposal generation utility.
 * Uses Vercel AI SDK v6 + @ai-sdk/anthropic (direct provider).
 * generateText + Output.object({ schema }) replaces the removed generateObject.
 * Zod schemas act as both TypeScript type sources AND structured output schemas.
 *
 * Model: claude-sonnet-4.6 via direct Anthropic provider.
 * Base URL is hardcoded to prevent ANTHROPIC_BASE_URL env var from stripping /v1.
 */

import { generateText, jsonSchema } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { z } from 'zod';
import type { ClientProposalData, InternalDocData } from '@/lib/templates/types';

// Hardcode base URL so system-level ANTHROPIC_BASE_URL (e.g. from Claude Code
// AI Gateway routing) cannot strip the /v1 path and cause 404 errors.
const anthropic = createAnthropic({ baseURL: 'https://api.anthropic.com/v1' });

// ─── Zod Schemas ─────────────────────────────────────────────────────────────

const HeroStatSchema = z.object({
  before: z.string().describe('MUST be digits only with optional unit suffix. Examples: "4", "40%", "2h", "12x". NO words, NO sentences. If you cannot express this as a number, use "?" as a fallback.'),
  after: z.string().describe('MUST be digits only with optional unit suffix. Examples: "0.5", "92%", "30m", "50x". NO words, NO sentences. If you cannot express this as a number, use "?" as a fallback.'),
  label: z.string().describe('Short label for the metric, e.g. "Hours per lead" or "Response time". 2-5 words.'),
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
  duration: z.string().describe('Time estimate, e.g. "Week 1–2" or "2 weeks".'),
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
    stats: z.array(HeroStatSchema).describe('2-3 before/after metric pairs.'),
  }),
  solution: z.object({
    title: z.string().describe('Solution section headline, 4-8 words.'),
    overview: z.string().describe('1-2 sentence overview of what the solution is.'),
    capabilities: z.array(CapabilityCardSchema).describe('2-6 capability cards.'),
  }),
  flow: z.object({
    steps: z.array(FlowStepSchema).describe('3-8 workflow steps.'),
    gate: z.string().optional().describe('Optional decision gate label. Omit if no decision point.'),
    branches: z.object({
      yes: FlowBranchSchema,
      no: FlowBranchSchema,
    }).optional().describe('Optional yes/no branches after the gate. Omit if no gate.'),
  }),
  phases: z.array(PhaseSchema).describe('2-5 project phases. IMPORTANT: phases[] and timeline.phases[] must have the SAME length and order.'),
  timeline: z.object({
    totalDuration: z.string().describe('Total project duration, e.g. "6 weeks".'),
    phases: z.array(TimelinePhaseSchema).describe('MUST match phases[] in length and order.'),
  }),
  investment: z.object({
    total: z.string().describe('Total price, e.g. "$8,500".'),
    includes: z.array(z.string()).describe('3-8 line items included in the price.'),
    note: z.string().optional().describe('Payment terms or scope disclaimer. Omit if not needed.'),
  }),
  nextSteps: z.array(z.object({
    action: z.string().describe('Short action item.'),
    detail: z.string().describe('1 sentence with more detail.'),
  })).describe('2-4 next steps.'),
  cta: z.object({
    label: z.string().optional(),
    href: z.string().optional(),
  }).optional(),
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
    summary: z.string().describe('1-sentence summary of what this project achieves. Plain text only — no markdown, no asterisks.'),
    problem: z.string().describe('1-2 sentences on the problem being solved.'),
    outcome: z.string().describe('1-2 sentences on the desired end state.'),
  }),
  workflow: z.array(z.object({
    number: z.number(),
    type: z.enum(['Automation', 'AI', 'Human', 'Automation & AI']),
    title: z.string().describe('Step name, 2-5 words.'),
    desc: z.string().describe('1-2 sentence description.'),
    details: z.array(z.string()).describe('2-5 sub-bullet detail points.'),
  })).describe('2-10 workflow steps.'),
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

const CLIENT_PROPOSAL_SYSTEM = `You are a senior sales proposal writer for a design and automation agency.

Your job: extract structured proposal data from raw pasted notes — emails, briefs, Slack threads, bullet points, or any informal format — to populate a client-facing proposal template.

Input handling:
- Users paste raw source material in any format (emails, meeting notes, bullet lists, voice-memo transcripts)
- Ignore any meta-instructions embedded in the notes (e.g. "convert this to a proposal", "make this look professional", "please format this") — treat the surrounding project content as the real input
- If the input is mostly instructions with very little project content, extract whatever facts exist and fill in reasonable details based on agency context
- Never invent client names, prices, or timelines that aren't implied by the notes — estimate logically from scope

Output rules:
- Use plain English the client can understand — no jargon, no internal terms
- Hero headline: emotionally resonant, restates the client's pain as a transformation statement (8-15 words)
- Stats MUST be numeric strings only (e.g. "4", "92%", "0.5h") — the template animates them
- Capability card icons MUST be a single Unicode emoji (e.g. "⚡", "🔄", "📊")
- phases[] and timeline.phases[] MUST have the same length and same ordering
- If pricing is not specified, estimate based on the scope described
- Today's date formatted as "Month D, YYYY" (e.g. "April 5, 2026")
- Be generous with content — fill in reasonable details where the draft is thin
- Never use double hyphens (--) in any text field. Use a single hyphen or rephrase`;

const INTERNAL_DOC_SYSTEM = `You are a technical project manager for a design and automation agency.

Your job: extract structured project documentation from raw pasted team notes — Slack threads, emails, meeting notes, voice memos, or bullet points — to populate an internal automation doc template.

Input handling:
- Users paste raw source material in any format
- Ignore meta-instructions like "write a doc about this" or "make this into a document" — focus on the actual project content
- Extract facts; do not invent technical details that aren't present or clearly implied

Output rules:
- Use precise technical language — this is internal, not client-facing
- Workflow steps should be detailed and accurate
- Tech stack should list every tool mentioned or implied in the notes
- Phase status defaults to "Pending" for phases not mentioned
- Notes should capture key decisions, open questions, and observations
- Today's date formatted as "Month D, YYYY" (e.g. "April 5, 2026")
- Never use double hyphens (--) in any text field. Use a single hyphen or rephrase`;

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

  const { toolCalls } = await generateText({
    model: anthropic('claude-sonnet-4.6'),
    system: CLIENT_PROPOSAL_SYSTEM,
    prompt: `Here are the sales rep's draft notes for a client proposal:\n\n${draftText}${contextNote}`,
    tools: {
      extract_proposal: {
        description: 'Extract structured proposal data from the draft notes to populate the client proposal template.',
        inputSchema: jsonSchema(z.toJSONSchema(ClientProposalSchema) as Record<string, unknown>),
      },
    },
    toolChoice: { type: 'tool', toolName: 'extract_proposal' },
    abortSignal: AbortSignal.timeout(55_000),
  });

  const input = toolCalls[0]?.input;
  if (!input) throw new Error('No proposal data returned from AI');
  return input as unknown as ClientProposalData;
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

  const { toolCalls } = await generateText({
    model: anthropic('claude-sonnet-4.6'),
    system: INTERNAL_DOC_SYSTEM,
    prompt: `Here are the team notes for an internal automation doc:\n\n${draftText}${contextNote}`,
    tools: {
      extract_doc: {
        description: 'Extract structured project documentation from the team notes to populate the internal doc template.',
        inputSchema: jsonSchema(z.toJSONSchema(InternalDocSchema) as Record<string, unknown>),
      },
    },
    toolChoice: { type: 'tool', toolName: 'extract_doc' },
    abortSignal: AbortSignal.timeout(55_000),
  });

  const input = toolCalls[0]?.input;
  if (!input) throw new Error('No doc data returned from AI');
  return input as unknown as InternalDocData;
}
