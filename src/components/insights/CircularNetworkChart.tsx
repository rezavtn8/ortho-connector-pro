import { useMemo, useRef, useState } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import { computeMomentum, type FlowTier, type Momentum, type MonthlySeries } from '@/lib/officeMetrics';
import { classifyTierChange, hadHistoryBy, tierSnapshot } from '@/lib/tierSnapshot';
import type { InsightsCampaign, InsightsOffice, InsightsTag } from '@/hooks/useInsightsData';
import { packCircles } from './circlePack';
import {
  bundlePath,
  labelPolicy,
  layoutRing,
  ringLabelPlacement,
  type RingLeafInput,
} from './ringLayout';
import { annulusSectorPath, arcPath, polar, truncateLabel } from './svgPolar';
import {
  CHANNEL_LABELS,
  channelsInWindow,
  OUTREACH_CHANNELS,
  type OutreachChannel,
  type OutreachEvent,
} from './outreach';
import {
  CHART_INK,
  HEAT_TOKENS,
  OUTREACH_TOKENS,
  TIER_TOKENS,
  alpha,
  token,
} from './insightsColors';
import { InsightsTooltip, type TooltipState } from './InsightsTooltip';

/**
 * Hierarchical edge bundling: offices on a ring, hub circles packed in the middle,
 * bundled curves between them.
 *
 * Four views of the same ring, and the important thing about them is that **no two
 * palettes are ever on screen together**. The outreach hues and the tier hues were each
 * validated on their own and collide when scored against each other — outreach orange
 * lands on `--tier-warm`, outreach blue on `--tier-cold`. So every view except
 * "movement" paints leaves neutral and carries tier only in the labelled group arcs;
 * movement uses tier colour and nothing else. One palette per picture.
 *
 * Beyond the links, each leaf carries two extra marks that cost nothing to read and
 * would otherwise need their own chart: a rim bar for volume, and a chevron for
 * direction. The chevron encodes momentum by *shape* rather than colour precisely
 * because a third palette would not survive the same collision test.
 */

const VIEW = 1000;
const CX = VIEW / 2;
const CY = VIEW / 2;
const HUB_DISC = 168;
const LEAF_R = 286;
const RIM_BASE = LEAF_R + 8;
const RIM_MAX = 34;
const GROUP_ARC_R = RIM_BASE + RIM_MAX + 8;
const LABEL_R = GROUP_ARC_R + 12;

const TIER_ORDER: FlowTier[] = ['VIP', 'Warm', 'Cold', 'Dormant'];

export type NetworkMode = 'outreach' | 'movement' | 'tags' | 'campaigns';

/** How many named hubs a categorical view shows before folding the rest into Other. */
const MAX_NAMED_HUBS = 4;
const OTHER = '__other';
const NONE = '__none';

interface HubSpec {
  key: string;
  label: string;
  /** CSS custom-property name, without the leading `--`. */
  token: string;
}

interface NetworkLink {
  officeId: string;
  hubKey: string;
  /** True for an office with no referral history before the baseline window. */
  isNew: boolean;
}

interface CircularNetworkChartProps {
  offices: InsightsOffice[];
  /** The exact cohort array tiers were derived from — see `tierSnapshot`. */
  officeCohort: Array<{ id: string; name: string }>;
  officeSeries: MonthlySeries;
  outreach: OutreachEvent[];
  tags: InsightsTag[];
  campaigns: InsightsCampaign[];
  windowMonths: string[];
  /** Null when history cannot cover an equal-length baseline. */
  baselineMonths: string[] | null;
  mode: NetworkMode;
  nowDate: Date;
}

function sumWindow(monthly: Record<string, number>, months: readonly string[]): number {
  let total = 0;
  for (const m of months) total += monthly[m] ?? 0;
  return total;
}

