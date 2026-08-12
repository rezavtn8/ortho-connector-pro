/**
 * What changed since you last looked.
 *
 * This is the half that makes the page a watch rather than a dashboard: the
 * numbers elsewhere tell you where things stand, these tell you what moved.
 * Severity is carried by an icon and a label as well as colour, so the ranking
 * survives a colourblind reader and a greyscale print.
 */

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Activity, ArrowUpRight, Radio, Star, TrendingDown, TrendingUp } from 'lucide-react';
import type { Movement, MovementKind } from '@/lib/competitorIntel';

const ICONS: Record<MovementKind, React.ComponentType<{ className?: string }>> = {
  'review-surge': TrendingUp,
  'rating-drop': TrendingDown,
  'rating-gain': Star,
  overtaken: ArrowUpRight,
  overtook: ArrowUpRight,
  stalled: Activity,
};

const TONE = {
  high: {
    dot: 'bg-red-500',
    text: 'text-red-700 dark:text-red-400',
    ring: 'border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-950/30',
    label: 'Act now',
  },
  medium: {
    dot: 'bg-amber-500',
    text: 'text-amber-700 dark:text-amber-400',
    ring: 'border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/30',
    label: 'Watch',
  },
  low: {
    dot: 'bg-muted-foreground',
    text: 'text-muted-foreground',
    ring: 'border-border/50 bg-muted/30',
    label: 'Note',
  },
} as const;

interface Props {
  movements: Movement[];
  historyDays: number;
}

export function MovementFeed({ movements, historyDays }: Props) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Radio className="h-4 w-4 text-primary" />
          Movement
        </CardTitle>
        <CardDescription>Changes across your watchlist over the last 30 days</CardDescription>
      </CardHeader>
      <CardContent>
        {movements.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border py-8 text-center">
            <p className="text-sm font-medium">
              {historyDays < 2 ? 'Nothing to compare against yet' : 'Nothing has moved'}
            </p>
            <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">
              {historyDays < 2
                ? 'Movement is measured between snapshots. Once there are two days of history, changes show up here.'
                : 'No competitor has had a meaningful shift in rating or review pace since the last snapshot.'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {movements.map((movement, i) => {
              const tone = TONE[movement.severity];
              const Icon = ICONS[movement.kind];
              return (
                <div
                  key={`${movement.competitorId}-${movement.kind}-${i}`}
                  className={`flex gap-3 rounded-xl border p-3 ${tone.ring}`}
                >
                  <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${tone.text}`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <p className="text-sm font-medium leading-snug">{movement.headline}</p>
                      <span
                        className={`flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide ${tone.text}`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
                        {tone.label}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">{movement.detail}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
