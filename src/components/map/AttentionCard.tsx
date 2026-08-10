import { useState } from 'react';
import { AlertTriangle, ArrowDownRight, CircleSlash, ShieldCheck, TrendingUp } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { MOMENTUM_WINDOW } from '@/lib/officeMetrics';
import { cn } from '@/lib/utils';
import type { AttentionItem, AttentionSummary } from './attention';

interface AttentionCardProps {
  summary: AttentionSummary;
  monthLabel: string;
  onFocusOffice: (id: string | null) => void;
  onSelectOffice: (id: string) => void;
}

/** Enough to act on this week. The rest are a click away. */
const COLLAPSED_COUNT = 4;

/** Per-month rate, which is how the owner thinks about a referring office. */
const perMonth = (total: number) => (total / MOMENTUM_WINDOW).toFixed(1);

function AttentionRow({
  item,
  onFocusOffice,
  onSelectOffice,
}: {
  item: AttentionItem;
  onFocusOffice: (id: string | null) => void;
  onSelectOffice: (id: string) => void;
}) {
  const stopped = item.momentum === 'quiet';
  const Icon = stopped ? CircleSlash : ArrowDownRight;

  return (
    <button
      type="button"
      onMouseEnter={() => onFocusOffice(item.office.id)}
      onMouseLeave={() => onFocusOffice(null)}
      onFocus={() => onFocusOffice(item.office.id)}
      onBlur={() => onFocusOffice(null)}
      onClick={() => onSelectOffice(item.office.id)}
      className="w-full text-left rounded-md px-2 py-1.5 hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none transition-colors"
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-medium truncate">{item.office.name}</span>
        <span
          className={cn(
            'text-xs font-semibold tabular-nums shrink-0',
            stopped ? 'text-destructive' : 'text-amber-500',
          )}
        >
          −{item.perMonthDelta.toFixed(1)}/mo
        </span>
      </div>
      <p className="text-[10px] text-muted-foreground flex items-center gap-1 leading-tight">
        <Icon className="h-3 w-3 shrink-0" />
        {stopped ? (
          <>Stopped — was {perMonth(item.baseline)}/mo</>
        ) : (
          <>
            {perMonth(item.baseline)} → {perMonth(item.recent)} per month
          </>
        )}
        <span className="text-muted-foreground/60">· {item.office.tier}</span>
      </p>
    </button>
  );
}

/**
 * The map's to-do list: which referral relationships are worth a call this week.
 *
 * This is the half of the product's promise the map could not previously keep. Arcs
 * and tiers say where patients come from; only this says what is *changing*, which
 * is the part that costs a quarter if nobody notices. Everything here is measured at
 * the month the scrubber is parked on, so dragging back through history shows what
 * was going wrong then rather than re-reporting today.
 */
export function AttentionCard({
  summary,
  monthLabel,
  onFocusOffice,
  onSelectOffice,
}: AttentionCardProps) {
  const [expanded, setExpanded] = useState(false);

  const { items, patientsPerMonthAtRisk, risingCount } = summary;
  const shown = expanded ? items : items.slice(0, COLLAPSED_COUNT);
  const hidden = items.length - shown.length;

  return (
    <Card className="p-3 sm:p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold flex items-center gap-2 text-sm">
          <AlertTriangle className={cn('h-4 w-4', items.length > 0 && 'text-amber-500')} />
          Needs attention
        </h3>
        {items.length > 0 && (
          <span className="text-xs font-semibold tabular-nums text-amber-500">
            −{patientsPerMonthAtRisk.toFixed(1)}/mo
          </span>
        )}
      </div>

      {items.length === 0 ? (
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
            Nothing slipping as of {monthLabel}.
          </p>
          {risingCount > 0 && (
            <p className="text-[10px] text-muted-foreground pl-5">
              {risingCount} office{risingCount === 1 ? '' : 's'} referring more than usual.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-[10px] text-muted-foreground leading-tight">
            Against each office's own last {MOMENTUM_WINDOW} months, as of {monthLabel}.
          </p>

          <div className="space-y-0.5">
            {shown.map((item) => (
              <AttentionRow
                key={item.office.id}
                item={item}
                onFocusOffice={onFocusOffice}
                onSelectOffice={onSelectOffice}
              />
            ))}
          </div>

          {(hidden > 0 || expanded) && (
            <button
              type="button"
              onClick={() => setExpanded((value) => !value)}
              className="text-[11px] text-muted-foreground hover:text-foreground transition-colors px-2"
            >
              {expanded ? 'Show less' : `Show ${hidden} more`}
            </button>
          )}

          {risingCount > 0 && (
            <p className="text-[10px] text-muted-foreground flex items-center gap-1 pt-1 border-t">
              <TrendingUp className="h-3 w-3 text-emerald-500" />
              {risingCount} other{risingCount === 1 ? '' : 's'} referring more than usual.
            </p>
          )}
        </div>
      )}
    </Card>
  );
}
