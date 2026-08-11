import type {
  InsightsCampaign,
  InsightsData,
  InsightsOffice,
  InsightsSource,
  InsightsTag,
} from '@/hooks/useInsightsData';
import { bearingDegrees, distanceMiles } from '../geo';
import { buildMonthlySeries, monthKey, type MonthlyRow } from '@/lib/officeMetrics';
import { tierSnapshot } from '@/lib/tierSnapshot';
import { toOutreachEvents } from '../outreach';

/**
 * Synthetic referral networks for the dev preview harness.
 *
 * Fully deterministic — a small LCG rather than `Math.random` — so the preview renders
 * identically on every reload and two screenshots can actually be compared.
 *
 * The point of this file is the degenerate scenarios. A chart that looks right against
 * forty tidy offices is not the one that breaks in production; the ones that break are
 * the empty window, the single office, the practice that has never logged an outreach
 * touch, and the ring with two hundred names on it. All of those are one click away in
 * the harness.
 */

function lcg(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

const NAMES = [
  'Harborview Dental', 'Bristol Family Dentistry', 'Northgate Orthodontics',
  'Coastline Smile Studio', 'Redwood Pediatric Dental', 'Vista Ridge Dental',
  'Sunset Park Dentistry', 'Ironwood Oral Surgery', 'Cypress Grove Dental',
  'Lakeside Family Smiles', 'Monarch Dental Arts', 'Foothill Dental Care',
  'Baywood Periodontics', 'Silver Creek Dentistry', 'Union Square Dental',
  'Granite Bay Smiles', 'Meridian Dental Group', 'Alder Street Dental',
  'Pinecrest Dental', 'Camden Family Dental', 'Wexford Dental Studio',
  'Ashford Oral Health', 'Belmont Dental Partners', 'Kingsway Dentistry',
  'Thornbury Dental', 'Fairmount Smile Center', 'Oakhaven Dental',
  'Rosewood Orthodontics', 'Larkspur Dental Care', 'Windmere Family Dental',
];

const OTHER_TYPES = ['Google', 'Yelp', 'Website', 'Word of Mouth', 'Social Media'] as const;

/** A month axis of `count` months ending at `nowDate`. */
function axis(nowDate: Date, count: number): string[] {
  const out: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    out.push(monthKey(new Date(nowDate.getFullYear(), nowDate.getMonth() - i, 1)));
  }
  return out;
}

/** Irvine, CA — the fixtures' stand-in practice. */
const ORIGIN = { latitude: 33.6846, longitude: -117.8265 };

const TAG_NAMES = ['Key partner', 'Pediatric', 'Perio referral', 'Lunch club', 'New 2026'];
const CAMPAIGN_NAMES = ['Spring gift drop', 'Summer lunch tour', 'Holiday cards', 'Re-engage cold'];

export interface FixtureOptions {
  officeCount: number;
  otherCount?: number;
  months?: number;
  /** Rows are generated but every count is zero, to exercise the empty-window path. */
  allZero?: boolean;
  /** Skip outreach rows entirely, to exercise the "never contacted" banner. */
  noOutreach?: boolean;
  /** Force every office into one tier by giving them identical history. */
  singleTier?: boolean;
  /** One office carries most of the volume. */
  outlier?: boolean;
  /** Strip every coordinate, to exercise the Orbit empty state. */
  noGeo?: boolean;
  /** Strip tags and campaigns, to exercise those network modes' empty states. */
  noGroups?: boolean;
  /** Cluster every office along one bearing, to exercise beeswarm relaxation. */
  oneDirection?: boolean;
  seed?: number;
}

