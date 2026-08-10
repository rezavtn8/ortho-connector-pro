import { useId, useMemo, useRef, useState } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import type { FlowTier } from '@/lib/officeMetrics';
import type { InsightsOffice } from '@/hooks/useInsightsData';
import { layoutRadialBars, DEFAULT_HOLE_RATIO, type RadialBarInput } from './radialBars';
import { polar, truncateLabel } from './svgPolar';
import { CHART_INK, DIVERGING_FILL, TIER_FILL } from './insightsColors';
import { InsightsTooltip, type TooltipState } from './InsightsTooltip';

/**
 * One bar per referring office, radiating from a donut hole, grouped into tier sectors.
 *
 * The geometry — and the reasoning behind proportional sector widths and a linear
 * radius scale — lives in `radialBars.ts`. This file only maps that output to SVG.
 */

const VIEW = 1000;
const CX = VIEW / 2;
const CY = VIEW / 2;
const OUTER = 372;
const INNER = Math.round(OUTER * DEFAULT_HOLE_RATIO);

const TIER_ORDER: FlowTier[] = ['VIP', 'Warm', 'Cold', 'Dormant'];

export type RadialMetric = 'patients' | 'change';

interface RadialBarChartProps {
  offices: InsightsOffice[];
  windowMonths: string[];
  /** Null when history cannot cover an equal-length baseline. */
  baselineMonths: string[] | null;
  metric: RadialMetric;
}

function sumWindow(monthly: Record<string, number>, months: readonly string[]): number {
  let total = 0;
  for (const m of months) total += monthly[m] ?? 0;
  return total;
}

