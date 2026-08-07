import { useState } from 'react';
import { Check, ClipboardList, Copy, Route } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import { addressList, planVisitRoute } from './mapActions';
import type { Hub, MapOffice } from './types';

interface MapActionsBarProps {
  /** The offices currently shown, after search and tier filters. */
  offices: MapOffice[];
  hubs: Hub[];
  filterLabel: string;
}

/**
 * Acts on whatever the map is currently showing.
 *
 * The filters are the selection: narrow to "Warm within this month", then plan a
 * visit run or copy the addresses for that exact set.
 */
export function MapActionsBar({ offices, hubs, filterLabel }: MapActionsBarProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const hub = hubs[0];
  const disabled = offices.length === 0 || !hub;

  const handleRoute = () => {
    if (!hub) return;
    const plan = planVisitRoute(hub, offices);
    if (!plan) {
      toast({
        title: 'No route available',
        description: 'None of these offices have coordinates.',
        variant: 'destructive',
      });
      return;
    }

    window.open(plan.url, '_blank', 'noopener,noreferrer');
    toast({
      title: `Route for ${plan.stops.length} offices`,
      description:
        `About ${plan.totalMiles} miles round trip from ${hub.name}.` +
        (plan.omitted > 0
          ? ` ${plan.omitted} more couldn't be included — Google caps a route at 23 stops.`
          : ''),
    });
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(addressList(offices));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
      toast({ title: `Copied ${offices.length} addresses` });
    } catch {
      toast({
        title: 'Copy failed',
        description: 'Your browser blocked clipboard access.',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-xs text-muted-foreground flex items-center gap-1.5">
        <ClipboardList className="h-3.5 w-3.5" />
        {offices.length} {filterLabel}
      </span>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs"
            onClick={handleRoute}
            disabled={disabled}
          >
            <Route className="h-3.5 w-3.5 mr-1.5" />
            Plan visit route
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p className="max-w-[15rem]">
            Opens Google Maps with a driving loop from your practice through these offices,
            ordered nearest-first.
          </p>
        </TooltipContent>
      </Tooltip>

      <Button
        size="sm"
        variant="outline"
        className="h-8 text-xs"
        onClick={handleCopy}
        disabled={disabled}
      >
        {copied ? (
          <Check className="h-3.5 w-3.5 mr-1.5" />
        ) : (
          <Copy className="h-3.5 w-3.5 mr-1.5" />
        )}
        Copy addresses
      </Button>
    </div>
  );
}
