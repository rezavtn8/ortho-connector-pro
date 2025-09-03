import React from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { MapPin, Navigation } from 'lucide-react';
import { DISTANCE_OPTIONS, DistanceOption } from '@/utils/distanceCalculation';
import { cn } from '@/lib/utils';

interface DistanceSelectorProps {
  selectedDistance: DistanceOption;
  onDistanceChange: (distance: DistanceOption) => void;
  officeCount?: number;
  className?: string;
  variant?: 'buttons' | 'dropdown';
}

export function DistanceSelector({
  selectedDistance,
  onDistanceChange,
  officeCount,
  className,
  variant = 'buttons'
}: DistanceSelectorProps) {
  
  if (variant === 'dropdown') {
    return (
      <div className={cn("space-y-2", className)}>
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Navigation className="w-4 h-4" />
          Search Radius
        </div>
        <Select 
          value={selectedDistance.toString()} 
          onValueChange={(value) => onDistanceChange(Number(value) as DistanceOption)}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DISTANCE_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value.toString()}>
                <div className="flex items-center justify-between w-full">
                  <span>{option.label}</span>
                  <span className="text-muted-foreground ml-2">({option.description})</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <Navigation className="w-4 h-4" />
        Search Radius
        {typeof officeCount === 'number' && (
          <Badge variant="secondary" className="ml-auto">
            {officeCount} office{officeCount !== 1 ? 's' : ''} found
          </Badge>
        )}
      </div>
      
      <div className="flex flex-wrap gap-2">
        {DISTANCE_OPTIONS.map((option) => (
          <Button
            key={option.value}
            variant={selectedDistance === option.value ? 'default' : 'outline'}
            onClick={() => onDistanceChange(option.value)}
            size="sm"
            className={cn(
              "flex flex-col h-auto py-2 px-3 transition-all",
              selectedDistance === option.value && "ring-2 ring-primary/20"
            )}
          >
            <span className="font-medium text-sm">{option.label}</span>
            <span className="text-xs opacity-70">{option.description}</span>
          </Button>
        ))}
      </div>
      
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <MapPin className="w-3 h-3" />
        <span>
          Showing offices within {DISTANCE_OPTIONS.find(o => o.value === selectedDistance)?.description} of your clinic
        </span>
      </div>
    </div>
  );
}