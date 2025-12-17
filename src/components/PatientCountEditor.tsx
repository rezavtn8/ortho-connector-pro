import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Minus, Check, X, Loader2, Calendar } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { getCurrentYearMonth } from '@/lib/dateSync';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface PatientCountEditorProps {
  sourceId: string;
  currentCount: number;
  onUpdate: () => void;
  isEditable?: boolean;
  dailyEntryCount?: number;
}

export function PatientCountEditor({ 
  sourceId, 
  currentCount, 
  onUpdate,
  isEditable = true,
  dailyEntryCount = 0
}: PatientCountEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState(currentCount.toString());
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    setValue(currentCount.toString());
  }, [currentCount]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSave = async (newValue?: number) => {
    const finalValue = newValue !== undefined ? newValue : parseInt(value) || 0;
    
    if (finalValue === currentCount) {
      setIsEditing(false);
      return;
    }

    setIsLoading(true);
    
    try {
      const currentMonth = getCurrentYearMonth();
      
      const { data, error } = await supabase.rpc('set_patient_count', {
        p_source_id: sourceId,
        p_year_month: currentMonth,
        p_count: finalValue,
        p_reason: newValue !== undefined ? 
          (newValue > currentCount ? 'Quick increment' : 'Quick decrement') : 
          'Manual edit'
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: `Patient count updated to ${finalValue}`,
      });

      setIsEditing(false);
      onUpdate();
    } catch (error) {
      console.error('Error updating patient count:', error);
      toast({
        title: "Error",
        description: "Failed to update patient count",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleIncrement = () => {
    const newValue = currentCount + 1;
    handleSave(newValue);
  };

  const handleDecrement = () => {
    const newValue = Math.max(0, currentCount - 1);
    handleSave(newValue);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      setValue(currentCount.toString());
      setIsEditing(false);
    }
  };

  const handleCancel = () => {
    setValue(currentCount.toString());
    setIsEditing(false);
  };

  // Read-only mode when tracking via daily patients
  if (!isEditable) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center justify-center gap-1.5 px-2 py-1 bg-muted/50 rounded-md">
              <Calendar className="w-3 h-3 text-primary" />
              <span className="font-semibold text-sm">{currentCount}</span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs">
            <p className="text-xs">
              Tracked via Daily Patients ({dailyEntryCount} {dailyEntryCount === 1 ? 'entry' : 'entries'})
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Edit daily entries to change this total
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  if (isEditing) {
    return (
      <div className="flex items-center gap-1 animate-scale-in">
        <Button
          size="sm"
          variant="outline"
          onClick={handleDecrement}
          disabled={isLoading}
          className="h-6 w-6 p-0 hover:bg-red-50 hover:border-red-200 hover:text-red-600 transition-colors"
        >
          <Minus className="w-3 h-3" />
        </Button>
        
        <div className="relative">
          <Input
            ref={inputRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyPress}
            className="h-6 w-12 text-center text-xs px-1 border-primary/50 focus:border-primary"
            type="number"
            min="0"
            disabled={isLoading}
          />
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/80">
              <Loader2 className="w-3 h-3 animate-spin" />
            </div>
          )}
        </div>

        <Button
          size="sm"
          variant="outline"
          onClick={handleIncrement}
          disabled={isLoading}
          className="h-6 w-6 p-0 hover:bg-green-50 hover:border-green-200 hover:text-green-600 transition-colors"
        >
          <Plus className="w-3 h-3" />
        </Button>

        <div className="flex gap-0.5 ml-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => handleSave()}
            disabled={isLoading}
            className="h-5 w-5 p-0 hover:bg-green-50 hover:text-green-600"
          >
            <Check className="w-3 h-3" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleCancel}
            disabled={isLoading}
            className="h-5 w-5 p-0 hover:bg-red-50 hover:text-red-600"
          >
            <X className="w-3 h-3" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 animate-fade-in">
      <Button
        size="sm"
        variant="outline"
        onClick={handleDecrement}
        disabled={isLoading}
        className="h-6 w-6 p-0 hover:bg-red-50 hover:border-red-200 hover:text-red-600 transition-colors"
        title="Decrease by 1"
      >
        <Minus className="w-3 h-3" />
      </Button>
      
      <div 
        className="relative min-w-[2rem] text-center cursor-pointer hover:bg-muted/50 rounded px-1 py-0.5 transition-colors"
        onClick={() => setIsEditing(true)}
        title="Click to edit directly"
      >
        <span className="font-semibold text-sm hover:text-primary transition-colors">
          {currentCount}
        </span>
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/80 rounded">
            <Loader2 className="w-3 h-3 animate-spin" />
          </div>
        )}
      </div>

      <Button
        size="sm"
        variant="outline"
        onClick={handleIncrement}
        disabled={isLoading}
        className="h-6 w-6 p-0 hover:bg-green-50 hover:border-green-200 hover:text-green-600 transition-colors"
        title="Increase by 1"
      >
        <Plus className="w-3 h-3" />
      </Button>
    </div>
  );
}