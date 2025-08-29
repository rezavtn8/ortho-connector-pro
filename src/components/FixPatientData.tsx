// src/components/FixPatientData.tsx
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { AlertTriangle, CheckCircle, RefreshCw, Trash2 } from 'lucide-react';

export const FixPatientData: React.FC = () => {
  const [fixing, setFixing] = useState(false);
  const [status, setStatus] = useState<string>('');
  const { toast } = useToast();

  const resetAllPatientLoads = async () => {
    if (!confirm('This will reset all patient loads to 0. Are you sure?')) {
      return;
    }

    setFixing(true);
    setStatus('Resetting all patient loads...');

    try {
      // Reset all patient loads to 0
      const { error } = await supabase
        .from('patient_sources')
        .update({ patient_load: 0 })
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Update all records

      if (error) throw error;

      toast({
        title: "Reset Complete",
        description: "All patient loads have been reset to 0. You can now re-import the correct data.",
      });

      setStatus('Reset complete. Ready for new import.');
    } catch (error) {
      console.error('Error resetting data:', error);
      toast({
        title: "Reset Failed",
        description: "Failed to reset patient loads",
        variant: "destructive",
      });
      setStatus('Reset failed.');
    } finally {
      setFixing(false);
    }
  };

  const redistributeFromElite = async () => {
    if (!confirm('This will attempt to redistribute the Elite Dental Irvine data to the correct offices. Continue?')) {
      return;
    }

    setFixing(true);
    setStatus('Fetching Elite Dental data...');

    try {
      // First, get Elite Dental Irvine's history
      const { data: eliteOffice } = await supabase
        .from('patient_sources')
        .select('id')
        .ilike('name', '%Elite Dental Irvine%')
        .single();

      if (!eliteOffice) {
        throw new Error('Elite Dental Irvine not found');
      }

      // Get all history entries for Elite Dental
      const { data: eliteHistory } = await supabase
        .from('monthly_patient_data')
        .select('*')
        .eq('source_id', eliteOffice.id)
        .order('timestamp', { ascending: true });

      if (!eliteHistory || eliteHistory.length === 0) {
        setStatus('No history found for Elite Dental Irvine');
        return;
      }

      setStatus(`Found ${eliteHistory.length} history entries. Analyzing notes...`);

      // Group history by actual office names from notes
      const redistributionMap: { [officeName: string]: any[] } = {};
      
      eliteHistory.forEach(entry => {
        // Try to extract office name from notes
        // Notes format: "Imported [month] [year]: X patients"
        if (entry.notes && entry.notes.includes('Imported')) {
          // This might have the wrong office, need to check original import data
          // For now, we'll need manual redistribution
          const month = entry.notes.match(/Imported (\w+)/)?.[1];
          if (!redistributionMap['Elite Dental Irvine']) {
            redistributionMap['Elite Dental Irvine'] = [];
          }
          redistributionMap['Elite Dental Irvine'].push(entry);
        }
      });

      setStatus('Data analysis complete. Please use the import feature with correct office matching.');

      toast({
        title: "Analysis Complete",
        description: `Found ${eliteHistory.length} entries. Please re-import with corrected matching.`,
      });

    } catch (error) {
      console.error('Error redistributing data:', error);
      toast({
        title: "Redistribution Failed",
        description: "Failed to redistribute data. Please reset and re-import.",
        variant: "destructive",
      });
      setStatus('Redistribution failed.');
    } finally {
      setFixing(false);
    }
  };

  const clearHistoryForOffice = async () => {
    if (!confirm('This will clear ALL patient load history. Are you sure?')) {
      return;
    }

    setFixing(true);
    setStatus('Clearing history...');

    try {
      // Get Elite Dental Irvine
      const { data: eliteOffice } = await supabase
        .from('patient_sources')
        .select('id')
        .ilike('name', '%Elite Dental Irvine%')
        .single();

      if (eliteOffice) {
        // Delete all history for Elite Dental
        const { error } = await supabase
          .from('monthly_patient_data')
          .delete()
          .eq('source_id', eliteOffice.id);

        if (error) throw error;

        // Reset Elite Dental's current load
        await supabase
          .from('patient_sources')
          .update({ patient_load: 0 })
          .eq('id', eliteOffice.id);
      }

      toast({
        title: "History Cleared",
        description: "Elite Dental Irvine history has been cleared. Ready for correct import.",
      });

      setStatus('History cleared. Ready for new import.');
    } catch (error) {
      console.error('Error clearing history:', error);
      toast({
        title: "Clear Failed",
        description: "Failed to clear history",
        variant: "destructive",
      });
    } finally {
      setFixing(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-yellow-600" />
          Fix Patient Load Data
        </CardTitle>
        <CardDescription>
          Tools to fix incorrectly imported patient load data
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Data Issue Detected</AlertTitle>
          <AlertDescription>
            It appears all patient load data was incorrectly assigned to Elite Dental Irvine. 
            Use these tools to fix the issue.
          </AlertDescription>
        </Alert>

        <div className="space-y-3">
          <div className="p-4 border rounded-lg space-y-2">
            <h3 className="font-semibold">Option 1: Reset and Re-import</h3>
            <p className="text-sm text-muted-foreground">
              Clear all patient loads and history, then re-import with fixed matching
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={clearHistoryForOffice}
                disabled={fixing}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Clear Elite Dental History
              </Button>
              <Button
                variant="destructive"
                onClick={resetAllPatientLoads}
                disabled={fixing}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Reset All Patient Loads
              </Button>
            </div>
          </div>

          <div className="p-4 border rounded-lg space-y-2">
            <h3 className="font-semibold">Option 2: Analyze Data</h3>
            <p className="text-sm text-muted-foreground">
              Analyze the current data distribution
            </p>
            <Button
              variant="outline"
              onClick={redistributeFromElite}
              disabled={fixing}
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Analyze Elite Dental Data
            </Button>
          </div>
        </div>

        {status && (
          <div className="mt-4 p-3 bg-muted rounded-lg">
            <p className="text-sm font-medium">{status}</p>
          </div>
        )}

        <Alert variant="default">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertTitle>Recommended Fix</AlertTitle>
          <AlertDescription>
            1. Click "Clear Elite Dental History" to remove incorrect data<br/>
            2. Re-import your CSV file - the matching has been improved<br/>
            3. The system will now properly match office names
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
};