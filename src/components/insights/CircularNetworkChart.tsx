import { useMemo, useRef, useState } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import type { FlowTier, MonthlySeries } from '@/lib/officeMetrics';
import { classifyTierChange, hadHistoryBy, tierSnapshot } from '@/lib/tierSnapshot';
import type { InsightsOffice } from '@/hooks/useInsightsData';
import { packCircles } from './circlePack';
import {
  bundlePath,
  labelPolicy,
  layoutRing,
  ringLabelPlacement,
  type RingLeafInput,
} from './ringLayout';
import { arcPath, polar, truncateLabel } from './svgPolar';
import {
  CHANNEL_LABELS,
  channelsInWindow,
  OUTREACH_CHANNELS,
  type OutreachChannel,
  type OutreachEvent,
} from './outreach';
import { CHART_INK, OUTREACH_FILL, TIER_FILL, alpha } from './insightsColors';
import { InsightsTooltip, type TooltipState } from './InsightsTooltip';

/**
 * Hierarchical edge bundling: offices on a ring, hub circles packed in the middle,
 * bundled curves between them.
 *
 * Two views, and the important thing about them is that **they never share a palette**.
 * The outreach hues and the tier hues were each validated on their own and collide when
 * scored against each other — outreach orange lands on `--tier-warm`, outreach blue on
 * `--tier-cold`. So the outreach view paints leaves neutral and carries tier only in the
 * labelled group arcs, while the movement view uses tier colour and no outreach colour
 * at all. One palette per picture.
 */

const VIEW = 1000;
const CX = VIEW / 2;
const CY = VIEW / 2;
const HUB_DISC = 168;
const LEAF_R = 300;
const GROUP_ARC_R = 313;
const LABEL_R = 326;

const TIER_ORDER: FlowTier[] = ['VIP', 'Warm', 'Cold', 'Dormant'];

export type NetworkMode = 'outreach' | 'movement';

type HubKey = OutreachChannel | 'none' | FlowTier;

interface NetworkLink {
  officeId: string;
  hubKey: HubKey;
  /** True for an office with no referral history before the baseline window. */
  isNew: boolean;
}

