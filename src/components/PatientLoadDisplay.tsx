import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { TrendingUp, TrendingDown, Minus, Plus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface PatientLoadDisplayProps {
  officeId: string;
  patientLoad: number;
  onUpdate: () => void;
}

export function PatientLoadDisplay({ officeId, patientLoad, onUpdate }: PatientLoadDisplayProps) {
  const [updating, setUpdating] = useState(false);
  const { toast } = useToast();

  const updatePatientLoad = async (change: number) => {
    const newCount = Math.max(0, patientLoad + change);
    
    if (newCount === patientLoad) return;
    
    setUpdating(true);
    try {
      const { error } = await supabase
        .from('referring_offices')
        .update({ 
          patient_load: newCount,
          updated_at: new Date().toISOString()
        })
        .eq('id', officeId);

      if (error) throw error;

      toast({
        title: "Patient load updated",
        description: `Updated to ${newCount}`,
        variant: "default",
      });

      onUpdate();
    } catch (error) {
      console.error('Error updating patient load:', error);
      toast({
        title: "Error",
        description: "Failed to update patient load",
        variant: "destructive",
      });
    } finally {
      setUpdating(false);
    }
  };

  const getTrendIcon = () => {
    // Simple logic: show trend based on recent activity
    // This could be enhanced with actual trend calculation
    if (patientLoad > 15) return <TrendingUp className="h-3 w-3 text-green-600" />;
    if (patientLoad < 5) return <TrendingDown className="h-3 w-3 text-red-600" />;
    return <Minus className="h-3 w-3 text-muted-foreground" />;
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <span className="font-medium text-foreground">{patientLoad}</span>
              {getTrendIcon()}
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={() => updatePatientLoad(-1)}
                disabled={updating || patientLoad <= 0}
              >
                <Minus className="h-3 w-3" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={() => updatePatientLoad(1)}
                disabled={updating}
              >
                <Plus className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent side="top">
          <p>Patient Load: {patientLoad}</p>
          <p className="text-xs text-muted-foreground">Use +/- buttons to adjust</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}