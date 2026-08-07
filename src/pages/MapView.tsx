import { useCallback, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PatientFlowMap } from '@/components/map/PatientFlowMap';
import { isFlowTier, type FlowTier } from '@/components/map/types';

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** How long to wait after a scrubber drag settles before touching the URL. */
const URL_DEBOUNCE_MS = 300;

/**
 * Route wrapper for the patient-flow map.
 *
 * Parses deep links and mirrors map state back into the query string. Every value
 * is validated — an unrecognised one is ignored rather than thrown, so a stale or
 * hand-edited link degrades to the default view instead of a blank page.
 */
export function MapView() {
  const [searchParams, setSearchParams] = useSearchParams();

  // Read once on mount. These seed the map's own state; afterwards the map is the
  // source of truth and writes back, so re-reading here would fight it.
  const initial = useRef({
    showDiscovered:
      searchParams.get('showDiscovered') === 'true' || searchParams.get('discovered') === 'true',
    groupId: (() => {
      const value = searchParams.get('group');
      return value && UUID_PATTERN.test(value) ? value : null;
    })(),
    // Case-insensitive so ?tier=vip works. This is what makes the "View on map"
    // action on the Offices page actually filter — previously the param was
    // written by TierQuickActions but never read here.
    tier: (() => {
      const raw = searchParams.get('tier');
      if (!raw) return null;
      const normalized = raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
      return isFlowTier(normalized) ? (normalized as FlowTier) : null;
    })(),
    month: (() => {
      const value = searchParams.get('month');
      return value && MONTH_PATTERN.test(value) ? value : null;
    })(),
    officeId: (() => {
      const value = searchParams.get('office');
      return value && UUID_PATTERN.test(value) ? value : null;
    })(),
  }).current;

  const timerRef = useRef<number | null>(null);

  const handleStateChange = useCallback(
    (state: {
      month: string | null;
      tier: FlowTier | null;
      showDiscovered: boolean;
      groupId: string | null;
      officeId: string | null;
    }) => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);

      timerRef.current = window.setTimeout(() => {
        setSearchParams(
          (current) => {
            const next = new URLSearchParams(current);

            const set = (key: string, value: string | null) => {
              if (value) next.set(key, value);
              else next.delete(key);
            };

            set('month', state.month);
            set('tier', state.tier);
            set('group', state.groupId);
            set('office', state.officeId);
            next.delete('discovered'); // collapse the legacy spelling
            set('showDiscovered', state.showDiscovered ? 'true' : null);

            // Bail if nothing actually changed, so we don't loop on our own write.
            return next.toString() === current.toString() ? current : next;
          },
          // `replace` matters: without it a single scrubber drag pushes one history
          // entry per month and the back button becomes unusable.
          { replace: true },
        );
      }, URL_DEBOUNCE_MS);
    },
    [setSearchParams],
  );

  const props = useMemo(
    () => ({
      initialShowDiscovered: initial.showDiscovered,
      initialGroupId: initial.groupId,
      initialTier: initial.tier,
      initialMonth: initial.month,
      initialOfficeId: initial.officeId,
    }),
    [initial],
  );

  return <PatientFlowMap height="620px" {...props} onStateChange={handleStateChange} />;
}
