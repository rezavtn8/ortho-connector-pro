import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import mapboxgl from 'mapbox-gl';
import {
  applyColors,
  applyFocus,
  EMPTY_FC,
  installLayers,
  INTERACTIVE_LAYERS,
  LAYERS,
  SOURCES,
  type SourceId,
} from './flowLayers';
import { readHubColor, readTierColors } from './flowScales';
import 'mapbox-gl/dist/mapbox-gl.css';

const STYLES = {
  light: 'mapbox://styles/mapbox/light-v11',
  dark: 'mapbox://styles/mapbox/dark-v11',
} as const;

export interface FlowMapHandlers {
  onOfficeHover?: (id: string | null) => void;
  onOfficeClick?: (id: string) => void;
  onHubClick?: (id: string) => void;
  onBackgroundClick?: () => void;
}

export interface UseFlowMapOptions {
  token: string | null;
  containerRef: RefObject<HTMLDivElement>;
  theme: 'light' | 'dark';
  handlers: FlowMapHandlers;
}

/**
 * Owns the `mapboxgl.Map` instance.
 *
 * The central rule: **the map is constructed exactly once**, keyed only on the
 * access token. The previous implementation listed the office and flow arrays in
 * its effect dependencies; those arrays get fresh identities on every render, so
 * the entire WebGL context was torn down and rebuilt on every refetch, filter
 * toggle and data change. Everything here is instead a `setData` or a
 * `setPaintProperty` against the live instance.
 */
export function useFlowMap({ token, containerRef, theme, handlers }: UseFlowMapOptions) {
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [ready, setReady] = useState(false);
  const hasFitRef = useRef(false);

  /**
   * Latest data per source, held so it survives a style reload.
   *
   * `getSource()` returns undefined until the style has loaded, and `setStyle()`
   * discards every custom source. Buffering here and replaying on `style.load` is
   * what makes both cases safe.
   */
  const pendingRef = useRef<Record<SourceId, GeoJSON.FeatureCollection>>({
    [SOURCES.arcs]: EMPTY_FC,
    [SOURCES.particles]: EMPTY_FC,
    [SOURCES.offices]: EMPTY_FC,
    [SOURCES.hubs]: EMPTY_FC,
    [SOURCES.discovered]: EMPTY_FC,
  });

  // Handlers are registered once, so they must be read through a ref to avoid
  // capturing a stale closure.
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  const focusRef = useRef<string | null>(null);

  // --- Effect A: construct once ---------------------------------------------
  useEffect(() => {
    if (!token || !containerRef.current || mapRef.current) return;

    mapboxgl.accessToken = token;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: STYLES[theme],
      center: [-98.5, 39.8], // continental US; fitBounds takes over once data lands
      zoom: 3,
      attributionControl: true,
      cooperativeGestures: false,
    });

    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right');
    map.addControl(new mapboxgl.ScaleControl({ unit: 'imperial' }), 'bottom-left');

    // 'style.load', not 'load': it fires for the initial style AND after every
    // setStyle(), so switching theme re-installs sources and layers for free.
    map.on('style.load', () => {
      installLayers(map, readTierColors(), readHubColor());
      for (const [id, data] of Object.entries(pendingRef.current)) {
        (map.getSource(id) as mapboxgl.GeoJSONSource | undefined)?.setData(data);
      }
      applyFocus(map, focusRef.current);
      setReady(true);
    });

    const canvas = () => map.getCanvas();

    map.on('mousemove', LAYERS.officeDot, (e) => {
      const id = e.features?.[0]?.properties?.id;
      canvas().style.cursor = 'pointer';
      if (typeof id === 'string') handlersRef.current.onOfficeHover?.(id);
    });

    map.on('mouseleave', LAYERS.officeDot, () => {
      canvas().style.cursor = '';
      handlersRef.current.onOfficeHover?.(null);
    });

    map.on('click', LAYERS.officeDot, (e) => {
      const id = e.features?.[0]?.properties?.id;
      if (typeof id === 'string') {
        e.preventDefault();
        handlersRef.current.onOfficeClick?.(id);
      }
    });

    map.on('click', LAYERS.hubDot, (e) => {
      const id = e.features?.[0]?.properties?.id;
      if (typeof id === 'string') {
        e.preventDefault();
        handlersRef.current.onHubClick?.(id);
      }
    });

    map.on('click', (e) => {
      if (e.defaultPrevented) return;
      const hits = map.queryRenderedFeatures(e.point, {
        layers: INTERACTIVE_LAYERS.filter((l) => map.getLayer(l)),
      });
      if (hits.length === 0) handlersRef.current.onBackgroundClick?.();
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      hasFitRef.current = false;
      setReady(false);
    };
    // Token only. `theme` is handled by Effect B via setStyle, and `containerRef`
    // is a ref (stable by contract) — listing either here would reintroduce the
    // teardown-on-every-change bug this hook exists to fix.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // --- Effect B: theme ------------------------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;

    const current = map.getStyle()?.sprite;
    const want = STYLES[theme];
    // setStyle triggers 'style.load', which reinstalls layers and replays data.
    if (!current || !String(current).includes(theme)) {
      setReady(false);
      map.setStyle(want);
    } else {
      applyColors(map, readTierColors(), readHubColor());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme]);

  /** Buffer, then apply if the style is up. */
  const setSourceData = useCallback((id: SourceId, data: GeoJSON.FeatureCollection) => {
    pendingRef.current[id] = data;
    const map = mapRef.current;
    if (!map) return;
    const source = map.getSource(id) as mapboxgl.GeoJSONSource | undefined;
    source?.setData(data);
  }, []);

  const setFocus = useCallback((id: string | null) => {
    focusRef.current = id;
    const map = mapRef.current;
    if (map) applyFocus(map, id);
  }, []);

  const fitToData = useCallback((points: Array<[number, number]>, force = false) => {
    const map = mapRef.current;
    if (!map || points.length === 0) return;
    if (hasFitRef.current && !force) return;

    const bounds = new mapboxgl.LngLatBounds();
    for (const p of points) bounds.extend(p);

    map.fitBounds(bounds, {
      padding: { top: 60, bottom: 60, left: 60, right: 60 },
      maxZoom: 13,
      duration: force ? 800 : 0,
    });
    hasFitRef.current = true;
  }, []);

  const flyTo = useCallback((center: [number, number], zoom = 13) => {
    mapRef.current?.flyTo({ center, zoom, duration: 900, essential: true });
  }, []);

  return { mapRef, ready, setSourceData, setFocus, fitToData, flyTo };
}