export function makeInsightsFixture(opts: FixtureOptions, nowDate: Date): InsightsData {
  const {
    officeCount,
    otherCount = 4,
    months: monthCount = 18,
    allZero = false,
    noOutreach = false,
    singleTier = false,
    outlier = false,
    noGeo = false,
    noGroups = false,
    oneDirection = false,
    seed = 7,
  } = opts;

  const rand = lcg(seed);
  const months = axis(nowDate, monthCount);

  const officeCohort = Array.from({ length: officeCount }, (_, i) => ({
    id: `office-${i}`,
    name: NAMES[i % NAMES.length] + (i >= NAMES.length ? ` ${Math.floor(i / NAMES.length) + 1}` : ''),
  }));

  const monthlyRows: MonthlyRow[] = [];

  officeCohort.forEach((office, i) => {
    // A per-office baseline volume, then a drift so tiers actually move between
    // windows and the movement view has something to show.
    const strength = singleTier ? 4 : Math.max(0, Math.round(rand() * 9) - (i % 5));
    const drift = (rand() - 0.5) * 0.8;
    const boost = outlier && i === 0 ? 12 : 1;

    months.forEach((ym, m) => {
      if (allZero) {
        monthlyRows.push({ source_id: office.id, year_month: ym, patient_count: 0 });
        return;
      }
      const trend = 1 + drift * (m / Math.max(1, monthCount - 1));
      const noise = 0.6 + rand() * 0.8;
      const count = Math.max(0, Math.round(strength * trend * noise * boost));
      if (count > 0) monthlyRows.push({ source_id: office.id, year_month: ym, patient_count: count });
    });
  });

  const otherSourcesRaw = Array.from({ length: otherCount }, (_, i) => ({
    id: `other-${i}`,
    name: OTHER_TYPES[i % OTHER_TYPES.length],
    sourceType: OTHER_TYPES[i % OTHER_TYPES.length] as InsightsSource['sourceType'],
  }));

  const otherRows: MonthlyRow[] = [];
  otherSourcesRaw.forEach((s, i) => {
    months.forEach((ym) => {
      if (allZero) return;
      const count = Math.max(0, Math.round((5 - i) * (0.5 + rand())));
      if (count > 0) otherRows.push({ source_id: s.id, year_month: ym, patient_count: count });
    });
  });

  const officeSeries = buildMonthlySeries(monthlyRows);
  const otherSeries = buildMonthlySeries(otherRows);
  const monthSet = new Set(months);

  const visible = (series: ReturnType<typeof buildMonthlySeries>, id: string) => {
    const monthly: Record<string, number> = {};
    for (const [ym, count] of series.get(id) ?? []) if (monthSet.has(ym)) monthly[ym] = count;
    return monthly;
  };

  const withMetrics = tierSnapshot(officeCohort, officeSeries, monthKey(nowDate), nowDate);

  const tags: InsightsTag[] = noGroups
    ? []
    : TAG_NAMES.map((name, i) => ({ id: `tag-${i}`, name, color: null }));
  const campaigns: InsightsCampaign[] = noGroups
    ? []
    : CAMPAIGN_NAMES.map((name, i) => ({
        id: `camp-${i}`,
        name,
        campaignType: 'gift',
        status: 'completed',
      }));

  let officesWithNoReferrals = 0;
  let officesWithoutLocation = 0;

  const offices: InsightsOffice[] = withMetrics.map((o) => {
    if (o.totalReferrals === 0) officesWithNoReferrals++;

    const index = Number(o.id.split('-')[1] ?? 0);

    // A plausible catchment: mostly clustered inside ten miles with a thinning tail,
    // and (unless `oneDirection`) spread around the compass.
    const spin = rand();
    const bearing = oneDirection ? 115 + (spin - 0.5) * 26 : spin * 360;
    const miles = 0.6 + Math.pow(rand(), 2.2) * 26;
    const dLat = (miles / 69) * Math.cos((bearing * Math.PI) / 180);
    const dLng = (miles / (69 * Math.cos((ORIGIN.latitude * Math.PI) / 180))) *
      Math.sin((bearing * Math.PI) / 180);
    const point = noGeo
      ? null
      : { latitude: ORIGIN.latitude + dLat, longitude: ORIGIN.longitude + dLng };
    if (!point) officesWithoutLocation++;

    // Many-to-many membership, so the categorical network views have real bundles.
    const tagIds = tags.filter((_, t) => (index + t) % (3 + t) === 0).map((t) => t.id);
    const campaignIds = campaigns.filter((_, c) => (index * 2 + c) % (4 + c) === 0).map((c) => c.id);

    return {
      id: o.id,
      name: o.name,
      tier: o.tier,
      percentile: o.percentile,
      totalReferrals: o.totalReferrals,
      l12: o.l12,
      r3: o.r3,
      mslr: o.mslr,
      lastActiveMonth: o.lastActiveMonth,
      monthly: visible(officeSeries, o.id),
      distanceMiles: point ? distanceMiles(ORIGIN, point) : null,
      bearingDeg: point ? bearingDegrees(ORIGIN, point) : null,
      googleRating: point ? Math.round((3.4 + rand() * 1.6) * 10) / 10 : null,
      tagIds,
      campaignIds,
    };
  });

  const otherSources: InsightsSource[] = otherSourcesRaw.map((s) => ({
    ...s,
    monthly: visible(otherSeries, s.id),
  }));

  const totalsByMonth: Record<string, number> = {};
  let latestMonthWithData: string | null = null;
  for (const m of months) {
    let total = 0;
    for (const o of offices) total += o.monthly[m] ?? 0;
    for (const s of otherSources) total += s.monthly[m] ?? 0;
    totalsByMonth[m] = total;
    if (total > 0) latestMonthWithData = m;
  }

  const visits: Array<{ office_id: string; visit_date: string; visited: boolean }> = [];
  const deliveries: Array<{
    office_id: string;
    delivered_at: string | null;
    delivery_status: string;
    email_status: string | null;
    email_sent_at: string | null;
    created_at: string;
  }> = [];

  if (!noOutreach) {
    officeCohort.forEach((office, i) => {
      months.forEach((ym) => {
        const roll = rand();
        // Roughly a third of offices go untouched, which is what makes the "never
        // contacted" hub carry real weight rather than being a token circle.
        if (i % 3 === 0) return;
        if (roll > 0.86) visits.push({ office_id: office.id, visit_date: `${ym}-12`, visited: true });
        if (roll < 0.1) {
          deliveries.push({
            office_id: office.id,
            delivered_at: `${ym}-04`,
            delivery_status: 'delivered',
            email_status: roll < 0.05 ? 'sent' : null,
            email_sent_at: roll < 0.05 ? `${ym}-06` : null,
            created_at: `${ym}-01`,
          });
        }
      });
    });
  }

  return {
    months,
    latestMonthWithData,
    totalsByMonth,
    offices,
    otherSources,
    officeSeries,
    officeCohort,
    outreach: toOutreachEvents({ visits, deliveries }),
    clinics: [{ id: 'clinic-1', name: 'Nexora Orthodontics' }],
    origin: noGeo ? null : ORIGIN,
    tags,
    campaigns,
    counts: {
      offices: offices.length,
      otherSources: otherSources.length,
      visits: visits.length,
      deliveries: deliveries.length,
      emails: 0,
      officesWithNoReferrals,
      officesWithoutLocation,
    },
    campaignScopeIsOwnerOnly: true,
  };
}

