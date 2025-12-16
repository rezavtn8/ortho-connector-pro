import { useSearchParams } from 'react-router-dom';
import { useMemo } from 'react';
import { useOffices } from '@/hooks/useOffices';

interface OfficeContext {
  officeIds: string[];
  tierFilter: string | null;
  sourceContext: string | null;
  action: string | null;
  hasContext: boolean;
}

export function useOfficeContext(): OfficeContext {
  const [searchParams] = useSearchParams();
  const { data: offices } = useOffices();

  const context = useMemo(() => {
    const idsParam = searchParams.get('ids');
    const tierParam = searchParams.get('tier');
    const sourceParam = searchParams.get('source');
    const actionParam = searchParams.get('action');

    let officeIds: string[] = [];

    // If specific IDs are provided
    if (idsParam) {
      officeIds = idsParam.split(',').filter(id => id.trim());
    }
    // If tier is provided, get all offices in that tier
    else if (tierParam && offices) {
      officeIds = offices
        .filter(o => o.tier === tierParam)
        .map(o => o.id);
    }

    return {
      officeIds,
      tierFilter: tierParam,
      sourceContext: sourceParam,
      action: actionParam,
      hasContext: officeIds.length > 0 || !!tierParam,
    };
  }, [searchParams, offices]);

  return context;
}

export function buildOfficeContextUrl(
  basePath: string,
  options: {
    ids?: string[];
    tier?: string;
    source?: string;
    action?: string;
  }
): string {
  const params = new URLSearchParams();
  
  if (options.ids && options.ids.length > 0) {
    params.set('ids', options.ids.join(','));
  }
  if (options.tier) {
    params.set('tier', options.tier);
  }
  if (options.source) {
    params.set('source', options.source);
  }
  if (options.action) {
    params.set('action', options.action);
  }

  const queryString = params.toString();
  return queryString ? `${basePath}?${queryString}` : basePath;
}
