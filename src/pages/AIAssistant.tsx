import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Brain, MessageSquare, Settings, Users, Activity, TrendingUp, TrendingDown } from 'lucide-react';
import { AIAnalysisTab } from '@/components/ai/AIAnalysisTab';
import { AIChatTab } from '@/components/ai/AIChatTab';
import { AISettingsTab } from '@/components/ai/AISettingsTab';
import { supabase } from '@/integrations/supabase/client';
import { PatientSource, MonthlyPatients } from '@/lib/database.types';

export function AIAssistant() {
  const [activeTab, setActiveTab] = useState('analysis');
  const [totalPatients, setTotalPatients] = useState(0);
  const [averagePerSource, setAveragePerSource] = useState(0);
  const [growingSources, setGrowingSources] = useState(0);
  const [decliningSources, setDecliningSources] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadQuickStats();
  }, []);

  const loadQuickStats = async () => {
    try {
      // Load sources
      const { data: sourcesData } = await supabase
        .from('patient_sources')
        .select('*')
        .eq('is_active', true);

      // Load monthly data (last 6 months)
      const now = new Date();
      const startDate = new Date(now.getFullYear(), now.getMonth() - 6, 1);
      const startYearMonth = `${startDate.getFullYear()}-${(startDate.getMonth() + 1).toString().padStart(2, '0')}`;

      const { data: monthlyDataResult } = await supabase
        .from('monthly_patients')
        .select('*')
        .gte('year_month', startYearMonth);

      const sources = sourcesData || [];
      const monthlyData = monthlyDataResult || [];

      // Calculate stats
      const analyticsData = sources.map(source => {
        const sourceMonthlyData = monthlyData.filter(m => m.source_id === source.id);
        const total = sourceMonthlyData.reduce((sum, m) => sum + m.patient_count, 0);
        
        // Ensure chronological order by year_month before trend calculation
        const sorted = [...sourceMonthlyData].sort((a, b) => (a.year_month || '').localeCompare(b.year_month || ''));
        const recent = sorted.length >= 1 ? (sorted[sorted.length - 1].patient_count || 0) : 0;
        const previous = sorted.length >= 2 ? (sorted[sorted.length - 2].patient_count || 0) : 0;

        let trend: 'up' | 'down' | 'stable' = 'stable';
        if (sorted.length >= 2) {
          if (recent > previous) trend = 'up';
          else if (recent < previous) trend = 'down';
        }

        return { total, trend };
      });

      const total = analyticsData.reduce((sum, a) => sum + a.total, 0);
      const growing = analyticsData.filter(a => a.trend === 'up').length;
      const declining = analyticsData.filter(a => a.trend === 'down').length;

      setTotalPatients(total);
      setAveragePerSource(sources.length > 0 ? Math.round(total / sources.length) : 0);
      setGrowingSources(growing);
      setDecliningSources(declining);
    } catch (error) {
      console.error('Error loading quick stats:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header - Teal Theme matching other pages */}
      <div className="flex flex-col space-y-3 mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Brain className="h-8 w-8 title-icon" />
          <h1 className="text-4xl font-bold page-title">AI Assistant</h1>
        </div>
        <p className="text-muted-foreground text-lg">
          Intelligent insights and data-driven chat powered by AI
        </p>
      </div>

      {/* Quick Stats Card */}
      {!loading && (
        <Card variant="outline" className="bg-card/50 mb-6">
          <CardContent className="pt-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5" />
                  Total Patients
                </p>
                <p className="text-2xl font-bold text-foreground">{totalPatients.toLocaleString()}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5" />
                  Avg/Source
                </p>
                <p className="text-2xl font-bold text-foreground">{averagePerSource}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5" />
                  Growing
                </p>
                <p className="text-2xl font-bold text-green-600">{growingSources}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <TrendingDown className="w-3.5 h-3.5" />
                  Declining
                </p>
                <p className="text-2xl font-bold text-red-600">{decliningSources}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <div className="border-b">
              <TabsList className="grid w-full grid-cols-3 bg-transparent h-auto p-1">
                <TabsTrigger 
                  value="analysis" 
                  className="flex items-center gap-2 py-3 data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-50 data-[state=active]:to-blue-50 dark:data-[state=active]:from-purple-950/30 dark:data-[state=active]:to-blue-950/30 data-[state=active]:border-b-2 data-[state=active]:border-purple-500 rounded-none data-[state=active]:shadow-sm"
                >
                  <Brain className="h-4 w-4" />
                  Analysis
                </TabsTrigger>
                <TabsTrigger 
                  value="chat" 
                  className="flex items-center gap-2 py-3 data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-50 data-[state=active]:to-blue-50 dark:data-[state=active]:from-purple-950/30 dark:data-[state=active]:to-blue-950/30 data-[state=active]:border-b-2 data-[state=active]:border-purple-500 rounded-none data-[state=active]:shadow-sm"
                >
                  <MessageSquare className="h-4 w-4" />
                  Chat
                </TabsTrigger>
                <TabsTrigger 
                  value="settings" 
                  className="flex items-center gap-2 py-3 data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-50 data-[state=active]:to-blue-50 dark:data-[state=active]:from-purple-950/30 dark:data-[state=active]:to-blue-950/30 data-[state=active]:border-b-2 data-[state=active]:border-purple-500 rounded-none data-[state=active]:shadow-sm"
                >
                  <Settings className="h-4 w-4" />
                  Settings
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="analysis" className="p-6 mt-0">
              <AIAnalysisTab />
            </TabsContent>

            <TabsContent value="chat" className="p-6 mt-0">
              <AIChatTab />
            </TabsContent>

            <TabsContent value="settings" className="p-6 mt-0">
              <AISettingsTab />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}