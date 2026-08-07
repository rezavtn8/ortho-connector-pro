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
import { FlowMapCanvas } from './FlowMapCanvas';
import { MapActionsBar } from './MapActionsBar';
import { MapFilterBar } from './MapFilterBar';
import { MapLegend } from './MapLegend';
import { MapStatsRow } from './MapStatsRow';
import { MonthScrubber, type Speed } from './MonthScrubber';
import { OfficeDetailPanel } from './OfficeDetailPanel';
import { ReachCard } from './ReachCard';
import { computeReachStats } from './reachStats';
import type { FlowTier, MapOffice } from './types';
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
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(initialOfficeId);
  const [legendTier, setLegendTier] = useState<FlowTier | null>(null);
  const [resetViewToken, setResetViewToken] = useState(0);
  const [animation, setAnimation] = useState<FlowAnimationState>({
    animatedFlows: 0,
    totalFlows: 0,
    reducedMotion: false,
  });
  const [hasFlownToInitial, setHasFlownToInitial] = useState(false);
  const [showRings, setShowRings] = useState(true);

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

  const visibleFlows = useMemo(() => {
    if (!data || !deferredMonth) return [];
    return (data.flowsByMonth[deferredMonth] ?? []).filter((f) => visibleIds.has(f.sourceId));
  }, [data, deferredMonth, visibleIds]);

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

  const patientsThisMonth = useMemo(
    () => visibleFlows.reduce((sum, f) => sum + f.count, 0),
    [visibleFlows],
  );

  const deltaVsPrevious = useMemo(() => {
    if (!data || safeIndex <= 0) return null;
    const previous = months[safeIndex - 1];
    if (!previous) return null;
    const previousTotal = (data.flowsByMonth[previous] ?? [])
      .filter((f) => visibleIds.has(f.sourceId))
      .reduce((sum, f) => sum + f.count, 0);
    return patientsThisMonth - previousTotal;
  }, [data, months, safeIndex, visibleIds, patientsThisMonth]);

  const selectedOffice: MapOffice | null = selectedId
    ? (officesById.get(selectedId) ?? null)
    : null;

  // Fly to a deep-linked office once its data has arrived.
  const flyToOffice = useMemo(() => {
    if (hasFlownToInitial || !initialOfficeId) return null;
    return officesById.get(initialOfficeId) ?? null;
  }, [hasFlownToInitial, initialOfficeId, officesById]);

  useEffect(() => {
    if (flyToOffice) setHasFlownToInitial(true);
  }, [flyToOffice]);

  // Hovering a legend tier highlights that tier's busiest office as a proxy.
  const focusId = useMemo(() => {
    if (hoverId) return hoverId;
    if (!legendTier) return null;
    const inTier = visibleFlows
      .map((f) => ({ flow: f, office: officesById.get(f.sourceId) }))
      .filter((x) => x.office?.tier === legendTier)
      .sort((a, b) => b.flow.count - a.flow.count);
    return inTier[0]?.office?.id ?? null;
  }, [hoverId, legendTier, visibleFlows, officesById]);

  useEffect(() => {
    onStateChange?.({
      month: activeMonth,
      tier: tierFilter,
      showDiscovered,
      groupId,
      officeId: selectedId,
    });
  }, [activeMonth, tierFilter, showDiscovered, groupId, selectedId, onStateChange]);

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
      onClose={() => setSelectedId(null)}
    />
  ) : null;

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in">
      <MapStatsRow
        month={activeMonth}
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
        discoveredCount={discovered.length}
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
              discovered={showDiscovered ? discovered : []}
              maxFlowCount={data.maxFlowCount}
              focusId={focusId}
              selectedId={selectedId}
              height={height}
              onHover={setHoverId}
              onSelect={setSelectedId}
              onAnimationState={handleAnimationState}
              resetViewToken={resetViewToken}
              flyToOffice={flyToOffice}
              styleOverride={styleOverride}
              showRings={showRings}
              ringRadii={reach.ringRadii}
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
              playing={playing}
              onPlayingChange={setPlaying}
              speed={speed}
              onSpeedChange={setSpeed}
              totalsByMonth={data.totalsByMonth}
              patientsThisMonth={patientsThisMonth}
            />
          </Card>

          {visibleOffices.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">
              No offices match these filters.
            </p>
          )}
        </div>

        <div className="order-0 lg:order-2 space-y-4">
          <ReachCard
            stats={reach}
            showRings={showRings}
            onShowRingsChange={setShowRings}
            onFocusOffice={setHoverId}
            onSelectOffice={setSelectedId}
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
          />
        </div>
      </div>

      {isMobile && (
        <Sheet open={Boolean(detail)} onOpenChange={(open) => !open && setSelectedId(null)}>
          <SheetContent side="bottom" className="max-h-[75vh] overflow-y-auto">
            {detail}
          </SheetContent>
        </Sheet>
      )}
    </div>
  );
}
