import { Building2, Users, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Hub } from './types';

interface HubDetailPanelProps {
  hub: Hub;
  /** Patients and referrers over the window currently on the map. */
  patients: number;
  referringOffices: number;
  periodLabel: string;
  onClose: () => void;
}

/**
 * Your own practice, the destination every arc points at.
 *
 * Exists because the hub is a click target: the dispatcher resolves a click on it to
 * `{ kind: 'hub' }`, and a kind with nothing to render would be a click that
 * silently swallows itself — the very defect that made prospect pins feel broken.
 * Every interactive layer owes the user a response.
 */
export function HubDetailPanel({
  hub,
  patients,
  referringOffices,
  periodLabel,
  onClose,
}: HubDetailPanelProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-sm leading-tight truncate">{hub.name}</p>
          <p className="text-[11px] text-muted-foreground">
            {hub.isPrimary ? 'Your practice' : 'Your location'}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0 -mt-1 -mr-1"
          onClick={onClose}
          aria-label="Close"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      {hub.address && (
        <p className="text-xs text-muted-foreground leading-snug">{hub.address}</p>
      )}

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-md bg-muted/50 px-2 py-1.5">
          <p className="text-base font-semibold tabular-nums leading-tight flex items-center gap-1">
            <Users className="h-3.5 w-3.5 text-muted-foreground" />
            {patients}
          </p>
          <p className="text-[10px] text-muted-foreground leading-tight">Patients received</p>
        </div>
        <div className="rounded-md bg-muted/50 px-2 py-1.5">
          <p className="text-base font-semibold tabular-nums leading-tight flex items-center gap-1">
            <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
            {referringOffices}
          </p>
          <p className="text-[10px] text-muted-foreground leading-tight">Offices referring</p>
        </div>
      </div>

      <p className="text-[10px] text-muted-foreground">{periodLabel}</p>
    </div>
  );
}
