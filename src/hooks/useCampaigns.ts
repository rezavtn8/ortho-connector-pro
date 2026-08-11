import { useCallback, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { startOfDay } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useResilientQuery } from '@/hooks/useResilientQuery';
import { fetchAllRows } from '@/lib/supabasePaging';
import { now } from '@/lib/dateSync';
import {
  aggregateDeliveries,
  attentionFor,
  copyableCampaignFields,
  EMPTY_STATS,
  normalizeMethod,
  normalizeStatus,
  progressFor,
  type Attention,
  type CampaignStatus,
  type DeliveryMethod,
  type DeliveryRow,
  type DeliveryStats,
  type Progress,
} from '@/lib/campaigns';

/** The campaign columns the list view actually needs. */
const CAMPAIGN_COLUMNS =
  'id, name, status, campaign_type, delivery_method, campaign_mode, created_at, ' +
  'planned_delivery_date, notes, selected_gift_bundle, estimated_cost, actual_referrals, ' +
  'materials_checklist, assigned_rep_id, clinic_id';

export interface CampaignRecord {
  id: string;
  name: string;
  status: string;
  campaign_type: string;
  delivery_method: string;
  campaign_mode: string | null;
  created_at: string;
  planned_delivery_date: string | null;
  notes: string | null;
  selected_gift_bundle: any;
  estimated_cost: number | null;
  actual_referrals: number | null;
  materials_checklist: string[] | null;
  assigned_rep_id: string | null;
  clinic_id: string | null;
}

export interface Campaign extends CampaignRecord {
  method: DeliveryMethod;
  statusLabel: CampaignStatus;
  stats: DeliveryStats;
  progress: Progress;
  attention: Attention | null;
}

/**
 * Campaigns plus their delivery roll-up.
 *
 * Two queries, both scoped: the delivery read used to pull *every* delivery row in the
 * account with no `campaign_id` filter — and, being unpaged, silently stopped at
 * PostgREST's 1000-row ceiling, so a large account saw under-counted progress bars.
 */
export function useCampaigns() {
  const query = useResilientQuery<Campaign[]>({
    queryKey: ['campaigns'],
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .from('campaigns')
        .select(CAMPAIGN_COLUMNS)
        .order('created_at', { ascending: false });

      if (error) throw error;
      const campaigns = (rows ?? []) as unknown as CampaignRecord[];
      if (campaigns.length === 0) return [];

      const ids = campaigns.map((c) => c.id);
      const deliveries = await fetchAllRows<DeliveryRow>(() =>
        supabase
          .from('campaign_deliveries')
          .select('campaign_id, office_id, referral_tier, email_status, gift_status')
          .in('campaign_id', ids),
      );

      const statsByCampaign = aggregateDeliveries(deliveries);
      const today = startOfDay(now());

      return campaigns.map((campaign) => {
        const method = normalizeMethod(campaign.delivery_method);
        const stats = statsByCampaign.get(campaign.id) ?? EMPTY_STATS;
        return {
          ...campaign,
          method,
          statusLabel: normalizeStatus(campaign.status),
          stats,
          progress: progressFor(method, stats),
          attention: attentionFor(campaign, method, stats, today),
        };
      });
    },
    // The page is driven by explicit refetches after every mutation; a 5-minute poll
    // only re-ran the (previously very expensive) delivery scan behind the user's back.
    refetchOnWindowFocus: true,
    fallbackData: [],
    retryMessage: 'Refreshing campaigns...',
  });

  return query;
}

/**
 * Mutations for a campaign row.
 *
 * Every call checks the `error` the Supabase client *returns* — it does not throw, so
 * the previous `try/catch` around these writes could never fire and a failed delete or
 * status change still reported success.
 */
