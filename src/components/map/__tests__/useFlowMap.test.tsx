// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createElement, useEffect, useRef, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';

// React only flushes effects synchronously inside act() when this is set.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// jsdom has no canvas backend. installLayers() guards against a null context
// (prospect rings are simply skipped), but stubbing it keeps that path exercised.
HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
  beginPath: vi.fn(),
  arc: vi.fn(),
  fill: vi.fn(),
  stroke: vi.fn(),
  setLineDash: vi.fn(),
  getImageData: () => ({ data: new Uint8ClampedArray(4 * 40 * 40) }),
})) as unknown as typeof HTMLCanvasElement.prototype.getContext;

/**
 * Regression test for the defect this rewrite exists to fix.
 *
 * The previous map listed the office and flow arrays in its effect dependencies.
 * Those arrays get fresh identities on every render, so the entire WebGL map was
 * destroyed and rebuilt on every refetch, filter toggle and month change. Here we
 * assert the opposite invariant directly: the Map constructor runs exactly once
 * while data churns underneath it, and updates arrive as `setData` instead.
 */

const constructorCalls = { count: 0 };
const setDataCalls: Array<{ source: string; features: number }> = [];
const setPaintCalls: Array<{ layer: string; prop: string }> = [];
const removeCalls = { count: 0 };
const addLayerCalls: string[] = [];
const setStyleCalls: string[] = [];

/** Features the fake map reports under the pointer, newest staging wins. */
let renderedHits: Array<{ layer: { id: string }; properties: { id: string } }> = [];
const stageHits = (...hits: Array<[layer: string, id: string]>) => {
  renderedHits = hits.map(([layer, id]) => ({ layer: { id: layer }, properties: { id } }));
};

/** The live fake, so a test can drive the map the way Mapbox itself would. */
let lastMap: FakeMap | null = null;
const rememberMap = (map: FakeMap) => {
  lastMap = map;
};

class FakeGeoJSONSource {
  constructor(public id: string) {}
  setData(data: GeoJSON.FeatureCollection) {
    setDataCalls.push({ source: this.id, features: data.features.length });
  }
}

class FakeMap {
  private handlers = new Map<string, Array<(e: unknown) => void>>();
  private sources = new Map<string, FakeGeoJSONSource>();
  private layers = new Set<string>();
  private images = new Set<string>();

  constructor(public options: Record<string, unknown>) {
    constructorCalls.count++;
    rememberMap(this);
    // Style loads asynchronously in the real thing; mirror that.
    queueMicrotask(() => this.fire('style.load'));
  }

  on(event: string, layerOrHandler: unknown, maybeHandler?: unknown) {
    const handler = (typeof layerOrHandler === 'function' ? layerOrHandler : maybeHandler) as (
      e: unknown,
    ) => void;
    const list = this.handlers.get(event) ?? [];
    list.push(handler);
    this.handlers.set(event, list);
  }

  fire(event: string, payload: unknown = {}) {
    for (const handler of this.handlers.get(event) ?? []) handler(payload);
  }

  addControl() {}
  addSource(id: string) {
    this.sources.set(id, new FakeGeoJSONSource(id));
  }
  getSource(id: string) {
    return this.sources.get(id);
  }
  addLayer(layer: { id: string }) {
    this.layers.add(layer.id);
    addLayerCalls.push(layer.id);
  }
  getLayer(id: string) {
    return this.layers.has(id) ? { id } : undefined;
  }
  setPaintProperty(layer: string, prop: string) {
    setPaintCalls.push({ layer, prop });
  }
  addImage(id: string) {
    this.images.add(id);
  }
  hasImage(id: string) {
    return this.images.has(id);
  }
  getStyle() {
    return { sprite: String(this.options.style) };
  }
  setStyle(style: string) {
    setStyleCalls.push(style);
    this.options.style = style;
    // A real setStyle discards every custom source and layer.
    this.layers.clear();
    this.sources.clear();
    queueMicrotask(() => this.fire('style.load'));
  }
  getZoom() {
    return 8;
  }
  getCanvas() {
    return { style: {} };
  }
  /** Tests stage overlapping pins here; the dispatcher must pick exactly one. */
  queryRenderedFeatures(_point?: unknown, options?: { layers?: string[] }) {
    const allowed = new Set(options?.layers ?? []);
    return renderedHits.filter((h) => allowed.has(h.layer.id));
  }
  fitBounds() {}
  flyTo() {}
  remove() {
    removeCalls.count++;
  }
}

class FakeLngLatBounds {
  extend() {
    return this;
  }
}

vi.mock('mapbox-gl', () => ({
  default: {
    accessToken: '',
    Map: FakeMap,
    NavigationControl: class {},
    ScaleControl: class {},
    LngLatBounds: FakeLngLatBounds,
  },
}));
vi.mock('mapbox-gl/dist/mapbox-gl.css', () => ({}));

