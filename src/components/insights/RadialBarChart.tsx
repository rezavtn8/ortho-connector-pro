import { useId, useMemo, useRef, useState } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import type { FlowTier } from '@/lib/officeMetrics';
import type { InsightsOffice } from '@/hooks/useInsightsData';
import { layoutRadialBars, DEFAULT_HOLE_RATIO, type RadialBarInput } from './radialBars';
import { annulusSectorPath, polar, truncateLabel } from './svgPolar';
import { CHART_INK, DIVERGING_FILL, HEAT_FILL, TIER_FILL, heatStep } from './insightsColors';
import { InsightsTooltip, type TooltipState } from './InsightsTooltip';

/**
 * One bar per referring office, radiating from a donut hole, grouped into tier sectors.
 *
 * The geometry — and the reasoning behind proportional sector widths and a linear
 * radius scale — lives in `radialBars.ts`. This file maps that output to SVG and adds
 * the trace ring: a band of small cells just inside the bars carrying each office's
 * recent monthly history. A bar says how much; the trace says whether it arrived
 * steadily or in one lump, which is the difference between a relationship and a
 * one-off, and it costs one ring rather than a second chart.
 */

const VIEW = 1000;
const CX = VIEW / 2;
const CY = VIEW / 2;
const OUTER = 368;
const INNER = Math.round(OUTER * DEFAULT_HOLE_RATIO);
const TRACE_OUTER = INNER - 6;
const TRACE_DEPTH = 58;
const TRACE_MONTHS = 12;

const TIER_ORDER: FlowTier[] = ['VIP', 'Warm', 'Cold', 'Dormant'];

export type RadialMetric = 'patients' | 'change' | 'consistency' | 'recency';

