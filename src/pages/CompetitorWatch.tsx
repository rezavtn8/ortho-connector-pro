/**
 * Competitor Watch.
 *
 * The page is ordered by how actionable each block is rather than by how easy
 * it was to build: what is at stake, what changed, then the standings and the
 * charts. The previous version led with two bar charts of Google ratings,
 * which is the least specific thing here and the one any reputation tool can
 * already show.
 */

import React, { useMemo } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, Shield } from 'lucide-react';
import { useCompetitorIntel, useCompetitorActions } from '@/hooks/useCompetitorIntel';
import { MarketPositionHero } from '@/components/competitor/MarketPositionHero';
import { ExposureBoard } from '@/components/competitor/ExposureBoard';
import { MovementFeed } from '@/components/competitor/MovementFeed';
import { ReviewRaceChart } from '@/components/competitor/ReviewRaceChart';
import { CompetitorList } from '@/components/competitor/CompetitorList';
import { AddCompetitorPanel } from '@/components/competitor/AddCompetitorPanel';

export default function CompetitorWatch() {
  const intel = useCompetitorIntel();
  const { add, remove, refresh } = useCompetitorActions();

  const watchedPlaceIds = useMemo(
    () =>
      new Set(
        [
          ...intel.competitors.map((c) => c.google_place_id),
          intel.clinic?.google_place_id,
        ].filter((id): id is string => !!id),
      ),
    [intel.competitors, intel.clinic],
  );

  if (intel.isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-56 rounded-2xl" />
        <Skeleton className="h-64 rounded-2xl" />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Skeleton className="h-72 rounded-2xl" />
          <Skeleton className="h-72 rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-6">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Shield className="h-6 w-6 text-primary" />
          Competitor Watch
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Who is competing for your referrals, and what has changed since you last looked.
        </p>
      </header>

      {intel.error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Could not load everything</AlertTitle>
          <AlertDescription>{intel.error.message}</AlertDescription>
        </Alert>
      )}

      <MarketPositionHero
        clinic={intel.clinic}
        position={intel.position}
        rating={intel.mySnapshot?.google_rating ?? null}
        reviews={intel.mySnapshot?.review_count ?? 0}
        velocity={intel.myVelocity}
        lastRefreshed={intel.lastRefreshed}
        onRefresh={() => refresh.mutate(false)}
        isRefreshing={refresh.isPending}
      />

      {/* The reason this page is not a reputation dashboard. */}
      <ExposureBoard
        exposure={intel.exposure}
        hasClinicLocation={intel.clinic?.latitude != null && intel.clinic?.longitude != null}
        competitorCount={intel.competitors.length}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <MovementFeed movements={intel.movements} historyDays={intel.historyDays} />
        <ReviewRaceChart
          clinicName={intel.clinic?.name ?? 'Your practice'}
          mySeries={intel.mySeries}
          competitors={intel.competitors}
        />
      </div>

      <section>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Watchlist ({intel.competitors.length})
        </h2>
        <CompetitorList
          competitors={intel.competitors}
          myRating={intel.mySnapshot?.google_rating ?? null}
          onRemove={(id) => remove.mutate(id)}
          isRemoving={remove.isPending}
        />
      </section>

      <AddCompetitorPanel
        clinic={intel.clinic}
        watchedPlaceIds={watchedPlaceIds}
        onAdd={(entry) => add.mutate(entry)}
        isAdding={add.isPending}
      />
    </div>
  );
}
