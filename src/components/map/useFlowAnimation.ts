import { useEffect, useRef, useState, type RefObject } from 'react';
import type mapboxgl from 'mapbox-gl';
import { pointOnArc } from './arcGeometry';
import {
  allocateParticles,
  MAX_PARTICLES_DESKTOP,
  MAX_PARTICLES_MOBILE,
  particleOpacity,
  radiusFor,
  speedFor,
} from './flowScales';
import { SOURCES } from './flowLayers';
import type { ArcBuildResult } from './geojson';

/** 30fps. The bound is `setData` cost (serialize -> worker -> re-tile), not drawing. */
const FRAME_MS = 33;

interface Particle {
  flow: number;
  /** Even spacing within its own arc, plus a per-arc offset so arcs aren't in lockstep. */
  phase: number;
}

export interface FlowAnimationState {
  /** Flows that actually have moving dots — fewer than total when the budget is hit. */
  animatedFlows: number;
  totalFlows: number;
  reducedMotion: boolean;
}

/** Golden-ratio offset gives a well-spread, fully deterministic phase per arc. */
const phaseForArc = (i: number) => (i * 0.6180339887) % 1;

/**
 * Drives the traveling dots.
 *
 * Technique: one `requestAnimationFrame` loop that mutates a preallocated
 * FeatureCollection in place and pushes it with `setData` at most 30 times a second.
 *
 * Rejected alternative: animating `line-dasharray` ("marching ants"). It cannot be a
 * data-driven expression, so per-flow speed and density — the entire point of
 * encoding volume as motion — are impossible, and dash units are relative to line
 * width, so apparent speed would drift with volume and zoom.
 *
 * The loop reads everything through refs and is started once, so changing month,
 * filter or hover never restarts it and never captures a stale closure.
 */