interface CircularNetworkChartProps {
  offices: InsightsOffice[];
  /** The exact cohort array tiers were derived from — see `tierSnapshot`. */
  officeCohort: Array<{ id: string; name: string }>;
  officeSeries: MonthlySeries;
  outreach: OutreachEvent[];
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
  windowMonths,
  baselineMonths,
  mode,
  nowDate,
}: CircularNetworkChartProps) {
  const isMobile = useIsMobile();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [hoverLeaf, setHoverLeaf] = useState<string | null>(null);
  const [hoverHub, setHoverHub] = useState<HubKey | null>(null);

  const model = useMemo(() => {
    const patientsById = new Map(
      offices.map((o) => [o.id, sumWindow(o.monthly, windowMonths)]),
    );

    const leafInputs: RingLeafInput[] = offices.map((o) => ({
      id: o.id,
      label: o.name,
      group: o.tier,
      value: patientsById.get(o.id) ?? 0,
    }));

    const ring = layoutRing(leafInputs, {
      cx: CX,
      cy: CY,
      radius: LEAF_R,
      groupOrder: TIER_ORDER,
      groupGap: 0.06,
    });

    const links: NetworkLink[] = [];
    const hubKeys: HubKey[] = [];
    const hubValues = new Map<HubKey, number>();
    const hubMembers = new Map<HubKey, number>();
    let movementCounts = { promoted: 0, demoted: 0, unchanged: 0, new: 0 };

    if (mode === 'outreach') {
      hubKeys.push(...OUTREACH_CHANNELS, 'none');
      for (const k of hubKeys) {
        hubValues.set(k, 0);
        hubMembers.set(k, 0);
      }

      const touched = channelsInWindow(outreach, windowMonths);
      for (const o of offices) {
        const patients = patientsById.get(o.id) ?? 0;
        const channels = touched.get(o.id);
        const keys: HubKey[] = channels && channels.size > 0 ? [...channels] : ['none'];
        for (const k of keys) {
          links.push({ officeId: o.id, hubKey: k, isNew: false });
          // An office reached three ways counts toward all three hubs. That double
          // counting is inherent to the question ("how did we reach these patients")
          // and the totals are labelled per hub, never summed into a grand total.
          hubValues.set(k, (hubValues.get(k) ?? 0) + patients);
          hubMembers.set(k, (hubMembers.get(k) ?? 0) + 1);
        }
      }
    } else {
      hubKeys.push(...TIER_ORDER);
      for (const k of hubKeys) {
        hubValues.set(k, 0);
        hubMembers.set(k, 0);
      }

      // Baseline tiers must come from the identical cohort array, or the quartile
      // boundaries shift and offices that never moved appear to have moved.
      const baselineEnd = baselineMonths?.[baselineMonths.length - 1] ?? null;
      const baseTier = new Map<string, FlowTier>();
      if (baselineEnd) {
        for (const row of tierSnapshot(officeCohort, officeSeries, baselineEnd, nowDate)) {
          baseTier.set(row.id, row.tier);
        }
      }

      for (const o of offices) {
        const patients = patientsById.get(o.id) ?? 0;
        hubValues.set(o.tier, (hubValues.get(o.tier) ?? 0) + patients);
        hubMembers.set(o.tier, (hubMembers.get(o.tier) ?? 0) + 1);

        // Three cases, and collapsing the last two is the easy mistake:
        //   - had history by the baseline  -> compare the two tiers
        //   - no history then, some since  -> genuinely `new`
        //   - never referred at all        -> Dormant then, Dormant now, unchanged.
        // Reporting a never-active office as "new" is how the movement count ends up
        // claiming six new relationships on a practice that gained none.
        const hadHistory = baselineEnd ? hadHistoryBy(officeSeries, o.id, baselineEnd) : true;
        const from = hadHistory
          ? (baseTier.get(o.id) ?? null)
          : o.totalReferrals > 0
            ? null
            : o.tier;
        const change = classifyTierChange(from, o.tier);
        movementCounts = { ...movementCounts, [change]: movementCounts[change] + 1 };

        links.push({ officeId: o.id, hubKey: o.tier, isNew: change === 'new' });
        // An office that moved links to both ends, which is what makes the movement
        // legible as a crossing rope rather than as four separate fans.
        if (from && from !== o.tier) {
          links.push({ officeId: o.id, hubKey: from, isNew: false });
        }
      }
    }

    const packed = packCircles(
      hubKeys.map((k) => ({ id: String(k), value: hubValues.get(k) ?? 0 })),
      { radius: HUB_DISC, padding: 8, minRadiusRatio: 0.2 },
    );
    const hubs = new Map(
      packed.map((c) => [
        c.id as HubKey,
        { x: CX + c.x, y: CY + c.y, r: c.r, value: c.value, members: hubMembers.get(c.id as HubKey) ?? 0 },
      ]),
    );

    const leafById = new Map(ring.leaves.map((l) => [l.id, l]));
    const paths = links
      .map((l) => {
        const leaf = leafById.get(l.officeId);
        const hub = hubs.get(l.hubKey);
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
    // Inverse-sqrt tracks how the ink actually accumulates as curves overlap.
    const restOpacity = Math.min(0.42, Math.max(0.07, 3.4 / Math.sqrt(Math.max(1, paths.length))));

    return {
      ring,
      hubs,
      hubKeys,
      paths,
      patientsById,
      restOpacity,
      policy: labelPolicy(ring.leaves.length, LEAF_R),
      movementCounts,
      hasBaseline: baselineMonths !== null,
    };
  }, [offices, officeCohort, officeSeries, outreach, windowMonths, baselineMonths, mode, nowDate]);

  const {
    ring,
    hubs,
    hubKeys,
    paths,
    patientsById,
    restOpacity,
    policy,
    movementCounts,
    hasBaseline,
  } = model;

  const hubLabel = (k: HubKey): string =>
    mode === 'outreach' ? CHANNEL_LABELS[k as OutreachChannel | 'none'] : (k as string);

  /** What fits inside the circle. The legend below carries the full name. */
  const SHORT_LABEL: Record<string, string> = {
    visit: 'Visits',
    campaign: 'Campaigns',
    email: 'Email',
    none: 'No contact',
  };
  const hubShortLabel = (k: HubKey): string => SHORT_LABEL[String(k)] ?? (k as string);

  const hubColor = (k: HubKey): string =>
    mode === 'outreach'
      ? OUTREACH_FILL[k as OutreachChannel | 'none']
      : TIER_FILL[k as FlowTier];

  /** The colour of a link. In outreach mode identity lives on the hub, not the leaf. */
  const linkColor = (hubKey: HubKey, active: boolean): string => {
    const t =
      mode === 'outreach'
        ? `outreach-${hubKey === 'none' ? 'none' : hubKey}`
        : `tier-${String(hubKey).toLowerCase()}`;
    return alpha(t, active ? 0.85 : restOpacity);
  };

  const showTip = (e: React.MouseEvent, state: Omit<TooltipState, 'x' | 'y'>) => {
    const rect = wrapRef.current?.getBoundingClientRect();
    setTooltip({ ...state, x: rect ? e.clientX - rect.left : 0, y: rect ? e.clientY - rect.top : 0 });
  };

  const wrapRect = wrapRef.current?.getBoundingClientRect();
  const focusedLeaf = hoverLeaf ? ring.leaves.find((l) => l.id === hoverLeaf) : null;

  const isActive = (officeId: string, hubKey: HubKey) =>
    (hoverLeaf === null && hoverHub === null) ||
    hoverLeaf === officeId ||
    hoverHub === hubKey;

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
        Not enough history for an equal-length baseline, so there is nothing to compare
        tiers against yet. Widen the window or pick a nearer baseline.
      </p>
    );
  }

  const dimmed = hoverLeaf !== null || hoverHub !== null;

  return (
    <div ref={wrapRef} className="relative" onMouseLeave={() => setTooltip(null)}>
      <svg
        viewBox={`0 0 ${VIEW} ${VIEW}`}
        className="insights-fade mx-auto h-auto w-full max-w-[48rem]"
        role="img"
        aria-label={
          mode === 'outreach'
            ? `Network diagram of ${ring.leaves.length} referring offices linked to the outreach channels that reached them`
            : `Network diagram of ${ring.leaves.length} referring offices linked to their previous and current referral tier`
        }
      >
        {/* Links. Drawn first so nothing else is buried under 500 curves. */}
        <g style={{ transition: 'opacity 160ms ease' }}>
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

        {/* Group arcs. In outreach mode these are the *only* place tier appears. */}
        <g>
          {ring.groups.map((g) => (
            <path
              key={`arc-${g.group}`}
              d={arcPath(CX, CY, GROUP_ARC_R, g.startAngle, g.endAngle)}
              fill="none"
              style={{
                stroke: TIER_FILL[g.group as FlowTier] ?? CHART_INK.neutralMark,
                strokeWidth: 6,
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
            return (
              <circle
                key={l.id}
                cx={l.x}
                cy={l.y}
                r={policy.tickOnly ? 2 : 3.2}
                style={{
                  // Outreach mode keeps leaves neutral so the channel hues are the
                  // only categorical encoding on screen.
                  fill:
                    mode === 'outreach'
                      ? CHART_INK.neutralMark
                      : TIER_FILL[l.group as FlowTier],
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
                    subtitle: l.group,
                    rows: [{ label: 'Patients', value: String(patients) }],
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
          {hubKeys.map((k) => {
            const hub = hubs.get(k);
            if (!hub) return null;
            const active = hoverHub === null || hoverHub === k;
            return (
              <g key={String(k)}>
                <circle
                  cx={hub.x}
                  cy={hub.y}
                  r={hub.r}
                  style={{
                    fill: hubColor(k),
                    opacity: dimmed && !active ? 0.3 : 0.9,
                    cursor: 'pointer',
                    transition: 'opacity 160ms ease',
                  }}
                  onMouseEnter={() => setHoverHub(k)}
                  onMouseLeave={() => {
                    setHoverHub(null);
                    setTooltip(null);
                  }}
                  onMouseMove={(e) =>
                    showTip(e, {
                      title: hubLabel(k),
                      rows: [
                        { label: 'Offices', value: String(hub.members) },
                        { label: 'Patients', value: String(Math.round(hub.value)) },
                      ],
                    })
                  }
                />
              </g>
            );
          })}
        </g>

        {/* Hub labels, above the circles. The value is printed because a hub with no
            members is floored to a visible radius — without the number its area would
            be read as a quantity it does not have. */}
        <g pointerEvents="none">
          {hubKeys.map((k) => {
            const hub = hubs.get(k);
            if (!hub) return null;

            const short = hubShortLabel(k);
            // Size the label to the circle rather than clamping to a fixed range. A
            // fixed size overflows the smaller hubs, and SVG text does not clip or
            // ellipsize — it just runs out over the neighbouring circles, which is
            // how "Never contacted" ends up rendering as "ever contacte".
            const fitted = (hub.r * 1.7) / (short.length * 0.56);
            const nameSize = Math.min(15, fitted);
            const showName = nameSize >= 7.5;
            const valueSize = Math.min(12, hub.r * 0.28);

            return (
              <g key={`hl-${String(k)}`}>
                {showName && (
                  <text
                    x={hub.x}
                    y={hub.y - valueSize * 0.55}
                    textAnchor="middle"
                    style={{ fill: CHART_INK.surface, fontSize: nameSize, fontWeight: 700 }}
                  >
                    {short}
                  </text>
                )}
                <text
                  x={hub.x}
                  y={hub.y + (showName ? nameSize * 0.85 : 0)}
                  textAnchor="middle"
                  dominantBaseline={showName ? undefined : 'middle'}
                  style={{ fill: CHART_INK.surface, fontSize: valueSize, opacity: 0.92 }}
                >
                  {Math.round(hub.value)}
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
              const p = polar(CX, CY, LEAF_R + 16, focusedLeaf.angle);
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
        {hubKeys.map((k) => (
          <span key={`lg-${String(k)}`} className="flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="h-2.5 w-2.5 rounded-full"
              style={{ background: hubColor(k) }}
            />
            <span className="text-muted-foreground">
              {hubLabel(k)} · {hubs.get(k)?.members ?? 0}
            </span>
          </span>
        ))}
      </div>

      <div className="mt-2 space-y-1 text-center text-xs text-muted-foreground">
        {policy.tickOnly && (
          <p>
            {ring.leaves.length} offices — too many to name around the ring, so names appear on
            hover.
          </p>
        )}
        {ring.emptyGroups.length > 0 && (
          <p>No offices in {ring.emptyGroups.join(', ')} — those arcs are absent, not hidden.</p>
        )}
        {mode === 'outreach' && (
          <p>
            Ring arcs are referral tiers; the hub colours are outreach channels. An office
            reached more than one way links to each. Only campaigns you created are counted.
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