interface RadialBarChartProps {
  offices: InsightsOffice[];
  windowMonths: string[];
  /** Null when history cannot cover an equal-length baseline. */
  baselineMonths: string[] | null;
  /** The full axis, so the trace ring can show more history than the window. */
  allMonths: string[];
  metric: RadialMetric;
  showTrace: boolean;
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
  allMonths,
  metric,
  showTrace,
}: RadialBarChartProps) {
  const uid = useId().replace(/:/g, '');
  const isMobile = useIsMobile();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);

  const effectiveMetric: RadialMetric =
    metric === 'change' && baselineMonths === null ? 'patients' : metric;
  const diverging = effectiveMetric === 'change';

  const traceMonths = useMemo(
    () => allMonths.slice(Math.max(0, allMonths.length - TRACE_MONTHS)),
    [allMonths],
  );

  const { layout, rows, headline, caption, traceMax } = useMemo(() => {
    const rows = offices.map((o) => {
      const patients = sumWindow(o.monthly, windowMonths);
      const baseline = baselineMonths ? sumWindow(o.monthly, baselineMonths) : 0;
      const activeMonths = windowMonths.reduce((acc, m) => acc + ((o.monthly[m] ?? 0) > 0 ? 1 : 0), 0);
      return {
        office: o,
        patients,
        baseline,
        change: patients - baseline,
        activeMonths,
        // Share of the window's months with at least one referral. A steady one-a-month
        // office and a single twelve-patient burst have the same total and are not the
        // same relationship.
        consistency: windowMonths.length ? activeMonths / windowMonths.length : 0,
        // Recency as "months of history still ahead of the last referral", so more is
        // better and it plots the same direction as everything else on this chart.
        recency: o.mslr >= 999 ? 0 : Math.max(0, 24 - o.mslr),
      };
    });

    const valueOf = (r: (typeof rows)[number]) => {
      switch (effectiveMetric) {
        case 'change':
          return r.change;
        case 'consistency':
          return r.consistency * 100;
        case 'recency':
          return r.recency;
        default:
          return r.patients;
      }
    };

    const inputs: RadialBarInput[] = rows.map((r) => ({
      id: r.office.id,
      label: r.office.name,
      group: r.office.tier,
      value: valueOf(r),
      // Always window patients, whatever is being shown. Sorting by the displayed
      // metric would reshuffle every bar on the toggle and lose whichever office was
      // being read.
      sortValue: r.patients,
    }));

    const patients = rows.reduce((acc, r) => acc + r.patients, 0);
    const change = rows.reduce((acc, r) => acc + r.change, 0);

    const headline =
      effectiveMetric === 'change'
        ? `${change > 0 ? '+' : ''}${change}`
        : effectiveMetric === 'consistency'
          ? `${Math.round(
              (rows.reduce((acc, r) => acc + r.consistency, 0) / Math.max(1, rows.length)) * 100,
            )}%`
          : String(patients);

    const caption =
      effectiveMetric === 'change'
        ? 'net change'
        : effectiveMetric === 'consistency'
          ? 'median months active'
          : effectiveMetric === 'recency'
            ? 'patients'
            : 'patients';

    let traceMax = 0;
    for (const r of rows) {
      for (const m of traceMonths) {
        const v = r.office.monthly[m] ?? 0;
        if (v > traceMax) traceMax = v;
      }
    }

    return {
      rows: new Map(rows.map((r) => [r.office.id, r])),
      headline,
      caption,
      traceMax,
      layout: layoutRadialBars(inputs, {
        cx: CX,
        cy: CY,
        innerRadius: INNER,
        outerRadius: OUTER,
        groupOrder: TIER_ORDER,
        mode: diverging ? 'diverging' : 'magnitude',
      }),
    };
  }, [offices, windowMonths, baselineMonths, traceMonths, effectiveMetric, diverging]);

  const { bars, sectors, scale, emptyGroups } = layout;

  const showTip = (e: React.MouseEvent, id: string) => {
    const row = rows.get(id);
    if (!row) return;
    const rect = wrapRef.current?.getBoundingClientRect();
    setTooltip({
      title: row.office.name,
      subtitle: `${row.office.tier}${
        row.office.percentile !== null ? ` · top ${101 - row.office.percentile}%` : ''
      }`,
      rows: [
        { label: 'This window', value: String(row.patients), swatch: TIER_FILL[row.office.tier] },
        {
          label: 'Active months',
          value: `${row.activeMonths} of ${windowMonths.length}`,
        },
        ...(baselineMonths
          ? [
              { label: 'Baseline', value: String(row.baseline) },
              { label: 'Change', value: `${row.change > 0 ? '+' : ''}${row.change}` },
            ]
          : []),
        {
          label: 'Last referral',
          value: row.office.mslr >= 999 ? 'never' : `${row.office.mslr} mo ago`,
        },
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

  const unitSuffix =
    effectiveMetric === 'consistency' ? '%' : effectiveMetric === 'recency' ? ' mo' : '';

  return (
    <div ref={wrapRef} className="relative" onMouseLeave={() => setTooltip(null)}>
      <svg
        viewBox={`0 0 ${VIEW} ${VIEW}`}
        className="insights-fade mx-auto h-auto w-full max-w-[48rem]"
        role="img"
        aria-label={`Radial bar chart of ${bars.length} referring offices, bar length showing ${effectiveMetric}, grouped into tier sectors`}
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

        {/* Trace ring: the last twelve months per office, innermost month first, on the
            shared heat ramp. A bar says how much; this says whether it arrived steadily
            or in a single lump. */}
        {showTrace && traceMonths.length > 0 && (
          <g>
            {bars.map((b) => {
              const row = rows.get(b.id);
              if (!row) return null;
              const dim = hoverId !== null && hoverId !== b.id;
              const cellDepth = TRACE_DEPTH / traceMonths.length;
              return (
                <g key={`trace-${b.id}`} style={{ opacity: dim ? 0.18 : 1 }}>
                  {traceMonths.map((m, i) => {
                    const v = row.office.monthly[m] ?? 0;
                    const step = heatStep(v, traceMax);
                    const r0 = TRACE_OUTER - TRACE_DEPTH + i * cellDepth;
                    return (
                      <path
                        key={m}
                        d={annulusSectorPath(
                          CX,
                          CY,
                          r0,
                          r0 + cellDepth * 0.82,
                          b.startAngle,
                          b.endAngle,
                        )}
                        style={{
                          fill: step < 0 ? CHART_INK.grid : HEAT_FILL[step],
                          opacity: step < 0 ? 0.3 : 0.95,
                        }}
                      />
                    );
                  })}
                </g>
              );
            })}
          </g>
        )}

        {/* Tier band just outside the bars — keeps tier identity present in the
            diverging view, where the bars themselves are coloured by direction. */}
        <g pointerEvents="none">
          {sectors.map((s) => (
            <path
              key={`band-${s.group}`}
              d={annulusSectorPath(CX, CY, OUTER + 5, OUTER + 10, s.startAngle, s.endAngle)}
              style={{ fill: TIER_FILL[s.group as FlowTier] ?? CHART_INK.neutralMark }}
            />
          ))}
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
            const label = `${Math.abs(Math.round(t.value))}${unitSuffix}`;
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
            y={CY - 12}
            textAnchor="middle"
            style={{ fill: CHART_INK.strongLabel, fontSize: 38, fontWeight: 700 }}
          >
            {headline}
          </text>
          <text
            x={CX}
            y={CY + 16}
            textAnchor="middle"
            style={{ fill: CHART_INK.label, fontSize: 13 }}
          >
            {/* Named, not a bare "patients": the window bar above counts every source,
                this chart counts referring offices only, and two different totals on
                one screen with the same label reads as a bug. */}
            {caption} from {bars.length} office{bars.length === 1 ? '' : 's'}
          </text>
          {hovered && (
            <text
              x={CX}
              y={CY + 44}
              textAnchor="middle"
              style={{ fill: CHART_INK.strongLabel, fontSize: 14, fontWeight: 600 }}
            >
              {truncateLabel(hovered.label, 26)}
            </text>
          )}
        </g>

        {/* The hovered bar's own label, drawn last so nothing paints over it. There is
            no per-office label ring: past forty offices the names collide into a grey
            smear, and a ring of unreadable text is worse than none. */}
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
        {showTrace && (
          <span className="flex items-center gap-1">
            <span className="text-muted-foreground">Inner ring: last {traceMonths.length} months</span>
            {HEAT_FILL.map((f, i) => (
              <span
                key={i}
                aria-hidden="true"
                className="h-2.5 w-2.5 rounded-[1px]"
                style={{ background: f }}
              />
            ))}
          </span>
        )}
      </div>

      <div className="mt-1.5 space-y-1 text-center text-xs text-muted-foreground">
        {diverging && <p>Bars grow outward when gaining, inward when slipping. Ring colour is the tier.</p>}
        {effectiveMetric === 'consistency' && (
          <p>Bar length is the share of months in the window with at least one referral.</p>
        )}
        {effectiveMetric === 'recency' && (
          <p>Longer bars referred more recently. A missing bar has never referred.</p>
        )}
        {emptyGroups.length > 0 && (
          <p>No offices in {emptyGroups.join(', ')} — those sectors are absent, not hidden.</p>
        )}
        {metric === 'change' && baselineMonths === null && (
          <p>Not enough history for an equal-length baseline — showing patients instead.</p>
        )}
      </div>
    </div>
  );
}

function LegendSwatch({ color, label, muted }: { color: string; label: string; muted?: boolean }) {
  return (
    <span className={muted ? 'flex items-center gap-1.5 opacity-50' : 'flex items-center gap-1.5'}>
      <span aria-hidden="true" className="h-2.5 w-2.5 rounded-[2px]" style={{ background: color }} />
      <span className="text-muted-foreground">{label}</span>
    </span>
  );
}
