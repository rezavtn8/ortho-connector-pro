import { useMemo, useState } from 'react';
import { InsightsBoard } from '../InsightsBoard';
import { makeInsightsFixture, SCENARIOS } from './insightsFixture';

/**
 * Dev-only harness for the Insights diagrams.
 *
 * Routed at `/__insights-preview` behind `import.meta.env.DEV`, so it is tree-shaken
 * out of production entirely. It renders the *real* `InsightsBoard` — not a copy of its
 * wiring — against synthetic data, which means the degenerate cases can be looked at in
 * a browser without a login, a Supabase project, or a practice that happens to have
 * two hundred offices on the books.
 *
 * The clock is pinned so the tier quartiles and MSLR thresholds are identical on every
 * reload and two screenshots can be compared.
 */

/** Pinned clock. Mid-month so the day-of-month phase in `asOfDate` is exercised. */
const NOW = new Date(2026, 7, 14, 12, 0, 0);

export default function InsightsPreview() {
  const [scenarioId, setScenarioId] = useState(SCENARIOS[0].id);
  const scenario = SCENARIOS.find((s) => s.id === scenarioId) ?? SCENARIOS[0];

  const data = useMemo(() => makeInsightsFixture(scenario.options, NOW), [scenario]);

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6">
      <div className="mx-auto max-w-6xl space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-playfair text-xl font-bold">Insights preview</h1>
          <select
            value={scenarioId}
            onChange={(e) => setScenarioId(e.target.value)}
            className="h-8 rounded-md border bg-card px-2 text-xs"
            aria-label="Scenario"
          >
            {SCENARIOS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
          <span className="text-xs text-muted-foreground">
            {data.offices.length} offices · {data.otherSources.length} other sources ·{' '}
            {data.months.length} months · {data.outreach.length} outreach events
          </span>
        </div>

        {data.offices.length === 0 ? (
          <p className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">
            No offices — the real page shows an empty-state card here instead of the board.
          </p>
        ) : (
          // Remounting on scenario change is deliberate: the board seeds its month
          // index once, and carrying an index from a 24-month axis onto a 3-month one
          // is exactly the stale-state bug the harness exists to catch.
          <InsightsBoard key={scenarioId} data={data} nowDate={NOW} />
        )}
      </div>
    </div>
  );
}
