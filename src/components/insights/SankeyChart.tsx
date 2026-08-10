import { useId, useMemo, useRef, useState } from 'react';
import { computeMomentum, type FlowTier, type Momentum } from '@/lib/officeMetrics';
import type { InsightsOffice, InsightsSource } from '@/hooks/useInsightsData';
import { layoutSankey, type SankeyLinkInput, type SankeyNodeInput } from './sankeyLayout';
import { CHART_INK, TIER_FILL, alpha } from './insightsColors';
import { InsightsTooltip, type TooltipState } from './InsightsTooltip';

/**
 * Source type -> relationship -> destination, band width = patients in the window.
 *
 * The middle column is the app's tier vocabulary, plus one node the tiers cannot
 * describe: non-office sources. Google and Word of Mouth have no referring
 * relationship to grade, and `deriveOfficeMetrics` assigns tiers by relative quartile
 * over the office cohort — tiering a Google row would both invent a meaningless grade
 * and shift the quartile cut for every real office. They route through **Direct**
 * instead, drawn hatched rather than in a fifth hue so it reads as a different *kind*
 * of thing rather than a fifth tier.
 */

const VIEW_W = 900;
const VIEW_H = 460;
const MARGIN = { top: 16, right: 118, bottom: 16, left: 104 };
const NODE_W = 13;

const TIER_ORDER: FlowTier[] = ['VIP', 'Warm', 'Cold', 'Dormant'];
const DIRECT = 'Direct';

/** Middle-column ids, in render order. Direct sits last, after the graded tiers. */
const MIDDLE_ORDER: Record<string, number> = {
  VIP: 0,
  Warm: 1,
  Cold: 2,
  Dormant: 3,
  [DIRECT]: 4,
};

export type SankeyEndColumn = 'clinic' | 'momentum';

const MOMENTUM_ORDER: Momentum[] = ['rising', 'new', 'steady', 'slipping', 'quiet'];
const MOMENTUM_LABELS: Record<Momentum, string> = {
  rising: 'Rising',
  new: 'New',
  steady: 'Steady',
  slipping: 'Slipping',
  quiet: 'Gone quiet',
};

function sumWindow(monthly: Record<string, number>, months: readonly string[]): number {
  let total = 0;
  for (const m of months) total += monthly[m] ?? 0;
  return total;
}

interface SankeyChartProps {
  offices: InsightsOffice[];
  otherSources: InsightsSource[];
  clinics: Array<{ id: string; name: string }>;
  /** The months on screen, ascending. */
  windowMonths: string[];
  endColumn: SankeyEndColumn;
}

