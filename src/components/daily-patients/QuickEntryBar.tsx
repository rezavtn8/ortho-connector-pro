import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { 
  Plus, 
  Minus, 
  Users, 
  Loader2, 
  ChevronDown,
  Calendar,
  Check
} from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { format, subDays, isToday, isYesterday } from 'date-fns';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAddDailyPatients } from '@/hooks/useDailyPatients';
import { SOURCE_TYPE_CONFIG, SourceType } from '@/lib/database.types';
import { useToast } from '@/hooks/use-toast';

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
  const { toast } = useToast();

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
    { label: format(subDays(new Date(), 2), 'EEE'), date: subDays(new Date(), 2) },
    { label: format(subDays(new Date(), 3), 'EEE'), date: subDays(new Date(), 3) },
  ];

  if (loading) {
    return (
      <Card className="p-4">
        <div className="flex items-center justify-center py-2">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-4 bg-gradient-to-r from-primary/5 to-transparent border-primary/20">
      <div className="flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-primary/10">
              <Users className="w-4 h-4 text-primary" />
            </div>
            <span className="font-semibold text-sm">Quick Add Patients</span>
          </div>
          
          {/* Quick Date Picker */}
          <div className="flex items-center gap-1">
            {quickDates.map((qd) => (
              <Button
                key={qd.label}
                variant={format(date, 'yyyy-MM-dd') === format(qd.date, 'yyyy-MM-dd') ? 'default' : 'ghost'}
                size="sm"
                className={cn(
                  "h-7 text-xs px-2",
                  format(date, 'yyyy-MM-dd') === format(qd.date, 'yyyy-MM-dd') && "shadow-sm"
                )}
                onClick={() => setDate(qd.date)}
              >
                {qd.label}
              </Button>
            ))}
            <Popover open={dateOpen} onOpenChange={setDateOpen}>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 px-2">
                  <Calendar className="w-3.5 h-3.5" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
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
        </div>

        {/* Source Selection + Count + Submit */}
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Source Pills */}
          <div className="flex-1">
            <ScrollArea className="w-full whitespace-nowrap">
              <div className="flex gap-2 pb-2">
                {sources.map((source) => {
                  const config = SOURCE_TYPE_CONFIG[source.source_type];
                  const isSelected = selectedSource?.id === source.id;
                  return (
                    <Button
                      key={source.id}
                      variant={isSelected ? 'default' : 'outline'}
                      size="sm"
                      className={cn(
                        "shrink-0 gap-1.5 h-9 transition-all",
                        isSelected && "shadow-md ring-2 ring-primary/20"
                      )}
                      onClick={() => setSelectedSource(source)}
                    >
                      <span>{config?.icon || '📌'}</span>
                      <span className="max-w-[100px] truncate">{source.name}</span>
                      {isSelected && <Check className="w-3 h-3 ml-1" />}
                    </Button>
                  );
                })}
              </div>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          </div>

          {/* Count Control + Submit */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center bg-muted rounded-lg p-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-md"
                onClick={() => setCount(Math.max(1, count - 1))}
                disabled={count <= 1}
              >
                <Minus className="w-4 h-4" />
              </Button>
              <Input
                type="number"
                min="1"
                value={count}
                onChange={(e) => setCount(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-14 h-8 text-center font-bold text-lg border-0 bg-transparent focus-visible:ring-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-md"
                onClick={() => setCount(count + 1)}
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>

            {/* Quick Presets */}
            <div className="hidden md:flex gap-1">
              {[5, 10, 15].map((preset) => (
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

            <Button
              onClick={handleQuickAdd}
              disabled={!selectedSource || addDailyPatients.isPending}
              className="h-10 px-4 gap-2 shadow-md"
            >
              {addDailyPatients.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  <span className="hidden sm:inline">Add</span>
                  <Badge variant="secondary" className="ml-1 font-bold">
                    {count}
                  </Badge>
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
