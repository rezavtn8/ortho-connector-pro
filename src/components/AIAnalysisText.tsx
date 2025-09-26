import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Brain, 
  RefreshCw, 
  Clock, 
  Loader2,
  AlertCircle,
  Sparkles
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { format, isAfter, subHours } from 'date-fns';
import { useUnifiedAIData } from '@/hooks/useUnifiedAIData';

interface AnalysisCache {
  id: string;
  generated_text: string;
  created_at: string;
  metadata?: any;
}

const CACHE_HOURS = 24;
const LOCAL_STORAGE_KEY = 'ai_analysis_text_cache';

export function AIAnalysisText() {
  const { user } = useAuth();
  const { data: unifiedData, loading: dataLoading, fetchAllData } = useUnifiedAIData();
  
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisText, setAnalysisText] = useState<string>('');
  const [lastRun, setLastRun] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

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
          setAnalysisText(cached.text);
          setLastRun(new Date(cached.timestamp));
          console.log('Loaded analysis text from localStorage cache');
          return;
        }
      }

      // Then try Supabase
      const { data, error } = await supabase
        .from('ai_generated_content')
        .select('*')
        .eq('user_id', user.id)
        .eq('content_type', 'text_analysis')
        .gte('created_at', new Date(Date.now() - CACHE_HOURS * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('Error loading cached analysis:', error);
        return;
      }

      if (data) {
        setAnalysisText(data.generated_text);
        setLastRun(new Date(data.created_at));
        
        // Save to localStorage
        saveToLocalStorage(data.generated_text, data.created_at);
        console.log('Loaded analysis text from Supabase cache');
      }
    } catch (error) {
      console.error('Failed to load cached analysis:', error);
    }
  };

  const saveToLocalStorage = (text: string, timestamp: string) => {
    const cache = {
      userId: user?.id,
      text,
      timestamp,
      expiry: Date.now() + CACHE_HOURS * 60 * 60 * 1000
    };
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(cache));
  };

  const limitDataForAPI = (data: any) => {
    if (!data) return null;

    return {
      ...data,
      sources: (data.sources || []).slice(0, 50),
      monthly_data: (data.monthly_data || [])
        .filter((item: any) => {
          const itemDate = new Date(item.year_month + '-01');
          const cutoff = subHours(new Date(), 24 * 30 * 12);
          return itemDate >= cutoff;
        })
        .slice(0, 100),
      visits: (data.visits || []).slice(0, 20),
      campaigns: (data.campaigns || []).slice(0, 10),
      reviews: (data.reviews || []).slice(0, 15)
    };
  };

  const runAnalysis = async (forceRefresh = false) => {
    if (!user) return;
    
    // Check cache unless force refresh
    if (!forceRefresh && analysisText && lastRun) {
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
          prompt: `Provide a comprehensive, flowing analysis of this healthcare practice's performance and opportunities. Write in a natural, conversational tone as if speaking directly to the practice owner. Focus on actionable insights about referral patterns, growth opportunities, patient trends, and strategic recommendations. Make it engaging and insightful, highlighting both strengths and areas for improvement. Write 3-4 detailed paragraphs that flow naturally together.`,
          context: limitedData,
          parameters: {
            max_tokens: 1200
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

      if (!responseText || responseText.trim().length === 0) {
        throw new Error('No analysis text generated from AI response');
      }

      // Save to Supabase
      await supabase
        .from('ai_generated_content')
        .insert({
          user_id: user.id,
          content_type: 'text_analysis',
          generated_text: responseText.trim(),
          status: 'generated',
          metadata: { 
            method: 'unified_ai_service',
            model_used: 'gpt-4o-mini',
            data_points: {
              sources: limitedData?.sources?.length || 0,
              months: limitedData?.monthly_data?.length || 0,
              visits: limitedData?.visits?.length || 0
            }
          },
        });

      // Save to localStorage
      saveToLocalStorage(responseText.trim(), new Date().toISOString());
      
      setAnalysisText(responseText.trim());
      setLastRun(new Date());

      toast({
        title: "AI Analysis Complete",
        description: "Generated comprehensive practice analysis using advanced AI",
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
    }
  };

  const retryAnalysis = () => {
    setError(null);
    runAnalysis(true);
  };

  const formatAnalysisAge = (date: Date) => {
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${diffInHours} hours ago`;
    return format(date, 'MMM d, yyyy \'at\' HH:mm');
  };

  if (isAnalyzing) {
    return (
      <div className="space-y-6">
        <Card className="border-teal-200 dark:border-teal-800">
          <CardContent className="py-12">
            <div className="text-center space-y-4">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-teal-500/20 to-black/20 rounded-full blur-xl" />
                <Loader2 className="h-12 w-12 animate-spin mx-auto text-teal-600 relative z-10" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-semibold bg-gradient-to-r from-teal-600 to-black bg-clip-text text-transparent">
                  Analyzing Your Practice
                </h3>
                <p className="text-muted-foreground">
                  AI is processing your data to generate comprehensive insights...
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Control Panel */}
      <Card className="border-teal-200 dark:border-teal-800">
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Brain className="h-5 w-5 text-teal-600" />
                <h2 className="text-lg font-semibold bg-gradient-to-r from-teal-600 to-black bg-clip-text text-transparent">
                  AI Practice Analysis
                </h2>
              </div>
              {lastRun && (
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  Last updated: {formatAnalysisAge(lastRun)}
                </div>
              )}
            </div>
            <Button 
              onClick={() => runAnalysis(true)}
              disabled={isAnalyzing || dataLoading || !unifiedData}
              className="bg-gradient-to-r from-teal-600 to-teal-700 hover:from-teal-700 hover:to-teal-800 text-white"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Brain className="mr-2 h-4 w-4" />
                  {analysisText ? 'Refresh Analysis' : 'Generate Analysis'}
                </>
              )}
            </Button>
          </div>

          {error && (
            <Alert variant="destructive" className="mt-4">
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
            <Alert className="mt-4">
              <Loader2 className="h-4 w-4 animate-spin" />
              <AlertDescription>
                Loading practice data for analysis...
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Analysis Content */}
      {analysisText && (
        <Card className="border-teal-200 dark:border-teal-800 bg-gradient-to-br from-teal-50/50 to-slate-50/50 dark:from-teal-950/20 dark:to-slate-950/20">
          <CardContent className="py-8">
            <div className="relative">
              {/* Decorative elements */}
              <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-teal-500 to-black rounded-full" />
              <div className="absolute top-4 right-4 opacity-10">
                <Sparkles className="h-8 w-8 text-teal-600" />
              </div>
              
              <div className="pl-6 pr-12">
                <div className="prose prose-slate dark:prose-invert max-w-none">
                  <div className="text-slate-800 dark:text-slate-200 leading-relaxed text-base space-y-4">
                    {analysisText.split('\n').map((paragraph, index) => {
                      if (paragraph.trim()) {
                        return (
                          <p key={index} className="mb-4 text-justify">
                            {paragraph.trim()}
                          </p>
                        );
                      }
                      return null;
                    })}
                  </div>
                </div>
                
                {/* Signature */}
                <div className="mt-8 pt-4 border-t border-teal-200 dark:border-teal-800">
                  <div className="flex items-center gap-2 text-sm text-teal-600 dark:text-teal-400">
                    <Brain className="h-4 w-4" />
                    <span className="font-medium">AI-Generated Practice Analysis</span>
                    <span className="text-muted-foreground">•</span>
                    <span className="text-muted-foreground">
                      {lastRun ? formatAnalysisAge(lastRun) : 'Recently generated'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {!analysisText && !isAnalyzing && !error && (
        <Card className="border-teal-200 dark:border-teal-800">
          <CardContent className="py-12">
            <div className="text-center space-y-6">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-teal-500/20 to-black/20 rounded-full blur-xl" />
                <Brain className="h-16 w-16 mx-auto text-teal-600 opacity-80 relative z-10" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-semibold bg-gradient-to-r from-teal-600 to-black bg-clip-text text-transparent">
                  Ready for AI Practice Analysis
                </h3>
                <p className="text-muted-foreground max-w-md mx-auto">
                  Generate a comprehensive, AI-powered analysis of your practice performance, 
                  referral patterns, and growth opportunities.
                </p>
              </div>
              <Button 
                onClick={() => runAnalysis(true)}
                disabled={dataLoading || !unifiedData}
                size="lg"
                className="bg-gradient-to-r from-teal-600 to-teal-700 hover:from-teal-700 hover:to-teal-800 text-white"
              >
                <Sparkles className="mr-2 h-5 w-5" />
                Generate Analysis
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}