export function SankeyChart({
  offices,
  otherSources,
  clinics,
  windowMonths,
  endColumn,
}: SankeyChartProps) {
  const uid = useId().replace(/:/g, '');
  const wrapRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [hover, setHover] = useState<string | null>(null);

  const graph = useMemo(() => {
    const lastMonth = windowMonths[windowMonths.length - 1] ?? '';

    /** source-type node id -> middle node id -> patients */
    const stage1 = new Map<string, Map<string, number>>();
    /** middle node id -> end node id -> patients */
    const stage2 = new Map<string, Map<string, number>>();
    const sourceTypeTotals = new Map<string, number>();
    const middleTotals = new Map<string, number>();
    const endTotals = new Map<string, number>();

    const add = (table: Map<string, Map<string, number>>, from: string, to: string, v: number) => {
      let row = table.get(from);
      if (!row) {
        row = new Map();
        table.set(from, row);
      }
      row.set(to, (row.get(to) ?? 0) + v);
    };

    const endFor = (monthly: Record<string, number>): { id: string; label: string } => {
      if (endColumn === 'momentum') {
        const m = computeMomentum(monthly, lastMonth).momentum;
        return { id: `end:${m}`, label: MOMENTUM_LABELS[m] };
      }
      const clinic = clinics[0];
      return { id: `end:${clinic?.id ?? 'clinic'}`, label: clinic?.name ?? 'My practice' };
    };

    const endLabels = new Map<string, string>();

    for (const o of offices) {
      const patients = sumWindow(o.monthly, windowMonths);
      if (patients <= 0) continue; // no patients this window means no band to draw
      const end = endFor(o.monthly);
      endLabels.set(end.id, end.label);

      add(stage1, 'src:Office', `mid:${o.tier}`, patients);
      add(stage2, `mid:${o.tier}`, end.id, patients);
      sourceTypeTotals.set('src:Office', (sourceTypeTotals.get('src:Office') ?? 0) + patients);
      middleTotals.set(o.tier, (middleTotals.get(o.tier) ?? 0) + patients);
      endTotals.set(end.id, (endTotals.get(end.id) ?? 0) + patients);
    }

    for (const s of otherSources) {
      const patients = sumWindow(s.monthly, windowMonths);
      if (patients <= 0) continue;
      const end = endFor(s.monthly);
      endLabels.set(end.id, end.label);

      const srcId = `src:${s.sourceType}`;
      add(stage1, srcId, `mid:${DIRECT}`, patients);
      add(stage2, `mid:${DIRECT}`, end.id, patients);
      sourceTypeTotals.set(srcId, (sourceTypeTotals.get(srcId) ?? 0) + patients);
      middleTotals.set(DIRECT, (middleTotals.get(DIRECT) ?? 0) + patients);
      endTotals.set(end.id, (endTotals.get(end.id) ?? 0) + patients);
    }

    const nodes: SankeyNodeInput[] = [];
    const links: SankeyLinkInput[] = [];

    // Biggest source type first, and pinned — the left column carries no inherent
    // rank, but reshuffling it as the scrubber moves makes the diagram impossible to
    // read across months.
    [...sourceTypeTotals]
      .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
      .forEach(([id], i) => nodes.push({ id, label: id.slice(4), column: 0, order: i }));
    // Only middle nodes that actually carry flow. An always-present but empty tier
    // node would render as a 1px stub with a label and read as a rendering fault.
    for (const key of [...TIER_ORDER, DIRECT]) {
      if ((middleTotals.get(key) ?? 0) <= 0) continue;
      nodes.push({ id: `mid:${key}`, label: key, column: 1, order: MIDDLE_ORDER[key] });
    }
    const endIds =
      endColumn === 'momentum'
        ? MOMENTUM_ORDER.map((m) => `end:${m}`).filter((id) => (endTotals.get(id) ?? 0) > 0)
        : [...endTotals.keys()];
    endIds.forEach((id, i) => {
      nodes.push({ id, label: endLabels.get(id) ?? 'Practice', column: 2, order: i });
    });

    for (const [from, row] of stage1) {
      for (const [to, value] of row) links.push({ source: from, target: to, value });
    }
    for (const [from, row] of stage2) {
      for (const [to, value] of row) links.push({ source: from, target: to, value });
    }

    const layout = layoutSankey(nodes, links, {
      width: VIEW_W - MARGIN.left - MARGIN.right,
      height: VIEW_H - MARGIN.top - MARGIN.bottom,
      nodeWidth: NODE_W,
      nodePadding: 14,
    });

    const total = [...sourceTypeTotals.values()].reduce((a, b) => a + b, 0);
    return { layout, total };
  }, [offices, otherSources, clinics, windowMonths, endColumn]);

  const { layout, total } = graph;

  /** Middle node of a link, which is what gives the whole path its colour. */
  const tierOfLink = (source: string, target: string): FlowTier | typeof DIRECT | null => {
    const mid = source.startsWith('mid:') ? source.slice(4) : target.startsWith('mid:') ? target.slice(4) : null;
    if (!mid) return null;
    return mid === DIRECT ? DIRECT : (mid as FlowTier);
  };

  const fillFor = (key: FlowTier | typeof DIRECT | null, active: boolean): string => {
    if (key === DIRECT || key === null) return alpha('outreach-none', active ? 0.5 : 0.26);
    return alpha(`tier-${key.toLowerCase()}`, active ? 0.62 : 0.32);
  };

  const showTip = (e: React.MouseEvent, state: Omit<TooltipState, 'x' | 'y'>) => {
    const rect = wrapRef.current?.getBoundingClientRect();
    setTooltip({
      ...state,
      x: rect ? e.clientX - rect.left : 0,
      y: rect ? e.clientY - rect.top : 0,
    });
  };

  const pct = (v: number) => (total > 0 ? `${Math.round((v / total) * 100)}%` : '—');

  if (layout.nodes.length === 0 || total === 0) {
    return (
      <p className="py-16 text-center text-sm text-muted-foreground">
        No patients recorded in this window.
      </p>
    );
  }

  const wrapRect = wrapRef.current?.getBoundingClientRect();

  return (
    <div ref={wrapRef} className="relative" onMouseLeave={() => setTooltip(null)}>
      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        className="insights-fade h-auto w-full"
        role="img"
        aria-label={`Sankey diagram of ${total} patients flowing from source type through relationship tier to ${
          endColumn === 'momentum' ? 'current momentum' : 'your practice'
        }`}
      >
        <defs>
          {/* Direct is not a tier, so it must not wear a tier-like hue. Hatching is
              the one mark nothing else on the page uses, so it reads as a different
              kind of thing at a glance and survives greyscale printing. */}
          <pattern
            id={`${uid}-hatch`}
            width="5"
            height="5"
            patternTransform="rotate(45)"
            patternUnits="userSpaceOnUse"
          >
            {/* Light strokes over the grey node, not grey over grey — hatching in the
                same ink as the fill it sits on is invisible, which defeats the point
                of using texture as the secondary encoding. */}
            <line
              x1="0"
              y1="0"
              x2="0"
              y2="5"
              style={{ stroke: CHART_INK.surface, strokeWidth: 2 }}
            />
          </pattern>
        </defs>

        <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>
          <g>
            {layout.links.map((l) => {
              const key = tierOfLink(l.source, l.target);
              const active = hover === l.source || hover === l.target;
              const dim = hover !== null && !active;
              return (
                <path
                  key={`${l.source}->${l.target}`}
                  d={l.path}
                  fill="none"
                  style={{
                    fill: fillFor(key, active),
                    opacity: dim ? 0.18 : 1,
                    transition: 'opacity 160ms ease, fill 160ms ease',
                  }}
                  onMouseMove={(e) =>
                    showTip(e, {
                      title: `${layout.nodes.find((n) => n.id === l.source)?.label} → ${
                        layout.nodes.find((n) => n.id === l.target)?.label
                      }`,
                      rows: [
                        { label: 'Patients', value: String(l.value) },
                        { label: 'Share', value: pct(l.value) },
                      ],
                    })
                  }
                  onMouseLeave={() => setTooltip(null)}
                />
              );
            })}
          </g>

          <g>
            {layout.nodes.map((n) => {
              const key = n.column === 1 ? (n.label === DIRECT ? DIRECT : (n.label as FlowTier)) : null;
              const isDirect = key === DIRECT;
              const nodeFill =
                n.column === 1 && key && !isDirect
                  ? TIER_FILL[key as FlowTier]
                  : CHART_INK.label;

              return (
                <g key={n.id}>
                  <rect
                    x={n.x0}
                    y={n.y0}
                    width={n.x1 - n.x0}
                    height={Math.max(1, n.y1 - n.y0)}
                    rx={2}
                    style={{
                      fill: nodeFill,
                      opacity: hover === null || hover === n.id ? 1 : 0.35,
                      transition: 'opacity 160ms ease',
                      cursor: 'default',
                    }}
                    onMouseEnter={() => setHover(n.id)}
                    onMouseLeave={() => setHover(null)}
                    onMouseMove={(e) =>
                      showTip(e, {
                        title: n.label,
                        rows: [
                          { label: 'Patients', value: String(Math.round(n.value)) },
                          { label: 'Share', value: pct(n.value) },
                        ],
                      })
                    }
                  />
                  {isDirect && (
                    <rect
                      x={n.x0}
                      y={n.y0}
                      width={n.x1 - n.x0}
                      height={Math.max(1, n.y1 - n.y0)}
                      rx={2}
                      pointerEvents="none"
                      style={{ fill: `url(#${uid}-hatch)`, opacity: 0.9 }}
                    />
                  )}
                </g>
              );
            })}
          </g>

          <g pointerEvents="none">
            {layout.nodes.map((n) => {
              const mid = (n.y0 + n.y1) / 2;
              const left = n.column === 0;
              const isMiddle = n.column === 1;
              const x = left ? n.x0 - 8 : n.x1 + 8;
              const anchor = left ? 'end' : 'start';

              return (
                <g key={`${n.id}-label`}>
                  {isMiddle && (
                    // The middle column has ribbons on both sides, so the label needs
                    // its own ground or it reads through them.
                    <rect
                      x={x - 3}
                      y={mid - 8}
                      width={Math.max(28, n.label.length * 6.4 + 6)}
                      height={16}
                      rx={3}
                      style={{ fill: CHART_INK.surface, opacity: 0.86 }}
                    />
                  )}
                  <text
                    x={x}
                    y={mid}
                    textAnchor={anchor}
                    dominantBaseline="middle"
                    style={{
                      fill: CHART_INK.strongLabel,
                      fontSize: 11,
                      fontWeight: isMiddle ? 600 : 500,
                    }}
                  >
                    {n.label}
                  </text>
                  {!isMiddle && (
                    <text
                      x={x}
                      y={mid + 12}
                      textAnchor={anchor}
                      dominantBaseline="middle"
                      style={{ fill: CHART_INK.label, fontSize: 9.5 }}
                    >
                      {Math.round(n.value)}
                    </text>
                  )}
                </g>
              );
            })}
          </g>
        </g>
      </svg>

      <InsightsTooltip
        state={tooltip}
        width={wrapRect?.width ?? 0}
        height={wrapRect?.height ?? 0}
      />

      {layout.compressed && (
        <p className="mt-2 text-xs text-muted-foreground">
          Too many categories to space cleanly — bands are compressed to fit.
        </p>
      )}
      {layout.dropped > 0 && (
        <p className="mt-1 text-xs text-muted-foreground">
          {layout.dropped} flow{layout.dropped === 1 ? '' : 's'} skipped for referencing an unknown
          node.
        </p>
      )}
    </div>
  );
}
