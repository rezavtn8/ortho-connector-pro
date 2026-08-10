import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { PATIENT_FLOW_QUERY_KEY } from '@/hooks/usePatientFlowData';
import { PatientFlowMap } from '../PatientFlowMap';
import { buildDiscoveredFixture, buildFixture, previewStyle } from './flowMapFixture';

/**
 * Mapbox GL v3 validates the access token against Mapbox's API and refuses to draw
 * anything without a real one — a placeholder will not do, even for a style with no
 * mapbox:// resources.
 *
 * Supply a public (pk.*) token via VITE_MAPBOX_PREVIEW_TOKEN in `.env.local`, which
 * is gitignored. Production never uses this path; it fetches the token from the
 * get-mapbox-token edge function.
 */
const PREVIEW_TOKEN = import.meta.env.VITE_MAPBOX_PREVIEW_TOKEN as string | undefined;

/**
 * Dev-only preview of the patient-flow map.
 *
 * Exists because the real page sits behind auth: without this there is no way to
 * actually look at the map while iterating on it, and the first version shipped
 * with a scrubber that opened on an empty month precisely because nobody could
 * see it. Seeds the React Query cache with a deterministic fixture and supplies a
 * token-free basemap, so this renders the genuine components — not a mock of them.
 *
 * Reachable at /__map-preview under `npm run dev`. Never registered in production.
 */
export default function FlowMapPreview() {
  const queryClient = useQueryClient();
  const [dark, setDark] = useState(true);

  const fixture = useMemo(() => buildFixture(), []);
  const prospects = useMemo(() => buildDiscoveredFixture(), []);

  // Seed synchronously during render so the hooks never fire a real request.
  useMemo(() => {
    queryClient.setQueryData(PATIENT_FLOW_QUERY_KEY, fixture);
    queryClient.setQueryData(['mapbox-token'], PREVIEW_TOKEN);
    queryClient.setQueryData(['discovered-offices', 'all'], prospects);
  }, [queryClient, fixture, prospects]);

  // With a real token the harness uses the genuine Mapbox basemap, so what is on
  // screen here is what ships. The offline style is only a fallback.
  const style = useMemo(() => (PREVIEW_TOKEN ? undefined : previewStyle(dark)), [dark]);

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-lg font-semibold">Flow map preview</h1>
          <p className="text-xs text-muted-foreground">
            Dev only · {fixture.offices.length} offices · {fixture.months.length} months ·
            fixture data
            {PREVIEW_TOKEN ? ' · live basemap' : ' · offline basemap (no token)'}
          </p>
        </div>
        {!PREVIEW_TOKEN && (
          <button
            type="button"
            onClick={() => setDark((d) => !d)}
            className="text-xs rounded-md border px-3 py-1.5 hover:bg-muted"
          >
            {dark ? 'Light canvas' : 'Dark canvas'}
          </button>
        )}
      </div>

      {!PREVIEW_TOKEN && (
        <p className="mb-3 text-xs rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-amber-900">
          No <code>VITE_MAPBOX_PREVIEW_TOKEN</code> in <code>.env.local</code> — showing a
          token-free placeholder basemap. Layers still render, but tiles and labels will not.
        </p>
      )}

      <PatientFlowMap height="620px" styleOverride={style} initialShowDiscovered />
    </div>
  );
}
