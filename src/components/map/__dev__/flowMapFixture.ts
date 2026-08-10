import type { DiscoveredOffice } from '@/hooks/useDiscoveredOffices';
import type { PatientFlowData } from '@/hooks/usePatientFlowData';
import type { Flow, FlowTier, Hub, MapOffice } from '../types';

/**
 * Synthetic referral network for the dev preview harness.
 *
 * Fully deterministic — a small LCG rather than Math.random — so the preview looks
 * identical on every reload and screenshots can be compared across changes.
 */

const HUB: [number, number] = [-117.8265, 33.6846]; // Irvine, CA

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
  'Thornton Smile Centre', 'Everglade Dental', 'Fairmont Dental Care',
  'Larkspur Dental', 'Windermere Dentistry', 'Sable Ridge Dental',
];

function monthsBack(from: Date, count: number): string[] {
  const out: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(from.getFullYear(), from.getMonth() - i, 1);
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return out;
}

export function buildFixture(now = new Date(2026, 7, 7)): PatientFlowData {
  const rand = lcg(20260807);
  const months = monthsBack(now, 24);

  const hubs: Hub[] = [
    {
      id: 'hub-1',
      name: 'Nexora Orthodontics — Irvine',
      address: '2600 Michelson Dr, Irvine, CA',
      latitude: HUB[1],
      longitude: HUB[0],
      isPrimary: true,
    },
  ];

  const offices: MapOffice[] = [];
  const monthlyByOffice: Array<Record<string, number>> = [];

  for (let i = 0; i < NAMES.length; i++) {
    // Scatter around the hub, denser near the centre.
    const angle = rand() * Math.PI * 2;
    const radius = 0.02 + Math.pow(rand(), 1.7) * 0.42;
    const longitude = HUB[0] + Math.cos(angle) * radius * 1.2;
    const latitude = HUB[1] + Math.sin(angle) * radius;

    // A baseline volume with a trend, so playback shows real movement.
    const baseline = Math.pow(rand(), 2.1) * 26;
    const trend = (rand() - 0.45) * 0.9;
    const startsLate = rand() < 0.25 ? Math.floor(rand() * 12) : 0;
    const goesDormant = rand() < 0.18;
    const dormantFrom = goesDormant ? 12 + Math.floor(rand() * 9) : months.length;

    const monthly: Record<string, number> = {};
    let total = 0;
    let last: string | null = null;

    months.forEach((m, idx) => {
      // The newest month is deliberately empty: counts get entered at month end,
      // which is exactly the condition that used to open the map on nothing.
      if (idx >= months.length - 1) return;
      if (idx < startsLate || idx >= dormantFrom) return;

      const seasonal = 1 + 0.28 * Math.sin((idx / 12) * Math.PI * 2);
      const noise = 0.55 + rand() * 0.95;
      const value = Math.round(baseline * seasonal * noise + trend * idx);
      if (value <= 0) return;

      monthly[m] = value;
      total += value;
      last = m;
    });

    if (total === 0) continue;

    const recent3 = months.slice(-4, -1).reduce((s, m) => s + (monthly[m] ?? 0), 0);
    const l12 = months.slice(-13, -1).reduce((s, m) => s + (monthly[m] ?? 0), 0);
    const lastIdx = last ? months.indexOf(last) : -1;
    const mslr = lastIdx < 0 ? 999 : months.length - 1 - lastIdx;

    offices.push({
      id: `office-${i}`,
      name: NAMES[i],
      address: `${100 + Math.floor(rand() * 900)} Example Ave, Irvine, CA`,
      phone: '(949) 555-0142',
      email: null,
      website: 'https://example.com',
      google_rating: Math.round((3.4 + rand() * 1.6) * 10) / 10,
      latitude,
      longitude,
      tier: 'Cold',
      percentile: null,
      l12,
      r3: recent3,
      mslr,
      totalReferrals: total,
      currentMonthReferrals: 0,
      lastActiveMonth: last,
      monthly,
    });
    monthlyByOffice.push(monthly);
  }

  // Same relative tiering the real derivation uses: dormant split, then quartiles.
  const dormant = offices.filter((o) => o.mslr >= 6);
  const active = offices
    .filter((o) => o.mslr < 6)
    .sort((a, b) => b.totalReferrals - a.totalReferrals || a.mslr - b.mslr);

  const q1 = Math.ceil(active.length * 0.25);
  const q2 = Math.ceil(active.length * 0.5);
  active.forEach((o, idx) => {
    o.tier = (idx < q1 ? 'VIP' : idx < q2 ? 'Warm' : 'Cold') as FlowTier;
    o.percentile = Math.round(((active.length - idx) / active.length) * 100);
  });
  dormant.forEach((o) => {
    o.tier = 'Dormant';
    o.percentile = null;
  });

  const flowsByMonth: Record<string, Flow[]> = {};
  const totalsByMonth: Record<string, number> = {};
  let maxFlowCount = 0;
  let latestMonthWithData: string | null = null;

  for (const month of months) {
    const flows: Flow[] = [];
    let total = 0;
    for (const office of offices) {
      const count = office.monthly[month] ?? 0;
      if (count <= 0) continue;
      flows.push({ sourceId: office.id, hubId: 'hub-1', count });
      total += count;
      if (count > maxFlowCount) maxFlowCount = count;
    }
    flowsByMonth[month] = flows;
    totalsByMonth[month] = total;
    if (flows.length > 0) latestMonthWithData = month;
  }

  return {
    hubs,
    offices,
    unmappedCount: 2,
    months,
    flowsByMonth,
    totalsByMonth,
    latestMonthWithData,
    maxFlowCount: Math.max(1, maxFlowCount),
  };
}

