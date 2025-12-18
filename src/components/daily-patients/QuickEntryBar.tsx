import React, { useState, useEffect, useMemo } from 'react';
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
  ChevronsUpDown,
  Search
} from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { format, subDays } from 'date-fns';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAddDailyPatients } from '@/hooks/useDailyPatients';
import { SOURCE_TYPE_CONFIG, SourceType } from '@/lib/database.types';
import { getToday, isToday, isYesterday, isSameDay, normalizeDate } from '@/utils/dateUtils';

interface PatientSource {
  id: string;
  name: string;
  source_type: SourceType;
}

interface QuickEntryBarProps {
  onSuccess?: () => void;
}

export function QuickEntryBar({ onSuccess }: QuickEntryBarProps) {
  const [date, setDate] = useState<Date>(() => getToday());
  const [sources, setSources] = useState<PatientSource[]>([]);
  const [selectedSource, setSelectedSource] = useState<PatientSource | null>(null);
  const [count, setCount] = useState(1);
  const [loading, setLoading] = useState(true);
  const [dateOpen, setDateOpen] = useState(false);
  const [sourceOpen, setSourceOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
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

  const today = getToday();
  const yesterday = subDays(today, 1);

  // Filter sources based on search
  const filteredSources = useMemo(() => {
    if (!searchQuery) return sources;
    const query = searchQuery.toLowerCase();
    return sources.filter(source => 
      source.name.toLowerCase().includes(query) ||
      source.source_type.toLowerCase().includes(query)
    );
  }, [sources, searchQuery]);

  // Group filtered sources by type
  const groupedSources = useMemo(() => {
    return filteredSources.reduce((acc, source) => {
      const type = source.source_type;
      if (!acc[type]) acc[type] = [];
      acc[type].push(source);
      return acc;
    }, {} as Record<string, PatientSource[]>);
  }, [filteredSources]);

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
          <Button
            variant={isSameDay(date, today) ? 'default' : 'outline'}
            size="sm"
            className="h-8 text-xs px-2.5"
            onClick={() => setDate(today)}
          >
            Today
          </Button>
          <Button
            variant={isSameDay(date, yesterday) ? 'default' : 'outline'}
            size="sm"
            className="h-8 text-xs px-2.5"
            onClick={() => setDate(yesterday)}
          >
            Yesterday
          </Button>
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
                    setDate(normalizeDate(d));
                    setDateOpen(false);
                  }
                }}
                initialFocus
                className="pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* Searchable Source Selector */}
        <Popover open={sourceOpen} onOpenChange={setSourceOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={sourceOpen}
              className="w-[160px] sm:w-[200px] h-8 text-xs justify-between"
            >
              {selectedSource ? (
                <span className="flex items-center gap-1.5 truncate">
                  <span>{SOURCE_TYPE_CONFIG[selectedSource.source_type]?.icon || '📌'}</span>
                  <span className="truncate">{selectedSource.name}</span>
                </span>
              ) : (
                <span className="text-muted-foreground">Select source...</span>
              )}
              <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[280px] p-0 z-50" align="start">
            <Command shouldFilter={false}>
              <div className="flex items-center border-b px-3">
                <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                <input
                  placeholder="Search sources..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex h-10 w-full bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
                />
              </div>
              <CommandList className="max-h-[300px]">
                <CommandEmpty>No source found.</CommandEmpty>
                {Object.entries(groupedSources).map(([type, typeSources]) => {
                  const config = SOURCE_TYPE_CONFIG[type as SourceType];
                  return (
                    <CommandGroup key={type} heading={
                      <span className="flex items-center gap-1.5">
                        <span>{config?.icon || '📌'}</span>
                        <span>{config?.label || type}</span>
                      </span>
                    }>
                      {typeSources.map((source) => (
                        <CommandItem
                          key={source.id}
                          value={source.id}
                          onSelect={() => {
                            setSelectedSource(source);
                            setSourceOpen(false);
                            setSearchQuery('');
                          }}
                          className="cursor-pointer"
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              selectedSource?.id === source.id ? "opacity-100" : "opacity-0"
                            )}
                          />
                          <span className="truncate">{source.name}</span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  );
                })}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

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
