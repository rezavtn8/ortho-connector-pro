import { Check, ExternalLink, Loader2, Navigation, Phone, Plus, Star, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useAddProspectToNetwork } from '@/hooks/useAddProspectToNetwork';
import type { DiscoveredOffice } from '@/hooks/useDiscoveredOffices';
import { sanitizeURL } from '@/lib/sanitize';
import { calculateDistance } from '@/utils/distanceCalculation';
import type { Hub } from './types';

const RATING_BADGE: Record<string, string> = {
  Excellent: 'bg-emerald-500 text-white border-transparent',
  Good: 'bg-orange-500 text-white border-transparent',
  Average: 'bg-yellow-500 text-white border-transparent',
  Low: 'bg-muted text-muted-foreground border-transparent',
};

interface ProspectDetailPanelProps {
  prospect: DiscoveredOffice;
  hubs: Hub[];
  onClose: () => void;
}

/**
 * Detail card for a discovered prospect — the panel these pins never had.
 *
 * Text and links render through React and `sanitizeURL` for the same reason the
 * office panel does: these values come from the Google Places API by way of the
 * database, so interpolating them into markup would be a stored-XSS surface.
 */
export function ProspectDetailPanel({ prospect, hubs, onClose }: ProspectDetailPanelProps) {
  const { toast } = useToast();
  const addToNetwork = useAddProspectToNetwork();

  const website = prospect.website ? sanitizeURL(prospect.website) : null;

  // Prefer the distance Google gave us; fall back to the straight-line distance so
  // the field is never blank for a prospect discovered without one.
  const distance =
    prospect.distance_miles ??
    (hubs.length
      ? Math.min(
          ...hubs.map((hub) =>
            calculateDistance(hub.latitude, hub.longitude, prospect.latitude, prospect.longitude),
          ),
        )
      : null);

  const nearestHub = hubs[0] ?? null;
  const directions = nearestHub
    ? `https://www.google.com/maps/dir/?api=1&origin=${nearestHub.latitude},${nearestHub.longitude}&destination=${prospect.latitude},${prospect.longitude}&travelmode=driving`
    : null;

  const handleAdd = () => {
    addToNetwork.mutate(prospect, {
      onSuccess: (result) => {
        toast(
          result.outcome === 'added'
            ? {
                title: `${result.name} added to your network`,
                description: 'It will appear as a referring office once patients are logged.',
              }
            : {
                title: `${result.name} was already in your network`,
                description: 'Nothing was duplicated; the map has been brought up to date.',
              },
        );
        onClose();
      },
      onError: (error) => {
        toast({
          title: "Couldn't add this office",
          description: error.message,
          variant: 'destructive',
        });
      },
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-sm leading-tight truncate">{prospect.name}</p>
          <p className="text-[11px] text-muted-foreground">Prospect · not in your network</p>
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

      <div className="flex items-center gap-2 flex-wrap">
        <Badge className={RATING_BADGE[prospect.ratingCategory] ?? RATING_BADGE.Low}>
          {prospect.ratingCategory}
        </Badge>
        {prospect.google_rating !== null && (
          <span className="text-xs text-muted-foreground flex items-center gap-1 tabular-nums">
            <Star className="h-3 w-3 fill-current" />
            {prospect.google_rating.toFixed(1)}
          </span>
        )}
        {distance !== null && (
          <span className="text-xs text-muted-foreground tabular-nums">
            {distance.toFixed(1)} mi away
          </span>
        )}
      </div>

      {prospect.address && (
        <p className="text-xs text-muted-foreground leading-snug">{prospect.address}</p>
      )}
      {prospect.office_type && (
        <p className="text-[11px] text-muted-foreground">{prospect.office_type}</p>
      )}

      <div className="flex flex-wrap gap-1.5">
        {prospect.phone && (
          <Button size="sm" variant="outline" className="h-7 text-xs" asChild>
            <a href={`tel:${prospect.phone}`}>
              <Phone className="h-3 w-3 mr-1" />
              Call
            </a>
          </Button>
        )}
        {website && (
          <Button size="sm" variant="outline" className="h-7 text-xs" asChild>
            <a href={website} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-3 w-3 mr-1" />
              Website
            </a>
          </Button>
        )}
        {directions && (
          <Button size="sm" variant="outline" className="h-7 text-xs" asChild>
            <a href={directions} target="_blank" rel="noopener noreferrer">
              <Navigation className="h-3 w-3 mr-1" />
              Directions
            </a>
          </Button>
        )}
      </div>

      <Button
        size="sm"
        className="w-full h-8 text-xs"
        onClick={handleAdd}
        disabled={addToNetwork.isPending}
      >
        {addToNetwork.isPending ? (
          <>
            <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
            Adding…
          </>
        ) : addToNetwork.isSuccess ? (
          <>
            <Check className="h-3.5 w-3.5 mr-1.5" />
            Added
          </>
        ) : (
          <>
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Add to network
          </>
        )}
      </Button>
    </div>
  );
}
