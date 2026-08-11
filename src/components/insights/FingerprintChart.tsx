import { useMemo, useRef, useState } from 'react';
import type { FlowTier } from '@/lib/officeMetrics';
import type { InsightsOffice } from '@/hooks/useInsightsData';
import {
  layoutFingerprint,
  shortMonthLabel,
  type FingerprintSort,
} from './fingerprint';
import { formatYearMonth } from '@/lib/database.types';
import { CHART_INK, HEAT_FILL, TIER_FILL, heatStep, heatThresholds } from './insightsColors';
import { truncateLabel } from './svgPolar';
import { InsightsTooltip, type TooltipState } from './InsightsTooltip';

/**
 * Every office against every month, as a grid.
 *
 * The one view on this page that ranks nothing and argues nothing. It exists so that
 * patterns nobody thought to ask about are visible anyway — the office that only
 * refers in summer, the one that stopped dead in March, the two-year solid row next
 * to three scattered cells.
 */

const ROW_H = 15;
const ROW_GAP = 2;
const NAME_W = 176;
const SUMMARY_W = 92;
const HEADER_H = 26;
const FOOTER_H = 34;
const GROUP_GAP = 14;

interface FingerprintChartProps {
  offices: InsightsOffice[];
  windowMonths: string[];
  sort: FingerprintSort;
}

