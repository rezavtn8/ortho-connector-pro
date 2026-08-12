/**
 * What changed in the referral network, as a column of signals.
 *
 * This replaces the empty text box the assistant used to open with. An empty box asks
 * the user to already know what to ask, which for most people on most days means they
 * ask nothing and the feature goes unused. The briefing inverts that: the work is
 * already done, and the question is one click away.
 *
 * Signals are ordered by patients per month at stake, and each says why it is where it
 * is. Clicking one sends its question to the assistant rather than opening a separate
 * view — the rail and the conversation are one surface, which is the whole reason this
 * page no longer has tabs.
 *
 * The numbers come from `buildBriefing`, which is arithmetic. Nothing on this rail was
 * written by a model.
 */

import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarClock,
  CircleDashed,
  MessageSquareQuote,
  Sparkles,
  TrendingDown,
  type LucideIcon,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { Briefing, Signal, SignalKind, SignalTone } from '@/lib/briefing';

const ICONS: Record<SignalKind, LucideIcon> = {
  quiet: CircleDashed,
  slipping: TrendingDown,
  rising: ArrowUpRight,
  new: Sparkles,
  visit_overdue: CalendarClock,
  reviews_unanswered: MessageSquareQuote,
  no_entries: ArrowDownRight,
};

/**
 * Tone maps onto the app's existing status vocabulary rather than inventing colours.
 * `risk` reuses the destructive token, `good` the success token — the same pairs the
 * Offices table and the map already use, so a red row means the same thing here.
 */
const TONE: Record<SignalTone, { icon: string; ring: string }> = {
  risk: {
    icon: 'text-destructive',
    ring: 'bg-destructive/10 group-hover:bg-destructive/15',
  },
  watch: {
    icon: 'text-amber-600 dark:text-amber-500',
    ring: 'bg-amber-500/10 group-hover:bg-amber-500/15',
  },
  good: {
    icon: 'text-emerald-600 dark:text-emerald-500',
    ring: 'bg-emerald-500/10 group-hover:bg-emerald-500/15',
  },
  todo: {
    icon: 'text-muted-foreground',
    ring: 'bg-muted group-hover:bg-muted/80',
  },
};

export function BriefingRail({
  briefing,
  loading,
  onAsk,
  disabled,
}: {
  briefing: Briefing | null;
  loading: boolean;
  onAsk: (question: string) => void;
  disabled: boolean;
}) {
  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-4 w-32" />
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-lg border border-border/50 p-3">
            <Skeleton className="mb-2 h-4 w-full" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        ))}
      </div>
    );
  }

  const signals = briefing?.signals ?? [];

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-foreground">What changed</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {signals.length > 0
            ? 'Ordered by patients per month at stake'
            : 'Read from your referral history'}
        </p>
      </div>

      {briefing && briefing.totals.atRisk > 0 && (
        <div className="rounded-lg border border-destructive/25 bg-destructive/5 px-3 py-2.5">
          <p className="text-lg font-semibold leading-none text-foreground">
            {briefing.totals.atRisk}
            <span className="ml-1 text-xs font-normal text-muted-foreground">
              patients/month at risk
            </span>
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Across every declining relationship below
          </p>
        </div>
      )}

      {signals.length === 0 ? (
        <div className="rounded-lg border border-border/50 bg-muted/20 p-4">
          <p className="text-sm font-medium text-foreground">Nothing needs your attention</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            No relationship is declining enough to flag, visits are current, and reviews are
            answered. Ask a question below if you want to dig into something anyway.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {signals.map((signal) => (
            <SignalCard key={signal.id} signal={signal} onAsk={onAsk} disabled={disabled} />
          ))}
        </ul>
      )}
    </div>
  );
}

function SignalCard({
  signal,
  onAsk,
  disabled,
}: {
  signal: Signal;
  onAsk: (question: string) => void;
  disabled: boolean;
}) {
  const Icon = ICONS[signal.kind];
  const tone = TONE[signal.tone];

  return (
    <li>
      <div
        className={cn(
          'group rounded-lg border border-border/50 bg-card transition-colors',
          'hover:border-primary/30',
        )}
      >
        {/* The card body is the "ask" action. The office link is a separate control
            rather than the whole card, so the common case (find out more) does not
            require aiming at a small target. */}
        <button
          type="button"
          onClick={() => onAsk(signal.ask)}
          disabled={disabled}
          className="flex w-full items-start gap-2.5 rounded-lg p-3 text-left disabled:cursor-not-allowed disabled:opacity-60"
        >
          <span className={cn('mt-0.5 shrink-0 rounded-md p-1.5 transition-colors', tone.ring)}>
            <Icon className={cn('h-3.5 w-3.5', tone.icon)} aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium leading-snug text-foreground">
              {signal.headline}
            </span>
            <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
              {signal.detail}
            </span>
          </span>
        </button>

        <div className="flex items-center gap-1 border-t border-border/40 px-3 py-1.5">
          <button
            type="button"
            onClick={() => onAsk(signal.ask)}
            disabled={disabled}
            className="rounded px-1.5 py-0.5 text-xs font-medium text-primary transition-colors hover:bg-primary/10 disabled:opacity-60"
          >
            Ask about this
          </button>
          {signal.href && (
            <>
              <span className="text-border" aria-hidden>
                ·
              </span>
              <Link
                to={signal.href}
                className="rounded px-1.5 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                {signal.officeName ? 'Open office' : 'Open'}
              </Link>
            </>
          )}
        </div>
      </div>
    </li>
  );
}