const PROSPECT_NAMES = [
  'Willow Bend Dental',
  'Crescent Bay Orthodontics',
  'Marigold Family Dental',
  'Stonebridge Dental Care',
  'Harbor Point Smiles',
  'Juniper Hill Dentistry',
  'Terrace View Dental',
  'Oakmont Dental Studio',
];

/**
 * Prospect pins for the harness, including two already imported.
 *
 * The imported pair matter: they are how the preview shows that an office already
 * in the network stops being drawn as a prospect, rather than sitting under a
 * dashed ring forever on top of its own tier dot.
 */
export function buildDiscoveredFixture(): DiscoveredOffice[] {
  const rand = lcg(775501);

  return PROSPECT_NAMES.map((name, index) => {
    const angle = rand() * Math.PI * 2;
    const radius = 0.05 + Math.pow(rand(), 1.4) * 0.3;
    const rating = Math.round((3.2 + rand() * 1.8) * 10) / 10;

    return {
      id: `prospect-${index + 1}`,
      name,
      address: `${100 + Math.floor(rand() * 900)} Prospect Way, Irvine, CA`,
      phone: '(949) 555-01' + String(10 + index),
      website: `https://example.com/${index + 1}`,
      latitude: HUB[1] + Math.sin(angle) * radius,
      longitude: HUB[0] + Math.cos(angle) * radius * 1.2,
      google_rating: rating,
      office_type: index % 2 === 0 ? 'General dentist' : 'Pediatric dentist',
      distance_miles: Math.round(radius * 69 * 10) / 10,
      ratingCategory:
        rating >= 4.5 ? 'Excellent' : rating >= 4.0 ? 'Good' : rating >= 3.5 ? 'Average' : 'Low',
      google_place_id: `place-${index + 1}`,
      imported: index >= PROSPECT_NAMES.length - 2,
    };
  });
}

/**
 * A self-contained Mapbox style: no `mapbox://` sources, so the harness renders
 * without a Mapbox account or token. Roughly mirrors the tone of the real basemap
 * so visual judgements made here carry over.
 */
export function previewStyle(dark = true): import('mapbox-gl').StyleSpecification {
  return {
    version: 8,
    name: 'preview',
    sources: {},
    layers: [
      {
        id: 'background',
        type: 'background',
        paint: { 'background-color': dark ? '#0d1520' : '#eef2f5' },
      },
    ],
  };
}
