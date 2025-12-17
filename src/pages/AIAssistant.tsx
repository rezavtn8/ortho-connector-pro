import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Brain, MessageSquare, Settings, Users, Activity, TrendingUp, TrendingDown } from 'lucide-react';
import { AIAnalysisTab } from '@/components/ai/AIAnalysisTab';
import { AIChatTab } from '@/components/ai/AIChatTab';
import { AISettingsTab } from '@/components/ai/AISettingsTab';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';

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
      const { data: sourcesData } = await supabase
        .from('patient_sources')
        .select('*')
        .eq('is_active', true);

      const now = new Date();
      const startDate = new Date(now.getFullYear(), now.getMonth() - 6, 1);
      const startYearMonth = `${startDate.getFullYear()}-${(startDate.getMonth() + 1).toString().padStart(2, '0')}`;

      const { data: monthlyDataResult } = await supabase
        .from('monthly_patients')
        .select('*')
        .gte('year_month', startYearMonth);

      const sources = sourcesData || [];
      const monthlyData = monthlyDataResult || [];

      const analyticsData = sources.map(source => {
        const sourceMonthlyData = monthlyData.filter(m => m.source_id === source.id);
        const total = sourceMonthlyData.reduce((sum, m) => sum + m.patient_count, 0);
        
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

  const stats = [
    { 
      label: 'Total Patients', 
      value: totalPatients.toLocaleString(), 
      icon: Users, 
      color: 'text-teal-600 dark:text-teal-400',
      bgColor: 'bg-teal-50 dark:bg-teal-950/30'
    },
    { 
      label: 'Avg/Source', 
      value: averagePerSource, 
      icon: Activity, 
      color: 'text-blue-600 dark:text-blue-400',
      bgColor: 'bg-blue-50 dark:bg-blue-950/30'
    },
    { 
      label: 'Growing', 
      value: growingSources, 
      icon: TrendingUp, 
      color: 'text-emerald-600 dark:text-emerald-400',
      bgColor: 'bg-emerald-50 dark:bg-emerald-950/30'
    },
    { 
      label: 'Declining', 
      value: decliningSources, 
      icon: TrendingDown, 
      color: 'text-rose-600 dark:text-rose-400',
      bgColor: 'bg-rose-50 dark:bg-rose-950/30'
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {loading ? (
          [...Array(4)].map((_, i) => (
            <Card key={i} className="border-border/50">
              <CardContent className="p-4">
                <Skeleton className="h-4 w-24 mb-2" />
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))
        ) : (
          stats.map((stat, index) => (
            <Card key={index} className="border-border/50 hover:border-primary/30 transition-colors group">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${stat.bgColor} group-hover:scale-105 transition-transform`}>
                    <stat.icon className={`w-4 h-4 ${stat.color}`} />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{stat.label}</p>
                    <p className="text-xl font-bold text-foreground">{stat.value}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Tabs Section */}
      <Card className="border-border/50">
        <CardContent className="p-0">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <div className="border-b border-border/50 bg-muted/30 rounded-t-lg">
              <TabsList className="h-auto p-1 bg-transparent w-full justify-start gap-1">
                <TabsTrigger 
                  value="analysis" 
                  className="flex items-center gap-2 px-4 py-2.5 data-[state=active]:bg-background data-[state=active]:text-teal-600 dark:data-[state=active]:text-teal-400 data-[state=active]:shadow-sm rounded-lg"
                >
                  <Brain className="h-4 w-4" />
                  <span className="hidden sm:inline">Analysis</span>
                  <Badge variant="secondary" className="ml-1 text-xs bg-teal-100 text-teal-700 dark:bg-teal-900 dark:text-teal-300">
                    AI
                  </Badge>
                </TabsTrigger>
                <TabsTrigger 
                  value="chat" 
                  className="flex items-center gap-2 px-4 py-2.5 data-[state=active]:bg-background data-[state=active]:text-teal-600 dark:data-[state=active]:text-teal-400 data-[state=active]:shadow-sm rounded-lg"
                >
                  <MessageSquare className="h-4 w-4" />
                  <span className="hidden sm:inline">Chat</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="settings" 
                  className="flex items-center gap-2 px-4 py-2.5 data-[state=active]:bg-background data-[state=active]:text-teal-600 dark:data-[state=active]:text-teal-400 data-[state=active]:shadow-sm rounded-lg"
                >
                  <Settings className="h-4 w-4" />
                  <span className="hidden sm:inline">Settings</span>
                </TabsTrigger>
              </TabsList>
            </div>

            <div className="p-6">
              <TabsContent value="analysis" className="mt-0">
                <AIAnalysisTab />
              </TabsContent>

              <TabsContent value="chat" className="mt-0">
                <AIChatTab />
              </TabsContent>

              <TabsContent value="settings" className="mt-0">
                <AISettingsTab />
              </TabsContent>
            </div>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
