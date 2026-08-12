// @vitest-environment jsdom
/**
 * Render smoke test for the Competitor Watch page.
 *
 * Everything on this page is derived — exposure, movement, ranks and the race
 * chart are all computed from three unrelated row sets — so a single bad read
 * takes the whole route down behind the error boundary while still building
 * and type-checking cleanly. This asserts the real component tree renders and
 * that the headline numbers reach the screen, in the populated, the empty and
 * the no-address states.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import type { CompetitorIntel } from '@/hooks/useCompetitorIntel';
import {
  buildSeries,
  computeExposure,
  detectMovements,
  latestByCompetitor,
  marketPosition,
  velocityPerWeek,
  weeksToCrossover,
  type Snapshot,
} from '@/lib/competitorIntel';

/**
 * recharts' ResponsiveContainer observes its box on mount and jsdom has no
 * ResizeObserver, so without this the chart throws and takes the page with it.
 * The stub never fires, which leaves the container at its zero fallback size —
 * fine here, because these assertions are about the surrounding copy.
 */
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
(globalThis as { ResizeObserver?: unknown }).ResizeObserver ??= ResizeObserverStub;

let intel: CompetitorIntel;

vi.mock('@/hooks/useCompetitorIntel', async () => {
  const actual = await vi.importActual<typeof import('@/hooks/useCompetitorIntel')>(
    '@/hooks/useCompetitorIntel',
  );
  return {
    ...actual,
    useCompetitorIntel: () => intel,
    useCompetitorActions: () => ({
      add: { mutate: vi.fn(), isPending: false },
      remove: { mutate: vi.fn(), isPending: false },
      refresh: { mutate: vi.fn(), isPending: false },
    }),
  };
});

// The add panel fetches suggestions of its own; the page test is not about it.
vi.mock('@/components/competitor/AddCompetitorPanel', () => ({
  AddCompetitorPanel: () => createElement('div', null, 'Add competitors'),
}));

const MILE_LAT = 1 / 69;
const CLINIC = {
  id: 'clinic-1',
  name: 'Cedar Orthodontics',
  address: '1 Main St',
  latitude: 34.0,
  longitude: -118.0,
  google_place_id: 'place-me',
  specialty: 'orthodontist',
};

/**
 * Build the page's props the way the hook does, so the test exercises the same
 * analysis path the app uses rather than hand-written display values.
 */
function buildIntel(over: Partial<CompetitorIntel> = {}): CompetitorIntel {
  const rivals = [
    {
      id: 'w-bright',
      google_place_id: 'place-bright',
      name: 'BrightSmile Ortho',
      address: '9 Oak Ave',
      // 3 miles north — closer to the office 4 miles north than we are.
      latitude: 34.0 + 3 * MILE_LAT,
      longitude: -118.0,
    },
  ];

  const snapshots: Snapshot[] = [
    { watchlist_id: 'me', snapshot_date: '2026-06-01', google_rating: 4.7, review_count: 380 },
    { watchlist_id: 'me', snapshot_date: '2026-08-10', google_rating: 4.7, review_count: 400 },
    { watchlist_id: 'w-bright', snapshot_date: '2026-06-01', google_rating: 4.5, review_count: 300 },
    { watchlist_id: 'w-bright', snapshot_date: '2026-08-10', google_rating: 4.9, review_count: 380 },
  ];

  const series = buildSeries(snapshots);
  const latest = latestByCompetitor(snapshots);
  const mySeries = series.get('me') ?? [];
  const mySnapshot = latest.get('me') ?? null;

  const offices = [
    { id: 'o-patel', name: 'Dr Patel DDS', latitude: 34.0 + 4 * MILE_LAT, longitude: -118.0 },
  ];
  const monthly = [
    { source_id: 'o-patel', year_month: '2026-08', patient_count: 2 },
    { source_id: 'o-patel', year_month: '2026-05', patient_count: 9 },
  ];

  const exposure = computeExposure({
    clinic: CLINIC,
    competitors: rivals,
    offices,
    monthly,
    latest,
    mine: mySnapshot,
    now: new Date(Date.UTC(2026, 7, 11)),
  });
  const stake = exposure.competitors[0];

  return {
    clinic: CLINIC,
    selfId: 'me',
    mySnapshot,
    mySeries,
    myVelocity: velocityPerWeek(mySeries),
    competitors: rivals.map((r) => ({
      ...r,
      specialty: null,
      rating: latest.get(r.id)?.google_rating ?? null,
      reviews: latest.get(r.id)?.review_count ?? 0,
      velocity: velocityPerWeek(series.get(r.id)),
      series: series.get(r.id) ?? [],
      crossoverWeeks: weeksToCrossover(mySeries, series.get(r.id)),
      contestedPatients: stake?.contestedPatients ?? 0,
      threat: stake?.threat ?? 0,
      lastSeen: latest.get(r.id)?.snapshot_date ?? null,
    })),
    exposure,
    movements: detectMovements({ competitors: rivals, series, selfId: 'me', mine: mySeries }),
    position: marketPosition(mySnapshot, [{ rating: 4.9, reviews: 380 }]),
    historyDays: 2,
    lastRefreshed: '2026-08-10',
    isLoading: false,
    error: null,
    ...over,
  };
}

