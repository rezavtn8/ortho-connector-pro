import type { FlowTier } from '@/lib/officeMetrics';

export type { FlowTier };

/**
 * One of the practice's own locations — the destination patients flow *into*.
 *
 * MULTI-LOCATION SEAM: this is always consumed as `Hub[]`, never as a singular
 * `hub` prop, even though the app currently supports exactly one clinic per user
 * (`user_profiles.clinic_id` is a scalar and the `create_clinic_for_user` RPC
 * rejects a second clinic). Note `clinics.owner_id` has no unique constraint, so
 * additional rows are already physically possible. Keeping every signature plural
 * means adding a second location later is a data change, not a rewrite.
 */
export interface Hub {
  id: string;
  name: string;
  address: string | null;
  latitude: number;
  longitude: number;
  /** True for the clinic referenced by `user_profiles.clinic_id`. */
  isPrimary: boolean;
}

/** A referring office, with its full monthly history attached. */
export interface MapOffice {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  google_rating: number | null;
  latitude: number;
  longitude: number;
  tier: FlowTier;
  percentile: number | null;
  l12: number;
  r3: number;
  mslr: number;
  totalReferrals: number;
  currentMonthReferrals: number;
  lastActiveMonth: string | null;
  /** year_month -> patient_count, for the sparkline and the scrubber. */
  monthly: Record<string, number>;
}

/**
 * One office → one hub edge for one month.
 *
 * MULTI-LOCATION SEAM: `hubId` is carried and populated today even though it is
 * always `hubs[0].id`. Arc geometry is cached by `${sourceId}|${hubId}` and arc
 * features carry `hubId` in their GeoJSON properties, so per-location filtering
 * later is a single `setFilter` call.
 */
export interface Flow {
  sourceId: string;
  hubId: string;
  count: number;
}

export const TIER_ORDER: readonly FlowTier[] = ['VIP', 'Warm', 'Cold', 'Dormant'] as const;

export function isFlowTier(value: unknown): value is FlowTier {
  return typeof value === 'string' && (TIER_ORDER as readonly string[]).includes(value);
}
