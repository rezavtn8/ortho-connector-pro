import { useMemo, useRef, useState } from 'react';
import { computeMomentum, type FlowTier, type MonthlySeries } from '@/lib/officeMetrics';
import { hadHistoryBy, tierSnapshot } from '@/lib/tierSnapshot';
import type { InsightsOffice } from '@/hooks/useInsightsData';
import { layoutChord, type ChordMatrix } from './chordLayout';
import { polar, truncateLabel } from './svgPolar';
import { CHART_INK, MOMENTUM_TOKENS, TIER_TOKENS, alpha, token } from './insightsColors';
import { InsightsTooltip, type TooltipState } from './InsightsTooltip';

/**
 * Where the volume went, tier to tier, over the period.
 *
 * The network chart's movement view shows *which* offices moved; five hundred
 * individual curves cannot be read for the aggregate. This is the aggregate: arc length
 * is a tier's share of the traffic, ribbon width is how many patients' worth of
 * relationship crossed from one tier to another, and the loop that returns to its own
 * arc is what held.
 */

const VIEW = 860;
const CX = VIEW / 2;
const CY = VIEW / 2;
const RING = 268;
const BAND = 18;

const TIER_ORDER: FlowTier[] = ['VIP', 'Warm', 'Cold', 'Dormant'];
const NEW_KEY = 'New';
const TIER_KEYS = [...TIER_ORDER, NEW_KEY];

/** Best to worst, which is also the order the diverging ramp runs in. */
const MOMENTUM_KEYS = ['rising', 'new', 'steady', 'slipping', 'quiet'];
const MOMENTUM_LABELS: Record<string, string> = {
  rising: 'Rising',
  new: 'Newly referring',
  steady: 'Steady',
  slipping: 'Slipping',
  quiet: 'Gone quiet',
};

export type ChordWeight = 'patients' | 'offices';
export type ChordBasis = 'tier' | 'momentum';

interface ChordChartProps {
  offices: InsightsOffice[];
  officeCohort: Array<{ id: string; name: string }>;
  officeSeries: MonthlySeries;
  windowMonths: string[];
  /** Null when history cannot cover an equal-length baseline. */
  baselineMonths: string[] | null;
  weight: ChordWeight;
  basis: ChordBasis;
  nowDate: Date;
}

function sumWindow(monthly: Record<string, number>, months: readonly string[]): number {
  let total = 0;
  for (const m of months) total += monthly[m] ?? 0;
  return total;
}

