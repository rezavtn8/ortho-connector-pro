import { useMemo, useRef, useState } from 'react';
import type { FlowTier } from '@/lib/officeMetrics';
import type { InsightsOffice } from '@/hooks/useInsightsData';
import { layoutOrbit } from './orbitLayout';
import { COMPASS_POINTS } from './geo';
import { annulusSectorPath, polar, truncateLabel, TAU } from './svgPolar';
import { CHART_INK, TIER_FILL, alpha } from './insightsColors';
import { InsightsTooltip, type TooltipState } from './InsightsTooltip';

/**
 * The catchment as a compass: bearing around, distance out.
 *
 * The map on `/map-view` plots these same offices on real geography, which is exactly
 * why it cannot answer this. Pinned to streets, the *shape* of the catchment is buried
 * under roads and labels. Strip the geography, keep only direction and distance, and
 * the shape is the only thing left: a book that leans hard to one side, a ring of
 * neighbours with nothing beyond it, or a scatter of distant offices doing the work.
 */

const VIEW = 900;
const CX = VIEW / 2;
const CY = VIEW / 2;
const FIELD = 320;
const SECTOR_INNER = FIELD + 14;
const SECTOR_OUTER = FIELD + 44;

const TIER_ORDER: FlowTier[] = ['VIP', 'Warm', 'Cold', 'Dormant'];

interface OrbitChartProps {
  offices: InsightsOffice[];
  windowMonths: string[];
  /** Null when the practice has never been geocoded — nothing can be measured from. */
  hasOrigin: boolean;
}

function sumWindow(monthly: Record<string, number>, months: readonly string[]): number {
  let total = 0;
  for (const m of months) total += monthly[m] ?? 0;
  return total;
}

