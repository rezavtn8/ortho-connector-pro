import { Compass, Crosshair, FolderOpen, Search, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { TIER_ORDER, type FlowTier } from './types';

interface DiscoveredGroupOption {
  id: string;
  name: string;
  member_count?: number | null;
}

interface MapFilterBarProps {
  search: string;
  onSearchChange: (value: string) => void;
  tierFilter: FlowTier | null;
  onTierFilterChange: (tier: FlowTier | null) => void;
  tierCounts: Record<FlowTier, number>;
  showDiscovered: boolean;
  onShowDiscoveredChange: (value: boolean) => void;
  groups: DiscoveredGroupOption[];
  selectedGroupId: string | null;
  onSelectedGroupIdChange: (id: string | null) => void;
  discoveredCount: number;
  unmappedCount: number;
  onResetView: () => void;
}

export function MapFilterBar({
  search,
  onSearchChange,
  tierFilter,
  onTierFilterChange,
  tierCounts,
  showDiscovered,
  onShowDiscoveredChange,
  groups,
  selectedGroupId,
  onSelectedGroupIdChange,
  discoveredCount,
  unmappedCount,
  onResetView,
}: MapFilterBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 sm:gap-3">
      <div className="relative w-full sm:w-56">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Find an office…"
          className="pl-8 pr-8 h-9"
          aria-label="Search referring offices"
        />
        {search && (
          <button
            type="button"
            onClick={() => onSearchChange('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label="Clear search"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <div className="flex items-center gap-1.5 flex-wrap">
        <Button
          size="sm"
          variant={tierFilter === null ? 'default' : 'outline'}
          onClick={() => onTierFilterChange(null)}
          className="h-9"
        >
          All
        </Button>
        {TIER_ORDER.map((tier) => (
          <Button
            key={tier}
            size="sm"
            variant={tierFilter === tier ? 'default' : 'outline'}
            onClick={() => onTierFilterChange(tierFilter === tier ? null : tier)}
            className="h-9"
          >
            {tier}
            <span className="ml-1.5 text-xs opacity-70 tabular-nums">{tierCounts[tier]}</span>
          </Button>
        ))}
      </div>

      <div className="flex items-center gap-2 ml-auto flex-wrap">
        {unmappedCount > 0 && (
          <Tooltip>
            {/* Badge is a plain function component, so it cannot take the ref
                TooltipTrigger forwards; the span receives it instead. */}
            <TooltipTrigger asChild>
              <span>
                <Badge variant="outline" className="cursor-help">
                  {unmappedCount} unmapped
                </Badge>
              </span>
            </TooltipTrigger>
            <TooltipContent>
              <p className="max-w-[16rem]">
                {unmappedCount} office{unmappedCount === 1 ? ' has' : 's have'} referral history but
                no address coordinates, so {unmappedCount === 1 ? 'it is' : 'they are'} not drawn.
                Add an address on the office to place {unmappedCount === 1 ? 'it' : 'them'}.
              </p>
            </TooltipContent>
          </Tooltip>
        )}

        <div className="flex items-center gap-2">
          <Switch
            id="show-discovered"
            checked={showDiscovered}
            onCheckedChange={(value) => {
              onShowDiscoveredChange(value);
              if (!value) onSelectedGroupIdChange(null);
            }}
          />
          <Label htmlFor="show-discovered" className="flex items-center gap-1.5 cursor-pointer text-sm">
            <Compass className="h-4 w-4 text-teal-600" />
            Prospects
          </Label>
        </div>

        {showDiscovered && (
          <Select
            value={selectedGroupId ?? 'all'}
            onValueChange={(value) => onSelectedGroupIdChange(value === 'all' ? null : value)}
          >
            <SelectTrigger className="w-[160px] h-9">
              <SelectValue placeholder="All discovered" />
            </SelectTrigger>
            <SelectContent className="bg-background border z-50">
              <SelectItem value="all">All discovered</SelectItem>
              {groups.map((group) => (
                <SelectItem key={group.id} value={group.id}>
                  <span className="flex items-center gap-1.5">
                    <FolderOpen className="h-3 w-3" />
                    {group.name} ({group.member_count ?? 0})
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {showDiscovered && discoveredCount > 0 && (
          <Badge variant="secondary" className="bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200">
            {discoveredCount}
          </Badge>
        )}

        <Tooltip>
          <TooltipTrigger asChild>
            <Button size="icon" variant="outline" className="h-9 w-9" onClick={onResetView}>
              <Crosshair className="h-4 w-4" />
              <span className="sr-only">Reset view</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Reset view</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
