// src/components/PatientLoadDisplay.tsx - SIMPLIFIED VERSION
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Minus, Users } from 'lucide-react';
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

  const updatePatientCount = async (change: number) => {
    const newCount = Math.max(0, patientLoad + change);
    
    if (newCount === patientLoad) return;
    
    setUpdating(true);
    try {
      // Update the patient count in the database
      const { error } = await supabase
        .from('patient_sources')
        .update({ 
          patient_load: newCount,
          updated_at: new Date().toISOString()
        })
        .eq('id', officeId);

      if (error) throw error;

      // The database trigger will automatically log this change to patient_load_history

      toast({
        title: change > 0 ? "Patient added" : "Patient removed",
        description: `Total patients from this source: ${newCount}`,
      });

      onUpdate();
    } catch (error) {
      console.error('Error updating patient count:', error);
      toast({
        title: "Error",
        description: "Failed to update patient count",
        variant: "destructive",
      });
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Badge variant="secondary" className="px-3 py-1">
        <Users className="w-3 h-3 mr-1" />
        {patientLoad} patients
      </Badge>
      
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          className="h-7 w-7 p-0"
          onClick={() => updatePatientCount(-1)}
          disabled={updating || patientLoad <= 0}
        >
          <Minus className="h-3 w-3" />
        </Button>
        
        <Button
          variant="outline"
          size="sm"
          className="h-7 w-7 p-0"
          onClick={() => updatePatientCount(1)}
          disabled={updating}
        >
          <Plus className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}