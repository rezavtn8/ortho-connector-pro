import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Plus, Minus, Loader2, Users, Search, X } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAddDailyPatients } from '@/hooks/useDailyPatients';
import { SOURCE_TYPE_CONFIG, SourceType } from '@/lib/database.types';

interface PatientSource {
  id: string;
  name: string;
  source_type: SourceType;
  is_active: boolean;
}

interface SourceEntry {
  source_id: string;
  count: number;
  selected: boolean;
}

interface AddDailyPatientsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialDate?: Date;
  onSuccess?: () => void;
}

export function AddDailyPatientsDialog({
  open,
  onOpenChange,
  initialDate,
  onSuccess
}: AddDailyPatientsDialogProps) {
  const [date, setDate] = useState<Date>(initialDate || new Date());
  const [sources, setSources] = useState<PatientSource[]>([]);
  const [sourceEntries, setSourceEntries] = useState<Record<string, SourceEntry>>({});
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  const addDailyPatients = useAddDailyPatients();

  useEffect(() => {
    if (open) {
      loadSources();
      if (initialDate) {
        setDate(initialDate);
      }
    }
  }, [open, initialDate]);

  const loadSources = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('patient_sources')
        .select('id, name, source_type, is_active')
        .eq('is_active', true)
        .order('source_type')
        .order('name');

      if (error) throw error;

      setSources(data || []);
      
      // Initialize entries
      const entries: Record<string, SourceEntry> = {};
      (data || []).forEach(source => {
        entries[source.id] = {
          source_id: source.id,
          count: 1,
          selected: false
        };
      });
      setSourceEntries(entries);
    } catch (error) {
      console.error('Error loading sources:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleSource = (sourceId: string) => {
    setSourceEntries(prev => ({
      ...prev,
      [sourceId]: {
        ...prev[sourceId],
        selected: !prev[sourceId].selected
      }
    }));
  };

  const handleCountChange = (sourceId: string, delta: number) => {
    setSourceEntries(prev => ({
      ...prev,
      [sourceId]: {
        ...prev[sourceId],
        count: Math.max(1, prev[sourceId].count + delta),
        selected: true
      }
    }));
  };

  const handleDirectCountChange = (sourceId: string, value: string) => {
    const numValue = parseInt(value) || 1;
    setSourceEntries(prev => ({
      ...prev,
      [sourceId]: {
        ...prev[sourceId],
        count: Math.max(1, numValue),
        selected: numValue > 0
      }
    }));
  };

  const handleSubmit = async () => {
    const selectedEntries = Object.values(sourceEntries).filter(e => e.selected);
    
    if (selectedEntries.length === 0) {
      return;
    }

    const inputs = selectedEntries.map(entry => ({
      source_id: entry.source_id,
      date: date,
      count: entry.count,
      notes: notes || undefined
    }));

    await addDailyPatients.mutateAsync(inputs);
    
    // Reset form
    setNotes('');
    setSearchQuery('');
    const resetEntries: Record<string, SourceEntry> = {};
    sources.forEach(source => {
      resetEntries[source.id] = {
        source_id: source.id,
        count: 1,
        selected: false
      };
    });
    setSourceEntries(resetEntries);
    
    onSuccess?.();
    onOpenChange(false);
  };

  const clearSelection = () => {
    const resetEntries: Record<string, SourceEntry> = {};
    sources.forEach(source => {
      resetEntries[source.id] = {
        source_id: source.id,
        count: 1,
        selected: false
      };
    });
    setSourceEntries(resetEntries);
  };

  const selectedCount = Object.values(sourceEntries).filter(e => e.selected).length;
  const totalPatients = Object.values(sourceEntries)
    .filter(e => e.selected)
    .reduce((sum, e) => sum + e.count, 0);

  // Filter sources by search
  const filteredSources = sources.filter(source => 
    source.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    source.source_type.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Group sources by type
  const groupedSources = filteredSources.reduce((acc, source) => {
    const type = source.source_type;
    if (!acc[type]) acc[type] = [];
    acc[type].push(source);
    return acc;
  }, {} as Record<string, PatientSource[]>);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader className="pb-2">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Users className="w-5 h-5 text-primary" />
            Add Daily Patients
          </DialogTitle>
          <DialogDescription>
            Record patient visits for {format(date, 'EEEE, MMMM d, yyyy')}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col space-y-4">
          {/* Date Picker */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal h-11",
                    !date && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(date, 'EEEE, MMMM d, yyyy') : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={(d) => d && setDate(d)}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search sources..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-9"
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                onClick={() => setSearchQuery('')}
              >
                <X className="w-3 h-3" />
              </Button>
            )}
          </div>

          {/* Source Selection */}
          <div className="flex-1 overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : filteredSources.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <p className="text-muted-foreground">No sources found</p>
                {searchQuery && (
                  <Button variant="link" onClick={() => setSearchQuery('')}>
                    Clear search
                  </Button>
                )}
              </div>
            ) : (
              <ScrollArea className="h-[280px] border rounded-lg p-3">
                <div className="space-y-4">
                  {Object.entries(groupedSources).map(([type, typeSources]) => {
                    const config = SOURCE_TYPE_CONFIG[type as SourceType];
                    return (
                      <div key={type} className="space-y-2">
                        <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground sticky top-0 bg-background py-1">
                          <span className="text-lg">{config?.icon || '📌'}</span>
                          <span>{config?.label || type}</span>
                          <Badge variant="secondary" className="text-xs">
                            {typeSources.length}
                          </Badge>
                        </div>
                        <div className="space-y-1 pl-2">
                          {typeSources.map(source => {
                            const entry = sourceEntries[source.id];
                            if (!entry) return null;
                            
                            return (
                              <div
                                key={source.id}
                                className={cn(
                                  "flex items-center justify-between p-2.5 rounded-lg transition-all cursor-pointer group",
                                  entry.selected 
                                    ? "bg-primary/10 border-2 border-primary/30 shadow-sm" 
                                    : "hover:bg-muted/50 border-2 border-transparent"
                                )}
                                onClick={() => handleToggleSource(source.id)}
                              >
                                <div className="flex items-center gap-3 flex-1">
                                  <Checkbox
                                    checked={entry.selected}
                                    className="data-[state=checked]:bg-primary"
                                  />
                                  <span className={cn(
                                    "text-sm font-medium truncate transition-colors",
                                    entry.selected && "text-primary"
                                  )}>
                                    {source.name}
                                  </span>
                                </div>
                                
                                <div 
                                  className="flex items-center gap-1"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className={cn(
                                      "h-7 w-7 rounded-full",
                                      entry.selected && "hover:bg-primary/20"
                                    )}
                                    onClick={() => handleCountChange(source.id, -1)}
                                    disabled={entry.count <= 1}
                                  >
                                    <Minus className="w-3 h-3" />
                                  </Button>
                                  <Input
                                    type="number"
                                    min="1"
                                    value={entry.count}
                                    onChange={(e) => handleDirectCountChange(source.id, e.target.value)}
                                    className={cn(
                                      "w-12 h-7 text-center font-bold text-sm p-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
                                      entry.selected && "border-primary/30"
                                    )}
                                  />
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className={cn(
                                      "h-7 w-7 rounded-full",
                                      entry.selected && "hover:bg-primary/20"
                                    )}
                                    onClick={() => handleCountChange(source.id, 1)}
                                  >
                                    <Plus className="w-3 h-3" />
                                  </Button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Notes (optional)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any notes about these patient visits..."
              rows={2}
              className="resize-none"
            />
          </div>

          {/* Summary & Actions */}
          <div className="pt-2 border-t space-y-3">
            {selectedCount > 0 && (
              <div className="flex items-center justify-between p-3 bg-primary/5 rounded-lg border border-primary/20">
                <div className="flex items-center gap-3">
                  <Badge variant="secondary" className="font-semibold">
                    {selectedCount} source{selectedCount !== 1 ? 's' : ''}
                  </Badge>
                  <Badge variant="default" className="font-bold text-base px-3">
                    <Users className="w-4 h-4 mr-1" />
                    {totalPatients} patient{totalPatients !== 1 ? 's' : ''}
                  </Badge>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={clearSelection}
                  className="text-muted-foreground hover:text-foreground"
                >
                  Clear
                </Button>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={selectedCount === 0 || addDailyPatients.isPending}
                className="min-w-[140px]"
              >
                {addDailyPatients.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 mr-2" />
                    Add {totalPatients} Patient{totalPatients !== 1 ? 's' : ''}
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
