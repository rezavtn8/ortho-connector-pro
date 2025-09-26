import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Brain, 
  RefreshCw, 
  Clock, 
  TrendingUp, 
  AlertCircle, 
  CheckCircle2,
  BarChart3,
  Loader2,
  Users,
  Building2,
  Target,
  Sparkles,
  Zap,
  Eye,
  Shield,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { format, isAfter, subHours } from 'date-fns';
import { useUnifiedAIData } from '@/hooks/useUnifiedAIData';
import { BusinessInsightCard } from './BusinessInsightCard';
import { BusinessAnalysisLoadingSkeleton } from './BusinessAnalysisLoadingSkeleton';

interface BusinessInsight {
  title: string;
  priority: 'high' | 'medium' | 'low';
  summary: string;
  recommendation: string;
  detailedAnalysis: string;
  keyMetrics: string[];
  actionItems: string[];
  icon: React.ComponentType<any>;
}

interface AnalysisCache {
  id: string;
  generated_text: string;
  created_at: string;
  metadata?: any;
}

const INSIGHTS_PER_PAGE = 6;
const CACHE_HOURS = 24;
const LOCAL_STORAGE_KEY = 'business_analysis_cache';

export function SimplifiedBusinessAnalysis() {
  const { user } = useAuth();
  const { data: unifiedData, loading: dataLoading, fetchAllData } = useUnifiedAIData();
  
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [insights, setInsights] = useState<BusinessInsight[]>([]);
  const [lastRun, setLastRun] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [progressiveLoading, setProgressiveLoading] = useState(false);

  useEffect(() => {
    if (user) {
      loadCachedAnalysis();
    }
  }, [user]);

  // Auto-refresh after 24 hours
  useEffect(() => {
    if (lastRun && isAfter(new Date(), new Date(lastRun.getTime() + CACHE_HOURS * 60 * 60 * 1000))) {
      runAnalysis();
    }
  }, [lastRun]);

  const loadCachedAnalysis = async () => {
    if (!user) return;

    try {
      // Try localStorage first
      const localCache = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (localCache) {
        const cached = JSON.parse(localCache);
        if (cached.userId === user.id && cached.expiry > Date.now()) {
          setInsights(cached.insights);
          setLastRun(new Date(cached.timestamp));
          console.log('Loaded analysis from localStorage cache');
          return;
        }
      }

      // Then try Supabase
      const { data, error } = await supabase
        .from('ai_generated_content')
        .select('*')
        .eq('user_id', user.id)
        .eq('content_type', 'analysis')
        .gte('created_at', new Date(Date.now() - CACHE_HOURS * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('Error loading cached analysis:', error);
        return;
      }

      if (data) {
        const processedInsights = processAnalysisResponse(data.generated_text);
        if (processedInsights.length > 0) {
          setInsights(processedInsights);
          setLastRun(new Date(data.created_at));
          
          // Save to localStorage
          saveToLocalStorage(processedInsights, data.created_at);
          console.log('Loaded analysis from Supabase cache');
        }
      }
    } catch (error) {
      console.error('Failed to load cached analysis:', error);
    }
  };

  const saveToLocalStorage = (insights: BusinessInsight[], timestamp: string) => {
    const cache = {
      userId: user?.id,
      insights,
      timestamp,
      expiry: Date.now() + CACHE_HOURS * 60 * 60 * 1000
    };
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(cache));
  };

  const processAnalysisResponse = (responseText: string): BusinessInsight[] => {
    try {
      // Try to parse as JSON first
      const parsed = JSON.parse(responseText);
      let insightData = parsed.insights || parsed.data?.insights || [parsed];
      
      if (!Array.isArray(insightData)) {
        insightData = [insightData];
      }

      return insightData.map((insight: any) => ({
        title: insight.title || 'Business Insight',
        priority: insight.priority || 'medium',
        summary: insight.summary || insight.description || 'Analysis insight generated',
        recommendation: insight.recommendation || insight.action || 'Review and implement',
        detailedAnalysis: insight.detailedAnalysis || insight.details || insight.summary || 'Detailed analysis available',
        keyMetrics: insight.keyMetrics || insight.metrics || ['Analysis Complete'],
        actionItems: insight.actionItems || insight.actions || ['Review insights'],
        icon: getInsightIcon(insight.title || 'insight')
      }));
    } catch {
      // If parsing fails, create a single insight from the text
      return [{
        title: "AI Business Analysis",
        priority: "medium" as const,
        summary: responseText.substring(0, 200) + "...",
        recommendation: "Review the complete analysis for detailed insights.",
        detailedAnalysis: responseText,
        keyMetrics: ["AI Generated", "Comprehensive Analysis", "Data-Driven"],
        actionItems: ["Review insights", "Implement recommendations", "Monitor progress"],
        icon: Brain
      }];
    }
  };

  const limitDataForAPI = (data: any) => {
    if (!data) return null;

    return {
      ...data,
      sources: (data.sources || []).slice(0, 50), // Limit to 50 sources
      monthly_data: (data.monthly_data || [])
        .filter((item: any) => {
          const itemDate = new Date(item.year_month + '-01');
          const cutoff = subHours(new Date(), 24 * 30 * 12); // 12 months
          return itemDate >= cutoff;
        })
        .slice(0, 100), // Limit monthly data
      visits: (data.visits || []).slice(0, 20),
      campaigns: (data.campaigns || []).slice(0, 10),
      reviews: (data.reviews || []).slice(0, 15)
    };
  };

  const runAnalysis = async (forceRefresh = false) => {
    if (!user) return;
    
    // Check cache unless force refresh
    if (!forceRefresh && insights.length > 0 && lastRun) {
      const cacheAge = new Date().getTime() - lastRun.getTime();
      if (cacheAge < CACHE_HOURS * 60 * 60 * 1000) {
        toast({
          title: "Recent Analysis Available",
          description: "Using recent analysis. Click refresh to generate new insights.",
        });
        return;
      }
    }

    setIsAnalyzing(true);
    setProgressiveLoading(true);
    setError(null);

    try {
      console.log('Starting AI business analysis...');

      // Get unified data (fetch if missing)
      let rawData = unifiedData;
      if (!rawData) {
        const fetched = await fetchAllData();
        rawData = fetched;
      }
      if (!rawData) {
        throw new Error('No practice data available for analysis');
      }

      // Limit data sent to API
      const limitedData = limitDataForAPI(rawData);

      console.log('Limited data for analysis:', {
        sources: limitedData?.sources?.length || 0,
        monthly_data: limitedData?.monthly_data?.length || 0,
        visits: limitedData?.visits?.length || 0,
        campaigns: limitedData?.campaigns?.length || 0,
        reviews: limitedData?.reviews?.length || 0
      });

      // Call unified AI service
      const { data: aiResponse, error: aiError } = await supabase.functions.invoke('unified-ai-service', {
        body: { 
          task_type: 'analysis',
          taskType: 'analysis',
          prompt: 'Analyze my practice data and provide 4-6 comprehensive business insights with actionable recommendations. Focus on the most critical opportunities and issues.',
          context: limitedData,
          parameters: {
            max_tokens: 1000
          }
        },
        headers: {
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
      });

      if (aiError) {
        throw new Error(`AI service error: ${aiError.message}`);
      }

      if (!aiResponse?.success) {
        throw new Error(aiResponse?.error || 'AI analysis failed');
      }

      const responseText = typeof aiResponse.data === 'string' 
        ? aiResponse.data 
        : (aiResponse.data?.content ?? aiResponse.data?.text ?? JSON.stringify(aiResponse.data));

      const processedInsights = processAnalysisResponse(responseText);
      
      if (processedInsights.length === 0) {
        throw new Error('No insights generated from AI response');
      }

      // Save to Supabase
      const analysisText = JSON.stringify({ 
        insights: processedInsights,
        generated_at: new Date().toISOString(),
        method: 'unified_ai_service'
      });

      await supabase
        .from('ai_generated_content')
        .insert({
          user_id: user.id,
          content_type: 'analysis',
          generated_text: analysisText,
          status: 'generated',
          metadata: { 
            method: 'unified_ai_service',
            model_used: 'gpt-4o-mini',
            insights_count: processedInsights.length,
            data_points: {
              sources: limitedData?.sources?.length || 0,
              months: limitedData?.monthly_data?.length || 0,
              visits: limitedData?.visits?.length || 0
            }
          },
        });

      // Save to localStorage
      saveToLocalStorage(processedInsights, new Date().toISOString());
      
      setInsights(processedInsights);
      setLastRun(new Date());
      setCurrentPage(0);

      toast({
        title: "AI Analysis Complete",
        description: `Generated ${processedInsights.length} insights using advanced AI analysis.`,
      });

    } catch (error: any) {
      console.error('Analysis failed:', error);
      setError(error.message);
      
      toast({
        title: "Analysis Failed",
        description: error.message || "Please try again or contact support.",
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
      setProgressiveLoading(false);
    }
  };

  const retryAnalysis = () => {
    setError(null);
    runAnalysis(true);
  };

  const getInsightIcon = (title: string) => {
    const titleLower = title.toLowerCase();
    
    if (titleLower.includes('ai') || titleLower.includes('smart') || titleLower.includes('intelligent')) return Brain;
    if (titleLower.includes('opportunity') || titleLower.includes('missed') || titleLower.includes('potential')) return Zap;
    if (titleLower.includes('discovery') || titleLower.includes('discovered') || titleLower.includes('found')) return Eye;
    if (titleLower.includes('risk') || titleLower.includes('vulnerability') || titleLower.includes('threat')) return Shield;
    if (titleLower.includes('referral') || titleLower.includes('network') || titleLower.includes('source')) return Building2;
    if (titleLower.includes('patient') || titleLower.includes('volume') || titleLower.includes('trend')) return TrendingUp;
    if (titleLower.includes('marketing') || titleLower.includes('visit') || titleLower.includes('outreach')) return Users;
    if (titleLower.includes('campaign') || titleLower.includes('delivery') || titleLower.includes('email')) return Target;
    if (titleLower.includes('review') || titleLower.includes('rating') || titleLower.includes('reputation')) return CheckCircle2;
    if (titleLower.includes('portfolio') || titleLower.includes('diversification') || titleLower.includes('balance')) return BarChart3;
    
    return Sparkles;
  };

  const formatAnalysisAge = (date: Date) => {
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${diffInHours} hours ago`;
    return format(date, 'MMM d, yyyy \'at\' HH:mm');
  };

  // Pagination
  const totalPages = Math.ceil(insights.length / INSIGHTS_PER_PAGE);
  const currentInsights = insights.slice(
    currentPage * INSIGHTS_PER_PAGE, 
    (currentPage + 1) * INSIGHTS_PER_PAGE
  );

  const nextPage = () => {
    setCurrentPage(prev => Math.min(prev + 1, totalPages - 1));
  };

  const prevPage = () => {
    setCurrentPage(prev => Math.max(prev - 1, 0));
  };

  if (isAnalyzing || progressiveLoading) {
    return <BusinessAnalysisLoadingSkeleton />;
  }

  return (
    <div className="space-y-6">
      {/* Control Panel */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5 text-primary" />
                AI Business Analysis
              </CardTitle>
              {lastRun && (
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  Last updated: {formatAnalysisAge(lastRun)}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button 
                onClick={() => runAnalysis(true)}
                disabled={isAnalyzing || dataLoading || !unifiedData}
                className="w-full sm:w-auto"
                size="lg"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Brain className="mr-2 h-4 w-4" />
                    {insights.length > 0 ? 'Refresh Analysis' : 'Run Analysis'}
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p className="text-muted-foreground">
              AI-powered analysis examines your practice data to identify critical opportunities. 
              Analysis is cached for {CACHE_HOURS} hours and stored locally for offline access.
            </p>

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="flex items-center justify-between">
                  <span>Analysis Error: {error}</span>
                  <Button variant="outline" size="sm" onClick={retryAnalysis}>
                    <RefreshCw className="h-3 w-3 mr-1" />
                    Retry
                  </Button>
                </AlertDescription>
              </Alert>
            )}

            {dataLoading && (
              <Alert>
                <Loader2 className="h-4 w-4 animate-spin" />
                <AlertDescription>
                  Loading practice data for analysis...
                </AlertDescription>
              </Alert>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Analysis Results */}
      {insights.length > 0 && (
        <>
          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                Showing {currentPage * INSIGHTS_PER_PAGE + 1}-{Math.min((currentPage + 1) * INSIGHTS_PER_PAGE, insights.length)} of {insights.length} insights
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={prevPage}
                  disabled={currentPage === 0}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <span className="text-sm px-2">
                  {currentPage + 1} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={nextPage}
                  disabled={currentPage === totalPages - 1}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Insights Grid */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {currentInsights.map((insight, index) => (
              <BusinessInsightCard
                key={`${currentPage}-${index}`}
                insight={insight}
                index={index}
                onRetry={() => runAnalysis(true)}
              />
            ))}
          </div>
        </>
      )}

      {/* Empty State */}
      {insights.length === 0 && !isAnalyzing && !error && (
        <Card>
          <CardContent className="py-12">
            <div className="text-center space-y-4">
              <Brain className="h-12 w-12 mx-auto text-muted-foreground" />
              <div>
                <h3 className="text-lg font-semibold">No Analysis Available</h3>
                <p className="text-muted-foreground">
                  Run an AI analysis to get personalized insights about your practice.
                </p>
              </div>
              <Button onClick={() => runAnalysis(true)} disabled={dataLoading}>
                <Brain className="mr-2 h-4 w-4" />
                Start Analysis
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}