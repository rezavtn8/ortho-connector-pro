import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Calendar, TrendingUp, TrendingDown, Minus, Save, History } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

interface PatientLoadHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  officeId: string;
  officeName: string;
  currentPatientLoad: number;
  onUpdate: () => void;
}

interface HistoryEntry {
  id: string;
  patient_count: number;
  previous_count: number | null;
  timestamp: string;
  notes: string | null;
}

interface ChartDataPoint {
  date: string;
  count: number;
  formattedDate: string;
}

export function PatientLoadHistoryModal({ 
  isOpen, 
  onClose, 
  officeId, 
  officeName, 
  currentPatientLoad,
  onUpdate 
}: PatientLoadHistoryModalProps) {
  const [newPatientLoad, setNewPatientLoad] = useState(currentPatientLoad.toString());
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [dateRange, setDateRange] = useState(30); // days
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen) {
      setNewPatientLoad(currentPatientLoad.toString());
      loadHistory();
    }
  }, [isOpen, currentPatientLoad, officeId, dateRange]);

  const loadHistory = async () => {
    try {
      // Load history data
      const { data: historyData, error: historyError } = await supabase
        .from('patient_load_history')
        .select('*')
        .eq('office_id', officeId)
        .gte('timestamp', new Date(Date.now() - dateRange * 24 * 60 * 60 * 1000).toISOString())
        .order('timestamp', { ascending: false })
        .limit(50);

      if (historyError) {
        console.error('Error loading history:', historyError);
        return;
      }

      setHistory(historyData || []);

      // Transform data for chart
      const chartPoints: ChartDataPoint[] = [];
      
      // Add current point
      chartPoints.push({
        date: new Date().toISOString(),
        count: currentPatientLoad,
        formattedDate: format(new Date(), 'MMM dd')
      });

      // Add historical points
      if (historyData) {
        historyData.reverse().forEach((entry) => {
          chartPoints.unshift({
            date: entry.timestamp,
            count: entry.patient_count,
            formattedDate: format(new Date(entry.timestamp), 'MMM dd')
          });
        });
      }

      // Remove duplicates and sort by date
      const uniquePoints = chartPoints.reduce((acc, point) => {
        const existingIndex = acc.findIndex(p => 
          format(new Date(p.date), 'yyyy-MM-dd') === format(new Date(point.date), 'yyyy-MM-dd')
        );
        if (existingIndex === -1) {
          acc.push(point);
        } else {
          // Keep the latest point for that day
          if (new Date(point.date) > new Date(acc[existingIndex].date)) {
            acc[existingIndex] = point;
          }
        }
        return acc;
      }, [] as ChartDataPoint[]);

      setChartData(uniquePoints.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()));
    } catch (error) {
      console.error('Error loading patient load history:', error);
    }
  };

  const handleUpdatePatientLoad = async () => {
    if (!newPatientLoad || isNaN(parseInt(newPatientLoad))) {
      toast({
        title: "Invalid Input",
        description: "Please enter a valid number for patient load.",
        variant: "destructive",
      });
      return;
    }

    const newCount = parseInt(newPatientLoad);
    if (newCount === currentPatientLoad) {
      toast({
        title: "No Change",
        description: "Patient load value hasn't changed.",
        variant: "default",
      });
      return;
    }

    setLoading(true);
    try {
      // Update the patient load in the office record
      const { error: updateError } = await supabase
        .from('referring_offices')
        .update({ 
          patient_load: newCount,
          updated_at: new Date().toISOString()
        })
        .eq('id', officeId);

      if (updateError) {
        throw updateError;
      }

      // If notes were provided, update the most recent history entry
      if (notes.trim()) {
        const { error: notesError } = await supabase
          .from('patient_load_history')
          .update({ notes: notes.trim() })
          .eq('office_id', officeId)
          .order('timestamp', { ascending: false })
          .limit(1);

        if (notesError) {
          console.error('Error updating notes:', notesError);
        }
      }

      toast({
        title: "Updated Successfully",
        description: `Patient load updated to ${newCount}`,
        variant: "default",
      });

      setNotes('');
      onUpdate();
      loadHistory();
    } catch (error) {
      console.error('Error updating patient load:', error);
      toast({
        title: "Error",
        description: "Failed to update patient load. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Patient Load History - {officeName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Update Patient Load Section */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Save className="h-4 w-4" />
                Update Patient Load
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="currentLoad">Current Patient Load</Label>
                  <Input
                    id="currentLoad"
                    value={currentPatientLoad}
                    disabled
                    className="bg-muted"
                  />
                </div>
                <div>
                  <Label htmlFor="newLoad">New Patient Load</Label>
                  <Input
                    id="newLoad"
                    type="number"
                    value={newPatientLoad}
                    onChange={(e) => setNewPatientLoad(e.target.value)}
                    placeholder="Enter new patient count"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="notes">Notes (Optional)</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add notes about this change..."
                  rows={2}
                />
              </div>
              <Button 
                onClick={handleUpdatePatientLoad} 
                disabled={loading}
                className="w-full"
              >
                {loading ? 'Updating...' : 'Update Patient Load'}
              </Button>
            </CardContent>
          </Card>

          {/* Chart Section */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Patient Load Trend
                </CardTitle>
                <div className="flex gap-2">
                  <Button
                    variant={dateRange === 30 ? "default" : "outline"}
                    size="sm"
                    onClick={() => setDateRange(30)}
                  >
                    30 Days
                  </Button>
                  <Button
                    variant={dateRange === 90 ? "default" : "outline"}
                    size="sm"
                    onClick={() => setDateRange(90)}
                  >
                    90 Days
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="formattedDate" 
                      angle={-45}
                      textAnchor="end"
                      height={60}
                    />
                    <YAxis />
                    <Tooltip 
                      labelFormatter={(label, payload) => {
                        if (payload && payload[0]) {
                          return format(new Date(payload[0].payload.date), 'MMM dd, yyyy');
                        }
                        return label;
                      }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="count" 
                      stroke="hsl(var(--primary))" 
                      strokeWidth={2}
                      dot={{ fill: 'hsl(var(--primary))', strokeWidth: 2, r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-64 text-muted-foreground">
                  <div className="text-center">
                    <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No historical data available</p>
                    <p className="text-sm">Start tracking by updating the patient load above</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* History Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <History className="h-4 w-4" />
                Change History
              </CardTitle>
            </CardHeader>
            <CardContent>
              {history.length > 0 ? (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {history.map((entry) => (
                    <div key={entry.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                          {entry.previous_count !== null && (
                            <>
                              <span className="text-sm text-muted-foreground">
                                {entry.previous_count}
                              </span>
                              <span className="text-muted-foreground">→</span>
                            </>
                          )}
                          <span className="font-medium">{entry.patient_count}</span>
                          {entry.previous_count !== null && (
                            <span className={`text-xs ${
                              entry.patient_count > entry.previous_count 
                                ? 'text-green-600' 
                                : entry.patient_count < entry.previous_count 
                                ? 'text-red-600' 
                                : 'text-gray-500'
                            }`}>
                              {entry.patient_count > entry.previous_count 
                                ? `(+${entry.patient_count - entry.previous_count})` 
                                : entry.patient_count < entry.previous_count 
                                ? `(${entry.patient_count - entry.previous_count})` 
                                : '(no change)'
                              }
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-muted-foreground">
                          {format(new Date(entry.timestamp), 'MMM dd, yyyy')}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {format(new Date(entry.timestamp), 'h:mm a')}
                        </div>
                        {entry.notes && (
                          <div className="text-xs text-muted-foreground mt-1 max-w-48 truncate">
                            "{entry.notes}"
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No history available</p>
                  <p className="text-sm">Changes will appear here after you update the patient load</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}