let container: HTMLDivElement;
let root: Root;

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  intel = buildIntel();
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

async function render() {
  const { default: CompetitorWatch } = await import('@/pages/CompetitorWatch');
  await act(async () => {
    root.render(createElement(CompetitorWatch));
  });
}

describe('Competitor Watch page', () => {
  it('renders the practice, its exposure and its watchlist', async () => {
    await render();
    const text = container.textContent ?? '';

    expect(text).not.toContain('Something went wrong');
    expect(text).toContain('Competitor Watch');

    // Hero: our own standing and how fresh it is.
    expect(text).toContain('Cedar Orthodontics');
    expect(text).toContain('4.7');
    expect(text).toContain('400');
    expect(text).toContain('Rating rank');

    // Exposure: the office 4mi out is closer to BrightSmile than to us, and
    // its referrals fell 9 -> 2, so it is both contested and declining.
    expect(text).toContain('Contested referrals');
    expect(text).toContain('11 patients');
    expect(text).toContain('declining');
    expect(text).toContain('100%');

    // Movement: they climbed 4.5 -> 4.9 and crossed above our 4.7.
    expect(text).toContain('BrightSmile Ortho');
    expect(text).toContain('now outranks you on rating');

    expect(text).toContain('Watchlist (1)');
  });

  it('names the contested office when the exposure row is expanded', async () => {
    await render();

    const trigger = [...container.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('BrightSmile Ortho'),
    );
    expect(trigger).toBeDefined();

    await act(async () => {
      trigger!.click();
    });

    const text = container.textContent ?? '';
    expect(text).toContain('Dr Patel DDS');
    // Distances are stated both ways so the claim can be checked.
    expect(text).toContain('1.0 mi them');
    expect(text).toContain('4.0 mi you');
  });

  it('guides a first-run account with nothing tracked', async () => {
    intel = buildIntel({
      competitors: [],
      movements: [],
      exposure: {
        competitors: [],
        mappedPatients: 0,
        exposedPatients: 0,
        decliningPatients: 0,
        unmappedOffices: 0,
        exposedShare: 0,
      },
      position: null,
      historyDays: 0,
      lastRefreshed: null,
    });

    await render();
    const text = container.textContent ?? '';

    expect(text).not.toContain('Something went wrong');
    expect(text).toContain('No competitors tracked yet');
    expect(text).toContain('Never refreshed');
    expect(text).toContain('Watchlist (0)');
  });

  it('explains itself rather than showing zeroes when the clinic has no address', async () => {
    intel = buildIntel({
      clinic: { ...CLINIC, latitude: null, longitude: null },
      exposure: {
        competitors: [],
        mappedPatients: 0,
        exposedPatients: 0,
        decliningPatients: 0,
        unmappedOffices: 0,
        exposedShare: 0,
      },
    });

    await render();
    const text = container.textContent ?? '';

    expect(text).not.toContain('Something went wrong');
    expect(text).toContain('Set your practice address first');
  });

  it('does not claim a trend it cannot draw', async () => {
    intel = buildIntel({ mySeries: [], competitors: [], historyDays: 1, movements: [] });

    await render();
    const text = container.textContent ?? '';

    expect(text).toContain('Not enough history yet');
    expect(text).toContain('Nothing to compare against yet');
  });
});
