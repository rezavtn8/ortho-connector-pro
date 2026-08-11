/**
 * Campaign reads and writes that touch Supabase.
 *
 * Pure rules (status, progress, attention) live in `campaignRules` and are re-exported
 * here so every component can keep importing from `@/lib/campaigns`.
 */

import { supabase } from '@/integrations/supabase/client';

export * from './campaignRules';

/** An office chosen in a creator, from either source list. */
export interface SelectedOffice {
  id: string;
  name: string;
  address: string;
  /** Tier for network offices, office type for discovered ones. */
  badge: string;
  email?: string | null;
  origin: 'network' | 'discovered';
}

/**
 * Copy discovered offices into `patient_sources` and map discovered id → source id.
 *
 * `campaign_deliveries.office_id` carries a foreign key to `patient_sources`, so a
 * delivery row pointing at a `discovered_offices` id is rejected outright. Email and
 * gift campaigns built from a discovered group used to fail at exactly that insert,
 * after the campaign row had already been created.
 *
 * @param addToNetwork when false the office is stored inactive — usable for this
 *   campaign, invisible in the user's network lists.
 */
export async function importDiscoveredOffices(
  userId: string,
  discoveredIds: string[],
  addToNetwork: boolean,
): Promise<Map<string, string>> {
  const idMap = new Map<string, string>();
  if (discoveredIds.length === 0) return idMap;

  const { data: discovered, error } = await supabase
    .from('discovered_offices')
    .select(
      'id, name, address, phone, email, website, google_place_id, google_rating, latitude, longitude, distance_miles, opening_hours, yelp_rating, office_type',
    )
    .in('id', discoveredIds);

  if (error) throw new Error(`Could not read the selected offices: ${error.message}`);
  if (!discovered?.length) throw new Error('The selected offices could not be found.');

  for (const office of discovered) {
    if (office.google_place_id) {
      const { data: existing } = await supabase
        .from('patient_sources')
        .select('id')
        .eq('google_place_id', office.google_place_id)
        .eq('created_by', userId)
        .maybeSingle();

      if (existing) {
        idMap.set(office.id, existing.id);
        continue;
      }
    }

    const { data: inserted, error: insertError } = await supabase
      .from('patient_sources')
      .insert({
        name: office.name,
        source_type: 'Office' as any,
        address: office.address,
        phone: office.phone,
        email: office.email,
        website: office.website,
        google_place_id: office.google_place_id,
        google_rating: office.google_rating,
        latitude: office.latitude,
        longitude: office.longitude,
        distance_miles: office.distance_miles,
        opening_hours: office.opening_hours,
        yelp_rating: office.yelp_rating,
        created_by: userId,
        is_active: addToNetwork,
      })
      .select('id')
      .single();

    if (insertError) throw new Error(`Could not add ${office.name}: ${insertError.message}`);
    idMap.set(office.id, inserted.id);

    if (addToNetwork) {
      await supabase.from('discovered_offices').update({ imported: true }).eq('id', office.id);
    }
  }

  return idMap;
}

export interface CreateCampaignInput {
  campaign: Record<string, any>;
  offices: SelectedOffice[];
  actionMode: 'email_only' | 'letter_only' | 'gift_only';
  /** Only consulted when the selection contains discovered offices. */
  addDiscoveredToNetwork?: boolean;
}

/**
 * Create a campaign and its delivery rows as one unit.
 *
 * If the delivery insert fails the campaign row is removed again — the previous code
 * left behind an empty campaign that the list then rendered as "0 offices" forever.
 */
export async function createCampaignWithDeliveries({
  campaign,
  offices,
  actionMode,
  addDiscoveredToNetwork = false,
}: CreateCampaignInput): Promise<{ id: string }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Your session expired. Sign in again to create a campaign.');

  const discoveredIds = offices.filter((o) => o.origin === 'discovered').map((o) => o.id);
  const idMap = discoveredIds.length
    ? await importDiscoveredOffices(user.id, discoveredIds, addDiscoveredToNetwork)
    : new Map<string, string>();

  const { data: created, error: campaignError } = await supabase
    .from('campaigns')
    .insert({ ...campaign, status: 'Draft', created_by: user.id } as any)
    .select('id')
    .single();

  if (campaignError) throw new Error(campaignError.message);

  const deliveries = offices.map((office) => ({
    campaign_id: created.id,
    office_id: idMap.get(office.id) ?? office.id,
    action_mode: actionMode,
    delivery_status: 'Not Started',
    email_status: actionMode === 'gift_only' ? null : 'pending',
    gift_status: actionMode === 'gift_only' ? 'pending' : null,
    referral_tier: office.badge || 'Cold',
    created_by: user.id,
  }));

  const { error: deliveryError } = await supabase.from('campaign_deliveries').insert(deliveries);

  if (deliveryError) {
    await supabase.from('campaigns').delete().eq('id', created.id);
    throw new Error(deliveryError.message);
  }

  return { id: created.id };
}
