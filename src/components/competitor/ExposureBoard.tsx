/**
 * Referral exposure — which competitors sit between the practice and the
 * offices that actually refer to it.
 *
 * The bars encode magnitude (patients at stake), so they are ranked, share one
 * hue, and start at zero. Colour here is sequential-by-severity rather than
 * categorical: these are not five identities, they are one measure at five
 * intensities, and the accompanying number carries the value so the fill never
 * has to be read precisely.
 */

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, Crosshair, Info, TrendingDown, Users } from 'lucide-react';
import type { ExposureReport } from '@/lib/competitorIntel';
import { VOLUME_WINDOW_MONTHS } from '@/lib/competitorIntel';

interface Props {
  exposure: ExposureReport;
  /** False when the clinic has no coordinates, which disables the whole model. */
  hasClinicLocation: boolean;
  competitorCount: number;
}

export function ExposureBoard({ exposure, hasClinicLocation, competitorCount }: Props) {
  const contested = exposure.competitors.filter((c) => c.contestedPatients > 0);

  return (
    <Card variant="glass" className="border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Crosshair className="h-5 w-5 text-primary" />
              Contested referrals
            </CardTitle>
            <CardDescription className="mt-1 max-w-2xl">
              Referring offices that are closer to a competitor than they are to you, weighted by
              the patients they sent over the last {VOLUME_WINDOW_MONTHS} months.
            </CardDescription>
          </div>
          {exposure.mappedPatients > 0 && (
            <div className="text-right">
              <div className="text-3xl font-bold tabular-nums leading-none">
                {exposure.exposedPatients}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                of {exposure.mappedPatients} patients exposed
              </p>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {!hasClinicLocation ? (
          <EmptyState
            title="Set your practice address first"
            body="Exposure is measured from your location outward, so Settings needs your address before this can be calculated."
          />
        ) : competitorCount === 0 ? (
          <EmptyState
            title="No competitors tracked yet"
            body="Add a nearby practice below and this will show which of your referring offices they sit closer to."
          />
        ) : exposure.mappedPatients === 0 ? (
          <EmptyState
            title="No mapped referral history yet"
            body="Once your referring offices have addresses and recorded patients, their volume gets weighed against each competitor here."
          />
        ) : contested.length === 0 ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm dark:border-emerald-900/50 dark:bg-emerald-950/30">
            <p className="font-medium text-emerald-700 dark:text-emerald-400">
              You are the closest tracked practice to every referring office you have.
            </p>
            <p className="mt-1 text-muted-foreground">
              None of the {competitorCount} competitors you watch sits between you and a source of
              patients.
            </p>
          </div>
        ) : (
          <>
            <SummaryRow exposure={exposure} />
            <div className="space-y-2">
              {contested.map((row) => (
                <ExposureRow
                  key={row.competitorId}
                  row={row}
                  maxPatients={contested[0].contestedPatients}
                />
              ))}
            </div>
          </>
        )}

        <p className="flex items-start gap-1.5 border-t border-border/50 pt-3 text-xs text-muted-foreground">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            Proximity is a risk signal, not a verdict — it says a relationship is contested, never
            that it is being lost. The offices marked <strong>declining</strong> are the ones where
            your own referral numbers agree.
            {exposure.unmappedOffices > 0 && (
              <>
                {' '}
                {exposure.unmappedOffices} referring{' '}
                {exposure.unmappedOffices === 1 ? 'office has' : 'offices have'} no address on file
                and {exposure.unmappedOffices === 1 ? 'is' : 'are'} left out.
              </>
            )}
          </span>
        </p>
      </CardContent>
    </Card>
  );
}

function SummaryRow({ exposure }: { exposure: ExposureReport }) {
  const share = Math.round(exposure.exposedShare * 100);
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <Stat
        value={`${share}%`}
        label="of referral volume contested"
        tone={share >= 50 ? 'alert' : share >= 25 ? 'watch' : 'calm'}
      />
      <Stat
        value={String(exposure.decliningPatients)}
        label="patients from contested offices already declining"
        tone={exposure.decliningPatients > 0 ? 'alert' : 'calm'}
      />
      <Stat
        value={String(exposure.competitors.filter((c) => c.contestedPatients > 0).length)}
        label="competitors holding ground on you"
        tone="neutral"
      />
    </div>
  );
}

function Stat({
  value,
  label,
  tone,
}: {
  value: string;
  label: string;
  tone: 'alert' | 'watch' | 'calm' | 'neutral';
}) {
  const toneClass =
    tone === 'alert'
      ? 'text-red-600 dark:text-red-400'
      : tone === 'watch'
        ? 'text-amber-600 dark:text-amber-400'
        : tone === 'calm'
          ? 'text-emerald-600 dark:text-emerald-400'
          : 'text-foreground';

  return (
    <div className="rounded-xl border border-border/50 bg-background/60 p-3">
      <div className={`text-2xl font-bold tabular-nums ${toneClass}`}>{value}</div>
      <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{label}</p>
    </div>
  );
}

function ExposureRow({
  row,
  maxPatients,
}: {
  row: ExposureReport['competitors'][number];
  maxPatients: number;
}) {
  const [open, setOpen] = useState(false);
  const width = maxPatients > 0 ? Math.max(4, (row.contestedPatients / maxPatients) * 100) : 0;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="rounded-xl border border-border/50 bg-background/40 transition-colors hover:border-border">
        <CollapsibleTrigger className="w-full p-3 text-left">
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate text-sm font-medium">{row.name}</span>
                {row.decliningPatients > 0 && (
                  <Badge
                    variant="outline"
                    className="gap-1 border-red-200 bg-red-50 text-[10px] text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400"
                  >
                    <TrendingDown className="h-3 w-3" />
                    declining
                  </Badge>
                )}
              </div>

              {/* Magnitude bar: ranked, zero-based, one hue, value shown beside it. */}
              <div className="mt-2 flex items-center gap-2">
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${width}%`,
                      backgroundColor: `hsl(var(--chart-1) / ${0.45 + (row.threat / 100) * 0.55})`,
                    }}
                  />
                </div>
                <span className="w-24 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                  {row.contestedPatients} patients
                </span>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <div className="text-right">
                <div className="text-sm font-semibold tabular-nums">{row.threat}</div>
                <p className="text-[10px] text-muted-foreground">threat</p>
              </div>
              <ChevronDown
                className={`h-4 w-4 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`}
              />
            </div>
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="space-y-1 border-t border-border/50 px-3 pb-3 pt-2">
            <p className="flex items-center gap-1.5 pb-1 text-xs text-muted-foreground">
              <Users className="h-3.5 w-3.5" />
              Offices {row.name} is closer to than you are
            </p>
            {row.offices.map((office) => (
              <div
                key={office.sourceId}
                className="flex items-center justify-between gap-3 rounded-lg bg-muted/30 px-2.5 py-1.5 text-xs"
              >
                <span className="min-w-0 flex-1 truncate font-medium">{office.name}</span>
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  {office.milesToCompetitor.toFixed(1)} mi them · {office.milesToYou.toFixed(1)} mi
                  you
                </span>
                <span className="w-24 shrink-0 text-right tabular-nums">
                  {office.patients} patients
                  {office.declining && (
                    <span className="ml-1 text-red-600 dark:text-red-400">
                      {office.trend > 0 ? '+' : ''}
                      {office.trend}
                    </span>
                  )}
                </span>
              </div>
            ))}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border py-8 text-center">
      <p className="text-sm font-medium">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">{body}</p>
    </div>
  );
}