export function CircularNetworkChart({
  offices,
  officeCohort,
  officeSeries,
  outreach,
  tags,
  campaigns,
  windowMonths,
  baselineMonths,
  mode,
  nowDate,
}: CircularNetworkChartProps) {
  const isMobile = useIsMobile();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [hoverLeaf, setHoverLeaf] = useState<string | null>(null);
  const [hoverHub, setHoverHub] = useState<string | null>(null);

  const model = useMemo(() => {
    const patientsById = new Map(offices.map((o) => [o.id, sumWindow(o.monthly, windowMonths)]));
    const maxPatients = Math.max(1, ...patientsById.values());
    const lastMonth = windowMonths[windowMonths.length - 1] ?? '';

    const momentumById = new Map<string, Momentum>(
      offices.map((o) => [o.id, computeMomentum(o.monthly, lastMonth).momentum]),
    );

    const ring = layoutRing(
      offices.map((o) => ({
        id: o.id,
        label: o.name,
        group: o.tier,
        value: patientsById.get(o.id) ?? 0,
      })) as RingLeafInput[],
      { cx: CX, cy: CY, radius: LEAF_R, groupOrder: TIER_ORDER, groupGap: 0.06 },
    );

    const links: NetworkLink[] = [];
    const hubs: HubSpec[] = [];
    const hubValues = new Map<string, number>();
    const hubMembers = new Map<string, number>();
    let movementCounts = { promoted: 0, demoted: 0, unchanged: 0, new: 0 };
    let foldedCount = 0;

    const register = (spec: HubSpec) => {
      hubs.push(spec);
      hubValues.set(spec.key, 0);
      hubMembers.set(spec.key, 0);
    };
    const attach = (officeId: string, hubKey: string, patients: number, isNew = false) => {
      links.push({ officeId, hubKey, isNew });
      hubValues.set(hubKey, (hubValues.get(hubKey) ?? 0) + patients);
      hubMembers.set(hubKey, (hubMembers.get(hubKey) ?? 0) + 1);
    };

    /**
     * Shared shape for the two categorical views. Membership is many-to-many, hubs are
     * capped at the top few by volume, and everything else folds into `Other` — never
     * a generated hue for a ninth series, and never a silent truncation either: the
     * fold is counted and reported.
     */
    const buildCategorical = (
      entities: Array<{ id: string; name: string }>,
      membership: (o: InsightsOffice) => string[],
      noneLabel: string,
    ) => {
      const volume = new Map<string, number>();
      for (const o of offices) {
        const p = patientsById.get(o.id) ?? 0;
        for (const id of membership(o)) volume.set(id, (volume.get(id) ?? 0) + p);
      }

      const ranked = entities
        .filter((e) => volume.has(e.id))
        .sort((a, b) => (volume.get(b.id) ?? 0) - (volume.get(a.id) ?? 0) || a.id.localeCompare(b.id));

      const named = ranked.slice(0, MAX_NAMED_HUBS);
      const folded = new Set(ranked.slice(MAX_NAMED_HUBS).map((e) => e.id));
      foldedCount = folded.size;

      // Ordered by volume and coloured with the sequential ramp darkest-first, so hue
      // and circle area encode the same thing rather than competing. An unordered
      // categorical palette would need eight validated hues this page does not have.
      named.forEach((e, i) =>
        register({
          key: e.id,
          label: e.name,
          token: HEAT_TOKENS[Math.max(0, HEAT_TOKENS.length - 1 - i)],
        }),
      );
      if (folded.size > 0) {
        register({ key: OTHER, label: `Other (${folded.size})`, token: 'muted-foreground' });
      }
      register({ key: NONE, label: noneLabel, token: OUTREACH_TOKENS.none });

      for (const o of offices) {
        const p = patientsById.get(o.id) ?? 0;
        const mine = membership(o);
        if (mine.length === 0) {
          attach(o.id, NONE, p);
          continue;
        }
        const keys = new Set(mine.map((id) => (folded.has(id) ? OTHER : id)));
        for (const k of keys) if (hubValues.has(k)) attach(o.id, k, p);
      }
    };

    if (mode === 'outreach') {
      for (const c of OUTREACH_CHANNELS) {
        register({ key: c, label: CHANNEL_LABELS[c], token: OUTREACH_TOKENS[c] });
      }
      register({ key: NONE, label: CHANNEL_LABELS.none, token: OUTREACH_TOKENS.none });

      const touched = channelsInWindow(outreach, windowMonths);
      for (const o of offices) {
        const p = patientsById.get(o.id) ?? 0;
        const channels = touched.get(o.id);
        const keys: string[] =
          channels && channels.size > 0 ? [...(channels as Set<OutreachChannel>)] : [NONE];
        // An office reached three ways counts toward all three hubs. That double
        // counting is inherent to "how did we reach these patients", and the totals
        // are labelled per hub, never summed into a grand total.
        for (const k of keys) attach(o.id, k, p);
      }
    } else if (mode === 'tags') {
      buildCategorical(tags, (o) => o.tagIds, 'Untagged');
    } else if (mode === 'campaigns') {
      buildCategorical(campaigns, (o) => o.campaignIds, 'No campaign');
    } else {
      for (const t of TIER_ORDER) register({ key: t, label: t, token: TIER_TOKENS[t] });

      const baselineEnd = baselineMonths?.[baselineMonths.length - 1] ?? null;
      const baseTier = new Map<string, FlowTier>();
      if (baselineEnd) {
        // Baseline tiers must come from the identical cohort array, or the quartile
        // boundaries shift and offices that never moved appear to have moved.
        for (const row of tierSnapshot(officeCohort, officeSeries, baselineEnd, nowDate)) {
          baseTier.set(row.id, row.tier);
        }
      }

      for (const o of offices) {
        const p = patientsById.get(o.id) ?? 0;
        // Three cases, and collapsing the last two is the easy mistake:
        //   - had history by the baseline  -> compare the two tiers
        //   - no history then, some since  -> genuinely `new`
        //   - never referred at all        -> Dormant then, Dormant now, unchanged.
        const hadHistory = baselineEnd ? hadHistoryBy(officeSeries, o.id, baselineEnd) : true;
        const from = hadHistory
          ? (baseTier.get(o.id) ?? null)
          : o.totalReferrals > 0
            ? null
            : o.tier;
        const change = classifyTierChange(from, o.tier);
        movementCounts = { ...movementCounts, [change]: movementCounts[change] + 1 };

        attach(o.id, o.tier, p, change === 'new');
        // An office that moved links to both ends, which is what makes the movement
        // legible as a crossing rope rather than as four separate fans.
        if (from && from !== o.tier) attach(o.id, from, p);
      }
    }

    const packed = packCircles(
      hubs.map((h) => ({ id: h.key, value: hubValues.get(h.key) ?? 0 })),
      { radius: HUB_DISC, padding: 8, minRadiusRatio: 0.2 },
    );
    const hubGeom = new Map(
      packed.map((c) => [
        c.id,
        {
          x: CX + c.x,
          y: CY + c.y,
          r: c.r,
          value: c.value,
          members: hubMembers.get(c.id) ?? 0,
        },
      ]),
    );

    const leafById = new Map(ring.leaves.map((l) => [l.id, l]));
    const paths = links
      .map((l) => {
        const leaf = leafById.get(l.officeId);
        const hub = hubGeom.get(l.hubKey);
        if (!leaf || !hub) return null;
        return {
          ...l,
          key: `${l.officeId}|${l.hubKey}`,
          d: bundlePath(leaf, hub, { x: CX, y: CY }, { beta: 0.44 }),
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    // Link opacity has to scale with how many links there are, or the chart is wrong
    // at both ends of the range: a fixed value that keeps 500 curves readable makes 40
    // of them almost invisible, and one that suits 40 turns 500 into a solid disc.
    const restOpacity = Math.min(0.42, Math.max(0.07, 3.4 / Math.sqrt(Math.max(1, paths.length))));

    return {
      ring,
      hubs,
      hubGeom,
      paths,
      patientsById,
      momentumById,
      maxPatients,
      restOpacity,
      policy: labelPolicy(ring.leaves.length, LEAF_R),
      movementCounts,
      foldedCount,
      hasBaseline: baselineMonths !== null,
    };
  }, [
    offices,
    officeCohort,
    officeSeries,
    outreach,
    tags,
    campaigns,
    windowMonths,
    baselineMonths,
    mode,
    nowDate,
  ]);

  const {
    ring,
    hubs,
    hubGeom,
    paths,
    patientsById,
    momentumById,
    maxPatients,
    restOpacity,
    policy,
    movementCounts,
    foldedCount,
    hasBaseline,
  } = model;

  const hubByKey = useMemo(() => new Map(hubs.map((h) => [h.key, h])), [hubs]);

  /**
   * Hubs carry a token name rather than a finished colour so alpha can be composed
   * here. Overlapping ribbons then accumulate the way ink does, which is what makes a
   * bundle of forty read as heavier than a bundle of four.
   */
  const hubFill = (hubKey: string): string => token(hubByKey.get(hubKey)?.token ?? 'muted-foreground');
  const linkColor = (hubKey: string, active: boolean): string =>
    alpha(hubByKey.get(hubKey)?.token ?? 'muted-foreground', active ? 0.85 : restOpacity);

  const showTip = (e: React.MouseEvent, state: Omit<TooltipState, 'x' | 'y'>) => {
    const rect = wrapRef.current?.getBoundingClientRect();
    setTooltip({ ...state, x: rect ? e.clientX - rect.left : 0, y: rect ? e.clientY - rect.top : 0 });
  };

  const wrapRect = wrapRef.current?.getBoundingClientRect();
  const focusedLeaf = hoverLeaf ? ring.leaves.find((l) => l.id === hoverLeaf) : null;
  const dimmed = hoverLeaf !== null || hoverHub !== null;

  const isActive = (officeId: string, hubKey: string) =>
    !dimmed || hoverLeaf === officeId || hoverHub === hubKey;

  if (ring.leaves.length === 0) {
    return (
      <p className="py-16 text-center text-sm text-muted-foreground">
        No referring offices to chart yet.
      </p>
    );
  }

  if (mode === 'movement' && !hasBaseline) {
    return (
      <p className="py-16 text-center text-sm text-muted-foreground">
        Not enough history for an equal-length baseline, so there is nothing to compare tiers
        against yet. Widen the window or pick a nearer baseline.
      </p>
    );
  }

  if (hubs.length <= 1) {
    return (
      <p className="py-16 text-center text-sm text-muted-foreground">
        {mode === 'tags'
          ? 'No offices are tagged yet, so there is nothing to group them by.'
          : 'No campaigns have been delivered yet, so there is nothing to group offices by.'}
      </p>
    );
  }

  return (
    <div ref={wrapRef} className="relative" onMouseLeave={() => setTooltip(null)}>
      <svg
        viewBox={`0 0 ${VIEW} ${VIEW}`}
        className="insights-fade mx-auto h-auto w-full max-w-[50rem]"
        role="img"
        aria-label={`Network diagram of ${ring.leaves.length} referring offices grouped by ${mode}, with a rim bar per office showing its volume`}
      >
        {/* Links first, so nothing else is buried under hundreds of curves. */}
        <g>
          {paths.map((p) => {
            const active = isActive(p.officeId, p.hubKey);
            return (
              <path
                key={p.key}
                d={p.d}
                fill="none"
                style={{
                  stroke: linkColor(p.hubKey, active && dimmed),
                  strokeWidth: active && dimmed ? 1.8 : 1,
                  strokeLinecap: 'round',
                  strokeDasharray: p.isNew ? '3 3' : undefined,
                  opacity: dimmed && !active ? 0.12 : 1,
                  transition: 'opacity 160ms ease, stroke-width 160ms ease',
                }}
              />
            );
          })}
        </g>

        {/* Rim bars: one per office, length by patients. This is the volume ranking the
            radial tab shows in full, folded into the ring so the network view is not
            blind to how much each connection is worth. */}
        <g>
          {ring.leaves.map((l) => {
            const patients = patientsById.get(l.id) ?? 0;
            if (patients <= 0) return null;
            const active = hoverLeaf === null || hoverLeaf === l.id;
            // Square-root, so a forty-patient office is not fourteen times the length
            // of a two-patient one and the small offices stay visible.
            const len = RIM_MAX * Math.sqrt(patients / maxPatients);
            // A fifth of the slot, so these read as bars against the ring rather than as
            // a segmented band. Much wider and the rim becomes a second solid arc
            // competing with the tier arcs above it.
            const half = ((Math.PI * 2) / Math.max(1, ring.leaves.length)) * 0.2;
            return (
              <path
                key={`rim-${l.id}`}
                d={annulusSectorPath(CX, CY, RIM_BASE, RIM_BASE + len, l.angle - half, l.angle + half)}
                style={{
                  fill:
                    mode === 'movement'
                      ? token(TIER_TOKENS[l.group as FlowTier])
                      : CHART_INK.neutralMark,
                  opacity: dimmed && !active ? 0.2 : 0.9,
                  transition: 'opacity 140ms ease',
                }}
              />
            );
          })}
        </g>

        {/* Momentum chevrons — direction by *shape*, never by a third palette. Outward
            for rising, inward for slipping; steady and quiet get nothing, because a
            mark on every leaf is a mark that carries no information. */}
        <g pointerEvents="none">
          {ring.leaves.map((l) => {
            const m = momentumById.get(l.id);
            if (m !== 'rising' && m !== 'slipping') return null;
            const active = hoverLeaf === null || hoverLeaf === l.id;
            const patients = patientsById.get(l.id) ?? 0;
            const len = patients > 0 ? RIM_MAX * Math.sqrt(patients / maxPatients) : 0;
            const base = RIM_BASE + len + 5;
            const tipR = m === 'rising' ? base + 5 : base;
            const backR = m === 'rising' ? base : base + 5;
            const w = 0.008;
            const tip = polar(CX, CY, tipR, l.angle);
            const a = polar(CX, CY, backR, l.angle - w * 3);
            const b = polar(CX, CY, backR, l.angle + w * 3);
            return (
              <path
                key={`mom-${l.id}`}
                d={`M ${tip.x} ${tip.y} L ${a.x} ${a.y} L ${b.x} ${b.y} Z`}
                style={{
                  fill: CHART_INK.strongLabel,
                  opacity: dimmed && !active ? 0.15 : 0.6,
                  transition: 'opacity 140ms ease',
                }}
              />
            );
          })}
        </g>

        {/* Tier group arcs. In every view but movement these are the only place a tier
            colour appears. */}
        <g>
          {ring.groups.map((g) => (
            <path
              key={`arc-${g.group}`}
              d={arcPath(CX, CY, GROUP_ARC_R, g.startAngle, g.endAngle)}
              fill="none"
              style={{
                stroke: token(TIER_TOKENS[g.group as FlowTier]) ?? CHART_INK.neutralMark,
                strokeWidth: 5,
                strokeLinecap: 'butt',
                opacity: 0.9,
              }}
            />
          ))}
        </g>

        {/* Leaves. */}
        <g>
          {ring.leaves.map((l) => {
            const active = hoverLeaf === null || hoverLeaf === l.id;
            const patients = patientsById.get(l.id) ?? 0;
            const momentum = momentumById.get(l.id);
            return (
              <circle
                key={l.id}
                cx={l.x}
                cy={l.y}
                r={policy.tickOnly ? 2 : 3}
                style={{
                  // Non-movement views keep leaves neutral so the hub palette is the
                  // only categorical encoding on screen.
                  fill:
                    mode === 'movement'
                      ? token(TIER_TOKENS[l.group as FlowTier])
                      : CHART_INK.neutralMark,
                  opacity: dimmed && !active ? 0.25 : 1,
                  cursor: 'pointer',
                  transition: 'opacity 140ms ease',
                }}
                onMouseEnter={() => setHoverLeaf(l.id)}
                onMouseLeave={() => {
                  setHoverLeaf(null);
                  setTooltip(null);
                }}
                onMouseMove={(e) =>
                  showTip(e, {
                    title: l.label,
                    subtitle: `${l.group}${momentum ? ` · ${momentum}` : ''}`,
                    rows: [
                      { label: 'Patients', value: String(patients) },
                      ...paths
                        .filter((p) => p.officeId === l.id)
                        .map((p) => ({
                          label: hubByKey.get(p.hubKey)?.label ?? p.hubKey,
                          value: '●',
                          swatch: hubFill(p.hubKey),
                        })),
                    ],
                  })
                }
              />
            );
          })}
        </g>

        {/* Leaf labels, or nothing when the ring is too full for them to be read. */}
        {policy.showLabels && !isMobile && (
          <g transform={`translate(${CX},${CY})`} pointerEvents="none">
            {ring.leaves.map((l) => {
              const place = ringLabelPlacement(LABEL_R, l.angle);
              const active = hoverLeaf === null || hoverLeaf === l.id;
              return (
                <text
                  key={`lbl-${l.id}`}
                  transform={place.transform}
                  textAnchor={place.anchor}
                  dominantBaseline="middle"
                  style={{
                    fill: CHART_INK.label,
                    fontSize: policy.fontSize,
                    opacity: dimmed && !active ? 0.2 : 1,
                    transition: 'opacity 140ms ease',
                  }}
                >
                  {truncateLabel(l.label, policy.maxChars)}
                </text>
              );
            })}
          </g>
        )}

        {/* Hub circles. */}
        <g>
          {hubs.map((h) => {
            const geom = hubGeom.get(h.key);
            if (!geom) return null;
            const active = hoverHub === null || hoverHub === h.key;
            return (
              <circle
                key={h.key}
                cx={geom.x}
                cy={geom.y}
                r={geom.r}
                style={{
                  fill: hubFill(h.key),
                  opacity: dimmed && !active ? 0.3 : 0.92,
                  cursor: 'pointer',
                  transition: 'opacity 160ms ease',
                }}
                onMouseEnter={() => setHoverHub(h.key)}
                onMouseLeave={() => {
                  setHoverHub(null);
                  setTooltip(null);
                }}
                onMouseMove={(e) =>
                  showTip(e, {
                    title: h.label,
                    rows: [
                      { label: 'Offices', value: String(geom.members) },
                      { label: 'Patients', value: String(Math.round(geom.value)) },
                    ],
                  })
                }
              />
            );
          })}
        </g>

        {/* Hub labels. The value is printed because a hub with no members is floored to
            a visible radius — without the number its area reads as a quantity it does
            not have. */}
        <g pointerEvents="none">
          {hubs.map((h) => {
            const geom = hubGeom.get(h.key);
            if (!geom) return null;
            const full = h.label.replace(/ (deliveries|outreach)$/, '');
            // Fit the label to the circle by *shortening* it, not by shrinking it past
            // legibility and not by dropping it. SVG text neither clips nor
            // ellipsizes, so an unfitted label simply runs out over its neighbours;
            // and a circle showing only a number is a category the reader cannot name.
            // Below four characters there is nothing worth printing, and the legend
            // underneath carries every hub with its count regardless.
            const nameSize = Math.max(8, Math.min(15, geom.r * 0.34));
            const maxChars = Math.floor((geom.r * 1.7) / (nameSize * 0.56));
            const showName = maxChars >= 4;
            const short = truncateLabel(full, Math.min(18, maxChars));
            const valueSize = Math.min(12, geom.r * 0.28);
            return (
              <g key={`hl-${h.key}`}>
                {showName && (
                  <text
                    x={geom.x}
                    y={geom.y - valueSize * 0.55}
                    textAnchor="middle"
                    style={{ fill: CHART_INK.surface, fontSize: nameSize, fontWeight: 700 }}
                  >
                    {short}
                  </text>
                )}
                <text
                  x={geom.x}
                  y={geom.y + (showName ? nameSize * 0.85 : 0)}
                  textAnchor="middle"
                  dominantBaseline={showName ? undefined : 'middle'}
                  style={{ fill: CHART_INK.surface, fontSize: valueSize, opacity: 0.92 }}
                >
                  {Math.round(geom.value)}
                </text>
              </g>
            );
          })}
        </g>

        {/* The focused leaf's name, always drawn, always last. This is what keeps the
            tick-only ring usable rather than a dead end. */}
        {focusedLeaf && (
          <g pointerEvents="none">
            {(() => {
              const p = polar(CX, CY, LEAF_R - 14, focusedLeaf.angle);
              const text = truncateLabel(focusedLeaf.label, 26);
              const w = text.length * 7.2 + 16;
              const flip = focusedLeaf.angle > Math.PI;
              return (
                <>
                  <rect
                    x={flip ? p.x - w : p.x}
                    y={p.y - 11}
                    width={w}
                    height={22}
                    rx={4}
                    style={{ fill: CHART_INK.surface, stroke: CHART_INK.axis, strokeWidth: 1 }}
                  />
                  <text
                    x={flip ? p.x - 8 : p.x + 8}
                    y={p.y}
                    textAnchor={flip ? 'end' : 'start'}
                    dominantBaseline="middle"
                    style={{ fill: CHART_INK.strongLabel, fontSize: 12, fontWeight: 500 }}
                  >
                    {text}
                  </text>
                </>
              );
            })()}
          </g>
        )}
      </svg>

      <InsightsTooltip state={tooltip} width={wrapRect?.width ?? 0} height={wrapRect?.height ?? 0} />

      <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-xs">
        {hubs.map((h) => (
          <span key={`lg-${h.key}`} className="flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="h-2.5 w-2.5 rounded-full"
              style={{ background: hubFill(h.key) }}
            />
            <span className="text-muted-foreground">
              {h.label} · {hubGeom.get(h.key)?.members ?? 0}
            </span>
          </span>
        ))}
      </div>

      <div className="mt-2 space-y-1 text-center text-xs text-muted-foreground">
        <p>
          Ring arcs are referral tiers. Each office has a rim bar for its volume, and a chevron
          pointing out if it is rising or in if it is slipping.
        </p>
        {policy.tickOnly && (
          <p>{ring.leaves.length} offices — too many to name around the ring, so names appear on hover.</p>
        )}
        {ring.emptyGroups.length > 0 && (
          <p>No offices in {ring.emptyGroups.join(', ')} — those arcs are absent, not hidden.</p>
        )}
        {foldedCount > 0 && (
          <p>
            The {foldedCount} smallest {mode === 'tags' ? 'tags' : 'campaigns'} are folded into
            “Other” rather than given colours that could not be told apart.
          </p>
        )}
        {mode === 'outreach' && (
          <p>
            An office reached more than one way links to each hub. Only campaigns you created are
            counted.
          </p>
        )}
        {mode === 'movement' && (
          <p>
            {movementCounts.promoted} moved up, {movementCounts.demoted} moved down,{' '}
            {movementCounts.unchanged} held
            {movementCounts.new > 0 && <>, {movementCounts.new} newly referring (dashed)</>}. An
            office that changed tier links to both.
          </p>
        )}
      </div>
    </div>
  );
}
