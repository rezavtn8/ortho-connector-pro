import { Radar, Target } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import type { ReachStats } from './reachStats';

interface ReachCardProps {
  stats: ReachStats;
  showRings: boolean;
  onShowRingsChange: (value: boolean) => void;
  onFocusOffice: (id: string | null) => void;
  onSelectOffice: (id: string) => void;
}

/** Territory summary — where the practice's patients actually come from. */
export function ReachCard({
  stats,
  showRings,
  onShowRingsChange,
  onFocusOffice,
  onSelectOffice,
}: ReachCardProps) {
  const pct = Math.round(stats.shareWithinCore * 100);

  return (
    <Card className="p-3 sm:p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold flex items-center gap-2 text-sm">
          <Radar className="h-4 w-4" />
          Reach
        </h3>
        <div className="flex items-center gap-1.5">
          <Switch
            id="show-rings"
            checked={showRings}
            onCheckedChange={onShowRingsChange}
            className="scale-90"
          />
          <Label htmlFor="show-rings" className="text-[11px] text-muted-foreground cursor-pointer">
            Rings
          </Label>
        </div>
      </div>

      {stats.totalPatients === 0 ? (
        <p className="text-xs text-muted-foreground">No referrals in this month.</p>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-md bg-muted/50 px-2 py-1.5">
              <p className="text-base font-semibold tabular-nums leading-tight">
                {stats.medianMiles?.toFixed(1) ?? '—'}
                <span className="text-[11px] font-normal text-muted-foreground ml-0.5">mi</span>
              </p>
              <p className="text-[10px] text-muted-foreground leading-tight">
                Half of patients within
              </p>
            </div>
            <div className="rounded-md bg-muted/50 px-2 py-1.5">
              <p className="text-base font-semibold tabular-nums leading-tight">
                {stats.p90Miles?.toFixed(1) ?? '—'}
                <span className="text-[11px] font-normal text-muted-foreground ml-0.5">mi</span>
              </p>
              <p className="text-[10px] text-muted-foreground leading-tight">
                90% of patients within
              </p>
            </div>
          </div>

          <div>
            <div className="flex items-baseline justify-between mb-1">
              <span className="text-[11px] text-muted-foreground">
                Within {stats.coreRadius} mi
              </span>
              <span className="text-xs font-semibold tabular-nums">{pct}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>

          {stats.farthest && (
            <button
              type="button"
              onMouseEnter={() => onFocusOffice(stats.farthest!.office.id)}
              onMouseLeave={() => onFocusOffice(null)}
              onClick={() => onSelectOffice(stats.farthest!.office.id)}
              className="w-full text-left rounded-md px-2 py-1.5 hover:bg-muted/60 transition-colors"
            >
              <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Target className="h-3 w-3" />
                Farthest referrer
              </p>
              <p className="text-xs font-medium truncate">{stats.farthest.office.name}</p>
              <p className="text-[11px] text-muted-foreground tabular-nums">
                {stats.farthest.miles.toFixed(1)} mi · {stats.farthest.count} patient
                {stats.farthest.count === 1 ? '' : 's'}
              </p>
            </button>
          )}
        </div>
      )}
    </Card>
  );
}
