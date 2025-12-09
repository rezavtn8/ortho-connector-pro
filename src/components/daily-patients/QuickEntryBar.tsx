import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { 
  Plus, 
  Minus, 
  Users, 
  Loader2, 
  Calendar,
  Check,
  ChevronDown
} from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { format, subDays, isToday, isYesterday } from 'date-fns';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAddDailyPatients } from '@/hooks/useDailyPatients';
import { SOURCE_TYPE_CONFIG, SourceType } from '@/lib/database.types';

interface PatientSource {
  id: string;
  name: string;
  source_type: SourceType;
}

interface QuickEntryBarProps {
  onSuccess?: () => void;
}

export function QuickEntryBar({ onSuccess }: QuickEntryBarProps) {
  const [date, setDate] = useState<Date>(new Date());
  const [sources, setSources] = useState<PatientSource[]>([]);
  const [selectedSource, setSelectedSource] = useState<PatientSource | null>(null);
  const [count, setCount] = useState(1);
  const [loading, setLoading] = useState(true);
  const [dateOpen, setDateOpen] = useState(false);
  
  const addDailyPatients = useAddDailyPatients();

  useEffect(() => {
    loadSources();
  }, []);

  const loadSources = async () => {
    try {
      const { data, error } = await supabase
        .from('patient_sources')
        .select('id, name, source_type')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setSources(data || []);
      if (data && data.length > 0) {
        setSelectedSource(data[0]);
      }
    } catch (error) {
      console.error('Error loading sources:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickAdd = async () => {
    if (!selectedSource) return;
    
    await addDailyPatients.mutateAsync([{
      source_id: selectedSource.id,
      date: date,
      count: count,
    }]);
    
    setCount(1);
    onSuccess?.();
  };

  const formatDateLabel = (d: Date) => {
    if (isToday(d)) return 'Today';
    if (isYesterday(d)) return 'Yesterday';
    return format(d, 'MMM d');
  };

  const quickDates = [
    { label: 'Today', date: new Date() },
    { label: 'Yesterday', date: subDays(new Date(), 1) },
  ];

  if (loading) {
    return (
      <Card className="p-3">
        <div className="flex items-center justify-center py-2">
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        </div>
      </Card>
    );
  }

  if (sources.length === 0) {
    return null;
  }

  return (
    <Card className="p-3 bg-gradient-to-r from-primary/5 to-transparent border-primary/20">
      <div className="flex flex-wrap items-center gap-2">
        {/* Label */}
        <div className="flex items-center gap-1.5 shrink-0">
          <Users className="w-4 h-4 text-primary" />
          <span className="font-medium text-sm hidden sm:inline">Quick Add:</span>
        </div>

        {/* Date Selector */}
        <div className="flex items-center gap-1">
          {quickDates.map((qd) => (
            <Button
              key={qd.label}
              variant={format(date, 'yyyy-MM-dd') === format(qd.date, 'yyyy-MM-dd') ? 'default' : 'outline'}
              size="sm"
              className="h-8 text-xs px-2.5"
              onClick={() => setDate(qd.date)}
            >
              {qd.label}
            </Button>
          ))}
          <Popover open={dateOpen} onOpenChange={setDateOpen}>
            <PopoverTrigger asChild>
              <Button 
                variant={!isToday(date) && !isYesterday(date) ? 'default' : 'outline'} 
                size="sm" 
                className="h-8 px-2"
              >
                <Calendar className="w-3.5 h-3.5" />
                {!isToday(date) && !isYesterday(date) && (
                  <span className="ml-1 text-xs">{format(date, 'M/d')}</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 z-50 bg-popover" align="start">
              <CalendarComponent
                mode="single"
                selected={date}
                onSelect={(d) => {
                  if (d) {
                    setDate(d);
                    setDateOpen(false);
                  }
                }}
                initialFocus
                className="pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* Source Selector */}
        <Select 
          value={selectedSource?.id} 
          onValueChange={(id) => setSelectedSource(sources.find(s => s.id === id) || null)}
        >
          <SelectTrigger className="w-[140px] sm:w-[180px] h-8 text-xs">
            <SelectValue placeholder="Select source">
              {selectedSource && (
                <span className="flex items-center gap-1.5 truncate">
                  <span>{SOURCE_TYPE_CONFIG[selectedSource.source_type]?.icon || '📌'}</span>
                  <span className="truncate">{selectedSource.name}</span>
                </span>
              )}
            </SelectValue>
          </SelectTrigger>
          <SelectContent className="z-50 bg-popover">
            {sources.map((source) => (
              <SelectItem key={source.id} value={source.id}>
                <span className="flex items-center gap-2">
                  <span>{SOURCE_TYPE_CONFIG[source.source_type]?.icon || '📌'}</span>
                  <span className="truncate">{source.name}</span>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Count Control */}
        <div className="flex items-center bg-muted rounded-md">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setCount(Math.max(1, count - 1))}
            disabled={count <= 1}
          >
            <Minus className="w-3.5 h-3.5" />
          </Button>
          <Input
            type="number"
            min="1"
            value={count}
            onChange={(e) => setCount(Math.max(1, parseInt(e.target.value) || 1))}
            className="w-10 h-8 text-center font-bold text-sm border-0 bg-transparent focus-visible:ring-0 p-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setCount(count + 1)}
          >
            <Plus className="w-3.5 h-3.5" />
          </Button>
        </div>

        {/* Quick Presets */}
        <div className="hidden lg:flex gap-1">
          {[5, 10].map((preset) => (
            <Button
              key={preset}
              variant={count === preset ? 'secondary' : 'ghost'}
              size="sm"
              className="h-8 w-8 p-0 text-xs font-bold"
              onClick={() => setCount(preset)}
            >
              {preset}
            </Button>
          ))}
        </div>

        {/* Submit */}
        <Button
          onClick={handleQuickAdd}
          disabled={!selectedSource || addDailyPatients.isPending}
          size="sm"
          className="h-8 px-3 gap-1.5 ml-auto"
        >
          {addDailyPatients.isPending ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <>
              <Plus className="w-3.5 h-3.5" />
              <span>Add</span>
              <Badge variant="secondary" className="h-5 px-1.5 text-xs font-bold">
                {count}
              </Badge>
            </>
          )}
        </Button>
      </div>
    </Card>
  );
}
