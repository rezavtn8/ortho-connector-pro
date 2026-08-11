import { useMemo, useRef, useState } from 'react';
import type { FlowTier, MonthlySeries } from '@/lib/officeMetrics';
import { tierSnapshot } from '@/lib/tierSnapshot';
import type { InsightsOffice, InsightsSource } from '@/hooks/useInsightsData';
import { formatYearMonth, SOURCE_TYPE_CONFIG } from '@/lib/database.types';
import { layoutStream, nearestIndex, type StreamSeriesInput } from './streamLayout';
import { shortMonthLabel } from './fingerprint';
import { CHART_INK, HEAT_FILL, TIER_FILL } from './insightsColors';
import { niceTicks } from './svgPolar';
import { InsightsTooltip, type TooltipState } from './InsightsTooltip';

/**
 * How the book was composed, month by month.
 *
 * The tier bands are the point. Each month is stacked by the tier every office held
 * **in that month**, re-derived with `tierSnapshot` rather than painting today's tier
 * back across two years of history. Back-projecting is the tempting shortcut and it
 * produces a chart that cannot show what it is for: an office that was Cold in 2025
 * and is VIP now would have its old quiet months drawn as VIP volume, so the VIP band
 * would appear to have been large all along and the growth would vanish.
 *
 * That costs one `deriveOfficeMetrics` pass per month. At two dozen months and a few
 * hundred offices it is a few milliseconds inside a `useMemo`.
 */

const VIEW_W = 900;
const VIEW_H = 340;
const MARGIN = { top: 14, right: 16, bottom: 30, left: 46 };
const PLOT_W = VIEW_W - MARGIN.left - MARGIN.right;
const PLOT_H = VIEW_H - MARGIN.top - MARGIN.bottom;

/** Bottom of the stack first. Strongest relationships sit on the baseline. */
const TIER_STACK: FlowTier[] = ['VIP', 'Warm', 'Cold', 'Dormant'];

export type TidesBasis = 'tier' | 'sourceType';

interface TidesChartProps {
  offices: InsightsOffice[];
  otherSources: InsightsSource[];
  officeCohort: Array<{ id: string; name: string }>;
  officeSeries: MonthlySeries;
  /** The full month axis, not just the selected window — this view is the long view. */
  months: string[];
  /** Highlighted span, so the chart and the rest of the page agree on "now". */
  windowMonths: string[];
  basis: TidesBasis;
  nowDate: Date;
}

