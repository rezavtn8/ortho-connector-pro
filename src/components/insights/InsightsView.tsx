import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, Building2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { now } from '@/lib/dateSync';
import { useInsightsData } from '@/hooks/useInsightsData';
import { InsightsBoard, type InsightsState } from './InsightsBoard';

export type { InsightsState, InsightsTab } from './InsightsBoard';

interface InsightsViewProps {
  initial: Partial<InsightsState>;
  onStateChange?: (state: InsightsState) => void;
}

/** Reserves the board's height so the four states do not make the page jump. */
function StateCard({ children }: { children: React.ReactNode }) {
  return (
    <Card className="p-6">
      <div className="flex min-h-[22rem] items-center justify-center">
        <div className="space-y-2 text-center">{children}</div>
      </div>
    </Card>
  );
}

/**
 * Fetches the Insights data and renders the board, or the one state that applies.
 *
 * Split from `InsightsBoard` so the board can be rendered against fixtures in the dev
 * preview harness with no login. Everything below this line is loading, error and
 * empty handling — the diagrams themselves know nothing about React Query.
 */
export function InsightsView({ initial, onStateChange }: InsightsViewProps) {
  const { data, isLoading, isError, error, refetch, isFetching } = useInsightsData();
  const nowDate = useMemo(() => now(), []);

  if (isLoading) {
    return (
      <StateCard>
        <RefreshCw className="mx-auto h-8 w-8 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Loading your referral network…</p>
      </StateCard>
    );
  }

  if (isError) {
    return (
      <StateCard>
        <AlertCircle className="mx-auto h-10 w-10 text-muted-foreground" />
        <p className="font-medium">Could not load insights</p>
        <p className="text-sm text-muted-foreground">
          {error instanceof Error ? error.message : 'Something went wrong.'}
        </p>
        <Button size="sm" variant="secondary" onClick={() => refetch()}>
          Try again
        </Button>
      </StateCard>
    );
  }

  if (!data || data.offices.length === 0) {
    return (
      <StateCard>
        <Building2 className="mx-auto h-10 w-10 text-muted-foreground" />
        <p className="font-medium">No referring offices yet</p>
        <p className="text-sm text-muted-foreground">
          These views draw your referral network. Add the offices that send you patients and they
          will appear here.
        </p>
        <Button size="sm" asChild>
          <Link to="/offices">Go to Offices</Link>
        </Button>
      </StateCard>
    );
  }

  return (
    <InsightsBoard
      data={data}
      nowDate={nowDate}
      initial={initial}
      onStateChange={onStateChange}
      footnotes={
        <>
          {data.counts.deliveries > 0 && (
            <p>
              Campaign deliveries are visible only to whoever created them, so campaigns run by a
              teammate are not counted here.
            </p>
          )}
          {isFetching && <p>Refreshing…</p>}
        </>
      }
    />
  );
}
