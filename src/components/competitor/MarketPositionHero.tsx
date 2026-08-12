/**
 * Where the practice stands: its own listing, its rank, and how fresh the
 * numbers are.
 *
 * These are headline figures rather than a chart — four values with no shape
 * worth plotting. The staleness line matters as much as the numbers: a rank
 * computed from a three-week-old snapshot is not wrong so much as unfounded,
 * and the page should say which it is.
 */

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Crown, MapPin, RefreshCw, Star, Target, TrendingUp, Zap } from 'lucide-react';
import type { MarketPosition } from '@/lib/competitorIntel';
import type { ClinicRow } from '@/hooks/useCompetitorIntel';

interface Props {
  clinic: ClinicRow | null;
  position: MarketPosition | null;
  rating: number | null;
  reviews: number;
  velocity: number | null;
  lastRefreshed: string | null;
  onRefresh: () => void;
  isRefreshing: boolean;
}

export function MarketPositionHero({
  clinic,
  position,
  rating,
  reviews,
  velocity,
  lastRefreshed,
  onRefresh,
  isRefreshing,
}: Props) {
  const staleness = describeStaleness(lastRefreshed);

  return (
    <Card variant="glass" className="relative overflow-hidden border-primary/20">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/8 via-transparent to-primary/4" />

      <CardHeader className="relative pb-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="mb-1 flex items-center gap-2">
              <Badge className="gap-1.5 border-primary/25 bg-primary/15 px-2.5 py-0.5 text-primary backdrop-blur-sm">
                <Crown className="h-3.5 w-3.5" />
                Your practice
              </Badge>
            </div>
            <CardTitle className="truncate text-2xl font-bold tracking-tight">
              {clinic?.name || 'Your practice'}
            </CardTitle>
            <CardDescription className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">
                {clinic?.address || 'Set your practice address in Settings'}
              </span>
            </CardDescription>
          </div>

          <div className="flex flex-col items-end gap-1.5">
            <Button
              size="sm"
              variant="outline"
              onClick={onRefresh}
              disabled={isRefreshing}
              className="gap-1.5"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <p className={`text-[11px] ${staleness.stale ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'}`}>
              {staleness.label}
            </p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="relative">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Metric
            value={rating != null ? rating.toFixed(1) : '—'}
            label="Google rating"
            icon={<Star className="h-4 w-4 fill-amber-400 text-amber-400" />}
            highlight
          />
          <Metric
            value={reviews > 0 ? reviews.toLocaleString() : '—'}
            label="Total reviews"
            icon={<Zap className="h-4 w-4 text-primary" />}
          />
          <Metric
            value={position ? `#${position.ratingRank}` : '—'}
            sublabel={position ? `of ${position.total}` : undefined}
            label="Rating rank"
            icon={<Target className="h-4 w-4 text-primary" />}
          />
          <Metric
            value={velocity != null ? velocity.toFixed(1) : '—'}
            sublabel={velocity != null ? '/wk' : undefined}
            label="Your review pace"
            icon={<TrendingUp className="h-4 w-4 text-primary" />}
          />
        </div>

        {position && (
          <div className="mt-4 rounded-xl border border-border/50 bg-background/70 p-4 backdrop-blur-sm">
            <p className="text-sm leading-relaxed">
              <span className="font-semibold">Against the field: </span>
              <Comparison
                good={position.myRating != null && position.myRating >= position.avgRating}
                goodText={`rating ${position.myRating?.toFixed(1)} is above the ${position.avgRating.toFixed(1)} average`}
                badText={`rating ${position.myRating?.toFixed(1) ?? '—'} is below the ${position.avgRating.toFixed(1)} average`}
              />
              {' · '}
              <Comparison
                good={position.myReviews >= position.avgReviews}
                goodText={`${position.myReviews.toLocaleString()} reviews beats the ${position.avgReviews.toLocaleString()} average`}
                badText={`${position.myReviews.toLocaleString()} reviews trails the ${position.avgReviews.toLocaleString()} average`}
              />
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Comparison({
  good,
  goodText,
  badText,
}: {
  good: boolean;
  goodText: string;
  badText: string;
}) {
  return good ? (
    <span className="text-emerald-600 dark:text-emerald-400">{goodText}</span>
  ) : (
    <span className="text-amber-600 dark:text-amber-400">{badText}</span>
  );
}

function Metric({
  value,
  sublabel,
  label,
  icon,
  highlight,
}: {
  value: string;
  sublabel?: string;
  label: string;
  icon: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-4 text-center transition-all ${
        highlight ? 'border-primary/20 bg-primary/5 shadow-sm' : 'border-border/50 bg-background/60'
      }`}
    >
      <div className="mb-1 flex items-center justify-center gap-1.5">
        {icon}
        <span className="text-2xl font-bold tabular-nums">{value}</span>
        {sublabel && <span className="mb-0.5 self-end text-xs text-muted-foreground">{sublabel}</span>}
      </div>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

/**
 * How old the newest snapshot is.
 *
 * Anything past a week is flagged, because ranks and movement are both drawn
 * from these rows and a stale set quietly stops reflecting the market.
 */
function describeStaleness(lastRefreshed: string | null): { label: string; stale: boolean } {
  if (!lastRefreshed) return { label: 'Never refreshed', stale: true };

  const days = Math.round(
    (Date.now() - Date.parse(`${lastRefreshed}T00:00:00Z`)) / 86_400_000,
  );
  if (days <= 0) return { label: 'Updated today', stale: false };
  if (days === 1) return { label: 'Updated yesterday', stale: false };
  return { label: `Updated ${days} days ago`, stale: days > 7 };
}
