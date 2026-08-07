import { useEffect, useMemo, useRef } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import { SOURCES } from './flowLayers';
import {
  ArcCache,
  buildArcs,
  discoveredToFC,
  hubsToFC,
  officesToFC,
  ringsToFC,
  type DiscoveredPin,
} from './geojson';
import { useFlowAnimation, type FlowAnimationState } from './useFlowAnimation';
import { useFlowMap } from './useFlowMap';
import { useMapTheme } from './useMapTheme';
import type { Flow, Hub, MapOffice } from './types';

interface FlowMapCanvasProps {
  token: string;
  hubs: Hub[];
  /** Already filtered by search/tier — only these get dots and arcs. */
  offices: MapOffice[];
  flows: Flow[];
  discovered: DiscoveredPin[];
  maxFlowCount: number;
  focusId: string | null;
  selectedId: string | null;
  height: string;
  onHover: (id: string | null) => void;
  onSelect: (id: string | null) => void;
  onAnimationState: (state: FlowAnimationState) => void;
  /** Bumping this re-fits the viewport to the data. */
  resetViewToken: number;
  /** When set, the map flies here once. */
  flyToOffice: MapOffice | null;
  /** Dev preview harness only: a self-contained basemap style. */
  styleOverride?: import('mapbox-gl').StyleSpecification;
  showRings: boolean;
  ringRadii: number[];
}

export function FlowMapCanvas({
  token,
  hubs,
  offices,
  flows,
  discovered,
  maxFlowCount,
  focusId,
  selectedId,
  height,
  onHover,
  onSelect,
  onAnimationState,
  resetViewToken,
  flyToOffice,
  styleOverride,
  showRings,
  ringRadii,
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
    handlers: {
      onOfficeHover: onHover,
      onOfficeClick: onSelect,
      onBackgroundClick: () => onSelect(null),
    },
  });

  const officesById = useMemo(() => new Map(offices.map((o) => [o.id, o])), [offices]);
  const hubsById = useMemo(() => new Map(hubs.map((h) => [h.id, h])), [hubs]);

  // Arc geometry is cached by office+hub, so scrubbing months only recomputes
  // widths — never the curves themselves.
  const { featureCollection: arcsFC, arcs } = useMemo(
    () => buildArcs(flows, officesById, hubsById, maxFlowCount, arcCacheRef.current),
    [flows, officesById, hubsById, maxFlowCount],
  );

  const hubsFC = useMemo(() => hubsToFC(hubs), [hubs]);
  const ringsFC = useMemo(
    () => (showRings ? ringsToFC(hubs, ringRadii) : { type: 'FeatureCollection' as const, features: [] }),
    [hubs, ringRadii, showRings],
  );
  const officesFC = useMemo(() => officesToFC(offices), [offices]);
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
    setFocus(selectedId ?? focusId);
  }, [focusId, selectedId, setFocus]);

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