export function FingerprintChart({ offices, windowMonths, sort }: FingerprintChartProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [hoverRow, setHoverRow] = useState<string | null>(null);
  const [hoverCol, setHoverCol] = useState<number | null>(null);

  const layout = useMemo(
    () => layoutFingerprint(offices, windowMonths, sort),
    [offices, windowMonths, sort],
  );

  const { rows, groups, months, max, columnTotals, grandTotal } = layout;

  // Geometry. The grid is drawn at a fixed cell size and the whole SVG is scaled by
  // its viewBox, so no measurement of the container is needed — the same reason the
  // other views on this page avoid a ResizeObserver.
  const cellW = 22;
  const gridW = Math.max(1, months.length * cellW);
  const width = NAME_W + gridW + SUMMARY_W;
  const bodyH = rows.length * (ROW_H + ROW_GAP) + Math.max(0, groups.length - 1) * GROUP_GAP;
  const height = HEADER_H + bodyH + FOOTER_H;

  /** Row index -> y, accounting for the gap between tier groups. */
  const rowY = useMemo(() => {
    const ys: number[] = [];
    let y = HEADER_H;
    let group = 0;
    for (let i = 0; i < rows.length; i++) {
      if (group < groups.length - 1 && i === groups[group + 1].startRow) {
        y += GROUP_GAP;
        group++;
      }
      ys.push(y);
      y += ROW_H + ROW_GAP;
    }
    return ys;
  }, [rows.length, groups]);

  const maxColumnTotal = Math.max(1, ...columnTotals);
  const thresholds = heatThresholds(max);

  const showTip = (e: React.MouseEvent, state: Omit<TooltipState, 'x' | 'y'>) => {
    const rect = wrapRef.current?.getBoundingClientRect();
    setTooltip({ ...state, x: rect ? e.clientX - rect.left : 0, y: rect ? e.clientY - rect.top : 0 });
  };

  const wrapRect = wrapRef.current?.getBoundingClientRect();

  if (rows.length === 0 || months.length === 0) {
    return (
      <p className="py-16 text-center text-sm text-muted-foreground">
        No referring offices to chart yet.
      </p>
    );
  }

  return (
    <div ref={wrapRef} className="relative" onMouseLeave={() => setTooltip(null)}>
      {/* The grid grows with the office count, so it scrolls in its own box rather
          than stretching the page or being squashed to illegibility. */}
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          width={width}
          height={height}
          className="insights-fade block max-w-full"
          style={{ height: 'auto' }}
          role="img"
          aria-label={`Grid of ${rows.length} referring offices against ${months.length} months, shaded by patients per month, ${grandTotal} in total`}
          onMouseLeave={() => {
            setHoverRow(null);
            setHoverCol(null);
          }}
        >
          {/* Month axis. Januaries are always labelled because they carry the year;
              the regular every-third-column labels stand down when they would land
              next to one, which is what stops "Dec" and "Jan 26" printing on top of
              each other. */}
          <g pointerEvents="none">
            {months.map((m, i) => {
              const { label, isYearStart } = shortMonthLabel(m);
              const nearYearStart = months.some(
                (other, j) => Math.abs(j - i) <= 1 && j !== i && shortMonthLabel(other).isYearStart,
              );
              const show =
                isYearStart || ((i % 3 === 0 || i === months.length - 1) && !nearYearStart);
              if (!show) return null;
              return (
                <text
                  key={m}
                  x={NAME_W + i * cellW + cellW / 2}
                  y={HEADER_H - 9}
                  textAnchor="middle"
                  style={{
                    fill: hoverCol === i ? CHART_INK.strongLabel : CHART_INK.label,
                    fontSize: 9,
                    fontWeight: isYearStart ? 600 : 400,
                  }}
                >
                  {label}
                </text>
              );
            })}
          </g>

          {/* Tier group labels, sitting in the name gutter. Tier is the only place a
              tier colour appears here — the cells are a single sequential hue, so
              magnitude and identity never compete for the same channel. */}
          <g pointerEvents="none">
            {groups.map((g) => (
              <g key={g.tier}>
                <rect
                  x={0}
                  y={rowY[g.startRow] - 1}
                  width={3}
                  height={g.count * (ROW_H + ROW_GAP) - ROW_GAP + 2}
                  rx={1.5}
                  style={{ fill: TIER_FILL[g.tier as FlowTier] }}
                />
                <text
                  x={9}
                  y={rowY[g.startRow] - 4}
                  style={{
                    fill: CHART_INK.label,
                    fontSize: 8.5,
                    fontWeight: 600,
                    letterSpacing: '0.08em',
                  }}
                >
                  {g.tier.toUpperCase()} · {g.count} · {g.total}
                </text>
              </g>
            ))}
          </g>

          {/* Rows. */}
          <g>
            {rows.map((row, ri) => {
              const y = rowY[ri];
              const dim = hoverRow !== null && hoverRow !== row.id;
              return (
                <g key={row.id} style={{ opacity: dim ? 0.35 : 1, transition: 'opacity 120ms ease' }}>
                  <text
                    x={9}
                    y={y + ROW_H / 2}
                    dominantBaseline="middle"
                    style={{
                      fill: hoverRow === row.id ? CHART_INK.strongLabel : CHART_INK.label,
                      fontSize: 9.5,
                    }}
                  >
                    {truncateLabel(row.name, 26)}
                  </text>

                  {row.cells.map((v, ci) => {
                    const step = heatStep(v, max);
                    const x = NAME_W + ci * cellW;
                    return (
                      <rect
                        key={ci}
                        x={x + 1}
                        y={y}
                        width={cellW - 2}
                        height={ROW_H}
                        rx={2}
                        style={{
                          // An empty month is drawn as a faint well, not as the
                          // lightest shade of the ramp: "none" and "one" are
                          // different facts and must not be told apart by eye.
                          fill: step < 0 ? CHART_INK.grid : HEAT_FILL[step],
                          opacity: step < 0 ? 0.35 : 1,
                          cursor: 'pointer',
                        }}
                        onMouseEnter={() => {
                          setHoverRow(row.id);
                          setHoverCol(ci);
                        }}
                        onMouseMove={(e) =>
                          showTip(e, {
                            title: row.name,
                            subtitle: `${formatYearMonth(months[ci])} · ${row.tier}`,
                            rows: [
                              { label: 'Patients', value: String(v) },
                              { label: 'Row total', value: String(row.total) },
                              {
                                label: 'Active months',
                                value: `${Math.round(row.consistency * months.length)} of ${months.length}`,
                              },
                            ],
                          })
                        }
                      />
                    );
                  })}

                  {/* Row summary: total, plus a consistency bar. Two numbers that are
                      hard to read off a row of shaded cells but easy to compare in a
                      column of their own. */}
                  <text
                    x={NAME_W + gridW + 30}
                    y={y + ROW_H / 2}
                    textAnchor="end"
                    dominantBaseline="middle"
                    style={{ fill: CHART_INK.strongLabel, fontSize: 9.5, fontWeight: 600 }}
                  >
                    {row.total}
                  </text>
                  <rect
                    x={NAME_W + gridW + 40}
                    y={y + ROW_H / 2 - 3}
                    width={44}
                    height={6}
                    rx={3}
                    style={{ fill: CHART_INK.grid, opacity: 0.5 }}
                  />
                  <rect
                    x={NAME_W + gridW + 40}
                    y={y + ROW_H / 2 - 3}
                    width={Math.max(1, 44 * row.consistency)}
                    height={6}
                    rx={3}
                    style={{ fill: TIER_FILL[row.tier as FlowTier], opacity: 0.85 }}
                  />
                </g>
              );
            })}
          </g>

          {/* Column totals along the bottom — the practice's monthly volume, aligned
              cell-for-cell with the grid above it. */}
          <g pointerEvents="none">
            {columnTotals.map((t, i) => {
              const h = Math.max(1, (t / maxColumnTotal) * (FOOTER_H - 16));
              return (
                <rect
                  key={i}
                  x={NAME_W + i * cellW + 1}
                  y={HEADER_H + bodyH + (FOOTER_H - 16) - h + 4}
                  width={cellW - 2}
                  height={h}
                  rx={1.5}
                  style={{
                    fill: CHART_INK.label,
                    opacity: hoverCol === i ? 0.85 : 0.4,
                  }}
                />
              );
            })}
            <text
              x={NAME_W - 8}
              y={HEADER_H + bodyH + FOOTER_H - 8}
              textAnchor="end"
              style={{ fill: CHART_INK.label, fontSize: 8.5 }}
            >
              monthly total
            </text>
          </g>
        </svg>
      </div>

      <InsightsTooltip state={tooltip} width={wrapRect?.width ?? 0} height={wrapRect?.height ?? 0} />

      <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs">
        <span className="flex items-center gap-1.5">
          <span className="text-muted-foreground">Patients / month</span>
          <span
            aria-hidden="true"
            className="h-2.5 w-4 rounded-[2px]"
            style={{ background: CHART_INK.grid, opacity: 0.5 }}
          />
          <span className="text-muted-foreground">0</span>
          {HEAT_FILL.map((fill, i) => (
            <span key={i} className="flex items-center gap-1">
              <span
                aria-hidden="true"
                className="h-2.5 w-4 rounded-[2px]"
                style={{ background: fill }}
              />
              <span className="text-muted-foreground">{thresholds[i] ?? ''}</span>
            </span>
          ))}
        </span>
        <span className="text-muted-foreground">
          Right-hand bar is how many months the office was active.
        </span>
      </div>
    </div>
  );
}