export function OrbitChart({ offices, windowMonths, hasOrigin }: OrbitChartProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [hoverSector, setHoverSector] = useState<number | null>(null);

  const { layout, byId, total } = useMemo(() => {
    const rows = offices.map((o) => ({
      office: o,
      patients: sumWindow(o.monthly, windowMonths),
    }));

    return {
      byId: new Map(rows.map((r) => [r.office.id, r])),
      total: rows.reduce((acc, r) => acc + r.patients, 0),
      layout: layoutOrbit(
        rows.map((r) => ({
          id: r.office.id,
          bearingDeg: r.office.bearingDeg,
          distanceMiles: r.office.distanceMiles,
          value: r.patients,
        })),
        { cx: CX, cy: CY, radius: FIELD, minDotRadius: 3.5, maxDotRadius: 20 },
      ),
    };
  }, [offices, windowMonths]);

  const { dots, rings, maxMiles, sectorTotals, unplaced, medianMiles } = layout;
  const maxSector = Math.max(1, ...sectorTotals);

  const showTip = (e: React.MouseEvent, state: Omit<TooltipState, 'x' | 'y'>) => {
    const rect = wrapRef.current?.getBoundingClientRect();
    setTooltip({ ...state, x: rect ? e.clientX - rect.left : 0, y: rect ? e.clientY - rect.top : 0 });
  };

  const wrapRect = wrapRef.current?.getBoundingClientRect();
  const hovered = hoverId ? dots.find((d) => d.id === hoverId) : null;

  if (!hasOrigin) {
    return (
      <p className="py-16 text-center text-sm text-muted-foreground">
        Your practice has no coordinates yet, so there is nothing to measure distance from.
        Add its address in Settings and this fills in.
      </p>
    );
  }

  if (dots.length === 0) {
    return (
      <p className="py-16 text-center text-sm text-muted-foreground">
        None of your referring offices have coordinates yet, so none can be placed.
      </p>
    );
  }

  return (
    <div ref={wrapRef} className="relative" onMouseLeave={() => setTooltip(null)}>
      <svg
        viewBox={`0 0 ${VIEW} ${VIEW}`}
        className="insights-fade mx-auto h-auto w-full max-w-[46rem]"
        role="img"
        aria-label={`Polar plot of ${dots.length} referring offices by compass direction and distance from the practice, out to ${Math.round(maxMiles)} miles`}
      >
        {/* Distance rings and their labels. */}
        <g pointerEvents="none">
          {rings.map((ring) => (
            <circle
              key={ring.miles}
              cx={CX}
              cy={CY}
              r={ring.radius}
              fill="none"
              style={{ stroke: CHART_INK.grid, strokeWidth: 1, strokeDasharray: '2 5' }}
            />
          ))}
          {/* Spokes on the eight compass points, so a bearing can be read off. */}
          {COMPASS_POINTS.map((_, i) => {
            const p = polar(CX, CY, FIELD, (i / 8) * TAU);
            return (
              <line
                key={i}
                x1={CX}
                y1={CY}
                x2={p.x}
                y2={p.y}
                style={{ stroke: CHART_INK.grid, strokeWidth: 1, opacity: 0.45 }}
              />
            );
          })}
          {rings.map((ring) => (
            <g key={`lbl-${ring.miles}`}>
              <rect
                x={CX - 17}
                y={CY - ring.radius - 7}
                width={34}
                height={14}
                rx={3}
                style={{ fill: CHART_INK.surface, opacity: 0.9 }}
              />
              <text
                x={CX}
                y={CY - ring.radius}
                textAnchor="middle"
                dominantBaseline="middle"
                style={{ fill: CHART_INK.label, fontSize: 9.5 }}
              >
                {ring.miles < 1 ? ring.miles.toFixed(1) : Math.round(ring.miles)} mi
              </text>
            </g>
          ))}
        </g>

        {/* The compass rose: one wedge per direction, length by patients from it.
            This is the summary the scatter cannot give — "most of our patients come
            from the south-east" is a sector, not a dot. */}
        <g>
          {COMPASS_POINTS.map((point, i) => {
            const centre = (i / 8) * TAU;
            const half = TAU / 16 - 0.02;
            const share = sectorTotals[i] / maxSector;
            const r1 = SECTOR_INNER + (SECTOR_OUTER - SECTOR_INNER) * share;
            const active = hoverSector === null || hoverSector === i;
            return (
              <g key={point}>
                <path
                  d={annulusSectorPath(CX, CY, SECTOR_INNER, SECTOR_OUTER, centre - half, centre + half)}
                  style={{ fill: CHART_INK.grid, opacity: 0.35 }}
                />
                <path
                  d={annulusSectorPath(CX, CY, SECTOR_INNER, Math.max(SECTOR_INNER + 0.5, r1), centre - half, centre + half)}
                  style={{
                    fill: CHART_INK.label,
                    opacity: active ? 0.75 : 0.25,
                    cursor: 'pointer',
                    transition: 'opacity 140ms ease',
                  }}
                  onMouseEnter={() => setHoverSector(i)}
                  onMouseLeave={() => {
                    setHoverSector(null);
                    setTooltip(null);
                  }}
                  onMouseMove={(e) =>
                    showTip(e, {
                      title: `${point} of the practice`,
                      rows: [
                        { label: 'Patients', value: String(sectorTotals[i]) },
                        {
                          label: 'Share',
                          value: total > 0 ? `${Math.round((sectorTotals[i] / total) * 100)}%` : '—',
                        },
                      ],
                    })
                  }
                />
                <text
                  pointerEvents="none"
                  x={polar(CX, CY, SECTOR_OUTER + 16, centre).x}
                  y={polar(CX, CY, SECTOR_OUTER + 16, centre).y}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  style={{
                    fill: hoverSector === i ? CHART_INK.strongLabel : CHART_INK.label,
                    fontSize: 12,
                    fontWeight: 700,
                    letterSpacing: '0.06em',
                  }}
                >
                  {point}
                </text>
              </g>
            );
          })}
        </g>

        {/* The practice itself. */}
        <g pointerEvents="none">
          <circle cx={CX} cy={CY} r={7} style={{ fill: CHART_INK.strongLabel }} />
          <circle
            cx={CX}
            cy={CY}
            r={13}
            fill="none"
            style={{ stroke: CHART_INK.strongLabel, strokeWidth: 1.5, opacity: 0.35 }}
          />
        </g>

        {/* Half-the-patients ring. Patient-weighted, so it answers "half our patients
            come from within N miles" rather than "half our offices are". */}
        {medianMiles !== null && maxMiles > 0 && (
          <g pointerEvents="none">
            <circle
              cx={CX}
              cy={CY}
              r={Math.min(1, medianMiles / maxMiles) * FIELD}
              fill="none"
              style={{
                stroke: CHART_INK.strongLabel,
                strokeWidth: 1.5,
                strokeDasharray: '6 4',
                opacity: 0.5,
              }}
            />
          </g>
        )}

        {/* Offices. */}
        <g>
          {dots.map((d) => {
            const row = byId.get(d.id);
            const tier = row?.office.tier ?? 'Cold';
            const dim = hoverId !== null && hoverId !== d.id;
            return (
              <circle
                key={d.id}
                cx={d.x}
                cy={d.y}
                r={d.r}
                style={{
                  fill: alpha(`tier-${tier.toLowerCase()}`, 0.75),
                  stroke: CHART_INK.surface,
                  strokeWidth: 1.25,
                  opacity: dim ? 0.25 : 1,
                  cursor: 'pointer',
                  transition: 'opacity 140ms ease',
                }}
                onMouseEnter={() => setHoverId(d.id)}
                onMouseLeave={() => {
                  setHoverId(null);
                  setTooltip(null);
                }}
                onMouseMove={(e) =>
                  showTip(e, {
                    title: row?.office.name ?? 'Office',
                    subtitle: `${tier}${d.nudged ? ' · nudged to avoid overlap' : ''}`,
                    rows: [
                      { label: 'Patients', value: String(row?.patients ?? 0), swatch: TIER_FILL[tier] },
                      { label: 'Distance', value: `${d.distance.toFixed(1)} mi` },
                      {
                        label: 'Direction',
                        value: COMPASS_POINTS[Math.round((d.angle / TAU) * 8) % 8],
                      },
                      ...(row?.office.googleRating != null
                        ? [{ label: 'Google', value: `${row.office.googleRating.toFixed(1)}★` }]
                        : []),
                    ],
                  })
                }
              />
            );
          })}
        </g>

        {/* Hovered office label, drawn last. */}
        {hovered && (
          <g pointerEvents="none">
            {(() => {
              const name = truncateLabel(byId.get(hovered.id)?.office.name ?? '', 26);
              const w = name.length * 7 + 16;
              const right = hovered.x < CX;
              return (
                <>
                  <rect
                    x={right ? hovered.x + hovered.r + 6 : hovered.x - hovered.r - 6 - w}
                    y={hovered.y - 11}
                    width={w}
                    height={22}
                    rx={4}
                    style={{ fill: CHART_INK.surface, stroke: CHART_INK.axis, strokeWidth: 1 }}
                  />
                  <text
                    x={right ? hovered.x + hovered.r + 14 : hovered.x - hovered.r - 14}
                    y={hovered.y}
                    textAnchor={right ? 'start' : 'end'}
                    dominantBaseline="middle"
                    style={{ fill: CHART_INK.strongLabel, fontSize: 12, fontWeight: 500 }}
                  >
                    {name}
                  </text>
                </>
              );
            })()}
          </g>
        )}
      </svg>

      <InsightsTooltip state={tooltip} width={wrapRect?.width ?? 0} height={wrapRect?.height ?? 0} />

      <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-xs">
        {TIER_ORDER.map((tier) => (
          <span key={tier} className="flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="h-2.5 w-2.5 rounded-full"
              style={{ background: TIER_FILL[tier] }}
            />
            <span className="text-muted-foreground">{tier}</span>
          </span>
        ))}
        <span className="text-muted-foreground">Dot size is patients in the period.</span>
      </div>

      <div className="mt-1.5 space-y-1 text-center text-xs text-muted-foreground">
        {medianMiles !== null && (
          <p>
            Half your patients come from within{' '}
            <strong className="text-foreground">{medianMiles.toFixed(1)} miles</strong> — the dashed
            ring. Outer edge is {Math.round(maxMiles)} miles.
          </p>
        )}
        {unplaced > 0 && (
          <p>
            {unplaced} office{unplaced === 1 ? '' : 's'} could not be placed for want of an address.
          </p>
        )}
        <p>
          Dots are nudged apart where offices sit on top of each other, so direction and distance
          are approximate at the dot; hover for the real figures.
        </p>
      </div>
    </div>
  );
}
