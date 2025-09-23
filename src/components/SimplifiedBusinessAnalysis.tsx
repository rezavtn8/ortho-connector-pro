import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Play, 
  RefreshCw, 
  Clock, 
  TrendingUp, 
  AlertCircle, 
  CheckCircle2,
  BarChart3,
  Loader2,
  Users,
  Building2,
  Calendar,
  Target
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { format, subMonths } from 'date-fns';

interface BusinessInsight {
  title: string;
  priority: 'high' | 'medium' | 'low';
  summary: string;
  recommendation: string;
  icon: React.ComponentType<any>;
}

interface AnalysisCache {
  id: string;
  generated_text: string;
  created_at: string;
  metadata?: any;
}

export function SimplifiedBusinessAnalysis() {
  const { user } = useAuth();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [insights, setInsights] = useState<BusinessInsight[]>([]);
  const [cachedAnalysis, setCachedAnalysis] = useState<AnalysisCache | null>(null);
  const [lastRun, setLastRun] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadCachedAnalysis();
  }, [user]);

  const loadCachedAnalysis = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('ai_generated_content')
        .select('*')
        .eq('user_id', user.id)
        .eq('content_type', 'business_analysis')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('Error loading cached analysis:', error);
        return;
      }

      if (data) {
        setCachedAnalysis(data);
        setLastRun(new Date(data.created_at));
        
        try {
          const parsed = JSON.parse(data.generated_text);
          if (parsed.insights && Array.isArray(parsed.insights)) {
            setInsights(parsed.insights.map((insight: any) => ({
              ...insight,
              icon: getInsightIcon(insight.title)
            })));
          }
        } catch {
          // If parsing fails, create a simple insight from the text
          setInsights([{
            title: "Business Analysis",
            priority: "medium",
            summary: data.generated_text.substring(0, 150) + "...",
            recommendation: "Review the full analysis details.",
            icon: BarChart3
          }]);
        }
      }
    } catch (error) {
      console.error('Failed to load cached analysis:', error);
    }
  };

  const runDirectAnalysis = async () => {
    if (!user) return;

    setIsAnalyzing(true);
    setError(null);

    try {
      console.log('Starting direct business analysis...');

      // Get practice data directly from database
      const [sourcesResult, patientsResult, visitsResult] = await Promise.all([
        supabase
          .from('patient_sources')
          .select('*')
          .eq('created_by', user.id),
        supabase
          .from('monthly_patients')
          .select('*')
          .eq('user_id', user.id),
        supabase
          .from('marketing_visits')
          .select('*')
          .eq('user_id', user.id)
      ]);

      // Handle database errors gracefully
      if (sourcesResult.error || patientsResult.error || visitsResult.error) {
        console.error('Database query errors:', {
          sources: sourcesResult.error,
          patients: patientsResult.error,
          visits: visitsResult.error
        });
        
        // Generate offline analysis if data queries fail
        return generateOfflineAnalysis();
      }

      const sources = sourcesResult.data || [];
      const patients = patientsResult.data || [];
      const visits = visitsResult.data || [];

      console.log('Data loaded successfully:', { 
        sources: sources.length, 
        patients: patients.length, 
        visits: visits.length 
      });

      // Generate insights directly without AI (as fallback)
      const generatedInsights = generateDirectInsights(sources, patients, visits);
      
      // Try to enhance with AI if possible
      let aiEnhancedInsights = generatedInsights;
      
      try {
        const aiResponse = await callOptimizedAI(sources, patients, visits);
        if (aiResponse?.insights && Array.isArray(aiResponse.insights)) {
          aiEnhancedInsights = aiResponse.insights.map((insight: any) => ({
            ...insight,
            icon: getInsightIcon(insight.title)
          }));
        }
      } catch (aiError) {
        console.warn('AI enhancement failed, using direct analysis:', aiError);
        // Continue with direct insights
      }

      // Cache the results
      const analysisText = JSON.stringify({ 
        insights: aiEnhancedInsights,
        generated_at: new Date().toISOString(),
        method: 'enhanced'
      });

      await supabase
        .from('ai_generated_content')
        .insert({
          user_id: user.id,
          content_type: 'business_analysis',
          generated_text: analysisText,
          status: 'generated',
          metadata: { 
            method: 'enhanced',
            data_points: {
              sources: sources.length,
              patients: patients.length,
              visits: visits.length
            }
          },
        });

      setInsights(aiEnhancedInsights);
      setLastRun(new Date());

      toast({
        title: "Analysis Complete",
        description: `Generated ${aiEnhancedInsights.length} business insights successfully.`,
      });

    } catch (error: any) {
      console.error('Analysis failed:', error);
      setError(error.message);
      
      // Generate basic offline analysis as ultimate fallback
      const fallbackInsights = generateOfflineAnalysis();
      setInsights(fallbackInsights);
      
      toast({
        title: "Analysis Completed (Offline Mode)",
        description: "Generated basic analysis using available data.",
        variant: "default",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const generateDirectInsights = (sources: any[], patients: any[], visits: any[]) => {
    const insights: BusinessInsight[] = [];

    // Source Distribution Analysis
    const totalSources = sources.length;
    const activeSources = sources.filter(s => s.is_active).length;
    const sourceTypes = sources.reduce((acc, s) => {
      acc[s.source_type] = (acc[s.source_type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    insights.push({
      title: "Source Portfolio Health",
      priority: totalSources < 5 ? 'high' : totalSources < 15 ? 'medium' : 'low',
      summary: `You have ${totalSources} total sources with ${activeSources} currently active (${Math.round((activeSources/(totalSources || 1))*100)}% active rate).`,
      recommendation: totalSources < 10 ? 
        "Focus on expanding your referral network to reduce dependency risks." : 
        "Maintain regular communication with your strong referral network.",
      icon: Building2
    });

    // Performance Trends
    const totalPatients = patients.reduce((sum, p) => sum + (p.patient_count || 0), 0);
    const recentPatients = patients
      .filter(p => {
        const monthDate = new Date(p.year_month + '-01');
        const threeMonthsAgo = subMonths(new Date(), 3);
        return monthDate >= threeMonthsAgo;
      })
      .reduce((sum, p) => sum + (p.patient_count || 0), 0);

    insights.push({
      title: "Patient Volume Trends",
      priority: recentPatients > totalPatients * 0.4 ? 'low' : 'medium',
      summary: `${totalPatients} total patients tracked with ${recentPatients} in the last 3 months (${Math.round((recentPatients/(totalPatients || 1))*100)}% recent activity).`,
      recommendation: recentPatients < totalPatients * 0.3 ? 
        "Recent referral activity is below historical averages - consider reaching out to key sources." :
        "Maintain current referral relationship strategies.",
      icon: TrendingUp
    });

    // Marketing Activity
    const totalVisits = visits.length;
    const completedVisits = visits.filter(v => v.visited).length;
    const completionRate = totalVisits > 0 ? Math.round((completedVisits/(totalVisits || 1))*100) : 0;

    insights.push({
      title: "Marketing Engagement",
      priority: completionRate < 70 ? 'high' : completionRate < 85 ? 'medium' : 'low',
      summary: `${completedVisits} of ${totalVisits} planned marketing visits completed (${completionRate}% completion rate).`,
      recommendation: completionRate < 80 ? 
        "Improve visit completion rate by scheduling more systematically and following up on missed visits." :
        "Excellent marketing visit completion - maintain this engagement level.",
      icon: Users
    });

    // Source Quality Assessment
    const topSourceTypes = Object.entries(sourceTypes)
      .sort(([,a], [,b]) => (b as number) - (a as number))
      .slice(0, 3);

    insights.push({
      title: "Source Diversification",
      priority: topSourceTypes.length < 3 ? 'medium' : 'low',
      summary: `Top source types: ${topSourceTypes.map(([type, count]) => `${type} (${count})`).join(', ')}.`,
      recommendation: topSourceTypes.length < 3 ? 
        "Consider diversifying your referral sources across more practice types for better stability." :
        "Good diversification across multiple source types.",
      icon: Target
    });

    return insights;
  };

  const generateOfflineAnalysis = (): BusinessInsight[] => {
    return [
      {
        title: "Practice Overview",
        priority: "medium",
        summary: "Analysis running in offline mode with limited data access.",
        recommendation: "Ensure stable internet connection and try again for comprehensive insights.",
        icon: AlertCircle
      }
    ];
  };

  const callOptimizedAI = async (sources: any[], patients: any[], visits: any[]) => {
    const context = {
      sources: sources.slice(0, 20), // Limit data size
      patients: patients.slice(0, 50),
      visits: visits.slice(0, 30),
      analysis_timestamp: new Date().toISOString()
    };

    const { data, error } = await supabase.functions.invoke('optimized-ai-analysis', {
      body: { context },
      headers: {
        Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
      },
    });

    if (error) throw error;
    return data?.content ? JSON.parse(data.content) : null;
  };

  const getInsightIcon = (title: string) => {
    if (title.toLowerCase().includes('source')) return Building2;
    if (title.toLowerCase().includes('trend') || title.toLowerCase().includes('performance')) return TrendingUp;
    if (title.toLowerCase().includes('marketing') || title.toLowerCase().includes('engagement')) return Users;
    if (title.toLowerCase().includes('diversif') || title.toLowerCase().includes('quality')) return Target;
    return BarChart3;
  };

  const formatAnalysisAge = (date: Date) => {
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'Just generated';
    if (diffInHours < 24) return `${diffInHours} hours ago`;
    if (diffInHours < 48) return 'Yesterday';
    return format(date, 'MMM d, yyyy');
  };

  const getPriorityVariant = (priority: string) => {
    switch (priority) {
      case 'high': return 'destructive';
      case 'medium': return 'default';
      case 'low': return 'secondary';
      default: return 'default';
    }
  };

  return (
    <div className="space-y-6">
      {/* Control Panel */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              Business Intelligence Analysis
            </div>
            <div className="flex items-center gap-2">
              {lastRun && (
                <Badge variant="outline" className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatAnalysisAge(lastRun)}
                </Badge>
              )}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Generate actionable insights about your practice performance, referral patterns, and growth opportunities.
          </p>
          
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {error}
              </AlertDescription>
            </Alert>
          )}

          {!cachedAnalysis && !error && (
            <Alert>
              <BarChart3 className="h-4 w-4" />
              <AlertDescription>
                Ready to analyze your practice data. Click "Run Analysis" to get started.
              </AlertDescription>
            </Alert>
          )}

          <div className="flex gap-3">
            <Button 
              onClick={runDirectAnalysis}
              disabled={isAnalyzing}
              className="flex-1"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  {insights.length > 0 ? 'Run New Analysis' : 'Run Analysis'}
                </>
              )}
            </Button>
            
            {cachedAnalysis && (
              <Button 
                variant="outline" 
                onClick={loadCachedAnalysis}
                disabled={isAnalyzing}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh Cache
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Analysis Results */}
      {insights.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Business Insights</h3>
            {lastRun && (
              <Badge variant="secondary">
                Updated {formatAnalysisAge(lastRun)}
              </Badge>
            )}
          </div>
          
          <div className="grid gap-4">
            {insights.map((insight, index) => (
              <Card key={index} className="border-l-4 border-l-primary">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <insight.icon className="h-4 w-4 text-primary" />
                    {insight.title}
                    <Badge variant={getPriorityVariant(insight.priority)}>
                      {insight.priority}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm font-medium text-foreground mb-2">
                    {insight.summary}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    <span className="font-medium">Recommendation:</span> {insight.recommendation}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Loading State */}
      {isAnalyzing && (
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-center space-y-4 flex-col">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <div className="text-center">
                <p className="font-medium">Analyzing Your Practice Data</p>
                <p className="text-sm text-muted-foreground">
                  Processing sources, patient data, and marketing activities...
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}