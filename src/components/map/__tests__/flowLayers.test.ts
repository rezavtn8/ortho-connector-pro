// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { hslTokenToColor, readHubColor, readTierColors } from '../flowScales';
import { installLayers, LAYERS, SOURCES } from '../flowLayers';

/**
 * Regression tests for the bug that shipped a blank map.
 *
 * shadcn stores design tokens space-separated (`265 70% 55%`). Composing those into
 * `hsl(265 70% 55%)` produces CSS Color Level 4 syntax, which Mapbox GL cannot
 * parse. Worse, Mapbox does not throw on a bad paint value — it emits an error
 * event and silently declines to add the layer. Every arc, particle, office and hub
 * layer was rejected, leaving a basemap with nothing on it.
 *
 * These tests need no browser and no Mapbox token, so the class of failure is
 * caught in CI rather than by eye.
 */

/** Mapbox accepts the comma form only. Reject a bare-space `hsl(...)`. */
const CSS4_HSL = /hsla?\(\s*[\d.]+(deg)?\s+/;

function collectColorStrings(value: unknown, found: string[] = []): string[] {
  if (typeof value === 'string') {
    if (/^(hsla?|rgba?)\(/i.test(value) || /^#[0-9a-f]{3,8}$/i.test(value)) found.push(value);
    return found;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectColorStrings(item, found);
    return found;
  }
  if (value && typeof value === 'object') {
    for (const item of Object.values(value)) collectColorStrings(item, found);
  }
  return found;
}

/** Minimal Mapbox stand-in that records what installLayers tries to add. */
function makeFakeMap(glyphs?: string) {
  const layers = new Map<string, Record<string, unknown>>();
  const sources = new Set<string>();
  const images = new Set<string>();
  return {
    layers,
    sources,
    addSource: (id: string) => sources.add(id),
    getSource: (id: string) => (sources.has(id) ? {} : undefined),
    addLayer: (layer: { id: string }) => layers.set(layer.id, layer),
    getLayer: (id: string) => layers.get(id),
    setPaintProperty: () => {},
    addImage: (id: string) => images.add(id),
    hasImage: (id: string) => images.has(id),
    getStyle: () => ({ glyphs }),
  };
}

beforeEach(() => {
  document.documentElement.style.setProperty('--tier-vip', '265 70% 55%');
  document.documentElement.style.setProperty('--tier-warm', '35 90% 50%');
  document.documentElement.style.setProperty('--tier-cold', '200 65% 50%');
  document.documentElement.style.setProperty('--tier-dormant', '210 12% 62%');
  document.documentElement.style.setProperty('--primary', '185 75% 35%');

  // jsdom has no canvas backend; installLayers must tolerate a null context.
  HTMLCanvasElement.prototype.getContext = vi.fn(() => null) as never;
});

describe('hslTokenToColor', () => {
  it('converts a bare shadcn token to the comma form Mapbox needs', () => {
    expect(hslTokenToColor('265 70% 55%')).toBe('hsl(265, 70%, 55%)');
  });

  it('accepts an already-comma-separated token unchanged in meaning', () => {
    expect(hslTokenToColor('265, 70%, 55%')).toBe('hsl(265, 70%, 55%)');
  });

  it('adds missing percent signs', () => {
    expect(hslTokenToColor('265 70 55')).toBe('hsl(265, 70%, 55%)');
  });

  it('handles the slash-alpha form', () => {
    expect(hslTokenToColor('265 70% 55% / 0.4')).toBe('hsla(265, 70%, 55%, 0.4)');
  });

  it('returns null for junk so callers can fall back', () => {
    expect(hslTokenToColor('')).toBeNull();
    expect(hslTokenToColor('265 70%')).toBeNull();
    expect(hslTokenToColor('not a color')).toBeNull();
  });

  it('never emits CSS Color Level 4 syntax', () => {
    for (const token of ['265 70% 55%', '0 0% 0%', '185 75% 35% / 0.5']) {
      expect(hslTokenToColor(token)).not.toMatch(CSS4_HSL);
    }
  });
});

describe('resolved theme colours', () => {
  it('reads tier tokens in a Mapbox-parseable form', () => {
    const colors = readTierColors();
    for (const [tier, value] of Object.entries(colors)) {
      expect(value, `${tier} colour`).not.toMatch(CSS4_HSL);
      expect(value, `${tier} colour`).toMatch(/^hsla?\(/);
    }
  });

  it('reads the hub colour in a Mapbox-parseable form', () => {
    expect(readHubColor()).not.toMatch(CSS4_HSL);
  });

  it('falls back to a literal when the token is missing', () => {
    document.documentElement.style.removeProperty('--tier-vip');
    expect(readTierColors().VIP).not.toMatch(CSS4_HSL);
  });
});

describe('installLayers', () => {
  it('adds every source', () => {
    const map = makeFakeMap('https://example.com/{fontstack}/{range}.pbf');
    installLayers(map as never, readTierColors(), readHubColor());
    for (const id of Object.values(SOURCES)) {
      expect(map.sources.has(id), `source ${id}`).toBe(true);
    }
  });

  it('adds every layer when the style provides glyphs', () => {
    const map = makeFakeMap('https://example.com/{fontstack}/{range}.pbf');
    installLayers(map as never, readTierColors(), readHubColor());
    for (const id of Object.values(LAYERS)) {
      expect(map.layers.has(id), `layer ${id}`).toBe(true);
    }
  });

  it('skips only the text layers when the style has no glyphs', () => {
    // Every layer with a `text-field` needs glyphs — the office labels and the
    // catchment-ring mileage labels both. The prospect icons do not: they draw a
    // canvas image, so they must survive a glyph-less style.
    const textLayers: string[] = [LAYERS.officeLabel, LAYERS.ringLabels];

    const map = makeFakeMap(undefined);
    installLayers(map as never, readTierColors(), readHubColor());

    for (const id of textLayers) {
      expect(map.layers.has(id), `text layer ${id}`).toBe(false);
    }
    for (const id of Object.values(LAYERS)) {
      if (textLayers.includes(id)) continue;
      expect(map.layers.has(id), `layer ${id}`).toBe(true);
    }
  });

  it('emits no CSS Color Level 4 colour anywhere in any layer spec', () => {
    const map = makeFakeMap('https://example.com/{fontstack}/{range}.pbf');
    installLayers(map as never, readTierColors(), readHubColor());

    let checked = 0;
    for (const [id, layer] of map.layers) {
      for (const color of collectColorStrings(layer)) {
        checked++;
        expect(color, `layer "${id}" has a colour Mapbox cannot parse`).not.toMatch(CSS4_HSL);
      }
    }
    // Guard against the assertion silently checking nothing.
    expect(checked).toBeGreaterThan(5);
  });

  it('is idempotent, as style.load re-runs it after every setStyle', () => {
    const map = makeFakeMap('https://example.com/{fontstack}/{range}.pbf');
    installLayers(map as never, readTierColors(), readHubColor());
    const first = map.layers.size;
    installLayers(map as never, readTierColors(), readHubColor());
    expect(map.layers.size).toBe(first);
  });
});