export function useFlowAnimation({
  mapRef,
  ready,
  arcs,
  containerRef,
  isMobile,
}: {
  mapRef: RefObject<mapboxgl.Map | null>;
  ready: boolean;
  arcs: ArcBuildResult['arcs'];
  containerRef: RefObject<HTMLDivElement>;
  isMobile: boolean;
}): FlowAnimationState {
  const budget = isMobile ? MAX_PARTICLES_MOBILE : MAX_PARTICLES_DESKTOP;

  const arcsRef = useRef(arcs);
  const particlesRef = useRef<Particle[]>([]);
  const fcRef = useRef<GeoJSON.FeatureCollection>({ type: 'FeatureCollection', features: [] });
  const rafRef = useRef<number | null>(null);
  const tRef = useRef(0);
  const lastEmitRef = useRef(0);

  const [state, setState] = useState<FlowAnimationState>({
    animatedFlows: 0,
    totalFlows: 0,
    reducedMotion: false,
  });

  const reducedMotionRef = useRef(false);
  const visibleRef = useRef(true);
  const onScreenRef = useRef(true);

  // --- Particle pool ---------------------------------------------------------
  useEffect(() => {
    arcsRef.current = arcs;

    const { counts, animatedFlows } = allocateParticles(
      arcs.map((a) => a.u),
      budget,
    );

    const particles: Particle[] = [];
    for (let i = 0; i < arcs.length; i++) {
      const n = counts[i];
      for (let k = 0; k < n; k++) {
        particles.push({ flow: i, phase: (k / n + phaseForArc(i)) % 1 });
      }
    }
    particlesRef.current = particles;

    // Grow the feature pool to the high-water mark and reuse the objects. Features
    // are mutated in place each frame; `features.length` is truncated rather than
    // reallocated, so the loop does no per-frame allocation.
    const feats = fcRef.current.features;
    while (feats.length < particles.length) {
      feats.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [0, 0] },
        properties: { o: 0, r: 2, tier: 'Cold', sourceId: '' },
      });
    }

    setState({
      animatedFlows,
      totalFlows: arcs.length,
      reducedMotion: reducedMotionRef.current,
    });
  }, [arcs, budget]);

  // --- The loop --------------------------------------------------------------
  useEffect(() => {
    if (!ready) return;

    const tmp: [number, number] = [0, 0];

    const source = () =>
      mapRef.current?.getSource(SOURCES.particles) as mapboxgl.GeoJSONSource | undefined;

    /** Push whatever is currently in the FC. */
    const flush = (count: number) => {
      fcRef.current.features.length = count;
      source()?.setData(fcRef.current);
    };

    /**
     * Reduced motion: dots still convey volume as density, they just don't move.
     * Rendered once rather than animated.
     */
    const renderStatic = () => {
      const particles = particlesRef.current;
      const currentArcs = arcsRef.current;
      const feats = fcRef.current.features;

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        const arc = currentArcs[p.flow];
        if (!arc) continue;
        pointOnArc(arc.coords, p.phase, tmp);
        const geom = feats[i].geometry as GeoJSON.Point;
        geom.coordinates[0] = tmp[0];
        geom.coordinates[1] = tmp[1];
        feats[i].properties!.o = 0.75;
        feats[i].properties!.r = radiusFor(arc.u);
        feats[i].properties!.tier = arc.tier;
        feats[i].properties!.sourceId = arc.sourceId;
      }
      flush(particles.length);
    };

    const frame = (nowMs: number) => {
      rafRef.current = requestAnimationFrame(frame);

      const elapsed = nowMs - lastEmitRef.current;
      if (elapsed < FRAME_MS) return;
      lastEmitRef.current = nowMs;

      // Clamp dt so a long stall (tab wake, GC pause) doesn't teleport every dot.
      tRef.current += Math.min(elapsed, 100) / 1000;

      const particles = particlesRef.current;
      const currentArcs = arcsRef.current;
      const feats = fcRef.current.features;
      const t = tRef.current;

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        const arc = currentArcs[p.flow];
        if (!arc) continue;

        const progress = (t * speedFor(arc.u) + p.phase) % 1;
        pointOnArc(arc.coords, progress, tmp);

        const geom = feats[i].geometry as GeoJSON.Point;
        geom.coordinates[0] = tmp[0];
        geom.coordinates[1] = tmp[1];

        const props = feats[i].properties!;
        props.o = particleOpacity(progress);
        props.r = radiusFor(arc.u);
        props.tier = arc.tier;
        props.sourceId = arc.sourceId;
      }

      flush(particles.length);
    };

    const stop = () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };

    const start = () => {
      if (rafRef.current !== null) return;
      // Reset the clock so time doesn't appear to have passed while paused.
      lastEmitRef.current = performance.now();
      rafRef.current = requestAnimationFrame(frame);
    };

    const sync = () => {
      if (reducedMotionRef.current) {
        stop();
        renderStatic();
        return;
      }
      if (visibleRef.current && onScreenRef.current) {
        start();
      } else {
        stop();
        flush(0); // clear, so nothing sits frozen mid-arc
      }
    };

    // prefers-reduced-motion, live-updating
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    reducedMotionRef.current = mql.matches;
    const onMotionChange = () => {
      reducedMotionRef.current = mql.matches;
      setState((s) => ({ ...s, reducedMotion: mql.matches }));
      sync();
    };
    mql.addEventListener('change', onMotionChange);

    const onVisibility = () => {
      visibleRef.current = document.visibilityState === 'visible';
      sync();
    };
    document.addEventListener('visibilitychange', onVisibility);

    // A local observer rather than the shared useIntersectionObserver hook, which
    // defaults to triggerOnce and would never report the map leaving the viewport.
    let observer: IntersectionObserver | null = null;
    const node = containerRef.current;
    if (node && typeof IntersectionObserver !== 'undefined') {
      observer = new IntersectionObserver(
        (entries) => {
          onScreenRef.current = entries.some((e) => e.isIntersecting);
          sync();
        },
        { threshold: 0.01 },
      );
      observer.observe(node);
    }

    sync();

    return () => {
      stop();
      mql.removeEventListener('change', onMotionChange);
      document.removeEventListener('visibilitychange', onVisibility);
      observer?.disconnect();
    };
  }, [ready, mapRef, containerRef]);

  // Re-render statics immediately when the flow set changes under reduced motion.
  useEffect(() => {
    if (!ready || !reducedMotionRef.current) return;
    const source = mapRef.current?.getSource(SOURCES.particles) as
      | mapboxgl.GeoJSONSource
      | undefined;
    if (!source) return;

    const tmp: [number, number] = [0, 0];
    const feats = fcRef.current.features;
    const particles = particlesRef.current;

    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      const arc = arcs[p.flow];
      if (!arc) continue;
      pointOnArc(arc.coords, p.phase, tmp);
      const geom = feats[i].geometry as GeoJSON.Point;
      geom.coordinates[0] = tmp[0];
      geom.coordinates[1] = tmp[1];
      feats[i].properties!.o = 0.75;
      feats[i].properties!.r = radiusFor(arc.u);
      feats[i].properties!.tier = arc.tier;
      feats[i].properties!.sourceId = arc.sourceId;
    }
    feats.length = particles.length;
    source.setData(fcRef.current);
  }, [arcs, ready, mapRef]);

  return state;
}