export function RadialBarChart({
  offices,
  windowMonths,
  baselineMonths,
  metric,
}: RadialBarChartProps) {
  const uid = useId().replace(/:/g, '');
  const isMobile = useIsMobile();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);

  const diverging = metric === 'change' && baselineMonths !== null;

  const { layout, rows, total, headline } = useMemo(() => {
    const rows = offices.map((o) => {
      const patients = sumWindow(o.monthly, windowMonths);
      const baseline = baselineMonths ? sumWindow(o.monthly, baselineMonths) : 0;
      return { office: o, patients, baseline, change: patients - baseline };
    });

    const inputs: RadialBarInput[] = rows.map((r) => ({
      id: r.office.id,
      label: r.office.name,
      group: r.office.tier,
      value: diverging ? r.change : r.patients,
      // Always window patients, in both modes. Sorting by the displayed metric would
      // reshuffle every bar on the toggle and lose whichever office was being read.
      sortValue: r.patients,
    }));

    const patients = rows.reduce((acc, r) => acc + r.patients, 0);
    const change = rows.reduce((acc, r) => acc + r.change, 0);

    return {
      rows: new Map(rows.map((r) => [r.office.id, r])),
      total: patients,
      // The centre reports what the bars encode. Showing the patient total while every
      // bar is drawn as a delta would put two unrelated numbers in the same picture.
      headline: diverging ? `${change > 0 ? '+' : ''}${change}` : String(patients),
      layout: layoutRadialBars(inputs, {
        cx: CX,
        cy: CY,
        innerRadius: INNER,
        outerRadius: OUTER,
        groupOrder: TIER_ORDER,
        mode: diverging ? 'diverging' : 'magnitude',
      }),
    };
  }, [offices, windowMonths, baselineMonths, diverging]);

  const { bars, sectors, scale, emptyGroups } = layout;

  const showTip = (e: React.MouseEvent, id: string) => {
    const row = rows.get(id);
    if (!row) return;
    const rect = wrapRef.current?.getBoundingClientRect();
    setTooltip({
      title: row.office.name,
      subtitle: `${row.office.tier}${
        row.office.percentile !== null ? ` · top ${100 - row.office.percentile + 1}%` : ''
      }`,
      rows: [
        { label: 'This window', value: String(row.patients), swatch: TIER_FILL[row.office.tier] },
        ...(baselineMonths ? [{ label: 'Baseline', value: String(row.baseline) }] : []),
        ...(baselineMonths
          ? [{ label: 'Change', value: `${row.change > 0 ? '+' : ''}${row.change}` }]
          : []),
      ],
      x: rect ? e.clientX - rect.left : 0,
      y: rect ? e.clientY - rect.top : 0,
    });
  };

  const fillFor = (bar: (typeof bars)[number]): string => {
    if (!diverging) return TIER_FILL[bar.group as FlowTier] ?? CHART_INK.neutralMark;
    return bar.sign > 0 ? DIVERGING_FILL.up : bar.sign < 0 ? DIVERGING_FILL.down : DIVERGING_FILL.flat;
  };

  const wrapRect = wrapRef.current?.getBoundingClientRect();
  const hovered = hoverId ? bars.find((b) => b.id === hoverId) : null;

  if (bars.length === 0) {
    return (
      <p className="py-16 text-center text-sm text-muted-foreground">
        No referring offices to chart yet.
      </p>
    );
  }

  return (
    <div ref={wrapRef} className="relative" onMouseLeave={() => setTooltip(null)}>
      <svg
        viewBox={`0 0 ${VIEW} ${VIEW}`}
        className="insights-fade mx-auto h-auto w-full max-w-[46rem]"
        role="img"
        aria-label={
          diverging
            ? `Radial bar chart of ${bars.length} referring offices, each bar showing the change in patients against the previous period, grouped by tier`
            : `Radial bar chart of ${bars.length} referring offices totalling ${total} patients, bar length showing patients in the period, grouped by tier`
        }
      >
        {/* Value rings, under the bars. */}
        <g pointerEvents="none">
          {scale.ticks.map((t) => (
            <circle
              key={t.value}
              cx={CX}
              cy={CY}
              r={t.radius}
              fill="none"
              style={{
                stroke: CHART_INK.grid,
                strokeWidth: 1,
                strokeDasharray: '2 4',
                opacity: 0.6,
              }}
            />
          ))}
          {diverging && (
            // The zero circle is the baseline, not a gridline — solid and heavier so
            // "which side of nothing is this bar on" is readable without counting rings.
            <circle
              cx={CX}
              cy={CY}
              r={scale.zeroRadius}
              fill="none"
              style={{ stroke: CHART_INK.axis, strokeWidth: 1.5 }}
            />
          )}
        </g>

        {/* Bars. */}
        <g>
          {bars.map((b) => {
            const dim = hoverId !== null && hoverId !== b.id;
            return (
              <path
                key={b.id}
                d={b.path}
                style={{
                  fill: fillFor(b),
                  opacity: dim ? 0.22 : 1,
                  transition: 'opacity 140ms ease',
                }}
                onMouseEnter={() => setHoverId(b.id)}
                onMouseLeave={() => {
                  setHoverId(null);
                  setTooltip(null);
                }}
                onMouseMove={(e) => showTip(e, b.id)}
              />
            );
          })}
        </g>

        {/* Tier band just outside the bars — keeps tier identity present in the
            diverging view, where the bars themselves are coloured by direction. */}
        <g pointerEvents="none">
          {sectors.map((s) => {
            const a0 = s.startAngle;
            const a1 = s.endAngle;
            const rOut = OUTER + 10;
            const rIn = OUTER + 5;
            const p0 = polar(CX, CY, rOut, a0);
            const p1 = polar(CX, CY, rOut, a1);
            const p2 = polar(CX, CY, rIn, a1);
            const p3 = polar(CX, CY, rIn, a0);
            const large = a1 - a0 > Math.PI ? 1 : 0;
            return (
              <path
                key={`band-${s.group}`}
                d={
                  `M ${p0.x} ${p0.y} A ${rOut} ${rOut} 0 ${large} 1 ${p1.x} ${p1.y}` +
                  ` L ${p2.x} ${p2.y} A ${rIn} ${rIn} 0 ${large} 0 ${p3.x} ${p3.y} Z`
                }
                style={{ fill: TIER_FILL[s.group as FlowTier] ?? CHART_INK.neutralMark }}
              />
            );
          })}
        </g>

        {/* Curved sector labels. */}
        <defs>
          {sectors.map((s) => (
            <path key={`p-${s.group}`} id={`${uid}-sector-${s.group}`} d={s.labelPath} fill="none" />
          ))}
        </defs>
        <g pointerEvents="none">
          {sectors.map((s) => (
            <text
              key={`t-${s.group}`}
              style={{
                fill: CHART_INK.strongLabel,
                fontSize: 15,
                fontWeight: 600,
                letterSpacing: '0.06em',
              }}
            >
              <textPath href={`#${uid}-sector-${s.group}`} startOffset="50%" textAnchor="middle">
                {s.group.toUpperCase()} · {s.count}
              </textPath>
            </text>
          ))}
        </g>

        {/* Tick values, in the gutter that opens the first sector. */}
        <g pointerEvents="none">
          {scale.ticks.map((t) => {
            const p = polar(CX, CY, t.radius, scale.gutterAngle);
            // Sign is already carried by which side of the zero circle the ring sits
            // on, and by the bar colour. Printing "-4" as well would say it twice.
            const label = String(Math.abs(Math.round(t.value)));
            return (
              <g key={`tick-${t.value}`}>
                <rect
                  x={p.x - label.length * 3.6 - 3}
                  y={p.y - 7}
                  width={label.length * 7.2 + 6}
                  height={14}
                  rx={3}
                  style={{ fill: CHART_INK.surface, opacity: 0.9 }}
                />
                <text
                  x={p.x}
                  y={p.y}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  style={{ fill: CHART_INK.label, fontSize: 10 }}
                >
                  {label}
                </text>
              </g>
            );
          })}
        </g>

        {/* Centre readout. Uses the hole rather than leaving it as dead space. */}
        <g pointerEvents="none">
          <text
            x={CX}
            y={CY - 14}
            textAnchor="middle"
            style={{ fill: CHART_INK.strongLabel, fontSize: 40, fontWeight: 700 }}
          >
            {headline}
          </text>
          <text
            x={CX}
            y={CY + 16}
            textAnchor="middle"
            style={{ fill: CHART_INK.label, fontSize: 14 }}
          >
            {/* "from N offices", not a bare "patients": the window bar above counts
                every source, this chart counts referring offices only, and two
                different totals on one screen with the same label reads as a bug. */}
            {diverging ? 'net change' : 'patients'} from {bars.length} office
            {bars.length === 1 ? '' : 's'}
          </text>
          {hovered && (
            <text
              x={CX}
              y={CY + 46}
              textAnchor="middle"
              style={{ fill: CHART_INK.strongLabel, fontSize: 15, fontWeight: 600 }}
            >
              {truncateLabel(hovered.label, 26)}
            </text>
          )}
        </g>

        {/* The hovered bar's own label, drawn last so nothing paints over it. There is
            no per-office label ring at all: at 40+ offices the names collide into a
            grey smear, and a ring of unreadable text is worse than none. */}
        {hovered && !isMobile && (
          <g pointerEvents="none">
            {(() => {
              const p = polar(CX, CY, Math.max(hovered.r1, hovered.r0) + 26, hovered.midAngle);
              const text = truncateLabel(hovered.label, 24);
              const w = text.length * 7 + 12;
              const flip = hovered.midAngle > Math.PI;
              return (
                <>
                  <rect
                    x={p.x - (flip ? w - 6 : 6)}
                    y={p.y - 11}
                    width={w}
                    height={22}
                    rx={4}
                    style={{ fill: CHART_INK.surface, stroke: CHART_INK.axis, strokeWidth: 1 }}
                  />
                  <text
                    x={p.x + (flip ? -12 : 12)}
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
        {diverging ? (
          <>
            <LegendSwatch color={DIVERGING_FILL.up} label="Gaining" />
            <LegendSwatch color={DIVERGING_FILL.down} label="Slipping" />
            <LegendSwatch color={DIVERGING_FILL.flat} label="No change" />
            <span className="text-muted-foreground">
              Bars grow outward when gaining, inward when slipping. Ring colour is the tier.
            </span>
          </>
        ) : (
          TIER_ORDER.map((tier) => (
            <LegendSwatch
              key={tier}
              color={TIER_FILL[tier]}
              label={`${tier} · ${sectors.find((s) => s.group === tier)?.count ?? 0}`}
              muted={emptyGroups.includes(tier)}
            />
          ))
        )}
      </div>

      {emptyGroups.length > 0 && !diverging && (
        <p className="mt-1.5 text-center text-xs text-muted-foreground">
          No offices in {emptyGroups.join(', ')} — those sectors are absent, not hidden.
        </p>
      )}
      {metric === 'change' && baselineMonths === null && (
        <p className="mt-1.5 text-center text-xs text-muted-foreground">
          Not enough history for an equal-length baseline — showing patients instead.
        </p>
      )}
    </div>
  );
}

function LegendSwatch({
  color,
  label,
  muted,
}: {
  color: string;
  label: string;
  muted?: boolean;
}) {
  return (
    <span className={muted ? 'flex items-center gap-1.5 opacity-50' : 'flex items-center gap-1.5'}>
      <span
        aria-hidden="true"
        className="h-2.5 w-2.5 rounded-[2px]"
        style={{ background: color }}
      />
      <span className="text-muted-foreground">{label}</span>
    </span>
  );
}
