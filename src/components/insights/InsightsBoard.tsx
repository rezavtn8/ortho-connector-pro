import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Compass,
  Grid3x3,
  Network,
  PieChart,
  Shuffle,
  Waves,
  Waypoints,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { InsightsData } from '@/hooks/useInsightsData';
import { baselineWindow, resolveWindow, type WindowSize } from '@/components/map/timeWindow';
import type { CompareOffset } from '@/components/map/MonthScrubber';
import { channelsInWindow } from './outreach';
import { InsightsWindowBar } from './InsightsWindowBar';
import { CircularNetworkChart, type NetworkMode } from './CircularNetworkChart';
import { RadialBarChart, type RadialMetric } from './RadialBarChart';
import { SankeyChart, type SankeyEndColumn } from './SankeyChart';
import { FingerprintChart } from './FingerprintChart';
import { TidesChart, type TidesBasis } from './TidesChart';
import { OrbitChart } from './OrbitChart';
import { ChordChart, type ChordBasis, type ChordWeight } from './ChordChart';
import type { FingerprintSort } from './fingerprint';
import {
  CHORD_BASIS_LABELS,
  CHORD_WEIGHT_LABELS,
  FINGERPRINT_SORT_LABELS,
  INSIGHTS_TABS,
  NETWORK_MODE_LABELS,
  RADIAL_METRIC_LABELS,
  SANKEY_END_LABELS,
  TAB_BLURBS,
  TAB_LABELS,
  TIDES_BASIS_LABELS,
  type InsightsTab,
} from './insightsViews';

/**
 * The seven Insights views, their shared time control, and the state that ties them
 * together.
 *
 * Takes `data` as a prop and does no fetching of its own. That is what lets the dev
 * preview harness render the real component against synthetic fixtures — including the
 * degenerate ones — with no login and no Supabase, rather than exercising a parallel
 * copy of this wiring that could drift from what ships.
 */

/** Stable empty axis, so hooks keyed on `months` do not churn before data arrives. */
const NO_MONTHS: string[] = [];

const TAB_ICONS: Record<InsightsTab, typeof Network> = {
  network: Network,
  radial: PieChart,
  fingerprint: Grid3x3,
  tides: Waves,
  sankey: Waypoints,
  chord: Shuffle,
  orbit: Compass,
};

export type { InsightsTab } from './insightsViews';

export interface InsightsState {
  tab: InsightsTab;
  mode: NetworkMode;
  metric: RadialMetric;
  endColumn: SankeyEndColumn;
  sort: FingerprintSort;
  basis: TidesBasis;
  weight: ChordWeight;
  chordBasis: ChordBasis;
  trace: boolean;
  month: string | null;
  windowSize: WindowSize;
  baseline: CompareOffset;
}

interface InsightsBoardProps {
  data: InsightsData;
  /** Server-synced clock, injected so the fixtures can pin it. */
  nowDate: Date;
  initial?: Partial<InsightsState>;
  onStateChange?: (state: InsightsState) => void;
  /** Extra notes under the charts, e.g. data-completeness caveats. */
  footnotes?: React.ReactNode;
}

