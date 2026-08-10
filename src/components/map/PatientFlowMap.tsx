import { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';
import { MapPin, RefreshCw } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { useIsMobile } from '@/hooks/use-mobile';
import { useDiscoveredGroups } from '@/hooks/useDiscoveredGroups';
import { useDiscoveredOffices } from '@/hooks/useDiscoveredOffices';
import { useMapboxToken } from '@/hooks/useMapboxToken';
import { usePatientFlowData } from '@/hooks/usePatientFlowData';
import { formatYearMonth } from '@/lib/database.types';
import { AttentionCard } from './AttentionCard';
import { computeAttention } from './attention';
import { computeDeltaFlows } from './deltaFlows';
import { FlowMapCanvas } from './FlowMapCanvas';
import { HubDetailPanel } from './HubDetailPanel';
import { MapActionsBar } from './MapActionsBar';
import { MapFilterBar } from './MapFilterBar';
import { MapLegend } from './MapLegend';
import { MapStatsRow } from './MapStatsRow';
import { MonthScrubber, type CompareOffset, type Speed } from './MonthScrubber';
import { OfficeDetailPanel } from './OfficeDetailPanel';
import { ProspectDetailPanel } from './ProspectDetailPanel';
import { ReachCard } from './ReachCard';
import { computeReachStats } from './reachStats';
import {
  aggregateFlows,
  baselineWindow,
  resolveWindow,
  totalPatients,
  type WindowSize,
} from './timeWindow';
import type { FlowTier, MapOffice, MapTarget } from './types';
import type { FlowAnimationState } from './useFlowAnimation';

export interface PatientFlowMapProps {
  height?: string;
  initialShowDiscovered?: boolean;
  initialGroupId?: string | null;
  initialTier?: FlowTier | null;
  initialMonth?: string | null;
  initialOfficeId?: string | null;
  /** Reports state back so the page can keep the URL in sync. */
  onStateChange?: (state: {
    month: string | null;
    tier: FlowTier | null;
    showDiscovered: boolean;
    groupId: string | null;
    officeId: string | null;
  }) => void;
  /** Dev preview harness only: a self-contained basemap style. */
  styleOverride?: import('mapbox-gl').StyleSpecification;
}

const EMPTY_TIER_RECORD: Record<FlowTier, number> = { VIP: 0, Warm: 0, Cold: 0, Dormant: 0 };

function StateCard({ children, height }: { children: React.ReactNode; height: string }) {
  return (
    <Card className="p-6" style={{ minHeight: height }}>
      <div className="flex items-center justify-center h-full min-h-[16rem]">{children}</div>
    </Card>
  );
}

export function PatientFlowMap({
  height = '620px',
  initialShowDiscovered = false,
  initialGroupId = null,
  initialTier = null,
  initialMonth = null,
  initialOfficeId = null,
  onStateChange,
  styleOverride,
}: PatientFlowMapProps) {
  const isMobile = useIsMobile();

  const { token, isLoading: tokenLoading } = useMapboxToken();
  const { data, isLoading: dataLoading, error } = usePatientFlowData();
  const { groups } = useDiscoveredGroups();

  const [showDiscovered, setShowDiscovered] = useState(initialShowDiscovered);
  const [groupId, setGroupId] = useState<string | null>(initialGroupId);
  const [tierFilter, setTierFilter] = useState<FlowTier | null>(initialTier);
  const [search, setSearch] = useState('');
  const [monthIndex, setMonthIndex] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<Speed>('1');
  const [hover, setHover] = useState<MapTarget | null>(null);
  const [selected, setSelected] = useState<MapTarget | null>(
    initialOfficeId ? { kind: 'office', id: initialOfficeId } : null,
  );
  const [legendTier, setLegendTier] = useState<FlowTier | null>(null);
  const [resetViewToken, setResetViewToken] = useState(0);
  const [animation, setAnimation] = useState<FlowAnimationState>({
    animatedFlows: 0,
    totalFlows: 0,
    reducedMotion: false,
  });
  const [hasFlownToInitial, setHasFlownToInitial] = useState(false);
  const [showRings, setShowRings] = useState(true);
  const [compareOffset, setCompareOffset] = useState<CompareOffset>(0);
  // Opens on the whole history: the aggregate is the resting state of this map, and
  // a single month is the drill-down you scrub to.
  const [windowSize, setWindowSize] = useState<WindowSize>('all');

  const { data: discovered = [] } = useDiscoveredOffices(groupId, showDiscovered);

  // Memoized: this feeds effect and memo dependency arrays, and a fresh [] on every
  // render would re-run them continuously.
  const months = useMemo(() => data?.months ?? [], [data]);

  // Land on the deep-linked month if it exists, otherwise the most recent month
  // that actually has referrals. Opening on the bare calendar month means opening
  // on an empty map whenever this month's counts haven't been entered yet.
  useEffect(() => {
    if (months.length === 0 || monthIndex !== null) return;
    const requested = initialMonth ? months.indexOf(initialMonth) : -1;
    if (requested >= 0) {
      setMonthIndex(requested);
      return;
    }
    const withData = data?.latestMonthWithData
      ? months.indexOf(data.latestMonthWithData)
      : -1;
    setMonthIndex(withData >= 0 ? withData : months.length - 1);
  }, [months, monthIndex, initialMonth, data?.latestMonthWithData]);

  const safeIndex = monthIndex === null ? Math.max(0, months.length - 1) : monthIndex;
  const activeMonth = months[safeIndex] ?? null;

  // Scrubbing fires rapidly; deferring keeps the drag responsive while the arc
  // rebuild happens at a lower priority.
  const deferredMonth = useDeferredValue(activeMonth);
  const deferredSearch = useDeferredValue(search);

  const allOffices = useMemo(() => data?.offices ?? [], [data]);

  const officesById = useMemo(
    () => new Map(allOffices.map((o) => [o.id, o])),
    [allOffices],
  );

  const visibleOffices = useMemo(() => {
    const term = deferredSearch.trim().toLowerCase();
    return allOffices.filter((office) => {
      if (tierFilter && office.tier !== tierFilter) return false;
      if (!term) return true;
      return (
        office.name.toLowerCase().includes(term) ||
        (office.address ?? '').toLowerCase().includes(term)
      );
    });
  }, [allOffices, tierFilter, deferredSearch]);

  const visibleIds = useMemo(() => new Set(visibleOffices.map((o) => o.id)), [visibleOffices]);

  /**
   * The period on screen. Single source of truth — arcs, headline numbers, reach and
   * compare all derive from this one call, so they cannot describe different spans.
   */
  const activeWindow = useMemo(
    () => resolveWindow(months, windowSize, months.indexOf(deferredMonth ?? '')),
    [months, windowSize, deferredMonth],
  );

  const visibleFlows = useMemo(() => {
    if (!data) return [];
    return aggregateFlows(data.flowsByMonth, activeWindow.months, (id) => visibleIds.has(id));
  }, [data, activeWindow, visibleIds]);

  // --- Derived counts -------------------------------------------------------
  const tierCounts = useMemo(() => {
    const counts = { ...EMPTY_TIER_RECORD };
    for (const office of allOffices) counts[office.tier]++;
    return counts;
  }, [allOffices]);

  const tierPatients = useMemo(() => {
    const totals = { ...EMPTY_TIER_RECORD };
    for (const flow of visibleFlows) {
      const office = officesById.get(flow.sourceId);
      if (office) totals[office.tier] += flow.count;
    }
    return totals;
  }, [visibleFlows, officesById]);

  const discoveredCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const office of discovered) {
      counts[office.ratingCategory] = (counts[office.ratingCategory] ?? 0) + 1;
    }
    return counts;
  }, [discovered]);

  const reach = useMemo(
    () => computeReachStats(visibleFlows, officesById, data?.hubs ?? []),
    [visibleFlows, officesById, data?.hubs],
  );

  // Momentum is read at the month the scrubber is on, so scrubbing back shows what
  // was going wrong then rather than re-reporting today. Parked where the map opens
  // — the newest month with data — it is the current state of the business.
  const attention = useMemo(
    () => computeAttention(visibleOffices, deferredMonth),
    [visibleOffices, deferredMonth],
  );

  /**
   * The baseline period for compare mode: the same span, `compareOffset` months back.
   *
   * Null whenever the history cannot cover it in full, which turns compare mode off
   * rather than diffing a full period against a truncated one and reporting the
   * shortfall as a collapse.
   */
  const comparison = useMemo(
    () => baselineWindow(months, activeWindow, compareOffset),
    [months, activeWindow, compareOffset],
  );

  const delta = useMemo(() => {
    if (!data || !comparison) return null;
    return computeDeltaFlows(
      visibleFlows,
      aggregateFlows(data.flowsByMonth, comparison.months, (id) => visibleIds.has(id)),
      (id) => visibleIds.has(id),
    );
  }, [data, comparison, visibleFlows, visibleIds]);

  const patientsThisMonth = useMemo(() => totalPatients(visibleFlows), [visibleFlows]);

  /** Change against the equally sized period immediately before this one. */
  const deltaVsPrevious = useMemo(() => {
    if (!data) return null;
    const previous = baselineWindow(months, activeWindow, activeWindow.monthCount);
    if (!previous) return null;
    const previousTotal = totalPatients(
      aggregateFlows(data.flowsByMonth, previous.months, (id) => visibleIds.has(id)),
    );
    return patientsThisMonth - previousTotal;
  }, [data, months, activeWindow, visibleIds, patientsThisMonth]);

  // Prospects already pulled into the network are not prospects any more, and they
  // already have a tier dot at the same address — drawing both means two pins for
  // one building, with the dashed ring implying work still to do.
  const visibleProspects = useMemo(() => discovered.filter((p) => !p.imported), [discovered]);
  const importedCount = discovered.length - visibleProspects.length;

  const selectedOffice: MapOffice | null =
    selected?.kind === 'office' ? (officesById.get(selected.id) ?? null) : null;

  const selectedProspect =
    selected?.kind === 'prospect'
      ? (visibleProspects.find((p) => p.id === selected.id) ?? null)
      : null;

  const selectedHub =
    selected?.kind === 'hub' ? (data?.hubs.find((h) => h.id === selected.id) ?? null) : null;

  // Fly to a deep-linked office once its data has arrived.
  const flyToOffice = useMemo(() => {
    if (hasFlownToInitial || !initialOfficeId) return null;
    return officesById.get(initialOfficeId) ?? null;
  }, [hasFlownToInitial, initialOfficeId, officesById]);

  useEffect(() => {
    if (flyToOffice) setHasFlownToInitial(true);
  }, [flyToOffice]);

  /**
   * What the map should emphasise, per kind.
   *
   * Selection outranks hover, and the two kinds stay independent: pointing at a
   * prospect must not dim the referral arcs, since a prospect has none and the map
   * would appear to empty itself.
   */
  const focus = useMemo(() => {
    const officeFromPointer =
      selectedOffice?.id ??
      (hover?.kind === 'office' ? hover.id : null) ??
      // Hovering a legend tier highlights that tier's busiest office as a proxy.
      (legendTier
        ? (visibleFlows
            .map((f) => ({ flow: f, office: officesById.get(f.sourceId) }))
            .filter((x) => x.office?.tier === legendTier)
            .sort((a, b) => b.flow.count - a.flow.count)[0]?.office?.id ?? null)
        : null);

    return {
      officeId: officeFromPointer,
      prospectId: selectedProspect?.id ?? (hover?.kind === 'prospect' ? hover.id : null),
    };
  }, [selectedOffice, selectedProspect, hover, legendTier, visibleFlows, officesById]);

  useEffect(() => {
    onStateChange?.({
      month: activeMonth,
      tier: tierFilter,
      showDiscovered,
      groupId,
      // The URL only carries referring offices; a prospect is not a page of its own.
      officeId: selected?.kind === 'office' ? selected.id : null,
    });
  }, [activeMonth, tierFilter, showDiscovered, groupId, selected, onStateChange]);

  // The side panels deal in referring offices only, so they get id-shaped callbacks
  // and the tagging happens here rather than in four different components.
  const focusOffice = useCallback(
    (id: string | null) => setHover(id ? { kind: 'office', id } : null),
    [],
  );
  const selectOffice = useCallback((id: string) => setSelected({ kind: 'office', id }), []);

  const handleAnimationState = useCallback((state: FlowAnimationState) => {
    setAnimation((previous) =>
      previous.animatedFlows === state.animatedFlows &&
      previous.totalFlows === state.totalFlows &&
      previous.reducedMotion === state.reducedMotion
        ? previous
        : state,
    );
  }, []);

  // --- States ---------------------------------------------------------------
  if (tokenLoading || dataLoading) {
    return (
      <StateCard height={height}>
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </StateCard>
    );
  }

  if (!token) {
    return (
      <StateCard height={height}>
        <div className="text-center space-y-2 max-w-sm">
          <MapPin className="h-10 w-10 mx-auto text-muted-foreground" />
          <p className="font-medium">Map unavailable</p>
          <p className="text-sm text-muted-foreground">
            The Mapbox token could not be loaded. Add <code>MAPBOX_PUBLIC_TOKEN</code> to your
            Supabase edge function secrets.
          </p>
        </div>
      </StateCard>
    );
  }

  if (error) {
    return (
      <StateCard height={height}>
        <div className="text-center space-y-2">
          <p className="font-medium">Couldn't load your referral data</p>
          <p className="text-sm text-muted-foreground">Please refresh and try again.</p>
        </div>
      </StateCard>
    );
  }

  if (!data || data.hubs.length === 0) {
    return (
      <StateCard height={height}>
        <div className="text-center space-y-3 max-w-sm">
          <MapPin className="h-10 w-10 mx-auto text-muted-foreground" />
          <p className="font-medium">Set your practice location first</p>
          <p className="text-sm text-muted-foreground">
            The map draws patient flow into your practice, so it needs to know where your practice
            is.
          </p>
          <Button size="sm" asChild>
            <a href="/settings">Open Settings</a>
          </Button>
        </div>
      </StateCard>
    );
  }

  const detail = selectedOffice ? (
    <OfficeDetailPanel
      office={selectedOffice}
      hubs={data.hubs}
      months={months}
      activeMonth={activeMonth}
      onClose={() => setSelected(null)}
    />
  ) : selectedProspect ? (
    <ProspectDetailPanel
      prospect={selectedProspect}
      hubs={data.hubs}
      onClose={() => setSelected(null)}
    />
  ) : selectedHub ? (
    <HubDetailPanel
      hub={selectedHub}
      patients={patientsThisMonth}
      referringOffices={visibleFlows.length}
      periodLabel={
        activeWindow.monthCount > 1
          ? `Over ${activeWindow.monthCount} months to ${activeMonth ? formatYearMonth(activeMonth) : '—'}`
          : `In ${activeMonth ? formatYearMonth(activeMonth) : '—'}`
      }
      onClose={() => setSelected(null)}
    />
  ) : null;

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in">
      <MapStatsRow
        month={activeMonth}
        monthCount={activeWindow.monthCount}
        patientsThisMonth={patientsThisMonth}
        activeOffices={visibleFlows.length}
        totalOffices={visibleOffices.length}
        deltaVsPrevious={deltaVsPrevious}
        hubCount={data.hubs.length}
      />

      <MapFilterBar
        search={search}
        onSearchChange={setSearch}
        tierFilter={tierFilter}
        onTierFilterChange={setTierFilter}
        tierCounts={tierCounts}
        showDiscovered={showDiscovered}
        onShowDiscoveredChange={setShowDiscovered}
        groups={groups}
        selectedGroupId={groupId}
        onSelectedGroupIdChange={setGroupId}
        discoveredCount={visibleProspects.length}
        importedCount={importedCount}
        unmappedCount={data.unmappedCount}
        onResetView={() => setResetViewToken((n) => n + 1)}
      />

      <MapActionsBar
        offices={visibleOffices}
        hubs={data.hubs}
        filterLabel={
          tierFilter || search.trim()
            ? 'offices match these filters'
            : 'offices in your network'
        }
      />

      <div className="flex flex-col lg:grid lg:grid-cols-4 gap-4 lg:gap-6">
        <div className="lg:col-span-3 order-1">
          <Card className="overflow-hidden relative">
            <FlowMapCanvas
              token={token}
              hubs={data.hubs}
              offices={visibleOffices}
              flows={visibleFlows}
              monthCount={activeWindow.monthCount}
              discovered={showDiscovered ? visibleProspects : []}
              maxFlowCount={data.maxFlowCount}
              focus={focus}
              height={height}
              onHover={setHover}
              onSelect={setSelected}
              onAnimationState={handleAnimationState}
              resetViewToken={resetViewToken}
              flyToOffice={flyToOffice}
              styleOverride={styleOverride}
              showRings={showRings}
              ringRadii={reach.ringRadii}
              momentumById={attention.byId}
              delta={delta}
            />

            {/* Desktop: float the detail over the map. Mobile uses a sheet below. */}
            {!isMobile && detail && (
              <Card
                variant="glass"
                className="absolute top-3 right-14 w-[19rem] p-3 shadow-elegant z-10"
              >
                {detail}
              </Card>
            )}

            <MonthScrubber
              months={months}
              monthIndex={safeIndex}
              onMonthIndexChange={setMonthIndex}
              window={activeWindow}
              windowSize={windowSize}
              onWindowSizeChange={setWindowSize}
              playing={playing}
              onPlayingChange={setPlaying}
              speed={speed}
              onSpeedChange={setSpeed}
              totalsByMonth={data.totalsByMonth}
              patientsThisMonth={patientsThisMonth}
              compareOffset={compareOffset}
              onCompareOffsetChange={setCompareOffset}
              compareMonth={comparison ? comparison.months[comparison.months.length - 1] : null}
            />
          </Card>

          {visibleOffices.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">
              No offices match these filters.
            </p>
          )}
        </div>

        <div className="order-0 lg:order-2 space-y-4">
          <AttentionCard
            summary={attention}
            monthLabel={activeMonth ? formatYearMonth(activeMonth) : 'this month'}
            onFocusOffice={focusOffice}
            onSelectOffice={selectOffice}
          />
          <ReachCard
            stats={reach}
            showRings={showRings}
            onShowRingsChange={setShowRings}
            onFocusOffice={focusOffice}
            onSelectOffice={selectOffice}
          />
          <MapLegend
            tierCounts={tierCounts}
            tierPatients={tierPatients}
            maxFlowCount={data.maxFlowCount}
            activeTier={legendTier}
            onTierHover={setLegendTier}
            showDiscovered={showDiscovered}
            discoveredCounts={discoveredCounts}
            animatedFlows={animation.animatedFlows}
            totalFlows={animation.totalFlows}
            reducedMotion={animation.reducedMotion}
            compare={
              delta && comparison
                ? {
                    monthLabel:
                      comparison.monthCount > 1
                        ? `${formatYearMonth(comparison.months[0])} – ${formatYearMonth(
                            comparison.months[comparison.monthCount - 1],
                          )}`
                        : formatYearMonth(comparison.months[0]),
                    gained: delta.gained,
                    lost: delta.lost,
                  }
                : null
            }
          />
        </div>
      </div>

      {isMobile && (
        <Sheet open={Boolean(detail)} onOpenChange={(open) => !open && setSelected(null)}>
          <SheetContent side="bottom" className="max-h-[75vh] overflow-y-auto">
            {detail}
          </SheetContent>
        </Sheet>
      )}
    </div>
  );
}
