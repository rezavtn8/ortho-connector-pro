/**
 * How referral volume becomes visual weight, and how tier colours reach Mapbox.
 *
 * Pure except for `readTierColors`, which reads CSS custom properties — Mapbox paint
 * properties can't reference CSS variables, so the tokens have to be resolved to
 * concrete colour strings at layer-install time and re-applied on theme change.
 */

import type { FlowTier } from './types';

/** Particle budget. `setData` cost is what bounds this, not the draw call. */
export const MAX_PARTICLES_DESKTOP = 400;
export const MAX_PARTICLES_MOBILE = 160;

/**
 * Normalized volume, 0..1.
 *
 * Square root rather than linear: a 60-a-month office reads about 3.5× a
 * 5-a-month one instead of 12×, so dominant flows stay dominant without
 * saturating the canvas and small flows stay above the visibility floor.
 *
 * `max` is the global maximum across *all* months, never the current month's —
 * per-month normalization makes every month look identical and destroys the
 * "the network grew" story the scrubber exists to tell.
 */
export function normalize(count: number, max: number): number {
  if (!(max > 0)) return 0;
  const u = Math.sqrt(Math.max(0, count) / max);
  return u > 1 ? 1 : u;
}

/** Stroke width in px at zoom 11. Floor keeps a 1-patient flow visible. */
export function widthFor(u: number): number {
  return 1.2 + 7.8 * u;
}

/** Particles on this arc. Floor of 1 means no flow is ever motionless. */
export function particlesFor(u: number): number {
  const n = Math.ceil(u * 8);
  return n < 1 ? 1 : n > 10 ? 10 : n;
}

/**
 * Progress per second — a full traversal takes ~16s at the low end, ~6s at the high.
 * Deliberately slow: fast dots read as noise, slow dots read as flow.
 */
export function speedFor(u: number): number {
  return 0.06 + 0.1 * u;
}

/** Particle radius in px at zoom 12. */
export function radiusFor(u: number): number {
  return 2 + 2 * u;
}

/** Cubic smoothstep, for the emerge/dissolve fade at the ends of each arc. */
export function smoothstep(edge0: number, edge1: number, x: number): number {
  if (edge1 === edge0) return x < edge0 ? 0 : 1;
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/** Dots emerge from the office and dissolve into the clinic. */
export function particleOpacity(progress: number): number {
  return smoothstep(0, 0.06, progress) * (1 - smoothstep(0.92, 1, progress));
}

export type TierColors = Record<FlowTier, string>;

/** Fallbacks if the CSS variables are missing (e.g. a detached test container). */
const FALLBACK_TIER_COLORS: TierColors = {
  VIP: 'hsl(265, 70%, 60%)',
  Warm: 'hsl(45, 85%, 55%)',
  Cold: 'hsl(200, 60%, 55%)',
  Dormant: 'hsl(210, 15%, 60%)',
};

const FALLBACK_HUB_COLOR = 'hsl(185, 75%, 35%)';

function cssVar(name: string, fallback: string): string {
  if (typeof window === 'undefined' || typeof getComputedStyle !== 'function') return fallback;
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  // Tokens are stored bare ("265 70% 60%"), the shadcn convention.
  return raw ? `hsl(${raw})` : fallback;
}

/**
 * Resolve the tier tokens to concrete colours.
 *
 * Must be re-read after a theme switch, since the same variable names resolve to
 * different values under `.dark`.
 */
export function readTierColors(): TierColors {
  return {
    VIP: cssVar('--tier-vip', FALLBACK_TIER_COLORS.VIP),
    Warm: cssVar('--tier-warm', FALLBACK_TIER_COLORS.Warm),
    Cold: cssVar('--tier-cold', FALLBACK_TIER_COLORS.Cold),
    Dormant: cssVar('--tier-dormant', FALLBACK_TIER_COLORS.Dormant),
  };
}

/** The practice's own locations use the brand teal, not an off-brand hardcoded blue. */
export function readHubColor(): string {
  return cssVar('--primary', FALLBACK_HUB_COLOR);
}

/**
 * Spread a fixed particle budget over the visible flows.
 *
 * Every flow gets at least one particle before any flow gets a second, so a
 * one-patient office is never silently motionless. The remainder is distributed by
 * normalized volume. If there are more flows than budget, the largest flows keep
 * their dots and the caller is told how many were left static — the legend surfaces
 * that rather than letting the truncation pass as "nothing is flowing here".
 */
export function allocateParticles(
  weights: readonly number[],
  budget: number,
): { counts: number[]; animatedFlows: number } {
  const n = weights.length;
  if (n === 0) return { counts: [], animatedFlows: 0 };

  if (n >= budget) {
    // Not enough budget for one each: give the largest flows a single dot.
    const order = weights
      .map((w, i) => ({ w, i }))
      .sort((a, b) => b.w - a.w)
      .slice(0, budget);
    const counts = new Array<number>(n).fill(0);
    for (const { i } of order) counts[i] = 1;
    return { counts, animatedFlows: order.length };
  }

  const counts = weights.map(() => 1);
  let remaining = budget - n;

  const desired = weights.map((u) => particlesFor(u) - 1);
  const totalDesired = desired.reduce((s, d) => s + d, 0);

  if (totalDesired > 0) {
    for (let i = 0; i < n && remaining > 0; i++) {
      const share = Math.min(desired[i], Math.round((desired[i] / totalDesired) * (budget - n)));
      const give = Math.min(share, remaining);
      counts[i] += give;
      remaining -= give;
    }
  }

  return { counts, animatedFlows: n };
}
