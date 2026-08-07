import { Link } from 'react-router-dom';
import { Area, AreaChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis } from 'recharts';
import { ArrowUpRight, ExternalLink, Phone, Star, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatYearMonth } from '@/lib/database.types';
import { sanitizeURL } from '@/lib/sanitize';
import { calculateDistance } from '@/utils/distanceCalculation';
import type { FlowTier, Hub, MapOffice } from './types';

const TIER_BADGE: Record<FlowTier, string> = {
  VIP: 'bg-[hsl(var(--tier-vip))] text-white border-transparent',
  Warm: 'bg-[hsl(var(--tier-warm))] text-white border-transparent',
  Cold: 'bg-[hsl(var(--tier-cold))] text-white border-transparent',
  Dormant: 'bg-muted text-muted-foreground border-transparent',
};

interface OfficeDetailPanelProps {
  office: MapOffice;
  hubs: Hub[];
  months: string[];
  activeMonth: string | null;
  onClose: () => void;
}

/**
 * Detail card for a selected office.
 *
 * Everything renders through React rather than a Mapbox `setHTML` popup. The old
 * popups interpolated raw database values straight into markup — including
 * `office.website` into an `href` — which was a stored-XSS surface. React escapes
 * text by construction, and the outbound link goes through `sanitizeURL`.
 */
export function OfficeDetailPanel({
  office,
  hubs,
  months,
  activeMonth,
  onClose,
}: OfficeDetailPanelProps) {
  const series = months.map((month) => ({
    month,
    label: formatYearMonth(month),
    patients: office.monthly[month] ?? 0,
  }));

  const activeCount = activeMonth ? (office.monthly[activeMonth] ?? 0) : 0;
  const activeLabel = activeMonth ? formatYearMonth(activeMonth) : null;

  // Distance to the nearest of the practice's locations.
  const distance = hubs.length
    ? Math.min(
        ...hubs.map((hub) =>
          calculateDistance(hub.latitude, hub.longitude, office.latitude, office.longitude),
        ),
      )
    : null;

  const safeWebsite = office.website ? sanitizeURL(office.website) : '';

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-semibold text-sm leading-tight truncate">{office.name}</h3>
          {office.address && (
            <p className="text-xs text-muted-foreground leading-tight mt-0.5 line-clamp-2">
              {office.address}
            </p>
          )}
        </div>
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7 shrink-0 -mt-1 -mr-1"
          onClick={onClose}
          aria-label="Close details"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <Badge className={TIER_BADGE[office.tier]}>{office.tier}</Badge>
        {office.percentile !== null && (
          <span className="text-xs text-muted-foreground">Top {101 - office.percentile}%</span>
        )}
        {distance !== null && (
          <span className="text-xs text-muted-foreground">{distance.toFixed(1)} mi away</span>
        )}
        {office.google_rating != null && (
          <span className="text-xs text-muted-foreground flex items-center gap-0.5">
            <Star className="h-3 w-3 fill-current" />
            {office.google_rating}
          </span>
        )}
      </div>

      <div className="grid grid-cols-4 gap-2 text-center">
        {[
          { label: activeLabel ?? 'Month', value: activeCount },
          { label: 'L12', value: office.l12 },
          { label: 'R3', value: office.r3 },
          { label: 'MSLR', value: office.mslr >= 999 ? '—' : office.mslr },
        ].map((stat) => (
          <div key={stat.label} className="rounded-md bg-muted/50 py-1.5">
            <p className="text-sm font-semibold tabular-nums leading-tight">{stat.value}</p>
            <p className="text-[10px] text-muted-foreground leading-tight truncate px-0.5">
              {stat.label}
            </p>
          </div>
        ))}
      </div>

      <div className="h-24 -mx-1">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={series} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
            <defs>
              <linearGradient id="officeSparkline" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.45} />
                <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <XAxis dataKey="label" hide />
            <Tooltip
              cursor={{ stroke: 'hsl(var(--muted-foreground))', strokeWidth: 1 }}
              contentStyle={{
                background: 'hsl(var(--popover))',
                border: '1px solid hsl(var(--border))',
                borderRadius: 6,
                fontSize: 12,
                padding: '4px 8px',
              }}
              labelStyle={{ fontSize: 11, color: 'hsl(var(--muted-foreground))' }}
              formatter={(value: number) => [`${value} patients`, '']}
            />
            {activeLabel && (
              <ReferenceLine
                x={activeLabel}
                stroke="hsl(var(--primary))"
                strokeDasharray="3 3"
                strokeWidth={1.5}
              />
            )}
            <Area
              type="monotone"
              dataKey="patients"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              fill="url(#officeSparkline)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {office.phone && (
          <Button size="sm" variant="outline" className="h-8 text-xs" asChild>
            <a href={`tel:${office.phone}`}>
              <Phone className="h-3 w-3 mr-1" />
              Call
            </a>
          </Button>
        )}
        {safeWebsite && (
          <Button size="sm" variant="outline" className="h-8 text-xs" asChild>
            <a href={safeWebsite} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-3 w-3 mr-1" />
              Website
            </a>
          </Button>
        )}
        <Button size="sm" className="h-8 text-xs ml-auto" asChild>
          <Link to={`/sources/${office.id}`}>
            Details
            <ArrowUpRight className="h-3 w-3 ml-1" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
