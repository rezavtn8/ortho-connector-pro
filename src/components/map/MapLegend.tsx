import { Building2, Compass, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { MOMENTUM_WINDOW } from '@/lib/officeMetrics';
import { cn } from '@/lib/utils';
import { DIRECTION_COLORS, normalize, widthFor } from './flowScales';
import { TIER_ORDER, type FlowTier } from './types';

const TIER_DESCRIPTIONS: Record<FlowTier, string> = {
  VIP: 'Top 25% by volume',
  Warm: 'Next 25%',
  Cold: 'Bottom 50%',
  Dormant: 'No referrals in 6+ months',
};

const TIER_VARS: Record<FlowTier, string> = {
  VIP: 'var(--tier-vip)',
  Warm: 'var(--tier-warm)',
  Cold: 'var(--tier-cold)',
  Dormant: 'var(--tier-dormant)',
};

const DISCOVERED_LEGEND = [
  { color: '#10b981', label: 'Excellent', description: '4.5+ stars' },
  { color: '#f97316', label: 'Good', description: '4.0 – 4.4' },
  { color: '#eab308', label: 'Average', description: '3.5 – 3.9' },
  { color: '#9ca3af', label: 'Low', description: 'Below 3.5' },
];

interface MapLegendProps {
  tierCounts: Record<FlowTier, number>;
  tierPatients: Record<FlowTier, number>;
  maxFlowCount: number;
  activeTier: FlowTier | null;
  onTierHover: (tier: FlowTier | null) => void;
  showDiscovered: boolean;
  discoveredCounts: Record<string, number>;
  animatedFlows: number;
  totalFlows: number;
  reducedMotion: boolean;
  /** Set when the map is showing month-on-month change rather than a month's flows. */
  compare: { monthLabel: string; gained: number; lost: number } | null;
}

export function MapLegend({
  tierCounts,
  tierPatients,
  maxFlowCount,
  activeTier,
  onTierHover,
  showDiscovered,
  discoveredCounts,
  animatedFlows,
  totalFlows,
  reducedMotion,
  compare,
}: MapLegendProps) {
  // Three sample widths labelled with real patient counts. Without this the
  // thickness encoding is undecodable.
  const widthSamples = [1, Math.max(2, Math.round(maxFlowCount / 4)), maxFlowCount]
    .filter((v, i, a) => a.indexOf(v) === i)
    .map((count) => ({ count, width: widthFor(normalize(count, maxFlowCount)) }));

  return (
    <div className="space-y-4">
      <Card className="p-3 sm:p-4">
        <h3 className="font-semibold mb-3 flex items-center gap-2 text-sm">
          <Building2 className="h-4 w-4" />
          Referring offices
        </h3>

        <div className="space-y-1">
          {TIER_ORDER.map((tier) => (
            <button
              key={tier}
              type="button"
              onMouseEnter={() => onTierHover(tier)}
              onMouseLeave={() => onTierHover(null)}
              className={cn(
                'w-full flex items-center justify-between rounded-md px-2 py-1.5 text-left transition-colors',
                activeTier === tier ? 'bg-muted' : 'hover:bg-muted/60',
              )}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span
                  className="h-3.5 w-3.5 rounded-full border-2 border-white shadow-sm shrink-0"
                  style={{ backgroundColor: `hsl(${TIER_VARS[tier]})` }}
                />
                <div className="min-w-0">
                  <p className="text-xs font-medium leading-tight">{tier}</p>
                  <p className="text-[11px] text-muted-foreground leading-tight truncate">
                    {TIER_DESCRIPTIONS[tier]}
                  </p>
                </div>
              </div>
              <div className="text-right shrink-0 ml-2">
                <p className="text-xs font-semibold tabular-nums">{tierCounts[tier]}</p>
                <p className="text-[11px] text-muted-foreground tabular-nums">
                  {tierPatients[tier]} pt
                </p>
              </div>
            </button>
          ))}
        </div>

        {/* The ring is a second, independent encoding on the same dot: the fill says
            what an office is worth, the ring says where it is heading. */}
        <div className="mt-3 pt-2.5 border-t space-y-1.5">
          <p className="text-[11px] font-medium">Rings show direction</p>
          {[
            { color: DIRECTION_COLORS.gaining, width: 2, label: 'Referring more than usual' },
            { color: DIRECTION_COLORS.losing, width: 2, label: 'Slipping against its own norm' },
            { color: DIRECTION_COLORS.losing, width: 3, label: 'Stopped referring' },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-2.5">
              <span
                className="h-3.5 w-3.5 rounded-full shrink-0"
                style={{ border: `${item.width}px solid ${item.color}` }}
              />
              <span className="text-[11px] text-muted-foreground leading-tight">{item.label}</span>
            </div>
          ))}
          <p className="text-[11px] text-muted-foreground pt-1">
            Measured against each office's own last {MOMENTUM_WINDOW} months, so a big
            referrer easing off registers even while it stays near the top.
          </p>
        </div>
      </Card>

      {compare ? (
        <Card className="p-3 sm:p-4">
          <h3 className="font-semibold mb-3 flex items-center gap-2 text-sm">
            <Sparkles className="h-4 w-4" />
            Change vs {compare.monthLabel}
          </h3>

          <div className="space-y-2.5">
            {[
              { color: DIRECTION_COLORS.gaining, label: 'More than before', value: compare.gained },
              { color: DIRECTION_COLORS.losing, label: 'Fewer than before', value: compare.lost },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className="rounded-full shrink-0"
                    style={{ width: 40, height: 4, backgroundColor: item.color }}
                  />
                  <span className="text-xs text-muted-foreground truncate">{item.label}</span>
                </div>
                <span className="text-xs font-semibold tabular-nums" style={{ color: item.color }}>
                  {item.value} pt
                </span>
              </div>
            ))}
          </div>

          <p className="text-[11px] text-muted-foreground mt-3 pt-2.5 border-t leading-relaxed">
            Thickness is the size of the change. Motion is off here — the dots stand for
            patients arriving, and a difference between two months has none.
          </p>
        </Card>
      ) : (
        <Card className="p-3 sm:p-4">
          <h3 className="font-semibold mb-3 flex items-center gap-2 text-sm">
            <Sparkles className="h-4 w-4" />
            Flow weight
          </h3>

          <div className="space-y-2.5">
            {widthSamples.map(({ count, width }) => (
              <div key={count} className="flex items-center gap-3">
                <span
                  className="rounded-full bg-foreground/70 shrink-0"
                  style={{ width: 40, height: Math.max(2, width) }}
                />
                <span className="text-xs text-muted-foreground tabular-nums">
                  {count} patient{count === 1 ? '' : 's'}/mo
                </span>
              </div>
            ))}
          </div>

          <p className="text-[11px] text-muted-foreground mt-3 pt-2.5 border-t leading-relaxed">
            {reducedMotion
              ? 'Motion is off (reduced-motion preference). Dot density still shows volume.'
              : 'Dots travel from each office toward your practice. Faster, denser flow means more patients.'}
          </p>

          {animatedFlows < totalFlows && (
            <p className="text-[11px] text-muted-foreground mt-2">
              Showing motion for the {animatedFlows} busiest of {totalFlows} flows; the rest still
              show their arc.
            </p>
          )}
        </Card>
      )}

      {showDiscovered && (
        <Card className="p-3 sm:p-4 border-teal-200 dark:border-teal-800">
          <h3 className="font-semibold mb-3 flex items-center gap-2 text-sm">
            <Compass className="h-4 w-4 text-teal-600" />
            Discovered offices
          </h3>

          <div className="space-y-2">
            {DISCOVERED_LEGEND.map((item) => (
              <div key={item.label} className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span
                    className="h-3.5 w-3.5 rounded-full shrink-0"
                    style={{
                      backgroundColor: `${item.color}40`,
                      border: `2px dashed ${item.color}`,
                    }}
                  />
                  <div>
                    <p className="text-xs font-medium leading-tight">{item.label}</p>
                    <p className="text-[11px] text-muted-foreground leading-tight">
                      {item.description}
                    </p>
                  </div>
                </div>
                <Badge variant="secondary" className="text-xs">
                  {discoveredCounts[item.label] ?? 0}
                </Badge>
              </div>
            ))}
          </div>

          <p className="text-[11px] text-muted-foreground mt-3 pt-2.5 border-t">
            Dashed rings are prospects not yet in your network.
          </p>
        </Card>
      )}
    </div>
  );
}
