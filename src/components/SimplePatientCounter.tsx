import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Plus, Minus, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface SimplePatientCounterProps {
  sourceId: string;
  sourceName: string;
  currentCount: number;
  onUpdate: (newCount: number) => void;
}

export function SimplePatientCounter({ 
  sourceId, 
  sourceName, 
  currentCount, 
  onUpdate 
}: SimplePatientCounterProps) {
  const [updating, setUpdating] = useState(false);
  const [inputValue, setInputValue] = useState(currentCount.toString());
  const { toast } = useToast();

  const updateCount = async (newCount: number) => {
    if (newCount === currentCount || newCount < 0) return;
    
    setUpdating(true);
    try {
      const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM format
      
      const { error } = await supabase
        .from('monthly_patients')
        .upsert({
          source_id: sourceId,
          year_month: currentMonth,
          patient_count: newCount,
          user_id: (await supabase.auth.getUser()).data.user?.id
        });

      if (error) throw error;

      onUpdate(newCount);
      setInputValue(newCount.toString());
      
      toast({
        title: "Updated",
        description: `${sourceName}: ${newCount} patients this month`,
      });
    } catch (error) {
      console.error('Error updating count:', error);
      toast({
        title: "Error",
        description: "Failed to update patient count",
        variant: "destructive",
      });
    } finally {
      setUpdating(false);
    }
  };

  const handleInputSubmit = () => {
    const newCount = parseInt(inputValue) || 0;
    updateCount(newCount);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleInputSubmit();
    }
  };

  return (
    <div className="flex items-center gap-3">
      <Badge variant="secondary" className="flex items-center gap-1 px-3 py-1">
        <Users className="w-3 h-3" />
        {currentCount}
      </Badge>
      
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={() => updateCount(currentCount - 1)}
          disabled={updating || currentCount <= 0}
        >
          <Minus className="h-3 w-3" />
        </Button>
        
        <Input
          type="number"
          min="0"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onBlur={handleInputSubmit}
          onKeyPress={handleKeyPress}
          className="w-16 h-8 text-center text-sm"
          disabled={updating}
        />
        
        <Button
          variant="outline"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={() => updateCount(currentCount + 1)}
          disabled={updating}
        >
          <Plus className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}