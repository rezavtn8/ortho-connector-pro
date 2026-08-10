import { useCallback, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { InsightsView, type InsightsState, type InsightsTab } from '@/components/insights/InsightsView';
import type { NetworkMode } from '@/components/insights/CircularNetworkChart';
import type { RadialMetric } from '@/components/insights/RadialBarChart';
import type { SankeyEndColumn } from '@/components/insights/SankeyChart';
import { COMPARE_OFFSETS, type CompareOffset } from '@/components/map/MonthScrubber';
import { WINDOW_SIZES, type WindowSize } from '@/components/map/timeWindow';

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

/** How long to wait after a control settles before touching the URL. */
const URL_DEBOUNCE_MS = 300;

const TABS: InsightsTab[] = ['network', 'radial', 'sankey'];

/**
 * Route wrapper for the Insights diagrams.
 *
 * Copies the discipline in `MapView`: every parameter is validated, an unrecognised
 * one is ignored rather than thrown, and writes are debounced and `replace`d. A stale
 * or hand-edited link degrades to the default view instead of a blank page, and
 * dragging the month slider does not push one history entry per month.
 */
export function Insights() {
  const [searchParams, setSearchParams] = useSearchParams();

  // Read once on mount. These seed the view's own state; afterwards the view is the
  // source of truth and writes back, so re-reading here would fight it.
  const initial = useRef<Partial<InsightsState>>({
    tab: (() => {
      const v = searchParams.get('tab');
      return v && (TABS as string[]).includes(v) ? (v as InsightsTab) : undefined;
    })(),
    mode: (() => {
      const v = searchParams.get('mode');
      return v === 'outreach' || v === 'movement' ? (v as NetworkMode) : undefined;
    })(),
    metric: (() => {
      const v = searchParams.get('metric');
      return v === 'patients' || v === 'change' ? (v as RadialMetric) : undefined;
    })(),
    endColumn: (() => {
      const v = searchParams.get('end');
      return v === 'clinic' || v === 'momentum' ? (v as SankeyEndColumn) : undefined;
    })(),
    month: (() => {
      const v = searchParams.get('month');
      return v && MONTH_PATTERN.test(v) ? v : undefined;
    })(),
    windowSize: (() => {
      const v = searchParams.get('window');
      if (v === 'all') return 'all' as WindowSize;
      const n = Number(v);
      return (WINDOW_SIZES as readonly (WindowSize | number)[]).includes(n)
        ? (n as WindowSize)
        : undefined;
    })(),
    baseline: (() => {
      const n = Number(searchParams.get('baseline'));
      return (COMPARE_OFFSETS as readonly number[]).includes(n) ? (n as CompareOffset) : undefined;
    })(),
  }).current;

  const timerRef = useRef<number | null>(null);

  const handleStateChange = useCallback(
    (state: InsightsState) => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);

      timerRef.current = window.setTimeout(() => {
        setSearchParams(
          (current) => {
            const next = new URLSearchParams(current);
            next.set('tab', state.tab);
            next.set('mode', state.mode);
            next.set('metric', state.metric);
            next.set('end', state.endColumn);
            next.set('window', String(state.windowSize));
            next.set('baseline', String(state.baseline));
            if (state.month) next.set('month', state.month);
            else next.delete('month');

            // Bail if nothing actually changed, so we do not loop on our own write.
            return next.toString() === current.toString() ? current : next;
          },
          { replace: true },
        );
      }, URL_DEBOUNCE_MS);
    },
    [setSearchParams],
  );

  const props = useMemo(() => ({ initial }), [initial]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-playfair text-2xl font-bold tracking-tight sm:text-3xl">Insights</h1>
        <p className="text-sm text-muted-foreground">
          The shape of your referral network — who sends patients, how you reach them, and where
          the volume comes from.
        </p>
      </div>
      <InsightsView {...props} onStateChange={handleStateChange} />
    </div>
  );
}
