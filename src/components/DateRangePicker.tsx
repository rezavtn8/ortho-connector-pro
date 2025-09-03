import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon } from 'lucide-react';
import { format, addDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays } from 'date-fns';
import { DateRange } from 'react-day-picker';
import { cn } from '@/lib/utils';

interface DateRangePickerProps {
  value?: DateRange;
  onChange: (range: DateRange | undefined) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  presets?: boolean;
}

const RANGE_PRESETS = [
  {
    label: 'Today',
    value: () => ({
      from: new Date(),
      to: new Date()
    })
  },
  {
    label: 'Yesterday',
    value: () => ({
      from: subDays(new Date(), 1),
      to: subDays(new Date(), 1)
    })
  },
  {
    label: 'Last 7 days',
    value: () => ({
      from: subDays(new Date(), 6),
      to: new Date()
    })
  },
  {
    label: 'Last 30 days',
    value: () => ({
      from: subDays(new Date(), 29),
      to: new Date()
    })
  },
  {
    label: 'This week',
    value: () => ({
      from: startOfWeek(new Date(), { weekStartsOn: 1 }),
      to: endOfWeek(new Date(), { weekStartsOn: 1 })
    })
  },
  {
    label: 'This month',
    value: () => ({
      from: startOfMonth(new Date()),
      to: endOfMonth(new Date())
    })
  },
  {
    label: 'Next 7 days',
    value: () => ({
      from: new Date(),
      to: addDays(new Date(), 6)
    })
  },
  {
    label: 'Next 30 days',
    value: () => ({
      from: new Date(),
      to: addDays(new Date(), 29)
    })
  }
];

export function DateRangePicker({
  value,
  onChange,
  placeholder = "Pick a date range",
  disabled = false,
  className,
  presets = true
}: DateRangePickerProps) {
  const [open, setOpen] = useState(false);

  const handlePresetSelect = (presetFn: () => DateRange) => {
    const range = presetFn();
    onChange(range);
    setOpen(false);
  };

  const formatRange = (range: DateRange) => {
    if (!range?.from) return placeholder;
    
    if (!range.to || range.from.getTime() === range.to.getTime()) {
      return format(range.from, "MMM dd, yyyy");
    }
    
    return `${format(range.from, "MMM dd")} - ${format(range.to, "MMM dd, yyyy")}`;
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className={cn(
            "w-full justify-start text-left font-normal",
            !value?.from && "text-muted-foreground",
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {formatRange(value)}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="flex">
          <div className="border-r">
            <Calendar
              mode="range"
              defaultMonth={value?.from}
              selected={value}
              onSelect={onChange}
              numberOfMonths={2}
              initialFocus
              className="pointer-events-auto"
            />
          </div>
          
          {presets && (
            <div className="p-3 w-48">
              <h4 className="text-sm font-medium mb-2">Quick Select</h4>
              <div className="space-y-1">
                {RANGE_PRESETS.map((preset) => (
                  <Button
                    key={preset.label}
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start text-sm"
                    onClick={() => handlePresetSelect(preset.value)}
                  >
                    {preset.label}
                  </Button>
                ))}
              </div>
              
              <div className="mt-4 pt-3 border-t">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start text-sm text-red-600 hover:text-red-700"
                  onClick={() => {
                    onChange(undefined);
                    setOpen(false);
                  }}
                >
                  Clear dates
                </Button>
              </div>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}