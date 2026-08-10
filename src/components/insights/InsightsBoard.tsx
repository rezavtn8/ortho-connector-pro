import { useCallback, useEffect, useMemo, useState } from 'react';
import { Network, PieChart, Waypoints } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
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
import { InsightsWindowBar } from './InsightsWindowBar';
import { CircularNetworkChart, type NetworkMode } from './CircularNetworkChart';
import { RadialBarChart, type RadialMetric } from './RadialBarChart';
import { SankeyChart, type SankeyEndColumn } from './SankeyChart';

/**
 * The three diagrams, their shared time control, and the state that ties them together.
 *
 * Takes `data` as a prop and does no fetching of its own. That is what lets the dev
 * preview harness render the real component against synthetic fixtures — including the
 * degenerate ones — with no login and no Supabase, rather than exercising a parallel
 * copy of this wiring that could drift from what ships.
 */

export type InsightsTab = 'network' | 'radial' | 'sankey';

/** Stable empty axis, so hooks keyed on `months` do not churn before data arrives. */
const NO_MONTHS: string[] = [];

export interface InsightsState {
  tab: InsightsTab;
  mode: NetworkMode;
  metric: RadialMetric;
  endColumn: SankeyEndColumn;
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

export function InsightsBoard({
  data,
  nowDate,
  initial = {},
  onStateChange,
  footnotes,
}: InsightsBoardProps) {
  const [tab, setTab] = useState<InsightsTab>(initial.tab ?? 'network');
  const [mode, setMode] = useState<NetworkMode>(initial.mode ?? 'outreach');
  const [metric, setMetric] = useState<RadialMetric>(initial.metric ?? 'patients');
  const [endColumn, setEndColumn] = useState<SankeyEndColumn>(initial.endColumn ?? 'clinic');
  const [windowSize, setWindowSize] = useState<WindowSize>(initial.windowSize ?? 12);
  const [baseline, setBaseline] = useState<CompareOffset>(initial.baseline ?? 3);
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
  const win = useMemo(() => resolveWindow(months, windowSize, index), [months, windowSize, index]);
  const base = useMemo(() => baselineWindow(months, win, baseline), [months, win, baseline]);
  const baselineMonths = base?.months ?? null;

  const patientsInWindow = useMemo(() => {
    let total = 0;
    for (const m of win.months) total += data.totalsByMonth[m] ?? 0;
    return total;
  }, [data.totalsByMonth, win.months]);

  const emit = useCallback(
    (over: Partial<InsightsState> = {}) => {
      onStateChange?.({
        tab,
        mode,
        metric,
        endColumn,
        windowSize,
        baseline,
        month: months[index] ?? null,
        ...over,
      });
    },
    [onStateChange, tab, mode, metric, endColumn, windowSize, baseline, months, index],
  );

  useEffect(() => {
    if (months.length) emit();
  }, [emit, months.length]);

  // Falling back to the outreach view rather than rendering an empty movement view:
  // the toggle is disabled with a reason, so the state can only be reached from a
  // stale deep link.
  const effectiveMode: NetworkMode = baselineMonths === null ? 'outreach' : mode;

  return (
    <div className="space-y-4">
      <InsightsWindowBar
        months={months}
        monthIndex={index}
        onMonthIndexChange={(i) => {
          setMonthIndex(i);
          emit({ month: months[i] ?? null });
        }}
        window={win}
        windowSize={windowSize}
        onWindowSizeChange={(s) => {
          setWindowSize(s);
          emit({ windowSize: s });
        }}
        baselineOffset={baseline}
        onBaselineOffsetChange={(b) => {
          setBaseline(b);
          emit({ baseline: b });
        }}
        totalsByMonth={data.totalsByMonth}
        patientsInWindow={patientsInWindow}
      />

      <Tabs
        value={tab}
        onValueChange={(v) => {
          setTab(v as InsightsTab);
          emit({ tab: v as InsightsTab });
        }}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabsList className="grid w-full max-w-md grid-cols-3">
            <TabsTrigger value="network" className="flex items-center gap-1.5">
              <Network className="h-4 w-4" />
              Network
            </TabsTrigger>
            <TabsTrigger value="radial" className="flex items-center gap-1.5">
              <PieChart className="h-4 w-4" />
              Radial
            </TabsTrigger>
            <TabsTrigger value="sankey" className="flex items-center gap-1.5">
              <Waypoints className="h-4 w-4" />
              Sankey
            </TabsTrigger>
          </TabsList>

          {tab === 'network' && (
            <ToggleGroup
              type="single"
              value={effectiveMode}
              onValueChange={(v) => {
                if (!v) return;
                setMode(v as NetworkMode);
                emit({ mode: v as NetworkMode });
              }}
              aria-label="Network view"
            >
              <ToggleGroupItem value="outreach" className="h-8 px-3 text-xs">
                Outreach
              </ToggleGroupItem>
              <ToggleGroupItem
                value="movement"
                className="h-8 px-3 text-xs"
                // Disabled with a reason rather than silently showing zeros — the
                // same discipline the map's compare control uses.
                disabled={baselineMonths === null}
                title={
                  baselineMonths === null
                    ? 'Needs enough history for an equal-length baseline'
                    : undefined
                }
              >
                Tier movement
              </ToggleGroupItem>
            </ToggleGroup>
          )}

          {tab === 'radial' && (
            <ToggleGroup
              type="single"
              value={baselineMonths === null ? 'patients' : metric}
              onValueChange={(v) => {
                if (!v) return;
                setMetric(v as RadialMetric);
                emit({ metric: v as RadialMetric });
              }}
              aria-label="Bar metric"
            >
              <ToggleGroupItem value="patients" className="h-8 px-3 text-xs">
                Patients
              </ToggleGroupItem>
              <ToggleGroupItem
                value="change"
                className="h-8 px-3 text-xs"
                disabled={baselineMonths === null}
                title={
                  baselineMonths === null
                    ? 'Needs enough history for an equal-length baseline'
                    : undefined
                }
              >
                Change vs baseline
              </ToggleGroupItem>
            </ToggleGroup>
          )}

          {tab === 'sankey' && (
            <Select
              value={endColumn}
              onValueChange={(v) => {
                setEndColumn(v as SankeyEndColumn);
                emit({ endColumn: v as SankeyEndColumn });
              }}
            >
              <SelectTrigger className="h-8 w-[11rem] text-xs" aria-label="Final column">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="clinic" className="text-xs">
                  → Your practice
                </SelectItem>
                <SelectItem value="momentum" className="text-xs">
                  → Momentum
                </SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>

        <Card className="mt-4 p-4 sm:p-6">
          <TabsContent value="network" className="mt-0">
            <CircularNetworkChart
              offices={data.offices}
              officeCohort={data.officeCohort}
              officeSeries={data.officeSeries}
              outreach={data.outreach}
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
              metric={metric}
            />
          </TabsContent>

          <TabsContent value="sankey" className="mt-0">
            <SankeyChart
              offices={data.offices}
              otherSources={data.otherSources}
              clinics={data.clinics}
              windowMonths={win.months}
              endColumn={endColumn}
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
