import { useEffect, useMemo, useRef } from 'react';
import type { Momentum } from '@/lib/officeMetrics';
import { useIsMobile } from '@/hooks/use-mobile';
import type { DeltaSummary } from './deltaFlows';
import { SOURCES } from './flowLayers';
import {
  ArcCache,
  buildArcs,
  buildDeltaArcs,
  discoveredToFC,
  hubsToFC,
  officesToFC,
  ringsToFC,
  type DiscoveredPin,
} from './geojson';
import { useFlowAnimation, type FlowAnimationState } from './useFlowAnimation';
import { useFlowMap } from './useFlowMap';
import { useMapTheme } from './useMapTheme';
import type { Flow, Hub, MapFocus, MapOffice, MapTarget } from './types';

interface FlowMapCanvasProps {
  token: string;
  hubs: Hub[];
  /** Already filtered by search/tier — only these get dots and arcs. */
  offices: MapOffice[];
  /** Already aggregated over the active time window. */
  flows: Flow[];
  /** Months the flows cover, so widths can be expressed per month. */
  monthCount: number;
  discovered: DiscoveredPin[];
  maxFlowCount: number;
  /** What to emphasise, tracked independently per kind. */
  focus: MapFocus;
  height: string;
  onHover: (target: MapTarget | null) => void;
  onSelect: (target: MapTarget | null) => void;
  onAnimationState: (state: FlowAnimationState) => void;
  /** Bumping this re-fits the viewport to the data. */
  resetViewToken: number;
  /** When set, the map flies here once. */
  flyToOffice: MapOffice | null;
  /** Dev preview harness only: a self-contained basemap style. */
  styleOverride?: import('mapbox-gl').StyleSpecification;
  showRings: boolean;
  ringRadii: number[];
  /** Direction per office, drawn as a ring around the dot. */
  momentumById: ReadonlyMap<string, Momentum>;
  /**
   * When set, the map draws month-on-month change instead of a month's flows.
   * The arcs become gains and losses, and the particles stop — see `buildDeltaArcs`.
   */
  delta: DeltaSummary | null;
}

export function FlowMapCanvas({
  token,
  hubs,
  offices,
  flows,
  monthCount,
  discovered,
  maxFlowCount,
  focus,
  height,
  onHover,
  onSelect,
  onAnimationState,
  resetViewToken,
  flyToOffice,
  styleOverride,
  showRings,
  ringRadii,
  momentumById,
  delta,
}: FlowMapCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const theme = useMapTheme();
  const arcCacheRef = useRef(new ArcCache());

  const { mapRef, ready, setSourceData, setFocus, fitToData, flyTo } = useFlowMap({
    token,
    containerRef,
    theme,
    styleOverride,
    handlers: { onHover, onSelect },
  });

  const officesById = useMemo(() => new Map(offices.map((o) => [o.id, o])), [offices]);
  const hubsById = useMemo(() => new Map(hubs.map((h) => [h.id, h])), [hubs]);

  // Arc geometry is cached by office+hub, so scrubbing months only recomputes
  // widths — never the curves themselves. Compare mode reuses the very same cached
  // curves; only the properties hung off them change.
  const { featureCollection: arcsFC, arcs } = useMemo(
    () =>
      delta
        ? buildDeltaArcs(delta.flows, officesById, hubsById, delta.maxDelta, arcCacheRef.current)
        : buildArcs(flows, officesById, hubsById, maxFlowCount, arcCacheRef.current, monthCount),
    [delta, flows, monthCount, officesById, hubsById, maxFlowCount],
  );

  const hubsFC = useMemo(() => hubsToFC(hubs), [hubs]);
  const ringsFC = useMemo(
    () => (showRings ? ringsToFC(hubs, ringRadii) : { type: 'FeatureCollection' as const, features: [] }),
    [hubs, ringRadii, showRings],
  );
  const officesFC = useMemo(() => officesToFC(offices, momentumById), [offices, momentumById]);
  const discoveredFC = useMemo(() => discoveredToFC(discovered), [discovered]);

  // Keep the arc cache bounded to the offices that still exist.
  useEffect(() => {
    const live = new Set<string>();
    for (const o of offices) for (const h of hubs) live.add(`${o.id}|${h.id}`);
    arcCacheRef.current.prune(live);
  }, [offices, hubs]);

  // --- Data effects: one setData each, no map rebuild ------------------------
  useEffect(() => setSourceData(SOURCES.hubs, hubsFC), [hubsFC, setSourceData, ready]);
  useEffect(() => setSourceData(SOURCES.rings, ringsFC), [ringsFC, setSourceData, ready]);
  useEffect(() => setSourceData(SOURCES.offices, officesFC), [officesFC, setSourceData, ready]);
  useEffect(() => setSourceData(SOURCES.arcs, arcsFC), [arcsFC, setSourceData, ready]);
  useEffect(
    () => setSourceData(SOURCES.discovered, discoveredFC),
    [discoveredFC, setSourceData, ready],
  );

  // --- Focus: paint only ----------------------------------------------------
  useEffect(() => {
    setFocus(focus);
  }, [focus, setFocus]);

  // --- Fit bounds -----------------------------------------------------------
  useEffect(() => {
    if (!ready) return;
    const points: Array<[number, number]> = [
      ...hubs.map((h) => [h.longitude, h.latitude] as [number, number]),
      ...offices.map((o) => [o.longitude, o.latitude] as [number, number]),
    ];
    fitToData(points);
  }, [ready, hubs, offices, fitToData]);

  useEffect(() => {
    if (!ready || resetViewToken === 0) return;
    const points: Array<[number, number]> = [
      ...hubs.map((h) => [h.longitude, h.latitude] as [number, number]),
      ...offices.map((o) => [o.longitude, o.latitude] as [number, number]),
    ];
    fitToData(points, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetViewToken]);

  useEffect(() => {
    if (!ready || !flyToOffice) return;
    flyTo([flyToOffice.longitude, flyToOffice.latitude]);
  }, [ready, flyToOffice, flyTo]);

  // --- Particles ------------------------------------------------------------
  const animationState = useFlowAnimation({ mapRef, ready, arcs, containerRef, isMobile });

  useEffect(() => {
    onAnimationState(animationState);
  }, [animationState, onAnimationState]);

  return (
    <div
      ref={containerRef}
      className="w-full"
      style={{ height: isMobile ? '420px' : height }}
      aria-label="Map of referring offices and patient flow into your practice"
      role="application"
    />
  );
}
