/**
 * The catalogue of Insights views, and the option labels each one offers.
 *
 * Kept out of the chart components so those files export components and nothing else
 * — a component module that also exports constants breaks React Fast Refresh, which
 * turns every tweak to a chart into a full page reload while you are iterating on it.
 */

import type { NetworkMode } from './CircularNetworkChart';
import type { RadialMetric } from './RadialBarChart';
import type { SankeyEndColumn } from './SankeyChart';
import type { FingerprintSort } from './fingerprint';
import type { TidesBasis } from './TidesChart';
import type { ChordBasis, ChordWeight } from './ChordChart';

export type InsightsTab =
  | 'network'
  | 'radial'
  | 'sankey'
  | 'fingerprint'
  | 'tides'
  | 'orbit'
  | 'chord';

export const INSIGHTS_TABS: readonly InsightsTab[] = [
  'network',
  'radial',
  'fingerprint',
  'tides',
  'sankey',
  'chord',
  'orbit',
];

export const TAB_LABELS: Record<InsightsTab, string> = {
  network: 'Network',
  radial: 'Radial',
  fingerprint: 'Fingerprint',
  tides: 'Tides',
  sankey: 'Sankey',
  chord: 'Chord',
  orbit: 'Orbit',
};

/** One line under the header, so a view explains itself before you have to poke it. */
export const TAB_BLURBS: Record<InsightsTab, string> = {
  network: 'Every office on a ring, linked to what connects them.',
  radial: 'One bar per office, grouped by tier.',
  fingerprint: 'Every office against every month, as a grid.',
  tides: 'How the book was composed, month by month.',
  sankey: 'Where the volume comes from, and what it becomes.',
  chord: 'How much volume shifted from one state to another.',
  orbit: 'Which direction your patients travel from.',
};

export const NETWORK_MODE_LABELS: Record<NetworkMode, string> = {
  outreach: 'Outreach',
  movement: 'Tier movement',
  tags: 'Tags',
  campaigns: 'Campaigns',
};

export const RADIAL_METRIC_LABELS: Record<RadialMetric, string> = {
  patients: 'Patients',
  change: 'Change vs baseline',
  consistency: 'Consistency',
  recency: 'Recency',
};

export const SANKEY_END_LABELS: Record<SankeyEndColumn, string> = {
  clinic: '→ Your practice',
  momentum: '→ Momentum',
  outreach: '→ Outreach reach',
};

export const FINGERPRINT_SORT_LABELS: Record<FingerprintSort, string> = {
  volume: 'Volume',
  name: 'Name',
  recency: 'Most recent',
  consistency: 'Most consistent',
  trend: 'Biggest gain',
};

export const TIDES_BASIS_LABELS: Record<TidesBasis, string> = {
  tier: 'By tier',
  sourceType: 'By source type',
};

export const CHORD_WEIGHT_LABELS: Record<ChordWeight, string> = {
  patients: 'Weight by patients',
  offices: 'Weight by offices',
};

export const CHORD_BASIS_LABELS: Record<ChordBasis, string> = {
  momentum: 'Momentum shifts',
  tier: 'Tier shifts',
};
