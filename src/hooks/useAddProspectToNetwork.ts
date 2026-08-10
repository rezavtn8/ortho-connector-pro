import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { PATIENT_FLOW_QUERY_KEY } from '@/hooks/usePatientFlowData';
import type { DiscoveredOffice } from '@/hooks/useDiscoveredOffices';

/**
 * Promote one discovered prospect into the referral network.
 *
 * Deliberately duplicate-safe. The bulk importer inserts unconditionally, which is
 * survivable when you run it once over a selection — but a button on a map pin is
 * one mis-click away from a second copy of an office, and a duplicated office splits
 * that practice's referral history across two rows. Every count, tier and trend the
 * product reports for them is then wrong, quietly and permanently.
 *
 * So this checks first, on `google_place_id` where Google gave us one, and on an
 * exact name + address match otherwise. A prospect that is already in the network is
 * reported as such and its `imported` flag repaired, rather than inserted again.
 */

export type AddProspectOutcome = 'added' | 'already-in-network';

export interface AddProspectResult {
  outcome: AddProspectOutcome;
  name: string;
}

async function findExistingSourceId(office: DiscoveredOffice): Promise<string | null> {
  if (office.google_place_id) {
    const { data, error } = await supabase
      .from('patient_sources')
      .select('id')
      .eq('google_place_id', office.google_place_id)
      .limit(1);
    if (error) throw error;
    if (data && data.length > 0) return data[0].id;
  }

  // No place id — fall back to an exact name match, narrowed by address when we
  // have one. Deliberately strict: a false positive here silently *refuses* to add
  // a real office, which is harder to notice than an extra row.
  let query = supabase.from('patient_sources').select('id').eq('name', office.name).limit(1);
  query = office.address ? query.eq('address', office.address) : query.is('address', null);

  const { data, error } = await query;
  if (error) throw error;
  return data && data.length > 0 ? data[0].id : null;
}

export function useAddProspectToNetwork() {
  const queryClient = useQueryClient();

  return useMutation<AddProspectResult, Error, DiscoveredOffice>({
    mutationFn: async (office) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('You are signed out. Please sign in and try again.');

      const existingId = await findExistingSourceId(office);

      if (!existingId) {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('clinic_id')
          .eq('user_id', user.id)
          .single();

        const { error: insertError } = await supabase.from('patient_sources').insert({
          name: office.name,
          address: office.address,
          phone: office.phone,
          website: office.website,
          google_place_id: office.google_place_id,
          google_rating: office.google_rating,
          latitude: office.latitude,
          longitude: office.longitude,
          distance_miles: office.distance_miles,
          source_type: 'Office',
          created_by: user.id,
          clinic_id: profile?.clinic_id,
          notes: office.office_type
            ? `Added from the map. Type: ${office.office_type}`
            : 'Added from the map.',
        });
        if (insertError) throw insertError;
      }

      // Runs in both branches: an office that is in the network but still flagged as
      // a prospect is exactly the stale state this repairs.
      const { error: flagError } = await supabase
        .from('discovered_offices')
        .update({ imported: true })
        .eq('id', office.id);
      if (flagError) throw flagError;

      return { outcome: existingId ? 'already-in-network' : 'added', name: office.name };
    },

    onSuccess: () => {
      // The pin has to leave the prospect layer and the office has to appear in the
      // network, so both queries are stale. Refetching is what makes the map agree
      // with the database without a reload.
      queryClient.invalidateQueries({ queryKey: ['discovered-offices'] });
      queryClient.invalidateQueries({ queryKey: PATIENT_FLOW_QUERY_KEY });
    },
  });
}