export function TidesChart({
  offices,
  otherSources,
  officeCohort,
  officeSeries,
  months,
  windowMonths,
  basis,
  nowDate,
}: TidesChartProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [cursor, setCursor] = useState<number | null>(null);
  const [hoverKey, setHoverKey] = useState<string | null>(null);

  const { layout, keys, labels, fills } = useMemo(() => {
    if (basis === 'sourceType') {
      const byType = new Map<string, number[]>();
      const push = (type: string, index: number, value: number) => {
        let row = byType.get(type);
        if (!row) {
          row = new Array<number>(months.length).fill(0);
          byType.set(type, row);
        }
        row[index] += value;
      };

      months.forEach((m, i) => {
        for (const o of offices) push('Office', i, o.monthly[m] ?? 0);
        for (const s of otherSources) push(s.sourceType, i, s.monthly[m] ?? 0);
      });

      // Biggest first so the baseline band is the stable one; a small jittery band on
      // the bottom makes every band above it wobble for no reason.
      const ordered = [...byType.entries()].sort(
        (a, b) =>
          b[1].reduce((x, y) => x + y, 0) - a[1].reduce((x, y) => x + y, 0) ||
          (a[0] < b[0] ? -1 : 1),
      );

      const series: StreamSeriesInput[] = ordered.map(([key, values]) => ({
        key,
        label: SOURCE_TYPE_CONFIG[key as keyof typeof SOURCE_TYPE_CONFIG]?.label ?? key,
        values,
      }));

      return {
        layout: layoutStream(series, months.length, { width: PLOT_W, height: PLOT_H }),
        keys: series.map((s) => s.key),
        labels: Object.fromEntries(series.map((s) => [s.key, s.label])),
        // Source type is not the tier vocabulary, so it must not borrow tier colours.
        // The sequential ramp is reused here as an ordinal one — the bands are stacked
        // and labelled, so order is the encoding and hue is not being asked to carry
        // eight distinct identities it cannot.
        fills: Object.fromEntries(
          series.map((s, i) => [s.key, HEAT_FILL[Math.min(HEAT_FILL.length - 1, i)]]),
        ) as Record<string, string>,
      };
    }

    const byTier = new Map<FlowTier, number[]>(
      TIER_STACK.map((t) => [t, new Array<number>(months.length).fill(0)]),
    );

    months.forEach((m, i) => {
      // The tier each office held *that month*, not the one it holds today.
      const snapshot = tierSnapshot(officeCohort, officeSeries, m, nowDate);
      const tierOf = new Map(snapshot.map((row) => [row.id, row.tier]));
      for (const o of offices) {
        const v = o.monthly[m] ?? 0;
        if (v <= 0) continue;
        byTier.get(tierOf.get(o.id) ?? o.tier)![i] += v;
      }
    });

    const series: StreamSeriesInput[] = TIER_STACK.map((t) => ({
      key: t,
      label: t,
      values: byTier.get(t)!,
    }));

    return {
      layout: layoutStream(series, months.length, { width: PLOT_W, height: PLOT_H }),
      keys: TIER_STACK as string[],
      labels: Object.fromEntries(TIER_STACK.map((t) => [t, t])),
      fills: Object.fromEntries(TIER_STACK.map((t) => [t, TIER_FILL[t]])) as Record<string, string>,
    };
  }, [basis, offices, otherSources, officeCohort, officeSeries, months, nowDate]);

  const { bands, xs, totals, max, outlinePath } = layout;

  const windowStart = months.indexOf(windowMonths[0] ?? '');
  const windowEnd = months.indexOf(windowMonths[windowMonths.length - 1] ?? '');

  const yTicks = useMemo(() => niceTicks(max, 4), [max]);

  const handleMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    if (!rect.width) return;
    const local = ((e.clientX - rect.left) / rect.width) * VIEW_W - MARGIN.left;
    const i = nearestIndex(xs, local);
    if (i < 0) return;
    setCursor(i);

    const wrap = wrapRef.current?.getBoundingClientRect();
    setTooltip({
      title: formatYearMonth(months[i]),
      subtitle: `${totals[i]} patient${totals[i] === 1 ? '' : 's'}`,
      rows: bands
        .filter((b) => b.points[i].value > 0)
        .reverse()
        .map((b) => ({
          label: labels[b.key] ?? b.key,
          value: String(b.points[i].value),
          swatch: fills[b.key],
        })),
      x: wrap ? e.clientX - wrap.left : 0,
      y: wrap ? e.clientY - wrap.top : 0,
    });
  };

  const wrapRect = wrapRef.current?.getBoundingClientRect();

  if (bands.length === 0 || months.length === 0) {
    return (
      <p className="py-16 text-center text-sm text-muted-foreground">
        No referral history to chart yet.
      </p>
    );
  }

  return (
    <div ref={wrapRef} className="relative" onMouseLeave={() => setTooltip(null)}>
      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        className="insights-fade h-auto w-full"
        role="img"
        aria-label={
          basis === 'tier'
            ? `Stacked area of monthly patients across ${months.length} months, banded by the referral tier each office held in that month`
            : `Stacked area of monthly patients across ${months.length} months, banded by source type`
        }
        onMouseMove={handleMove}
        onMouseLeave={() => {
          setCursor(null);
          setTooltip(null);
        }}
      >
        <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>
          {/* The selected window, so this long view and the rest of the page agree on
              which months the other tabs are describing. */}
          {windowStart >= 0 &&
            windowEnd >= windowStart &&
            xs.length > 1 &&
            (() => {
              // Clamped to the plot box. Extending half a step past the last month —
              // which is where the raw arithmetic lands — puts the shade outside the
              // axis it is meant to be describing.
              const half = PLOT_W / (months.length - 1) / 2;
              const x0 = Math.max(0, xs[windowStart] - half);
              const x1 = Math.min(PLOT_W, xs[windowEnd] + half);
              return (
                <rect
                  x={x0}
                  y={0}
                  width={Math.max(0, x1 - x0)}
                  height={PLOT_H}
                  style={{ fill: CHART_INK.label, opacity: 0.06 }}
                />
              );
            })()}

          <g pointerEvents="none">
            {yTicks.map((t) => {
              const y = PLOT_H - (t / max) * PLOT_H;
              return (
                <g key={t}>
                  <line
                    x1={0}
                    y1={y}
                    x2={PLOT_W}
                    y2={y}
                    style={{ stroke: CHART_INK.grid, strokeWidth: 1, opacity: 0.55 }}
                  />
                  <text
                    x={-8}
                    y={y}
                    textAnchor="end"
                    dominantBaseline="middle"
                    style={{ fill: CHART_INK.label, fontSize: 9.5 }}
                  >
                    {t}
                  </text>
                </g>
              );
            })}
          </g>

          <g>
            {bands.map((b) => {
              const dim = hoverKey !== null && hoverKey !== b.key;
              return (
                <path
                  key={b.key}
                  d={b.path}
                  style={{
                    fill: fills[b.key],
                    opacity: dim ? 0.25 : 0.88,
                    transition: 'opacity 140ms ease',
                  }}
                  onMouseEnter={() => setHoverKey(b.key)}
                  onMouseLeave={() => setHoverKey(null)}
                />
              );
            })}
          </g>

          {/* The outline is the practice's monthly total. Drawn over the bands so it
              stays readable however the composition shifts underneath it. */}
          <path
            d={outlinePath}
            fill="none"
            pointerEvents="none"
            style={{ stroke: CHART_INK.strongLabel, strokeWidth: 1.5, opacity: 0.55 }}
          />

          {cursor !== null && xs[cursor] !== undefined && (
            <g pointerEvents="none">
              <line
                x1={xs[cursor]}
                y1={0}
                x2={xs[cursor]}
                y2={PLOT_H}
                style={{ stroke: CHART_INK.strongLabel, strokeWidth: 1, opacity: 0.4 }}
              />
              <circle
                cx={xs[cursor]}
                cy={PLOT_H - (totals[cursor] / max) * PLOT_H}
                r={3.5}
                style={{ fill: CHART_INK.surface, stroke: CHART_INK.strongLabel, strokeWidth: 1.5 }}
              />
            </g>
          )}

          <g pointerEvents="none">
            {months.map((m, i) => {
              const { label, isYearStart } = shortMonthLabel(m);
              const step = Math.max(1, Math.ceil(months.length / 12));
              if (!isYearStart && i % step !== 0 && i !== months.length - 1) return null;
              return (
                <text
                  key={m}
                  x={xs[i]}
                  y={PLOT_H + 16}
                  textAnchor="middle"
                  style={{
                    fill: cursor === i ? CHART_INK.strongLabel : CHART_INK.label,
                    fontSize: 9.5,
                    fontWeight: isYearStart ? 600 : 400,
                  }}
                >
                  {label}
                </text>
              );
            })}
          </g>
        </g>
      </svg>

      <InsightsTooltip state={tooltip} width={wrapRect?.width ?? 0} height={wrapRect?.height ?? 0} />

      <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-xs">
        {[...keys].reverse().map((k) => {
          const band = bands.find((b) => b.key === k);
          return (
            <button
              key={k}
              type="button"
              className="flex items-center gap-1.5 rounded px-1 py-0.5 hover:bg-muted"
              onMouseEnter={() => setHoverKey(k)}
              onMouseLeave={() => setHoverKey(null)}
            >
              <span
                aria-hidden="true"
                className="h-2.5 w-2.5 rounded-[2px]"
                style={{ background: fills[k] }}
              />
              <span className="text-muted-foreground">
                {labels[k] ?? k} · {band?.total ?? 0}
              </span>
            </button>
          );
        })}
      </div>

      <p className="mt-1.5 text-center text-xs text-muted-foreground">
        {basis === 'tier' ? (
          <>
            Banded by the tier each office held <em>in that month</em>, not the tier it holds
            today — so growth into VIP shows as growth rather than having always been there.
          </>
        ) : (
          <>Banded by where the patient came from. The outline is the monthly total.</>
        )}{' '}
        The shaded span is the period the other tabs are showing.
      </p>
    </div>
  );
}
