/**
 * The Fingerprint matrix: every referring office against every month, in one grid.
 *
 * This is the descriptive counterpart to the analytical views. It makes no claim and
 * ranks nothing — it just shows the whole book at once, so patterns nobody thought to
 * query for are visible: the office that only refers in summer, the one that stopped
 * dead in March, the row that is solid for two years and the row that is three
 * scattered cells.
 *
 * Sorting and row derivation live here so they are testable; the component only maps
 * the result onto rects.
 *
 * Pure: no React, no DOM, no colors. Runs under `environment: "node"`.
 */

import type { FlowTier } from '@/lib/officeMetrics';

export interface FingerprintInput {
  id: string;
  name: string;
  tier: FlowTier;
  /** year_month -> patients. */
  monthly: Record<string, number>;
}

export type FingerprintSort = 'volume' | 'name' | 'recency' | 'consistency' | 'trend';

export interface FingerprintRow {
  id: string;
  name: string;
  tier: FlowTier;
  /** One entry per month on the axis, aligned to `months`. */
  cells: number[];
  total: number;
  /** Months with at least one referral, as a share of the axis. 0..1. */
  consistency: number;
  /** Index of the last month with a referral, or -1. */
  lastActiveIndex: number;
  /** Second half of the window minus the first, in patients per month. */
  trend: number;
  /** Largest single month, for a per-row scale. */
  peak: number;
}

export interface FingerprintLayout {
  months: string[];
  rows: FingerprintRow[];
  /** Group boundaries, in row order. */
  groups: Array<{ tier: FlowTier; startRow: number; count: number; total: number }>;
  /** Largest single cell across the whole grid — the shared colour domain. */
  max: number;
  /** Column totals, for the strip along the bottom. */
  columnTotals: number[];
  grandTotal: number;
}

const TIER_RANK: Record<FlowTier, number> = { VIP: 0, Warm: 1, Cold: 2, Dormant: 3 };

/**
 * Build the grid.
 *
 * Rows stay grouped by tier whatever the sort is. Sorting the whole grid by volume
 * alone produces a smooth gradient that looks tidy and hides the thing worth seeing —
 * that a VIP and a Dormant office can have almost the same total, and the difference
 * between them is *where* the ink sits along the row.
 */
export function layoutFingerprint(
  offices: readonly FingerprintInput[],
  months: readonly string[],
  sort: FingerprintSort = 'volume',
): FingerprintLayout {
  const axis = [...months];
  const rows: FingerprintRow[] = [];

  for (const office of offices ?? []) {
    if (!office?.id) continue;

    const cells = axis.map((m) => {
      const v = office.monthly?.[m];
      return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0;
    });

    let total = 0;
    let active = 0;
    let lastActiveIndex = -1;
    let peak = 0;
    for (let i = 0; i < cells.length; i++) {
      const v = cells[i];
      total += v;
      if (v > 0) {
        active++;
        lastActiveIndex = i;
        if (v > peak) peak = v;
      }
    }

    // Halves rather than a fitted slope: a slope is dominated by a single spike at
    // either end, and the question here is only "more lately, or less".
    const half = Math.floor(cells.length / 2);
    const early = cells.slice(0, half).reduce((a, b) => a + b, 0);
    const late = cells.slice(half).reduce((a, b) => a + b, 0);
    const trend = half > 0 ? late / (cells.length - half) - early / half : 0;

    rows.push({
      id: office.id,
      name: office.name,
      tier: office.tier,
      cells,
      total,
      consistency: axis.length ? active / axis.length : 0,
      lastActiveIndex,
      trend,
      peak,
    });
  }

  const compare: Record<FingerprintSort, (a: FingerprintRow, b: FingerprintRow) => number> = {
    volume: (a, b) => b.total - a.total,
    name: (a, b) => a.name.localeCompare(b.name),
    recency: (a, b) => b.lastActiveIndex - a.lastActiveIndex || b.total - a.total,
    consistency: (a, b) => b.consistency - a.consistency || b.total - a.total,
    trend: (a, b) => b.trend - a.trend || b.total - a.total,
  };
  const cmp = compare[sort] ?? compare.volume;

  rows.sort(
    (a, b) =>
      TIER_RANK[a.tier] - TIER_RANK[b.tier] ||
      cmp(a, b) ||
      // Every sort ends on the id, so equal rows keep a fixed order and the grid does
      // not reshuffle itself between renders.
      (a.id < b.id ? -1 : 1),
  );

  const groups: FingerprintLayout['groups'] = [];
  for (let i = 0; i < rows.length; i++) {
    const tier = rows[i].tier;
    const last = groups[groups.length - 1];
    if (last && last.tier === tier) {
      last.count++;
      last.total += rows[i].total;
    } else {
      groups.push({ tier, startRow: i, count: 1, total: rows[i].total });
    }
  }

  const columnTotals = axis.map((_, i) => rows.reduce((acc, r) => acc + r.cells[i], 0));
  let max = 0;
  for (const r of rows) if (r.peak > max) max = r.peak;

  return {
    months: axis,
    rows,
    groups,
    max,
    columnTotals,
    grandTotal: rows.reduce((acc, r) => acc + r.total, 0),
  };
}

/** `'2026-03'` -> `'Mar'`, and `'Jan'` gets its year so the axis stays readable. */
export function shortMonthLabel(ym: string): { label: string; isYearStart: boolean } {
  const [y, m] = ym.split('-');
  const index = Number(m) - 1;
  const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const label = names[index] ?? m;
  return { label: index === 0 ? `${label} ${y.slice(2)}` : label, isYearStart: index === 0 };
}