/** One row of controls per view, so the header never carries seven dead widgets. */
function ViewControls({
  tab,
  state,
  set,
  baselineMissing,
  hasTags,
  hasCampaigns,
}: {
  tab: InsightsTab;
  state: InsightsState;
  set: (over: Partial<InsightsState>) => void;
  baselineMissing: boolean;
  hasTags: boolean;
  hasCampaigns: boolean;
}) {
  const needsBaseline = 'Needs enough history for an equal-length baseline';

  if (tab === 'network') {
    return (
      <Select value={state.mode} onValueChange={(v) => set({ mode: v as NetworkMode })}>
        <SelectTrigger className="h-8 w-[10.5rem] text-xs" aria-label="Network grouping">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {(Object.keys(NETWORK_MODE_LABELS) as NetworkMode[]).map((m) => (
            <SelectItem
              key={m}
              value={m}
              // Disabled with a reason rather than rendering an empty ring.
              disabled={
                (m === 'movement' && baselineMissing) ||
                (m === 'tags' && !hasTags) ||
                (m === 'campaigns' && !hasCampaigns)
              }
              className="text-xs"
            >
              {NETWORK_MODE_LABELS[m]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  if (tab === 'radial') {
    return (
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <Switch
            id="radial-trace"
            checked={state.trace}
            onCheckedChange={(v) => set({ trace: v })}
          />
          <Label htmlFor="radial-trace" className="text-xs text-muted-foreground">
            Trace ring
          </Label>
        </div>
        <Select value={state.metric} onValueChange={(v) => set({ metric: v as RadialMetric })}>
          <SelectTrigger className="h-8 w-[11rem] text-xs" aria-label="Bar metric">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(RADIAL_METRIC_LABELS) as RadialMetric[]).map((m) => (
              <SelectItem
                key={m}
                value={m}
                disabled={m === 'change' && baselineMissing}
                title={m === 'change' && baselineMissing ? needsBaseline : undefined}
                className="text-xs"
              >
                {RADIAL_METRIC_LABELS[m]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  if (tab === 'fingerprint') {
    return (
      <Select value={state.sort} onValueChange={(v) => set({ sort: v as FingerprintSort })}>
        <SelectTrigger className="h-8 w-[10.5rem] text-xs" aria-label="Row order">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {(Object.keys(FINGERPRINT_SORT_LABELS) as FingerprintSort[]).map((s) => (
            <SelectItem key={s} value={s} className="text-xs">
              Sort: {FINGERPRINT_SORT_LABELS[s]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  if (tab === 'tides') {
    return (
      <Select value={state.basis} onValueChange={(v) => set({ basis: v as TidesBasis })}>
        <SelectTrigger className="h-8 w-[10.5rem] text-xs" aria-label="Band basis">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {(Object.keys(TIDES_BASIS_LABELS) as TidesBasis[]).map((b) => (
            <SelectItem key={b} value={b} className="text-xs">
              {TIDES_BASIS_LABELS[b]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  if (tab === 'sankey') {
    return (
      <Select value={state.endColumn} onValueChange={(v) => set({ endColumn: v as SankeyEndColumn })}>
        <SelectTrigger className="h-8 w-[11rem] text-xs" aria-label="Final column">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {(Object.keys(SANKEY_END_LABELS) as SankeyEndColumn[]).map((e) => (
            <SelectItem key={e} value={e} className="text-xs">
              {SANKEY_END_LABELS[e]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  if (tab === 'chord') {
    return (
      <div className="flex items-center gap-2">
        <Select value={state.chordBasis} onValueChange={(v) => set({ chordBasis: v as ChordBasis })}>
          <SelectTrigger className="h-8 w-[10rem] text-xs" aria-label="What shifted">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(CHORD_BASIS_LABELS) as ChordBasis[]).map((b) => (
              <SelectItem key={b} value={b} className="text-xs">
                {CHORD_BASIS_LABELS[b]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={state.weight} onValueChange={(v) => set({ weight: v as ChordWeight })}>
          <SelectTrigger className="h-8 w-[11rem] text-xs" aria-label="Ribbon weight">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(CHORD_WEIGHT_LABELS) as ChordWeight[]).map((w) => (
              <SelectItem key={w} value={w} className="text-xs">
                {CHORD_WEIGHT_LABELS[w]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  return null;
}

export function InsightsBoard({
  data,
  nowDate,
  initial = {},
  onStateChange,
  footnotes,
}: InsightsBoardProps) {
  const [state, setState] = useState<InsightsState>(() => ({
    tab: initial.tab ?? 'network',
    mode: initial.mode ?? 'outreach',
    metric: initial.metric ?? 'patients',
    endColumn: initial.endColumn ?? 'clinic',
    sort: initial.sort ?? 'volume',
    basis: initial.basis ?? 'tier',
    weight: initial.weight ?? 'patients',
    chordBasis: initial.chordBasis ?? 'momentum',
    trace: initial.trace ?? true,
    month: initial.month ?? null,
    windowSize: initial.windowSize ?? 12,
    baseline: initial.baseline ?? 3,
  }));
  const [monthIndex, setMonthIndex] = useState<number | null>(null);

  const months = data.months.length ? data.months : NO_MONTHS;

  // Open on the newest month that actually has data, not on the axis end. Counts are
  // usually entered at month end, so on the 7th the newest month is empty — and every
  // chart would open blank, which reads as a broken page rather than an empty month.
  useEffect(() => {
    if (monthIndex !== null || months.length === 0) return;
    const seed = initial.month && months.includes(initial.month) ? initial.month : null;
    const fallback = data.latestMonthWithData ?? months[months.length - 1];
    setMonthIndex(Math.max(0, months.indexOf(seed ?? fallback)));
  }, [months, monthIndex, initial.month, data.latestMonthWithData]);

  const index = monthIndex ?? Math.max(0, months.length - 1);
  const win = useMemo(
    () => resolveWindow(months, state.windowSize, index),
    [months, state.windowSize, index],
  );
  const base = useMemo(() => baselineWindow(months, win, state.baseline), [months, win, state.baseline]);
  const baselineMonths = base?.months ?? null;

  const reached = useMemo(
    () => channelsInWindow(data.outreach, win.months) as Map<string, Set<string>>,
    [data.outreach, win.months],
  );

  const patientsInWindow = useMemo(() => {
    let total = 0;
    for (const m of win.months) total += data.totalsByMonth[m] ?? 0;
    return total;
  }, [data.totalsByMonth, win.months]);

  const set = useCallback((over: Partial<InsightsState>) => {
    setState((prev) => ({ ...prev, ...over }));
  }, []);

  useEffect(() => {
    if (months.length) onStateChange?.({ ...state, month: months[index] ?? null });
  }, [onStateChange, state, months, index]);

  const baselineMissing = baselineMonths === null;
  const hasTags = data.tags.length > 0;
  const hasCampaigns = data.campaigns.length > 0;

  // A stale deep link can name a view whose data has since gone; fall back rather than
  // rendering an empty ring with a disabled control the user cannot see.
  const effectiveMode: NetworkMode =
    (state.mode === 'movement' && baselineMissing) ||
    (state.mode === 'tags' && !hasTags) ||
    (state.mode === 'campaigns' && !hasCampaigns)
      ? 'outreach'
      : state.mode;

  return (
    <div className="space-y-4">
      <InsightsWindowBar
        months={months}
        monthIndex={index}
        onMonthIndexChange={setMonthIndex}
        window={win}
        windowSize={state.windowSize}
        onWindowSizeChange={(s) => set({ windowSize: s })}
        baselineOffset={state.baseline}
        onBaselineOffsetChange={(b) => set({ baseline: b })}
        totalsByMonth={data.totalsByMonth}
        patientsInWindow={patientsInWindow}
      />

      <Tabs value={state.tab} onValueChange={(v) => set({ tab: v as InsightsTab })}>
        <div className="space-y-3">
          <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1">
            {INSIGHTS_TABS.map((t) => {
              const Icon = TAB_ICONS[t];
              return (
                <TabsTrigger key={t} value={t} className="flex items-center gap-1.5">
                  <Icon className="h-4 w-4" />
                  {TAB_LABELS[t]}
                </TabsTrigger>
              );
            })}
          </TabsList>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">{TAB_BLURBS[state.tab]}</p>
            <ViewControls
              tab={state.tab}
              state={state}
              set={set}
              baselineMissing={baselineMissing}
              hasTags={hasTags}
              hasCampaigns={hasCampaigns}
            />
          </div>
        </div>

        <Card className="mt-4 p-4 sm:p-6">
          <TabsContent value="network" className="mt-0">
            <CircularNetworkChart
              offices={data.offices}
              officeCohort={data.officeCohort}
              officeSeries={data.officeSeries}
              outreach={data.outreach}
              tags={data.tags}
              campaigns={data.campaigns}
              windowMonths={win.months}
              baselineMonths={baselineMonths}
              mode={effectiveMode}
              nowDate={nowDate}
            />
          </TabsContent>

          <TabsContent value="radial" className="mt-0">
            <RadialBarChart
              offices={data.offices}
              windowMonths={win.months}
              baselineMonths={baselineMonths}
              allMonths={months}
              metric={state.metric}
              showTrace={state.trace}
            />
          </TabsContent>

          <TabsContent value="fingerprint" className="mt-0">
            <FingerprintChart
              offices={data.offices}
              windowMonths={win.months}
              sort={state.sort}
            />
          </TabsContent>

          <TabsContent value="tides" className="mt-0">
            <TidesChart
              offices={data.offices}
              otherSources={data.otherSources}
              officeCohort={data.officeCohort}
              officeSeries={data.officeSeries}
              months={months}
              windowMonths={win.months}
              basis={state.basis}
              nowDate={nowDate}
            />
          </TabsContent>

          <TabsContent value="sankey" className="mt-0">
            <SankeyChart
              offices={data.offices}
              otherSources={data.otherSources}
              clinics={data.clinics}
              windowMonths={win.months}
              endColumn={state.endColumn}
              reached={reached}
            />
          </TabsContent>

          <TabsContent value="chord" className="mt-0">
            <ChordChart
              offices={data.offices}
              officeCohort={data.officeCohort}
              officeSeries={data.officeSeries}
              windowMonths={win.months}
              baselineMonths={baselineMonths}
              weight={state.weight}
              basis={state.chordBasis}
              nowDate={nowDate}
            />
          </TabsContent>

          <TabsContent value="orbit" className="mt-0">
            <OrbitChart
              offices={data.offices}
              windowMonths={win.months}
              hasOrigin={data.origin !== null}
            />
          </TabsContent>
        </Card>
      </Tabs>

      <div className="space-y-1 text-xs text-muted-foreground">
        {data.offices.length < 10 && (
          <p>
            {data.offices.length} office{data.offices.length === 1 ? '' : 's'} on the books — these
            views get considerably more useful past about ten.
          </p>
        )}
        {data.counts.officesWithNoReferrals > 0 && (
          <p>
            {data.counts.officesWithNoReferrals} office
            {data.counts.officesWithNoReferrals === 1 ? ' has' : 's have'} never sent a patient.
            They sit in Dormant.
          </p>
        )}
        {data.counts.officesWithoutLocation > 0 && (
          <p>
            {data.counts.officesWithoutLocation} referring office
            {data.counts.officesWithoutLocation === 1 ? ' has' : 's have'} no address, so they are
            absent from Orbit.
          </p>
        )}
        {data.counts.visits === 0 && data.counts.deliveries === 0 && data.counts.emails === 0 && (
          <p>
            No visits, campaigns or emails recorded yet, so every office reads as “never
            contacted” in the outreach view.
          </p>
        )}
        {footnotes}
      </div>
    </div>
  );
}