export interface Scenario {
  id: string;
  label: string;
  options: FixtureOptions;
}

/** The cases worth looking at. The tidy one is first; the rest are where things break. */
export const SCENARIOS: Scenario[] = [
  { id: 'typical', label: 'Typical (28 offices)', options: { officeCount: 28 } },
  { id: 'busy', label: 'Busy (120 offices)', options: { officeCount: 120, seed: 11 } },
  {
    id: 'crowded',
    label: 'Crowded (220 — labels drop to ticks)',
    options: { officeCount: 220, seed: 13 },
  },
  { id: 'one', label: 'One office', options: { officeCount: 1, otherCount: 1 } },
  { id: 'none', label: 'No offices', options: { officeCount: 0, otherCount: 0 } },
  {
    id: 'zero',
    label: 'All zeros (empty window)',
    options: { officeCount: 20, allZero: true },
  },
  {
    id: 'no-outreach',
    label: 'No outreach logged',
    options: { officeCount: 30, noOutreach: true, seed: 17 },
  },
  {
    id: 'single-tier',
    label: 'Every office identical',
    options: { officeCount: 16, singleTier: true },
  },
  { id: 'outlier', label: 'One dominant referrer', options: { officeCount: 24, outlier: true } },
  { id: 'short', label: 'Only 3 months of history', options: { officeCount: 20, months: 3 } },
  { id: 'long', label: 'Two full years', options: { officeCount: 34, months: 24, seed: 23 } },
  {
    id: 'no-geo',
    label: 'No addresses (Orbit empty)',
    options: { officeCount: 24, noGeo: true },
  },
  {
    id: 'no-groups',
    label: 'No tags or campaigns',
    options: { officeCount: 24, noGroups: true },
  },
  {
    id: 'one-direction',
    label: 'Catchment on one corridor',
    options: { officeCount: 46, oneDirection: true, seed: 29 },
  },
];
