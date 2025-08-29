import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { PatientLoadHistoryModal } from './PatientLoadHistoryModal';
import { format } from 'date-fns';
import { Calendar as CalendarIcon, History, Plus, Save, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

interface PatientLoadHistoryEditorProps {
  officeId: string;
  officeName: string;
  currentLoad: number;
  onUpdate?: (newLoad: number) => void;
}

export const PatientLoadHistoryEditor: React.FC<PatientLoadHistoryEditorProps> = ({
  officeId,
  officeName,
  currentLoad,
  onUpdate
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [loading, setLoading] = useState(false);
  const [editForm, setEditForm] = useState({
    patient_count: currentLoad,
    notes: '',
    date: new Date()
  });
  const { toast } = useToast();
  const { user } = useAuth();

  const handleSave = async () => {
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "You must be logged in to update patient counts",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);

      // Update monthly patient count instead of patient_load
      const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM format
      const { error: updateError } = await supabase
        .from('monthly_patients')
        .upsert({
          source_id: officeId,
          year_month: currentMonth,
          patient_count: editForm.patient_count,
          user_id: user.id
        });

      if (updateError) throw updateError;

      // Add to change log if notes provided
      if (editForm.notes) {
        const { error: historyError } = await supabase
          .from('patient_changes_log')
          .insert({
            source_id: officeId,
            year_month: currentMonth,
            old_count: currentLoad,
            new_count: editForm.patient_count,
            reason: editForm.notes,
            change_type: 'manual_edit',
            user_id: user.id
          });

        if (historyError) throw historyError;
      }

      toast({
        title: "Success",
        description: "Patient load updated successfully",
      });

      setIsEditing(false);
      if (onUpdate) {
        onUpdate(editForm.patient_count);
      }
    } catch (error) {
      console.error('Error updating patient load:', error);
      toast({
        title: "Error",
        description: "Failed to update patient load",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setEditForm({
      patient_count: currentLoad,
      notes: '',
      date: new Date()
    });
    setIsEditing(false);
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Patient Load Management</span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowHistory(true)}
              >
                <History className="h-4 w-4 mr-2" />
                View History
              </Button>
              {!isEditing && (
                <Button
                  size="sm"
                  onClick={() => setIsEditing(true)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Update Load
                </Button>
              )}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isEditing ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="patient_count">Patient Count</Label>
                  <Input
                    id="patient_count"
                    type="number"
                    min="0"
                    value={editForm.patient_count}
                    onChange={(e) => setEditForm(prev => ({
                      ...prev,
                      patient_count: parseInt(e.target.value) || 0
                    }))}
                  />
                </div>
                <div>
                  <Label>Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !editForm.date && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {editForm.date ? format(editForm.date, "PPP") : <span>Pick a date</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={editForm.date}
                        onSelect={(date) => date && setEditForm(prev => ({ ...prev, date }))}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              <div>
                <Label htmlFor="notes">Notes (Optional)</Label>
                <Textarea
                  id="notes"
                  placeholder="Add any notes about this update..."
                  value={editForm.notes}
                  onChange={(e) => setEditForm(prev => ({
                    ...prev,
                    notes: e.target.value
                  }))}
                  rows={3}
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={handleCancel}
                  disabled={loading}
                >
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={loading}
                >
                  <Save className="h-4 w-4 mr-2" />
                  {loading ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="text-4xl font-bold text-primary mb-2">
                {currentLoad}
              </div>
              <p className="text-sm text-muted-foreground">
                Current Patient Load
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* History Modal */}
      <PatientLoadHistoryModal
        officeId={officeId}
        officeName={officeName}
        isOpen={showHistory}
        onClose={() => setShowHistory(false)}
      />
    </>
  );
};

// Export as default for compatibility
export default PatientLoadHistoryEditor;