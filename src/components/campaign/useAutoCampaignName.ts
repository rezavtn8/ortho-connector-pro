import { useCallback, useEffect, useRef, useState } from 'react';
import { format } from 'date-fns';
import { now } from '@/lib/dateSync';

interface TypeOption {
  value: string;
  label: string;
}

/**
 * Suggests a campaign name from the chosen type, and keeps following the type until
 * the user types their own name.
 *
 * The creators previously suggested a name once, guarded on `!campaignName`, so
 * changing the campaign type afterwards left a name describing the *old* type — the
 * single most common way a campaign ended up mislabelled in the list.
 *
 * @param suffix appended after the type label, e.g. "Letters".
 */
export function useAutoCampaignName(types: TypeOption[], selectedType: string, suffix = '') {
  const [name, setNameState] = useState('');
  const userEdited = useRef(false);

  const suggestion = useCallback(
    (type: string) => {
      const label = types.find((t) => t.value === type)?.label ?? '';
      const parts = [label, suffix].filter(Boolean).join(' ');
      return `${parts} — ${format(now(), 'MMM yyyy')}`;
    },
    [types, suffix],
  );

  useEffect(() => {
    if (!userEdited.current) setNameState(suggestion(selectedType));
  }, [selectedType, suggestion]);

  const setName = useCallback((value: string) => {
    userEdited.current = true;
    setNameState(value);
  }, []);

  const reset = useCallback(() => {
    userEdited.current = false;
    setNameState('');
  }, []);

  return { name, setName, reset };
}