const { useFlowMap } = await import('../useFlowMap');
const { SOURCES, ARC_LAYER_IDS, LAYERS } = await import('../flowLayers');

function makeFC(count: number): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: Array.from({ length: count }, (_, i) => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [i, i] },
      properties: { id: String(i) },
    })),
  };
}

/** Mirrors how FlowMapCanvas drives the hook: new FC identity each render. */
function Harness({
  arcCount,
  theme,
  handlers = {},
}: {
  arcCount: number;
  theme: 'light' | 'dark';
  handlers?: Parameters<typeof useFlowMap>[0]['handlers'];
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { setSourceData, ready } = useFlowMap({
    token: 'pk.test',
    containerRef: containerRef as never,
    theme,
    handlers,
  });

  useEffect(() => {
    setSourceData(SOURCES.arcs, makeFC(arcCount));
  }, [arcCount, setSourceData, ready]);

  return createElement('div', { ref: containerRef });
}

let container: HTMLDivElement;
let root: Root;
let unmounted = false;

beforeEach(() => {
  unmounted = false;
  constructorCalls.count = 0;
  removeCalls.count = 0;
  setDataCalls.length = 0;
  setPaintCalls.length = 0;
  addLayerCalls.length = 0;
  setStyleCalls.length = 0;
  lastMap = null;
  renderedHits = [];

  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  if (!unmounted) act(() => root.unmount());
  container.remove();
});

const render = async (node: ReactNode) => {
  await act(async () => {
    root.render(node);
    // Let the queued 'style.load' microtask land before assertions.
    await Promise.resolve();
    await Promise.resolve();
  });
};

describe('useFlowMap lifecycle', () => {
  it('constructs the map exactly once across many data changes', async () => {
    await render(createElement(Harness, { arcCount: 1, theme: 'light' }));
    expect(constructorCalls.count).toBe(1);

    // Simulate a scrubber drag / refetch churn: the data identity changes
    // repeatedly, which is precisely what used to rebuild the map.
    for (const n of [2, 3, 4, 5, 6, 7, 8]) {
      await render(createElement(Harness, { arcCount: n, theme: 'light' }));
    }

    expect(constructorCalls.count).toBe(1);
    expect(removeCalls.count).toBe(0);
  });

  it('pushes each data change through setData instead', async () => {
    await render(createElement(Harness, { arcCount: 1, theme: 'light' }));
    const before = setDataCalls.length;

    await render(createElement(Harness, { arcCount: 9, theme: 'light' }));

    const arcWrites = setDataCalls.slice(before).filter((c) => c.source === SOURCES.arcs);
    expect(arcWrites.length).toBeGreaterThan(0);
    expect(arcWrites.at(-1)?.features).toBe(9);
  });

  it('installs every source and layer once the style loads', async () => {
    await render(createElement(Harness, { arcCount: 1, theme: 'light' }));

    // Arcs are one gradient layer per tier: a Mapbox `line-gradient` can only read
    // `line-progress`, never `['get', 'tier']`, so the tier split lives in the
    // layer list. Every one of them has to be installed, not just the first.
    for (const id of ARC_LAYER_IDS) {
      expect(addLayerCalls, `arc layer ${id}`).toContain(id);
    }
    expect(addLayerCalls).toContain(LAYERS.arcGlow);
    expect(addLayerCalls).toContain(LAYERS.particles);
    expect(addLayerCalls).toContain(LAYERS.officeDot);
    expect(addLayerCalls).toContain(LAYERS.hubDot);
    expect(addLayerCalls).toContain(LAYERS.discovered);
    expect(addLayerCalls).toContain(LAYERS.rings);
  });

  it('buffers data written before the style has loaded, then replays it', async () => {
    // The very first setSourceData happens before 'style.load' fires. If it were
    // dropped rather than buffered, the map would come up empty.
    await render(createElement(Harness, { arcCount: 4, theme: 'light' }));
    const arcWrites = setDataCalls.filter((c) => c.source === SOURCES.arcs);
    expect(arcWrites.some((c) => c.features === 4)).toBe(true);
  });

  it('re-installs layers and replays data after a style reload', async () => {
    await render(createElement(Harness, { arcCount: 3, theme: 'light' }));
    addLayerCalls.length = 0;
    setDataCalls.length = 0;

    // A style reload wipes every custom source and layer. Drive it directly
    // rather than via the theme, which no longer reloads anything (see below).
    await act(async () => {
      lastMap!.setStyle('mapbox://styles/mapbox/satellite-v9');
      await Promise.resolve();
      await Promise.resolve();
    });

    // 'style.load' must bring the layers back and replay the buffered data.
    expect(addLayerCalls).toContain(ARC_LAYER_IDS[0]);
    expect(addLayerCalls).toContain(LAYERS.officeDot);
    expect(setDataCalls.some((c) => c.source === SOURCES.arcs && c.features === 3)).toBe(true);
    expect(constructorCalls.count).toBe(1);
    expect(removeCalls.count).toBe(0);
  });

  it('recolours in place on theme change instead of reloading the basemap', async () => {
    await render(createElement(Harness, { arcCount: 3, theme: 'light' }));
    setPaintCalls.length = 0;

    await render(createElement(Harness, { arcCount: 3, theme: 'dark' }));
    await act(async () => {
      await Promise.resolve();
    });

    // Both themes render on the same dark basemap, so a theme switch is a token
    // change only. Reloading the identical style would blank every layer and
    // rebuild it for no visual difference.
    expect(setStyleCalls).toEqual([]);
    expect(setPaintCalls.length).toBeGreaterThan(0);
    expect(constructorCalls.count).toBe(1);
    expect(removeCalls.count).toBe(0);
  });

  it('removes the map on unmount', async () => {
    await render(createElement(Harness, { arcCount: 1, theme: 'light' }));
    act(() => root.unmount());
    unmounted = true;
    expect(removeCalls.count).toBe(1);
  });
});

/**
 * The regression suite for prospects being a click sink.
 *
 * They were listed as interactive — which blocked the background dismiss — but had
 * no handler of their own, so clicking one did nothing at all: no panel, and not
 * even a dismissal of whatever was already open.
 */
describe('click dispatch', () => {
  const selections: Array<{ kind: string; id: string } | null> = [];

  const clickWith = async (...hits: Array<[string, string]>) => {
    selections.length = 0;
    await render(
      createElement(Harness, {
        arcCount: 1,
        theme: 'light',
        handlers: { onSelect: (t) => selections.push(t) },
      }),
    );
    stageHits(...hits);
    act(() => lastMap!.fire('click', { point: { x: 10, y: 10 } }));
  };

  it('opens a prospect when one is clicked', async () => {
    await clickWith(['discovered-offices-icon', 'prospect-1']);
    expect(selections).toEqual([{ kind: 'prospect', id: 'prospect-1' }]);
  });

  it('selects the referring office, not the prospect beneath it', async () => {
    // Two pins at the same address: an office you already track and the prospect it
    // was discovered as. The one drawn on top is the one the user aimed at.
    await clickWith(
      ['discovered-offices-icon', 'prospect-1'],
      ['network-offices-dot', 'office-1'],
    );
    expect(selections).toEqual([{ kind: 'office', id: 'office-1' }]);
  });

  it('selects your practice over anything sharing its coordinates', async () => {
    await clickWith(['network-offices-dot', 'office-1'], ['hub-dot', 'hub-1']);
    expect(selections).toEqual([{ kind: 'hub', id: 'hub-1' }]);
  });

  it('fires exactly once per click, never once per overlapping layer', async () => {
    await clickWith(
      ['hub-dot', 'hub-1'],
      ['network-offices-dot', 'office-1'],
      ['discovered-offices-icon', 'prospect-1'],
    );
    expect(selections).toHaveLength(1);
  });

  it('dismisses on a click that hits nothing', async () => {
    await clickWith();
    expect(selections).toEqual([null]);
  });

  it('ignores a hit with no id rather than selecting undefined', async () => {
    selections.length = 0;
    await render(
      createElement(Harness, {
        arcCount: 1,
        theme: 'light',
        handlers: { onSelect: (t) => selections.push(t) },
      }),
    );
    renderedHits = [{ layer: { id: 'network-offices-dot' }, properties: {} as never }];
    act(() => lastMap!.fire('click', { point: { x: 1, y: 1 } }));
    expect(selections).toEqual([null]);
  });

  it('reports hover targets and clears them when the pointer leaves', async () => {
    const hovers: Array<{ kind: string; id: string } | null> = [];
    await render(
      createElement(Harness, {
        arcCount: 1,
        theme: 'light',
        handlers: { onHover: (t) => hovers.push(t) },
      }),
    );

    stageHits(['discovered-offices-icon', 'prospect-1']);
    act(() => lastMap!.fire('mousemove', { point: { x: 5, y: 5 } }));
    expect(hovers.at(-1)).toEqual({ kind: 'prospect', id: 'prospect-1' });

    act(() => lastMap!.fire('mouseout', {}));
    expect(hovers.at(-1)).toBeNull();
  });

  it('resolves every interaction on the one map instance', async () => {
    await clickWith(['network-offices-dot', 'office-1']);
    act(() => lastMap!.fire('mousemove', { point: { x: 2, y: 2 } }));
    expect(constructorCalls.count).toBe(1);
    expect(removeCalls.count).toBe(0);
  });
});
