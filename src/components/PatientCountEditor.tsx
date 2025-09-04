import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Minus, Check, X, Edit3, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { getCurrentYearMonth } from '@/lib/database.types';

interface PatientCountEditorProps {
  sourceId: string;
  currentCount: number;
  onUpdate: () => void;
}

export function PatientCountEditor({ sourceId, currentCount, onUpdate }: PatientCountEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState(currentCount.toString());
  const [isLoading, setIsLoading] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const currentMonth = getCurrentYearMonth();
      
      // Check if record exists for this month
      const { data: existing } = await supabase
        .from('monthly_patients')
        .select('id, patient_count')
        .eq('source_id', sourceId)
        .eq('year_month', currentMonth)
        .maybeSingle();

      if (existing) {
        // Update existing record
        const { error } = await supabase
          .from('monthly_patients')
          .update({ 
            patient_count: finalValue,
            updated_at: new Date().toISOString()
          })
          .eq('id', existing.id);

        if (error) throw error;
      } else if (finalValue > 0) {
        // Insert new record only if value is greater than 0
        const { error } = await supabase
          .from('monthly_patients')
          .insert({
            source_id: sourceId,
            year_month: currentMonth,
            patient_count: finalValue,
            user_id: user.id
          });

        if (error) throw error;
      }

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
    <div 
      className="relative inline-flex items-center gap-1 group cursor-pointer"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => setIsEditing(true)}
    >
      <div className="relative">
        <span className="font-semibold text-sm group-hover:text-primary transition-colors">
          {currentCount}
        </span>
        
        {/* Hover overlay with quick actions */}
        {isHovered && (
          <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 flex items-center gap-0.5 bg-popover border rounded-md shadow-md p-0.5 animate-fade-in z-10">
            <Button
              size="sm"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                handleDecrement();
              }}
              className="h-5 w-5 p-0 hover:bg-red-50 hover:text-red-600"
              title="Decrease by 1"
            >
              <Minus className="w-2.5 h-2.5" />
            </Button>
            
            <Button
              size="sm"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                setIsEditing(true);
              }}
              className="h-5 w-5 p-0 hover:bg-blue-50 hover:text-blue-600"
              title="Edit directly"
            >
              <Edit3 className="w-2.5 h-2.5" />
            </Button>
            
            <Button
              size="sm"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                handleIncrement();
              }}
              className="h-5 w-5 p-0 hover:bg-green-50 hover:text-green-600"
              title="Increase by 1"
            >
              <Plus className="w-2.5 h-2.5" />
            </Button>
          </div>
        )}
      </div>
      
      {/* Edit hint */}
      <Edit3 className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
    </div>
  );
}