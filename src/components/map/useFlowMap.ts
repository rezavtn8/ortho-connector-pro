import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import mapboxgl from 'mapbox-gl';
import {
  applyColors,
  applyFocus,
  EMPTY_FC,
  installLayers,
  INTERACTIVE_LAYERS,
  LAYER_TARGET_KIND,
  SOURCES,
  type SourceId,
} from './flowLayers';
import { readHubColor, readTierColors } from './flowScales';
import { NO_FOCUS, type MapFocus, type MapTarget } from './types';
import 'mapbox-gl/dist/mapbox-gl.css';

/**
 * The flow map is a data-visualisation surface, not a wayfinding map, so it uses a
 * dark basemap in both app themes: glowing tier-coloured arcs and particles need to
 * be the brightest thing on screen, and on a light basemap they have to fight the
 * streets for contrast. Roads and labels stay as recessed context.
 */
const STYLES = {
  light: 'mapbox://styles/mapbox/dark-v11',
  dark: 'mapbox://styles/mapbox/dark-v11',
} as const;

export interface FlowMapHandlers {
  /** Null when the pointer leaves every interactive pin. */
  onHover?: (target: MapTarget | null) => void;
  /** Null when the click landed on empty map, which dismisses the panel. */
  onSelect?: (target: MapTarget | null) => void;
}

export interface UseFlowMapOptions {
  token: string | null;
  containerRef: RefObject<HTMLDivElement>;
  theme: 'light' | 'dark';
  handlers: FlowMapHandlers;
  /**
   * Replaces the Mapbox basemap style.
   *
   * Used by the dev preview harness, which supplies a self-contained style object
   * so the map renders without a Mapbox account. Undefined in the app.
   */
  styleOverride?: mapboxgl.StyleSpecification;
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
export function useFlowMap({
  token,
  containerRef,
  theme,
  handlers,
  styleOverride,
}: UseFlowMapOptions) {
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [ready, setReady] = useState(false);
  const hasFitRef = useRef(false);

  /**
   * The basemap URL currently on the map, so the theme effect can tell whether a
   * reload is actually needed.
   *
   * Tracked here rather than sniffed back out of `getStyle()`: the style object
   * reports its sprite (`mapbox://sprites/mapbox/dark-v11`), not the URL it was
   * loaded from, so any comparison against `STYLES[theme]` is a string coincidence.
   * It stopped being one the moment both themes started pointing at the dark
   * basemap — matching "light" against a dark sprite failed, and every switch to
   * the light theme reloaded the identical style, blanking and rebuilding every
   * layer for no visual change.
   */
  const appliedStyleRef = useRef<string | null>(null);

  /**
   * Latest data per source, held so it survives a style reload.
   *
   * `getSource()` returns undefined until the style has loaded, and `setStyle()`
   * discards every custom source. Buffering here and replaying on `style.load` is
   * what makes both cases safe.
   */
  // Derived from SOURCES rather than listed by hand, so adding a source can't
  // silently leave it without a replay slot.
  const pendingRef = useRef<Record<SourceId, GeoJSON.FeatureCollection>>(
    Object.fromEntries(Object.values(SOURCES).map((id) => [id, EMPTY_FC])) as Record<
      SourceId,
      GeoJSON.FeatureCollection
    >,
  );

  // Handlers are registered once, so they must be read through a ref to avoid
  // capturing a stale closure.
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  const focusRef = useRef<MapFocus>(NO_FOCUS);

  // --- Effect A: construct once ---------------------------------------------
  useEffect(() => {
    if (!token || !containerRef.current || mapRef.current) return;

    mapboxgl.accessToken = token;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: styleOverride ?? STYLES[theme],
      center: [-98.5, 39.8], // continental US; fitBounds takes over once data lands
      zoom: 3,
      attributionControl: true,
      cooperativeGestures: false,
    });

    // The preview harness supplies its own style object; leave the ref null so a
    // later theme change is treated as "not what's loaded" and skipped outright.
    appliedStyleRef.current = styleOverride ? null : STYLES[theme];

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

    /**
     * Resolve the single thing a pointer event refers to.
     *
     * One query over every interactive layer, then an explicit priority choice —
     * rather than a `map.on(event, layer, ...)` per layer. Per-layer handlers fire
     * once *each* for overlapping pins, in registration order, and the previous
     * version leaned on `preventDefault` to suppress a separate background handler.
     * That arrangement is how prospects ended up as a click sink: they were listed
     * as interactive, which blocked the background dismiss, but had no handler of
     * their own, so a click on one did nothing whatsoever. With a single dispatcher
     * there is exactly one outcome per click and nothing to keep in sync.
     */
    const pick = (point: mapboxgl.Point): MapTarget | null => {
      const layers = INTERACTIVE_LAYERS.filter((id) => map.getLayer(id));
      if (layers.length === 0) return null;

      let best: MapTarget | null = null;
      let bestRank = Number.POSITIVE_INFINITY;

      for (const hit of map.queryRenderedFeatures(point, { layers })) {
        const layerId = hit.layer?.id;
        const id = hit.properties?.id;
        if (typeof layerId !== 'string' || typeof id !== 'string') continue;

        // INTERACTIVE_LAYERS is ordered topmost-first, so the lowest rank wins.
        const rank = INTERACTIVE_LAYERS.indexOf(layerId);
        const kind = LAYER_TARGET_KIND[layerId];
        // An interactive layer with no kind mapping is skipped rather than
        // dispatched as `undefined`, so a half-added layer cannot open a blank panel.
        if (rank < 0 || rank >= bestRank || !kind) continue;

        bestRank = rank;
        best = { kind, id };
      }

      return best;
    };

    map.on('mousemove', (e) => {
      const target = pick(e.point);
      canvas().style.cursor = target ? 'pointer' : '';
      handlersRef.current.onHover?.(target);
    });

    // Leaving the canvas entirely never produces a mousemove, so clear explicitly.
    map.on('mouseout', () => {
      canvas().style.cursor = '';
      handlersRef.current.onHover?.(null);
    });

    map.on('click', (e) => {
      handlersRef.current.onSelect?.(pick(e.point));
    });

    mapRef.current = map;

    // Dev-only handle so the preview harness (and the console) can inspect the
    // live map — query rendered features, project coordinates, check layer state.
    // Stripped from production builds along with the branch.
    if (import.meta.env.DEV) {
      (window as unknown as { __flowMap?: mapboxgl.Map }).__flowMap = map;
    }

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
    if (!map || !ready || styleOverride) return;

    const want = STYLES[theme];
    // Both themes currently resolve to the same basemap, so this is the usual
    // path: the tokens have changed underneath us, but the tiles have not.
    if (appliedStyleRef.current === want) {
      applyColors(map, readTierColors(), readHubColor());
      return;
    }

    // setStyle triggers 'style.load', which reinstalls layers and replays data.
    appliedStyleRef.current = want;
    setReady(false);
    map.setStyle(want);
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

  const setFocus = useCallback((focus: MapFocus) => {
    focusRef.current = focus;
    const map = mapRef.current;
    if (map) applyFocus(map, focus);
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
