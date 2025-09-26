import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { RefreshCw, TrendingUp, Users, Star, AlertCircle, Brain } from 'lucide-react';
import { useAIAnalysis } from '@/hooks/useAIAnalysis';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';

export function AIAnalysisTab() {
  const { analysis, loading, error, refreshAnalysis } = useAIAnalysis();
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshAnalysis();
      toast({
        title: "Analysis Updated",
        description: "Your business analysis has been refreshed with the latest data.",
      });
    } catch (error) {
      toast({
        title: "Refresh Failed",
        description: "Unable to refresh analysis. Please try again.",
        variant: "destructive",
      });
    } finally {
      setRefreshing(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold">Business Analysis</h2>
          <Button disabled>
            <RefreshCw className="h-4 w-4 animate-spin mr-2" />
            Analyzing...
          </Button>
        </div>
        <div className="grid gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-4 bg-muted rounded w-1/3"></div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="h-3 bg-muted rounded w-full"></div>
                  <div className="h-3 bg-muted rounded w-2/3"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
        <h3 className="text-lg font-semibold mb-2">Analysis Failed</h3>
        <p className="text-muted-foreground mb-4">
          Unable to generate business analysis. Please try again.
        </p>
        <Button onClick={handleRefresh} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry Analysis
        </Button>
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="text-center py-12">
        <Brain className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-semibold mb-2">No Analysis Yet</h3>
        <p className="text-muted-foreground mb-4">
          Generate your first AI-powered business analysis
        </p>
        <Button onClick={handleRefresh}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Generate Analysis
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold">Business Analysis</h2>
          <p className="text-sm text-muted-foreground">
            Last updated: {format(new Date(analysis.generated_at), 'PPp')}
          </p>
        </div>
        <Button onClick={handleRefresh} disabled={refreshing}>
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <Card className="p-6">
        <div className="prose prose-lg max-w-none">
          <div className="flex items-center gap-3 mb-6">
            <Brain className="h-6 w-6 text-teal-600" />
            <h3 className="text-xl font-bold text-foreground m-0">Executive Summary</h3>
          </div>
          
          {analysis.metrics && (
            <div className="bg-teal-50 dark:bg-teal-950/30 rounded-lg p-4 mb-6 border border-teal-200 dark:border-teal-800">
              <div className="flex items-center gap-4 text-sm">
                <span className="text-teal-700 dark:text-teal-300 font-medium">
                  <strong className="text-teal-600">{analysis.metrics.total_sources || 0}</strong> sources
                </span>
                <span className="text-teal-700 dark:text-teal-300 font-medium">
                  <strong className="text-teal-600">{analysis.metrics.total_patients || 0}</strong> patients
                </span>
                <span className="text-teal-700 dark:text-teal-300 font-medium">
                  <strong className="text-teal-600">{analysis.metrics.active_campaigns || 0}</strong> active campaigns
                </span>
              </div>
            </div>
          )}

          <div className="space-y-4 text-foreground leading-relaxed">
            {analysis.insights?.map((insight: any, index: number) => {
              const priorityColor = insight.priority === 'high' ? 'text-red-600 dark:text-red-400' : 
                                  insight.priority === 'medium' ? 'text-amber-600 dark:text-amber-400' : 
                                  'text-green-600 dark:text-green-400';
              
              return (
                <div key={index} className="mb-6">
                  <h4 className={`font-bold text-lg mb-2 ${priorityColor}`}>
                    {insight.title}
                  </h4>
                  <p className="text-muted-foreground mb-3 italic">
                    {insight.summary}
                  </p>
                  <div className="bg-gradient-to-r from-teal-50 to-blue-50 dark:from-teal-950/20 dark:to-blue-950/20 rounded-lg p-4 border-l-4 border-teal-500">
                    <p className="text-sm">
                      <span className="font-semibold text-teal-700 dark:text-teal-300">Strategic Recommendation:</span>{' '}
                      <span className="text-foreground">{insight.recommendation}</span>
                    </p>
                  </div>
                  {index < analysis.insights.length - 1 && (
                    <div className="mt-4 border-b border-border/30"></div>
                  )}
                </div>
              );
            })}

            <div className="mt-8 p-4 bg-gradient-to-br from-teal-100 to-blue-100 dark:from-teal-900/30 dark:to-blue-900/30 rounded-lg border border-teal-200 dark:border-teal-700">
              <p className="text-sm text-teal-800 dark:text-teal-200 italic">
                <strong>Next Steps:</strong> Focus on the highest priority recommendations above to maximize impact on patient acquisition and retention.
              </p>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}