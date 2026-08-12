/**
 * The watchlist itself, ordered by threat rather than by rating.
 *
 * Ordering by rating answered "who is best"; ordering by threat answers "who
 * should I be worried about", which is the question the page exists for. A
 * beautifully rated practice on the far side of town outranks nobody's
 * referrals and sinks to the bottom accordingly.
 */

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { ArrowDown, ArrowUp, Clock, MapPin, Minus, Star, Trash2, Users } from 'lucide-react';
import type { CompetitorRow } from '@/hooks/useCompetitorIntel';

interface Props {
  competitors: CompetitorRow[];
  myRating: number | null;
  onRemove: (id: string) => void;
  isRemoving: boolean;
}

export function CompetitorList({ competitors, myRating, onRemove, isRemoving }: Props) {
  if (competitors.length === 0) {
    return (
      <Card className="border-2 border-dashed">
        <CardContent className="py-16 text-center">
          <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
            <Users className="h-8 w-8 text-primary/60" />
          </div>
          <h3 className="mb-1 text-lg font-semibold">No competitors tracked yet</h3>
          <p className="mx-auto max-w-sm text-sm text-muted-foreground">
            Add practices from the suggestions below. Once two are tracked, exposure and movement
            start working.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {competitors.map((competitor) => (
        <CompetitorCard
          key={competitor.id}
          competitor={competitor}
          myRating={myRating}
          onRemove={() => onRemove(competitor.id)}
          isRemoving={isRemoving}
        />
      ))}
    </div>
  );
}

function CompetitorCard({
  competitor,
  myRating,
  onRemove,
  isRemoving,
}: {
  competitor: CompetitorRow;
  myRating: number | null;
  onRemove: () => void;
  isRemoving: boolean;
}) {
  const ratingGap =
    myRating != null && competitor.rating != null ? competitor.rating - myRating : null;

  return (
    <Card className="group border-border/60 transition-all hover:border-border hover:shadow-md">
      <CardContent className="pb-4 pt-5">
        <div className="mb-3 flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{competitor.name}</p>
            <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
              <MapPin className="h-3 w-3 shrink-0" />
              {competitor.address || 'No address on file'}
            </p>
          </div>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                size="sm"
                variant="ghost"
                disabled={isRemoving}
                className="h-7 w-7 p-0 text-muted-foreground/50 opacity-0 transition-opacity hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100"
                aria-label={`Stop watching ${competitor.name}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Stop watching {competitor.name}?</AlertDialogTitle>
                <AlertDialogDescription>
                  This deletes their snapshot history too, so the trend lines they appear in start
                  again from scratch if you re-add them.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Keep watching</AlertDialogCancel>
                <AlertDialogAction onClick={onRemove}>Remove</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        {competitor.contestedPatients > 0 && (
          <div className="mb-3 flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-2.5 py-1.5">
            <Users className="h-3.5 w-3.5 shrink-0 text-primary" />
            <span className="text-xs">
              <strong className="tabular-nums">{competitor.contestedPatients}</strong> patients
              contested
            </span>
            <Badge variant="outline" className="ml-auto shrink-0 text-[10px] tabular-nums">
              threat {competitor.threat}
            </Badge>
          </div>
        )}

        <div className="grid grid-cols-3 gap-2">
          <Cell
            label="Rating"
            value={competitor.rating != null ? competitor.rating.toFixed(1) : '—'}
            icon={<Star className="h-3 w-3 fill-amber-400 text-amber-400" />}
          />
          <Cell label="Reviews" value={competitor.reviews.toLocaleString()} />
          <Cell
            label="/week"
            value={competitor.velocity != null ? competitor.velocity.toFixed(1) : '—'}
            icon={
              competitor.velocity == null ? (
                <Clock className="h-3 w-3 text-muted-foreground" />
              ) : competitor.velocity > 0.1 ? (
                <ArrowUp className="h-3 w-3 text-red-600 dark:text-red-400" />
              ) : competitor.velocity < -0.1 ? (
                <ArrowDown className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <Minus className="h-3 w-3 text-muted-foreground" />
              )
            }
          />
        </div>

        {competitor.crossoverWeeks != null && (
          <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-400">
            Passes your review count in about {competitor.crossoverWeeks}{' '}
            {competitor.crossoverWeeks === 1 ? 'week' : 'weeks'} at current pace
          </p>
        )}

        {ratingGap != null && (
          <p
            className={`mt-2 flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium ${
              ratingGap > 0.1
                ? 'border-red-200 bg-red-50 text-red-600 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400'
                : ratingGap < -0.1
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-600 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-400'
                  : 'border-border/50 bg-muted/30 text-muted-foreground'
            }`}
          >
            {ratingGap > 0.1 ? (
              <>
                <ArrowUp className="h-3 w-3" /> {ratingGap.toFixed(1)} above you
              </>
            ) : ratingGap < -0.1 ? (
              <>
                <ArrowDown className="h-3 w-3" /> {Math.abs(ratingGap).toFixed(1)} below you
              </>
            ) : (
              <>Level with you on rating</>
            )}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function Cell({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border/30 bg-muted/30 p-2.5 text-center">
      <div className="flex items-center justify-center gap-1">
        {icon}
        <span className="text-sm font-bold tabular-nums">{value}</span>
      </div>
      <p className="mt-0.5 text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}
