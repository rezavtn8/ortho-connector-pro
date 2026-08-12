/**
 * Executes a proposal the user has confirmed.
 *
 * This is the only place a suggestion from the assistant turns into a row in the
 * database, and it runs in the browser, under the user's own session, after a click.
 * The model has no path to any of it — see `supabase/functions/ai-agent/tools.ts`.
 *
 * Campaigns go through `createCampaignWithDeliveries` rather than a fresh insert, so
 * an agent-created campaign is the same object as a hand-created one: same status,
 * same delivery rows, same rollback if the deliveries fail. A parallel write path
 * here would eventually drift and produce campaigns the rest of the app half-renders.
 *
 * Everything is created as a **draft**. Confirming a proposal never sends an email,
 * never posts anything to Google, and never contacts a referring office. The user
 * still opens the campaign and sends it themselves.
 */

import { supabase } from '@/integrations/supabase/client';
import { createCampaignWithDeliveries, type SelectedOffice } from '@/lib/campaigns';
import type { Proposal } from '@/lib/agentProtocol';

export interface ActionResult {
  /** Shown in the toast. */
  message: string;
  /** Where the user can go to see what was made. */
  href: string;
}

async function currentUser() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Your session expired. Sign in again.');
  return user;
}

/**
 * `marketing_visits.rep_name` is NOT NULL, and the dialog fills it from the signed-in
 * user. Matching that here keeps an agent-logged visit indistinguishable from one
 * logged by hand in the visit list.
 */
async function repName(userId: string): Promise<string> {
  const { data } = await supabase
    .from('user_profiles')
    .select('first_name, last_name')
    .eq('user_id', userId)
    .maybeSingle();

  const full = [data?.first_name, data?.last_name].filter(Boolean).join(' ').trim();
  return full || 'Practice team';
}

/**
 * @param tierByOffice office id → tier, from the caller's already-derived network.
 *   `campaign_deliveries.referral_tier` is a real column the campaign screens filter
 *   and colour by, so defaulting every recipient to Cold would quietly mislabel an
 *   agent-built campaign. Passed in rather than re-derived because the caller has
 *   already computed it with the canonical rules.
 */
export async function executeProposal(
  proposal: Proposal,
  tierByOffice?: ReadonlyMap<string, string>,
): Promise<ActionResult> {
  const user = await currentUser();

  if (proposal.kind === 'visit') {
    const rep = await repName(user.id);

    const rows = proposal.offices.map((office) => ({
      office_id: office.id,
      visit_date: proposal.visit_date,
      visit_type: proposal.visit_type || 'Check-in',
      rep_name: rep,
      // Planned, not completed. Marking it visited would put a visit the user has not
      // made into the record the whole product's recency scoring reads from.
      visited: false,
      follow_up_notes: proposal.notes || proposal.rationale || null,
      user_id: user.id,
    }));

    const { error } = await supabase.from('marketing_visits').insert(rows);
    if (error) throw new Error(`Could not schedule the visit: ${error.message}`);

    return {
      message:
        rows.length === 1
          ? `Visit to ${proposal.offices[0].name} scheduled for ${proposal.visit_date}.`
          : `${rows.length} visits scheduled for ${proposal.visit_date}.`,
      href: '/marketing-visits',
    };
  }

  const offices: SelectedOffice[] = proposal.offices.map((office) => ({
    id: office.id,
    name: office.name,
    address: '',
    badge: tierByOffice?.get(office.id) ?? 'Cold',
    origin: 'network',
  }));

  const { id } = await createCampaignWithDeliveries({
    campaign: {
      name: proposal.name,
      campaign_type: proposal.campaign_type,
      delivery_method: proposal.delivery_method,
      notes: [proposal.rationale, proposal.notes].filter(Boolean).join('\n\n') || null,
    },
    offices,
    actionMode:
      proposal.delivery_method === 'email'
        ? 'email_only'
        : proposal.delivery_method === 'letter'
          ? 'letter_only'
          : 'gift_only',
  });

  return {
    message: `"${proposal.name}" created as a draft for ${offices.length} ${
      offices.length === 1 ? 'office' : 'offices'
    }. Nothing has been sent.`,
    href: `/campaigns?id=${id}`,
  };
}
