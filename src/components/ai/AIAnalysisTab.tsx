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

      <Card className="max-w-4xl mx-auto bg-white dark:bg-card shadow-sm border border-border/50">
        {/* Data Snapshot Bar */}
        {analysis.metrics && (
          <div className="px-8 py-4 bg-gradient-to-r from-slate-50 to-blue-50/30 dark:from-slate-900/50 dark:to-blue-900/20 border-b border-border/30">
            <div className="flex items-center justify-center gap-8 text-sm font-medium">
              <span className="text-slate-600 dark:text-slate-300">
                <span className="text-teal-600 font-semibold">{analysis.metrics.total_sources || 0}</span> sources
              </span>
              <div className="h-4 w-px bg-border/50"></div>
              <span className="text-slate-600 dark:text-slate-300">
                <span className="text-teal-600 font-semibold">{analysis.metrics.total_patients || 0}</span> patients
              </span>
              <div className="h-4 w-px bg-border/50"></div>
              <span className="text-slate-600 dark:text-slate-300">
                <span className="text-teal-600 font-semibold">{analysis.metrics.active_campaigns || 0}</span> campaigns
              </span>
            </div>
          </div>
        )}

        {/* Executive Summary Content */}
        <div className="px-8 py-8">
          <div className="flex items-center gap-3 mb-8">
            <Brain className="h-6 w-6 text-teal-600" />
            <h3 className="text-2xl font-semibold text-foreground">Business Intelligence Report</h3>
          </div>

          {/* Narrative Analysis */}
          <div className="prose max-w-none mb-8">
            <div className="text-base leading-7 text-slate-700 dark:text-slate-300 space-y-6">
              {analysis.insights?.map((insight: any, index: number) => (
                <div key={index}>
                  <p className="mb-4">
                    <span className="font-medium text-foreground">{insight.summary}</span>
                  </p>
                  {index < analysis.insights.length - 1 && (
                    <div className="my-6 w-16 h-px bg-gradient-to-r from-teal-300 to-transparent"></div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Recommendations Section */}
          {analysis.insights?.length > 0 && (
            <div className="bg-gradient-to-br from-teal-50/50 to-blue-50/30 dark:from-teal-950/20 dark:to-blue-950/20 rounded-xl p-6 border border-teal-100 dark:border-teal-800/30">
              <h4 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                <div className="w-2 h-2 bg-teal-500 rounded-full"></div>
                Key Recommendations
              </h4>
              <ul className="space-y-3">
                {analysis.insights?.map((insight: any, index: number) => (
                  <li key={index} className="flex items-start gap-3 text-sm">
                    <div className="w-1.5 h-1.5 bg-teal-400 rounded-full mt-2 flex-shrink-0"></div>
                    <span className="text-slate-700 dark:text-slate-300 leading-6">
                      {insight.recommendation}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}