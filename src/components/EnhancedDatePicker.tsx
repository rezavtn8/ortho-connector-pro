import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CalendarIcon, Clock } from 'lucide-react';
import { format, addDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { cn } from '@/lib/utils';

interface EnhancedDatePickerProps {
  value?: Date | null;
  onChange: (date: Date | null) => void;
  placeholder?: string;
  withTime?: boolean;
  disabled?: boolean;
  className?: string;
  minDate?: Date;
  maxDate?: Date;
  presets?: boolean;
}

const DATE_PRESETS = [
  { label: 'Today', value: () => new Date() },
  { label: 'Tomorrow', value: () => addDays(new Date(), 1) },
  { label: 'In 3 days', value: () => addDays(new Date(), 3) },
  { label: 'Next week', value: () => addDays(new Date(), 7) },
  { label: 'In 2 weeks', value: () => addDays(new Date(), 14) },
  { label: 'End of month', value: () => endOfMonth(new Date()) },
];

export function EnhancedDatePicker({
  value,
  onChange,
  placeholder = "Pick a date",
  withTime = false,
  disabled = false,
  className,
  minDate,
  maxDate,
  presets = true
}: EnhancedDatePickerProps) {
  const [open, setOpen] = useState(false);
  const [timeValue, setTimeValue] = useState(value ? format(value, 'HH:mm') : '09:00');

  const handleDateSelect = (selectedDate: Date | undefined) => {
    if (selectedDate) {
      if (withTime && timeValue) {
        const [hours, minutes] = timeValue.split(':');
        selectedDate.setHours(parseInt(hours), parseInt(minutes));
      }
      onChange(selectedDate);
      if (!withTime) {
        setOpen(false);
      }
    }
  };

  const handleTimeChange = (newTime: string) => {
    setTimeValue(newTime);
    if (value) {
      const [hours, minutes] = newTime.split(':');
      const newDate = new Date(value);
      newDate.setHours(parseInt(hours), parseInt(minutes));
      onChange(newDate);
    }
  };

  const handlePresetSelect = (presetFn: () => Date) => {
    const date = presetFn();
    if (withTime && timeValue) {
      const [hours, minutes] = timeValue.split(':');
      date.setHours(parseInt(hours), parseInt(minutes));
    }
    onChange(date);
    setOpen(false);
  };

  const generateTimeOptions = () => {
    const times = [];
    for (let hour = 0; hour < 24; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        times.push(timeStr);
      }
    }
    return times;
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className={cn(
            "w-full justify-start text-left font-normal",
            !value && "text-muted-foreground",
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {value ? (
            withTime ? 
              format(value, "PPP 'at' p") : 
              format(value, "PPP")
          ) : (
            <span>{placeholder}</span>
          )}
          {withTime && <Clock className="ml-auto h-4 w-4" />}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0 pointer-events-auto" align="start">
        <div className="flex">
          <div className="border-r">
            <Calendar
              mode="single"
              selected={value}
              onSelect={handleDateSelect}
              disabled={(date) => {
                if (minDate && date < minDate) return true;
                if (maxDate && date > maxDate) return true;
                return false;
              }}
              initialFocus
              className="p-3 pointer-events-auto"
            />
            
            {withTime && (
              <div className="p-3 border-t">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Time</label>
                  <Select value={timeValue} onValueChange={handleTimeChange}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {generateTimeOptions().map((time) => (
                        <SelectItem key={time} value={time}>
                          {time}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </div>
          
          {presets && (
            <div className="p-3 w-48">
              <h4 className="text-sm font-medium mb-2">Quick Select</h4>
              <div className="space-y-1">
                {DATE_PRESETS.map((preset) => (
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
                    onChange(null);
                    setOpen(false);
                  }}
                >
                  Clear date
                </Button>
              </div>
            </div>
          )}
        </div>
        
        {withTime && (
          <div className="p-3 border-t flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => setOpen(false)}
            >
              Done
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}