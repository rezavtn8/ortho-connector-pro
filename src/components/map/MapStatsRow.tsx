import { Building2, MapPin, TrendingUp, Users } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { formatYearMonth } from '@/lib/database.types';

interface MapStatsRowProps {
  month: string | null;
  /** Months the headline figures cover; 1 means a single month. */
  monthCount: number;
  patientsThisMonth: number;
  activeOffices: number;
  totalOffices: number;
  /** Change vs the equivalent preceding period, or null when it does not fit. */
  deltaVsPrevious: number | null;
  hubCount: number;
}

/**
 * Window-aware headline numbers.
 *
 * These follow the scrubber *and* the window control, so the stats and the map never
 * tell different stories — a row reading "Patients in Jul 2026" above a map drawing
 * twelve months of arcs is worse than no row at all.
 */
export function MapStatsRow({
  month,
  monthCount,
  patientsThisMonth,
  activeOffices,
  totalOffices,
  deltaVsPrevious,
  hubCount,
}: MapStatsRowProps) {
  const monthLabel = month ? formatYearMonth(month) : '—';
  const periodLabel =
    monthCount > 1 ? `over ${monthCount} months to ${monthLabel}` : `in ${monthLabel}`;
  const priorLabel = monthCount > 1 ? 'prior period' : 'prior month';

  const deltaText =
    deltaVsPrevious === null
      ? `No prior ${monthCount > 1 ? 'period' : 'month'}`
      : deltaVsPrevious === 0
        ? `Flat vs ${priorLabel}`
        : `${deltaVsPrevious > 0 ? '+' : ''}${deltaVsPrevious} vs ${priorLabel}`;

  const stats = [
    {
      icon: Users,
      iconClass: 'text-primary',
      value: patientsThisMonth,
      label: `Patients ${periodLabel}`,
    },
    {
      icon: TrendingUp,
      iconClass: deltaVsPrevious && deltaVsPrevious < 0 ? 'text-destructive' : 'text-emerald-600',
      value: activeOffices,
      label: 'Offices referring',
      sub: deltaText,
    },
    {
      icon: Building2,
      iconClass: 'text-muted-foreground',
      value: totalOffices,
      label: 'Offices on map',
    },
    {
      icon: MapPin,
      iconClass: 'text-muted-foreground',
      value: hubCount,
      label: hubCount === 1 ? 'Your location' : 'Your locations',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      {stats.map((stat) => (
        <Card key={stat.label} className="p-3 sm:p-4">
          <div className="flex items-start gap-2.5">
            <stat.icon className={`h-4 w-4 sm:h-5 sm:w-5 mt-0.5 shrink-0 ${stat.iconClass}`} />
            <div className="min-w-0">
              <p className="text-lg sm:text-2xl font-bold tabular-nums leading-tight">
                {stat.value}
              </p>
              <p className="text-xs sm:text-sm text-muted-foreground leading-tight">{stat.label}</p>
              {stat.sub && (
                <p className="text-[11px] text-muted-foreground mt-0.5 leading-tight">{stat.sub}</p>
              )}
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
