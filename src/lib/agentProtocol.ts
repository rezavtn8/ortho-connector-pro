/**
 * The wire contract between the browser and the `ai-agent` edge function.
 *
 * Kept in one file, imported by the hook and by every component that renders a piece
 * of a turn, so a change to the event shape breaks at compile time rather than as a
 * blank message in production. The function's own copies of `AgentEvent` and
 * `Proposal` are the other half of this contract; they are duplicated there because
 * Supabase bundles a function from its own directory.
 */

/** A proposed change, awaiting a human. Nothing has happened when one of these arrives. */
export type Proposal =
  | {
      kind: 'visit';
      title: string;
      rationale: string;
      offices: Array<{ id: string; name: string }>;
      visit_date: string;
      visit_type: string;
      notes: string;
    }
  | {
      kind: 'campaign';
      title: string;
      rationale: string;
      offices: Array<{ id: string; name: string }>;
      name: string;
      campaign_type: string;
      delivery_method: 'email' | 'letter' | 'physical';
      notes: string;
    };

export type AgentEvent =
  | { type: 'text'; delta: string }
  | { type: 'tool_start'; id: string; name: string }
  | { type: 'tool_end'; id: string; name: string; summary: string; ok: boolean }
  | { type: 'proposal'; id: string; proposal: Proposal }
  | { type: 'done'; tokens: number }
  | { type: 'error'; message: string };

/** A lookup the assistant performed, shown so the user can see what was consulted. */
export interface ToolTrace {
  id: string;
  name: string;
  /** Null while still running. */
  summary: string | null;
  ok: boolean;
}

export type ProposalState = 'pending' | 'accepted' | 'dismissed' | 'failed';

export interface ProposalRecord {
  id: string;
  proposal: Proposal;
  state: ProposalState;
  /** Set when accepted, so the card can link to what it produced. */
  resultHref?: string;
  error?: string;
}

export interface AgentMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  at: number;
  traces?: ToolTrace[];
  proposals?: ProposalRecord[];
  /** Set when the turn ended badly; rendered as an inline notice, not as prose. */
  error?: string;
}

/**
 * Human label for a tool name.
 *
 * The user should be able to read the trace and know what the assistant looked at
 * without knowing the schema. Present tense while running reads better than a
 * past-tense label that appears before the work is done.
 */
export const TOOL_LABELS: Record<string, string> = {
  list_offices: 'Reading the referral network',
  get_office: 'Opening an office record',
  referral_trend: 'Reading practice volume',
  list_visits: 'Checking visit history',
  list_reviews: 'Checking reviews',
  list_campaigns: 'Checking existing campaigns',
  propose_visit: 'Drafting a visit',
  propose_campaign: 'Drafting a campaign',
};

export function toolLabel(name: string): string {
  return TOOL_LABELS[name] ?? name.replace(/_/g, ' ');
}