export function useCampaignActions() {
  const queryClient = useQueryClient();

  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['campaigns'] });
  }, [queryClient]);

  const setStatus = useCallback(
    async (campaign: Campaign, status: CampaignStatus) => {
      const { error } = await supabase
        .from('campaigns')
        .update({ status })
        .eq('id', campaign.id);

      if (error) {
        toast.error('Could not update status', { description: error.message });
        return false;
      }
      toast.success(`"${campaign.name}" is now ${status}`);
      refresh();
      return true;
    },
    [refresh],
  );

  const remove = useCallback(
    async (campaign: Campaign) => {
      const { error: deliveryError } = await supabase
        .from('campaign_deliveries')
        .delete()
        .eq('campaign_id', campaign.id);

      if (deliveryError) {
        toast.error('Could not delete campaign', { description: deliveryError.message });
        return false;
      }

      const { error } = await supabase.from('campaigns').delete().eq('id', campaign.id);
      if (error) {
        toast.error('Could not delete campaign', { description: error.message });
        return false;
      }

      toast.success(`Deleted "${campaign.name}"`);
      refresh();
      return true;
    },
    [refresh],
  );

  const duplicate = useCallback(
    async (campaign: Campaign) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Your session expired. Sign in again.');
        return false;
      }

      const { data: created, error } = await supabase
        .from('campaigns')
        .insert({
          ...copyableCampaignFields(campaign),
          name: nextCopyName(campaign.name),
          status: 'Draft',
          created_by: user.id,
        } as any)
        .select('id')
        .single();

      if (error) {
        toast.error('Could not duplicate campaign', { description: error.message });
        return false;
      }

      const { data: sourceDeliveries, error: readError } = await supabase
        .from('campaign_deliveries')
        .select('office_id, referral_tier, action_mode')
        .eq('campaign_id', campaign.id);

      if (readError) {
        await supabase.from('campaigns').delete().eq('id', created.id);
        toast.error('Could not duplicate campaign', { description: readError.message });
        return false;
      }

      if (sourceDeliveries?.length) {
        // Reset the tracking columns — a copy starts unsent. Which column matters is
        // decided by the campaign's own method, not by `action_mode`, which is null on
        // rows written before that field existed.
        const isGift = campaign.method === 'physical';
        const { error: insertError } = await supabase.from('campaign_deliveries').insert(
          sourceDeliveries.map((d) => ({
            campaign_id: created.id,
            office_id: d.office_id,
            referral_tier: d.referral_tier,
            action_mode: d.action_mode,
            delivery_status: 'Not Started',
            email_status: isGift ? null : 'pending',
            gift_status: isGift ? 'pending' : null,
            created_by: user.id,
          })),
        );

        if (insertError) {
          await supabase.from('campaigns').delete().eq('id', created.id);
          toast.error('Could not duplicate campaign', { description: insertError.message });
          return false;
        }
      }

      toast.success(`Copied "${campaign.name}"`, {
        description: `${sourceDeliveries?.length ?? 0} offices carried over as a new draft.`,
      });
      refresh();
      return true;
    },
    [refresh],
  );

  /** Records the referrals a finished campaign is credited with. */
  const saveOutcome = useCallback(
    async (campaign: Campaign, referrals: number | null) => {
      const { error } = await supabase
        .from('campaigns')
        .update({ actual_referrals: referrals })
        .eq('id', campaign.id);

      if (error) {
        toast.error('Could not save the result', { description: error.message });
        return false;
      }
      toast.success('Result saved');
      refresh();
      return true;
    },
    [refresh],
  );

  return useMemo(
    () => ({ setStatus, remove, duplicate, saveOutcome, refresh }),
    [setStatus, remove, duplicate, saveOutcome, refresh],
  );
}

/** "Spring Outreach" → "Spring Outreach (Copy)" → "Spring Outreach (Copy 2)". */
function nextCopyName(name: string): string {
  const match = name.match(/^(.*) \(Copy(?: (\d+))?\)$/);
  if (!match) return `${name} (Copy)`;
  const n = match[2] ? Number(match[2]) + 1 : 2;
  return `${match[1]} (Copy ${n})`;
}
