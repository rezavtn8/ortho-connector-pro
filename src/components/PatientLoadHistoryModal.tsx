import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { Calendar, TrendingUp, TrendingDown, Minus, Clock, User } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format, subDays, parseISO } from 'date-fns';

interface PatientLoadHistoryModalProps {
  officeId: string;
  officeName: string;
  isOpen: boolean;
  onClose: () => void;
}

interface HistoryEntry {
  id: string;
  timestamp: string;
  patient_count: number;
  previous_count: number | null;
  notes: string | null;
  changed_by_user_id: string | null;
}

interface ChartData {
  date: string;
  count: number;
  label: string;
}

export const PatientLoadHistoryModal: React.FC<PatientLoadHistoryModalProps> = ({
  officeId,
  officeName,
  isOpen,
  onClose
}) => {
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [timeRange, setTimeRange] = useState(30); // days
  const [currentLoad, setCurrentLoad] = useState(0);
  const [trend, setTrend] = useState<'up' | 'down' | 'stable'>('stable');

  useEffect(() => {
    if (isOpen && officeId) {
      fetchHistory();
    }
  }, [isOpen, officeId, timeRange]);

  const fetchHistory = async () => {
    try {
      setLoading(true);
      const startDate = subDays(new Date(), timeRange);

      // Fetch historical data
      const { data: historyData, error: historyError } = await supabase
        .from('monthly_patient_data')
        .select('*')
        .eq('source_id', officeId)
        .gte('timestamp', startDate.toISOString())
        .order('timestamp', { ascending: false });

      if (historyError) throw historyError;

      // Fetch current patient load
      const { data: officeData, error: officeError } = await supabase
        .from('patient_sources')
        .select('patient_load')
        .eq('id', officeId)
        .single();

      if (officeError) throw officeError;

      setHistory(historyData || []);
      setCurrentLoad(officeData?.patient_load || 0);

      // Process data for chart
      if (historyData && historyData.length > 0) {
        const processedData = historyData
          .slice()
          .reverse()
          .map((entry) => ({
            date: format(parseISO(entry.timestamp), 'MMM dd'),
            count: entry.patient_count,
            label: format(parseISO(entry.timestamp), 'PPp')
          }));
        
        setChartData(processedData);

        // Calculate trend
        if (historyData.length > 1) {
          const recent = historyData[0].patient_count;
          const previous = historyData[Math.min(historyData.length - 1, 7)].patient_count;
          
          if (recent > previous) setTrend('up');
          else if (recent < previous) setTrend('down');
          else setTrend('stable');
        }
      }
    } catch (error) {
      console.error('Error fetching patient load history:', error);
    } finally {
      setLoading(false);
    }
  };

  const getTrendIcon = () => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="h-4 w-4 text-green-600" />;
      case 'down':
        return <TrendingDown className="h-4 w-4 text-red-600" />;
      default:
        return <Minus className="h-4 w-4 text-gray-500" />;
    }
  };

  const getChangeColor = (current: number, previous: number | null) => {
    if (previous === null) return 'text-gray-600';
    if (current > previous) return 'text-green-600';
    if (current < previous) return 'text-red-600';
    return 'text-gray-600';
  };

  const getChangeText = (current: number, previous: number | null) => {
    if (previous === null) return 'Initial';
    const diff = current - previous;
    if (diff > 0) return `+${diff}`;
    if (diff < 0) return `${diff}`;
    return 'No change';
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            Patient Load History - {officeName}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="chart" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="chart">Trend Chart</TabsTrigger>
            <TabsTrigger value="history">History Log</TabsTrigger>
          </TabsList>

          <TabsContent value="chart" className="space-y-4">
            {/* Summary Stats */}
            <div className="grid grid-cols-3 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Current Load</p>
                      <p className="text-2xl font-bold">{currentLoad}</p>
                    </div>
                    {getTrendIcon()}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Period</p>
                    <p className="text-lg font-medium">{timeRange} days</p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Changes</p>
                    <p className="text-lg font-medium">{history.length}</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Time Range Selector */}
            <div className="flex gap-2">
              {[7, 30, 60, 90].map((days) => (
                <button
                  key={days}
                  onClick={() => setTimeRange(days)}
                  className={`px-3 py-1 rounded-md text-sm transition-colors ${
                    timeRange === days
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary hover:bg-secondary/80'
                  }`}
                >
                  {days}d
                </button>
              ))}
            </div>

            {/* Chart */}
            {loading ? (
              <div className="h-64 flex items-center justify-center">
                <div className="text-muted-foreground">Loading chart data...</div>
              </div>
            ) : chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis 
                    dataKey="date" 
                    tick={{ fontSize: 12 }}
                    stroke="#888"
                  />
                  <YAxis 
                    tick={{ fontSize: 12 }}
                    stroke="#888"
                  />
                  <Tooltip 
                    content={({ active, payload }) => {
                      if (active && payload && payload[0]) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-white p-3 rounded-lg shadow-lg border">
                            <p className="font-medium">{data.label}</p>
                            <p className="text-sm text-primary">
                              Patient Count: {data.count}
                            </p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="count"
                    stroke="#10b981"
                    strokeWidth={2}
                    fill="url(#colorCount)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-64 flex items-center justify-center text-muted-foreground">
                No data available for the selected period
              </div>
            )}
          </TabsContent>

          <TabsContent value="history" className="space-y-4">
            <ScrollArea className="h-[400px] w-full">
              {loading ? (
                <div className="flex items-center justify-center h-32">
                  <div className="text-muted-foreground">Loading history...</div>
                </div>
              ) : history.length > 0 ? (
                <div className="space-y-2">
                  {history.map((entry, index) => (
                    <Card key={entry.id} className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm font-medium">
                              {format(parseISO(entry.timestamp), 'PPp')}
                            </span>
                          </div>
                          <div className="flex items-center gap-4">
                            <span className="text-lg font-bold">{entry.patient_count}</span>
                            <Badge 
                              variant="outline" 
                              className={getChangeColor(entry.patient_count, entry.previous_count)}
                            >
                              {getChangeText(entry.patient_count, entry.previous_count)}
                            </Badge>
                          </div>
                          {entry.notes && (
                            <p className="text-sm text-muted-foreground mt-2">{entry.notes}</p>
                          )}
                        </div>
                        {entry.changed_by_user_id && (
                          <User className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="flex items-center justify-center h-32 text-muted-foreground">
                  No history available
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

// Make sure to export as default as well for compatibility
export default PatientLoadHistoryModal;