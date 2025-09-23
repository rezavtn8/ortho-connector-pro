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
  Loader2
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';

interface AnalysisResult {
  id: string;
  generated_text: string;
  created_at: string;
  metadata?: any; // Use any to handle Supabase Json type
}

export function BusinessAnalysisControl() {
  const { user } = useAuth();
  const [isRunning, setIsRunning] = useState(false);
  const [cachedAnalysis, setCachedAnalysis] = useState<AnalysisResult | null>(null);
  const [lastRun, setLastRun] = useState<Date | null>(null);
  const [parsedAnalysis, setParsedAnalysis] = useState<any>(null);

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
        .eq('content_type', 'business_intelligence')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!error && data) {
        setCachedAnalysis(data);
        setLastRun(new Date(data.created_at));
        
        // Try to parse the analysis content
        try {
          const parsed = JSON.parse(data.generated_text);
          setParsedAnalysis(parsed);
        } catch {
          // If not JSON, treat as plain text
          setParsedAnalysis({ plain_text: data.generated_text });
        }
      }
    } catch (error) {
      console.error('Error loading cached analysis:', error);
    }
  };

  const runBusinessAnalysis = async () => {
    if (!user) return;

    setIsRunning(true);
    try {
      // Get practice data for analysis
      const [sourcesResult, patientsResult, visitsResult] = await Promise.all([
        supabase
          .from('patient_sources')
          .select('*')
          .eq('created_by', user.id),
        supabase
          .from('monthly_patients')
          .select('*, patient_sources(name, source_type)')
          .eq('user_id', user.id),
        supabase
          .from('marketing_visits')
          .select('*')
          .eq('user_id', user.id)
      ]);

      const context = {
        sources: sourcesResult.data || [],
        patients: patientsResult.data || [],
        visits: visitsResult.data || [],
        analysis_timestamp: new Date().toISOString()
      };

      // Call the AI assistant with business intelligence task
      const { data, error } = await supabase.functions.invoke('optimized-ai-analysis', {
        body: {
          context,
        },
        headers: {
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
      });

      if (error) throw error;

      if (data?.content) {
        toast({
          title: "Analysis Complete",
          description: "Your business intelligence report has been generated successfully.",
        });
        
        // Reload cached analysis to show new results
        await loadCachedAnalysis();
      } else {
        throw new Error('No analysis content received');
      }

    } catch (error: any) {
      console.error('Error running business analysis:', error);
      toast({
        title: "Analysis Failed",
        description: error.message || "Failed to generate business analysis. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsRunning(false);
    }
  };

  const formatAnalysisAge = (date: Date) => {
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'Just generated';
    if (diffInHours < 24) return `${diffInHours} hours ago`;
    if (diffInHours < 48) return 'Yesterday';
    return format(date, 'MMM d, yyyy');
  };

  const renderAnalysisContent = () => {
    if (!parsedAnalysis) return null;

    // Handle structured JSON analysis
    if (parsedAnalysis.source_distribution || parsedAnalysis.performance_trends || parsedAnalysis.insights) {
      // Handle new insights format
      if (parsedAnalysis.insights && Array.isArray(parsedAnalysis.insights)) {
        return (
          <div className="space-y-4">
            {parsedAnalysis.insights.map((insight: any, index: number) => (
              <Card key={index} className="border-l-4 border-l-primary">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <BarChart3 className="h-4 w-4 text-primary" />
                    {insight.title}
                    <Badge variant={insight.priority === 'high' ? 'destructive' : insight.priority === 'medium' ? 'default' : 'secondary'}>
                      {insight.priority}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm font-medium text-foreground mb-2">
                    {insight.summary}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {insight.recommendation}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        );
      }

      // Handle legacy format
      const sections = [
        { key: 'source_distribution', title: 'Source Distribution', icon: BarChart3 },
        { key: 'performance_trends', title: 'Performance Trends', icon: TrendingUp },
        { key: 'geographic_distribution', title: 'Geographic Analysis', icon: BarChart3 },
        { key: 'source_quality', title: 'Source Quality', icon: CheckCircle2 },
        { key: 'strategic_recommendations', title: 'Strategic Recommendations', icon: TrendingUp },
        { key: 'emerging_patterns', title: 'Emerging Patterns', icon: AlertCircle }
      ];

      return (
        <div className="space-y-4">
          {sections.map(({ key, title, icon: Icon }) => {
            const section = parsedAnalysis[key];
            if (!section) return null;

            return (
              <Card key={key} className="border-l-4 border-l-primary">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Icon className="h-4 w-4 text-primary" />
                    {title}
                    <Badge variant={section.priority === 'high' ? 'destructive' : section.priority === 'medium' ? 'default' : 'secondary'}>
                      {section.priority}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm font-medium text-foreground mb-2">
                    {section.summary}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {section.full_analysis}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      );
    }

    // Handle plain text analysis
    if (parsedAnalysis.plain_text) {
      return (
        <Card>
          <CardContent className="pt-6">
            <div className="whitespace-pre-wrap text-sm">
              {parsedAnalysis.plain_text}
            </div>
          </CardContent>
        </Card>
      );
    }

    return null;
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
            Generate comprehensive insights about your practice performance, referral patterns, and growth opportunities.
          </p>
          
          {!cachedAnalysis && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                No analysis has been run yet. Click "Run Analysis" to generate your first business intelligence report.
              </AlertDescription>
            </Alert>
          )}

          <div className="flex gap-3">
            <Button 
              onClick={runBusinessAnalysis}
              disabled={isRunning}
              className="flex-1"
            >
              {isRunning ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  {cachedAnalysis ? 'Run New Analysis' : 'Run Analysis'}
                </>
              )}
            </Button>
            
            {cachedAnalysis && (
              <Button 
                variant="outline" 
                onClick={loadCachedAnalysis}
                disabled={isRunning}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            )}
          </div>

          {isRunning && (
            <Alert>
              <Loader2 className="h-4 w-4 animate-spin" />
              <AlertDescription>
                Analyzing your practice data... This may take 30-60 seconds.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Analysis Results */}
      {cachedAnalysis && parsedAnalysis && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Analysis Results</h3>
            <Badge variant="secondary">
              Generated {formatAnalysisAge(lastRun!)}
            </Badge>
          </div>
          {renderAnalysisContent()}
        </div>
      )}
    </div>
  );
}