export function ChordChart({
  offices,
  officeCohort,
  officeSeries,
  windowMonths,
  baselineMonths,
  weight,
  basis,
  nowDate,
}: ChordChartProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [hoverGroup, setHoverGroup] = useState<string | null>(null);

  const { layout, moves, fillToken } = useMemo(() => {
    const baselineEnd = baselineMonths?.[baselineMonths.length - 1] ?? null;
    const windowEnd = windowMonths[windowMonths.length - 1] ?? '';

    const keys = basis === 'momentum' ? MOMENTUM_KEYS : TIER_KEYS;
    const labels: Record<string, string> =
      basis === 'momentum'
        ? MOMENTUM_LABELS
        : Object.fromEntries(TIER_KEYS.map((k) => [k, k === NEW_KEY ? 'Newly referring' : k]));
    const fillToken = (k: string) =>
      basis === 'momentum'
        ? (MOMENTUM_TOKENS[k] ?? 'muted-foreground')
        : k === NEW_KEY
          ? 'muted-foreground'
          : TIER_TOKENS[k as FlowTier];

    const size = keys.length;
    const matrix: ChordMatrix = Array.from({ length: size }, () => new Array<number>(size).fill(0));
    const moves: Array<{ office: InsightsOffice; from: string; to: string; value: number }> = [];

    if (!baselineEnd) {
      return {
        moves,
        fillToken,
        layout: layoutChord([], {}, [], { cx: CX, cy: CY, radius: RING }),
      };
    }

    // Baseline tiers over the identical cohort array — see `tierSnapshot`. Running the
    // two snapshots over different cohorts shifts every quartile boundary and invents
    // movement for offices that never moved.
    const baseTier =
      basis === 'tier'
        ? new Map(
            tierSnapshot(officeCohort, officeSeries, baselineEnd, nowDate).map((r) => [
              r.id,
              r.tier as string,
            ]),
          )
        : null;

    for (const o of offices) {
      const value = weight === 'offices' ? 1 : sumWindow(o.monthly, windowMonths);
      if (value <= 0) continue;

      let from: string;
      let to: string;

      if (basis === 'momentum') {
        // Momentum is windowed rather than cumulative, so it genuinely moves — which
        // is why this is the default. Tier is a quartile rank over *lifetime* totals,
        // and lifetime totals barely reorder over a quarter, so the tier basis is
        // usually a picture of nothing happening. That is a true fact about the tier
        // definition, and worth being able to see, but it makes a poor opening view.
        from = computeMomentum(o.monthly, baselineEnd).momentum;
        to = computeMomentum(o.monthly, windowEnd).momentum;
      } else {
        const hadHistory = hadHistoryBy(officeSeries, o.id, baselineEnd);
        // Never-referred offices are not "new" — they were Dormant then and are
        // Dormant now, which is a hold, not an arrival.
        from = hadHistory
          ? (baseTier?.get(o.id) ?? o.tier)
          : o.totalReferrals > 0
            ? NEW_KEY
            : o.tier;
        to = o.tier;
      }

      const i = keys.indexOf(from);
      const j = keys.indexOf(to);
      if (i < 0 || j < 0) continue;

      matrix[i][j] += value;
      if (from !== to) moves.push({ office: o, from: labels[from] ?? from, to: labels[to] ?? to, value });
    }

    return {
      moves,
      fillToken,
      layout: layoutChord(keys, labels, matrix, {
        cx: CX,
        cy: CY,
        radius: RING,
        bandWidth: BAND,
        padAngle: 0.05,
        curvature: 0.85,
      }),
    };
  }, [offices, officeCohort, officeSeries, windowMonths, baselineMonths, weight, basis, nowDate]);

  const { groups, ribbons, total, movedShare } = layout;

  const fillFor = (key: string, active: boolean) => alpha(fillToken(key), active ? 0.82 : 0.34);

  const showTip = (e: React.MouseEvent, state: Omit<TooltipState, 'x' | 'y'>) => {
    const rect = wrapRef.current?.getBoundingClientRect();
    setTooltip({ ...state, x: rect ? e.clientX - rect.left : 0, y: rect ? e.clientY - rect.top : 0 });
  };

  const wrapRect = wrapRef.current?.getBoundingClientRect();
  const unit = weight === 'offices' ? 'office' : 'patient';

  if (baselineMonths === null) {
    return (
      <p className="py-16 text-center text-sm text-muted-foreground">
        Not enough history for an equal-length baseline, so there is nothing to compare against.
        Widen the window or pick a nearer baseline.
      </p>
    );
  }

  if (groups.length === 0) {
    return (
      <p className="py-16 text-center text-sm text-muted-foreground">
        No referral volume in this period, so nothing moved.
      </p>
    );
  }

  const biggestMoves = [...moves].sort((a, b) => b.value - a.value).slice(0, 3);

  return (
    <div ref={wrapRef} className="relative" onMouseLeave={() => setTooltip(null)}>
      <svg
        viewBox={`0 0 ${VIEW} ${VIEW}`}
        className="insights-fade mx-auto h-auto w-full max-w-[42rem]"
        role="img"
        aria-label={`Chord diagram of how ${Math.round(total)} ${unit}s of referral volume moved between ${basis === 'momentum' ? 'momentum states' : 'tiers'}, ${Math.round(movedShare * 100)} per cent of it changing`}
      >
        {/* Ribbons first, so the arcs and labels sit above them. */}
        <g>
          {ribbons.map((r) => {
            const active =
              hoverGroup === null || hoverGroup === r.from || hoverGroup === r.to;
            return (
              <path
                key={`${r.from}->${r.to}`}
                // Coloured by where the volume came *from*: this view is read as
                // "what happened to the VIP book", so the origin is the subject.
                d={r.path}
                style={{
                  fill: fillFor(r.from, hoverGroup !== null && active),
                  stroke: CHART_INK.surface,
                  strokeWidth: 0.75,
                  opacity: active ? 1 : 0.1,
                  transition: 'opacity 160ms ease, fill 160ms ease',
                  cursor: 'pointer',
                }}
                onMouseMove={(e) =>
                  showTip(e, {
                    title: r.isSelf ? `${r.from} held` : `${r.from} → ${r.to}`,
                    rows: [
                      {
                        label: weight === 'offices' ? 'Offices' : 'Patients',
                        value: String(Math.round(r.value)),
                      },
                      {
                        label: 'Share',
                        value: total > 0 ? `${Math.round((r.value / total) * 100)}%` : '—',
                      },
                    ],
                  })
                }
                onMouseLeave={() => setTooltip(null)}
              />
            );
          })}
        </g>

        {/* Tier arcs. */}
        <g>
          {groups.map((g) => (
            <path
              key={g.key}
              d={g.path}
              style={{
                fill: token(fillToken(g.key)),
                opacity: hoverGroup === null || hoverGroup === g.key ? 1 : 0.35,
                cursor: 'pointer',
                transition: 'opacity 160ms ease',
              }}
              onMouseEnter={() => setHoverGroup(g.key)}
              onMouseLeave={() => {
                setHoverGroup(null);
                setTooltip(null);
              }}
              onMouseMove={(e) =>
                showTip(e, {
                  title: g.label,
                  rows: [
                    {
                      label: 'Left this tier',
                      value: String(Math.round(g.outgoing)),
                    },
                    { label: 'Arrived here', value: String(Math.round(g.incoming)) },
                  ],
                })
              }
            />
          ))}
        </g>

        {/* Arc labels, outside the band. */}
        <g pointerEvents="none">
          {groups.map((g) => {
            // A sliver of an arc has no room for a name, and two slivers side by side
            // print their labels on top of each other. Below the threshold the arc is
            // left unlabelled — the legend underneath carries all of them with counts,
            // so nothing is lost, and hovering names it.
            if (g.endAngle - g.startAngle < 0.16) return null;
            const p = polar(CX, CY, RING + BAND + 22, g.midAngle);
            const flip = g.midAngle > Math.PI;
            return (
              <text
                key={`lbl-${g.key}`}
                x={p.x}
                y={p.y}
                textAnchor={
                  Math.abs(Math.sin(g.midAngle)) < 0.25 ? 'middle' : flip ? 'end' : 'start'
                }
                dominantBaseline="middle"
                style={{ fill: CHART_INK.strongLabel, fontSize: 14, fontWeight: 600 }}
              >
                {truncateLabel(g.label, 16)}
              </text>
            );
          })}
        </g>

        {/* Centre readout. */}
        <g pointerEvents="none">
          <text
            x={CX}
            y={CY - 10}
            textAnchor="middle"
            style={{ fill: CHART_INK.strongLabel, fontSize: 38, fontWeight: 700 }}
          >
            {Math.round(movedShare * 100)}%
          </text>
          <text
            x={CX}
            y={CY + 18}
            textAnchor="middle"
            style={{ fill: CHART_INK.label, fontSize: 13 }}
          >
            changed
          </text>
        </g>
      </svg>

      <InsightsTooltip state={tooltip} width={wrapRect?.width ?? 0} height={wrapRect?.height ?? 0} />

      <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-xs">
        {groups.map((g) => (
          <span key={g.key} className="flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="h-2.5 w-2.5 rounded-[2px]"
              style={{ background: token(fillToken(g.key)) }}
            />
            <span className="text-muted-foreground">
              {g.label} · {Math.round(g.outgoing)} out / {Math.round(g.incoming)} in
            </span>
          </span>
        ))}
      </div>

      <div className="mt-1.5 space-y-1 text-center text-xs text-muted-foreground">
        <p>
          Ribbon width is {unit}s crossing from one {basis === 'momentum' ? 'state' : 'tier'} to
          another over the period; a loop back to the same arc is volume that held. Colour is
          where it came from.
        </p>
        {biggestMoves.length > 0 && (
          <p>
            Biggest shifts:{' '}
            {biggestMoves
              .map((m) => `${truncateLabel(m.office.name, 22)} (${m.from} → ${m.to})`)
              .join(' · ')}
          </p>
        )}
      </div>
    </div>
  );
}
