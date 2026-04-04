/**
 * Type definitions for AI-generated proposal data.
 * These match the PROPOSAL_DATA schemas defined in:
 * docs/superpowers/specs/2026-04-04-proposal-templates-design.md
 */

// ─── Template 1: Client Proposal ─────────────────────────────────────────────

export interface ProposalMeta {
  client_name: string;
  project_name: string;
  projectType: string;
  date: string;
  preparedBy: string;
}

export interface HeroStat {
  before: string; // numeric string only, e.g. "4" or "92%"
  after: string;  // numeric string only
  label: string;
}

export interface HeroData {
  headline: string;
  subtext: string;
  stats: HeroStat[];
}

export interface CapabilityCard {
  icon: string;    // single Unicode emoji
  title: string;
  detail: string;
  outcome: string; // revealed on hover
}

export interface SolutionData {
  title: string;
  overview: string;
  capabilities: CapabilityCard[];
}

export interface FlowStep {
  type: 'auto' | 'human';
  icon: string;
  title: string;
  desc: string;
  time: string;
}

export interface FlowBranch {
  title: string;
  desc: string;
  stat: string;
}

export interface FlowData {
  steps: FlowStep[];
  gate?: string;
  branches?: {
    yes: FlowBranch;
    no: FlowBranch;
  };
}

export interface PhaseData {
  number: number;
  title: string;
  duration: string;
  description: string;
  deliverables: string[];
  clientNeeds: string[];
}

export interface TimelinePhase {
  name: string;
  weeks: number;
  color?: string; // defaults to #6c3fff
}

export interface TimelineData {
  totalDuration: string;
  phases: TimelinePhase[];
}

export interface InvestmentData {
  total: string;
  includes: string[];
  note?: string;
}

export interface NextStep {
  action: string;
  detail: string;
}

export interface CtaData {
  label: string;
  href: string;
}

export interface ClientProposalData {
  meta: ProposalMeta;
  hero: HeroData;
  solution: SolutionData;
  flow: FlowData;
  phases: PhaseData[];
  timeline: TimelineData;
  investment: InvestmentData;
  nextSteps: NextStep[];
  cta: CtaData;
}

// ─── Template 2: Internal Automation Doc ─────────────────────────────────────

export interface InternalProjectData {
  client: string;
  name: string;
  status: 'Draft' | 'In Progress' | 'Complete';
  phase: string;
  owner: string;
  date: string;
}

export interface GoalData {
  summary: string;
  problem: string;
  outcome: string;
}

export type WorkflowStepType = 'Automation' | 'AI' | 'Human' | 'Automation & AI';

export interface WorkflowStep {
  number: number;
  type: WorkflowStepType;
  title: string;
  desc: string;
  details: string[];
}

export interface TechEntry {
  tool: string;
  purpose: string;
  notes: string;
}

export type PhaseStatusValue = 'Done' | 'In Progress' | 'Pending' | 'Blocked';

export interface PhaseStatus {
  name: string;
  status: PhaseStatusValue;
  dueDate: string;
  notes: string;
}

export interface NoteEntry {
  date: string;
  author: string;
  note: string;
}

export interface InternalDocData {
  project: InternalProjectData;
  goal: GoalData;
  workflow: WorkflowStep[];
  tech: TechEntry[];
  status: {
    phases: PhaseStatus[];
  };
  notes: NoteEntry[];
}
