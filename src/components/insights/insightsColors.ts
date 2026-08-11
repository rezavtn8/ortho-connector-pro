/**
 * The only place an Insights chart writes a color.
 *
 * Two rules this file exists to enforce:
 *
 * 1. **`var()` does not resolve inside an SVG presentation attribute.** `fill="hsl(var(--tier-vip))"`
 *    renders black or nothing at all, depending on the browser, with no console error.
 *    Colors must go through the `style` prop — `style={{ fill: TIER_FILL.VIP }}` — where
 *    the value is real CSS and `var()` works. Nothing in `src/components/insights/`
 *    should carry a `fill=` or `stroke=` string attribute other than `"none"`.
 *
 * 2. **One palette per view.** The tier hues and the outreach hues were validated
 *    separately and collide when scored against each other (outreach orange sits on top
 *    of `--tier-warm`, outreach blue on top of `--tier-cold`). The "Outreach" view of
 *    the network chart therefore paints leaves neutral and carries tier identity in the
 *    labeled group arcs only; the "Tier movement" view uses tier colors and no outreach
 *    colors. Never both as comparable marks in one picture.
 *
 * Alpha composes for free here because the tokens are stored space-separated
 * (`265 70% 55%`), so `hsl(var(--tier-vip) / 0.35)` is valid CSS Color 4. Do *not*
 * reach for `flowScales.hslTokenToColor` — that exists solely because Mapbox's older
 * parser cannot read the space-separated form, and it is the wrong tool in a stylesheet.
 */

import type { FlowTier } from '@/lib/officeMetrics';
import type { OutreachChannel } from './outreach';

/** `hsl(var(--token))`, ready for a `style` prop. */
export function token(name: string): string {
  return `hsl(var(--${name}))`;
}

/** `hsl(var(--token) / a)` — the space-separated token form makes this work. */
export function alpha(name: string, a: number): string {
  return `hsl(var(--${name}) / ${a})`;
}

export const TIER_TOKENS: Readonly<Record<FlowTier, string>> = {
  VIP: 'tier-vip',
  Warm: 'tier-warm',
  Cold: 'tier-cold',
  Dormant: 'tier-dormant',
};

export const TIER_FILL: Readonly<Record<FlowTier, string>> = {
  VIP: token('tier-vip'),
  Warm: token('tier-warm'),
  Cold: token('tier-cold'),
  Dormant: token('tier-dormant'),
};

export type OutreachKey = OutreachChannel | 'none';

export const OUTREACH_TOKENS: Readonly<Record<OutreachKey, string>> = {
  visit: 'outreach-visit',
  campaign: 'outreach-campaign',
  email: 'outreach-email',
  none: 'outreach-none',
};

export const OUTREACH_FILL: Readonly<Record<OutreachKey, string>> = {
  visit: token('outreach-visit'),
  campaign: token('outreach-campaign'),
  email: token('outreach-email'),
  none: token('outreach-none'),
};

/**
 * Direction colors for the diverging radial view.
 *
 * Literal HSL, not tokens, and deliberately the same two values `flowScales.DIRECTION_COLORS`
 * uses on the map — gaining and losing carry fixed meaning, so they must not drift when
 * the brand palette is re-themed, and they must not read differently on two screens
 * describing the same movement. Both sit clear of `--tier-warm`'s orange.
 */
export const DIVERGING_FILL = {
  up: 'hsl(152, 62%, 46%)',
  down: 'hsl(2, 78%, 58%)',
  flat: token('muted-foreground'),
} as const;

/**
 * Sequential ramp for magnitude, light to dark. Five steps, one hue.
 *
 * Binned rather than continuous on purpose: a continuous ramp cannot be legended, and
 * an unlegended heatmap is a picture of a number nobody can read back. `heatStep`
 * returns the bin index so the same thresholds drive the cells and the key.
 */
export const HEAT_TOKENS: readonly string[] = ['heat-1', 'heat-2', 'heat-3', 'heat-4', 'heat-5'];

export const HEAT_FILL: readonly string[] = HEAT_TOKENS.map(token);

/**
 * Which heat bin a value falls in, or -1 for "nothing here".
 *
 * Zero is deliberately its own case rather than the lightest step: "no referrals this
 * month" and "one referral this month" are different facts, and a ramp that renders
 * them as neighbouring shades of the same blue asks the reader to distinguish them by
 * eye. Zero gets no fill at all.
 *
 * Bins are on a square-root scale of `max`. Referral counts are heavily skewed — one
 * office at forty a month and a long tail at one or two — so linear bins would put the
 * entire tail in bin 0 and leave three bins empty.
 */
export function heatStep(value: number, max: number): number {
  if (!(value > 0) || !Number.isFinite(value)) return -1;
  if (!(max > 0)) return 0;
  const t = Math.sqrt(Math.min(value, max) / max);
  return Math.min(HEAT_FILL.length - 1, Math.max(0, Math.ceil(t * HEAT_FILL.length) - 1));
}

/** The value thresholds the bins correspond to, for the legend. */
export function heatThresholds(max: number): number[] {
  if (!(max > 0)) return [];
  return HEAT_FILL.map((_, i) => Math.ceil(((i + 1) / HEAT_FILL.length) ** 2 * max));
}

/**
 * Momentum: a diverging green-to-red ramp for the direction states, plus one blue that
 * sits off that axis entirely for `new`.
 *
 * A first-ever referral is not a point on a good-to-bad scale, so it gets a hue that
 * is not on the scale. Sharing the neutral midpoint with `steady` was the first
 * attempt and it put two identical greys side by side on the chord ring, where the
 * only thing telling them apart was a label. Scored as a set of five, the worst
 * all-pairs separation is CVD 10.9 and normal-vision 15.5 — both clear.
 */
export const MOMENTUM_TOKENS: Readonly<Record<string, string>> = {
  rising: 'momentum-rising',
  new: 'momentum-new',
  steady: 'momentum-steady',
  slipping: 'momentum-slipping',
  quiet: 'momentum-quiet',
};

/** Neutral ink and surfaces, so no chart hardcodes a gray. */
export const CHART_INK = {
  axis: token('border'),
  grid: alpha('border', 0.8),
  label: token('muted-foreground'),
  strongLabel: token('foreground'),
  surface: token('card'),
  neutralMark: alpha('muted-foreground', 0.55),
} as const;
