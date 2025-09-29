import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { RefreshCw, TrendingUp, Users, Star, AlertCircle, Brain } from 'lucide-react';
import { useAIAnalysis } from '@/hooks/useAIAnalysis';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

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
          <Button disabled className="bg-gradient-to-r from-purple-500 to-blue-500">
            <RefreshCw className="h-4 w-4 animate-spin mr-2" />
            Analyzing...
          </Button>
        </div>
        <div className="grid gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse border-purple-200/50 dark:border-purple-800/50">
              <CardHeader>
                <div className="h-4 bg-gradient-to-r from-purple-200 to-blue-200 dark:from-purple-900 dark:to-blue-900 rounded w-1/3"></div>
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
        <div className="w-16 h-16 rounded-full bg-gradient-to-r from-purple-500 to-blue-500 flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="h-8 w-8 text-white" />
        </div>
        <h3 className="text-lg font-semibold mb-2">Analysis Failed</h3>
        <p className="text-muted-foreground mb-4">
          Unable to generate business analysis. Please try again.
        </p>
        <Button onClick={handleRefresh} className="bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600">
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry Analysis
        </Button>
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="text-center py-12">
        <div className="w-20 h-20 rounded-full bg-gradient-to-r from-purple-500 to-blue-500 flex items-center justify-center mx-auto mb-6 shadow-lg shadow-purple-500/30">
          <Brain className="h-10 w-10 text-white" />
        </div>
        <h3 className="text-xl font-semibold mb-2 bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
          Generate Your First AI Analysis
        </h3>
        <p className="text-muted-foreground mb-6 max-w-md mx-auto">
          Get AI-powered insights about your business performance, patient sources, and strategic recommendations
        </p>
        <Button onClick={handleRefresh} className="bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 shadow-lg shadow-purple-500/30">
          <Brain className="h-4 w-4 mr-2" />
          Generate Analysis
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-r from-purple-500 to-blue-500 flex items-center justify-center shadow-md shadow-purple-500/30">
              <Brain className="h-5 w-5 text-white" />
            </div>
            <h2 className="text-xl font-semibold">Business Analysis</h2>
          </div>
          <p className="text-sm text-muted-foreground ml-13">
            Last updated: {format(new Date(analysis.generated_at), 'PPp')}
          </p>
        </div>
        <Button onClick={handleRefresh} disabled={refreshing} className="bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 shadow-md shadow-purple-500/20">
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh Analysis
        </Button>
      </div>

      <Card className="max-w-4xl mx-auto bg-white dark:bg-card shadow-lg border border-purple-200/50 dark:border-purple-800/50">
        {/* Data Snapshot Bar */}
        {analysis.metrics && (
          <div className="px-8 py-4 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-950/30 dark:to-blue-950/30 border-b border-purple-200/50 dark:border-purple-800/50">
            <div className="flex items-center justify-center gap-8 text-sm font-medium">
              <span className="text-slate-600 dark:text-slate-300">
                <span className="font-semibold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">{analysis.metrics.total_sources || 0}</span> sources
              </span>
              <div className="h-4 w-px bg-purple-300/50 dark:bg-purple-700/50"></div>
              <span className="text-slate-600 dark:text-slate-300">
                <span className="font-semibold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">{analysis.metrics.total_patients || 0}</span> patients
              </span>
              <div className="h-4 w-px bg-purple-300/50 dark:bg-purple-700/50"></div>
              <span className="text-slate-600 dark:text-slate-300">
                <span className="font-semibold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">{analysis.metrics.active_campaigns || 0}</span> campaigns
              </span>
            </div>
          </div>
        )}

        {/* Executive Summary Content */}
        <div className="px-8 py-8">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-r from-purple-500 to-blue-500 flex items-center justify-center">
              <Brain className="h-5 w-5 text-white" />
            </div>
            <h3 className="text-2xl font-semibold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">Business Intelligence Report</h3>
          </div>

          {/* Executive Narrative Analysis */}
          <div className="space-y-8 mb-10">
            {analysis.narrative_sections?.map((section: any, index: number) => (
              <div key={index} className="space-y-4">
                <h4 className="text-lg font-semibold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">{section.title}</h4>
                
                {/* Section Content with validation */}
                <div className="text-base leading-7 text-slate-700 dark:text-slate-300">
                  {section.content ? (
                    section.content.split('\n\n').map((paragraph: string, pIndex: number) => (
                      <p key={pIndex} className="mb-4">{paragraph}</p>
                    ))
                  ) : (
                    <p className="text-muted-foreground italic">No content available for this section</p>
                  )}
                </div>

                {/* Key Findings */}
                {section.key_findings && section.key_findings.length > 0 && (
                  <div className="bg-purple-50 dark:bg-purple-950/20 rounded-lg p-4 border-l-4 border-purple-500">
                    <h5 className="font-medium text-sm bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent mb-2">Key Findings</h5>
                    <ul className="space-y-1 text-sm">
                      {section.key_findings.map((finding: string, fIndex: number) => (
                        <li key={fIndex} className="flex items-start gap-2">
                          <div className="w-1 h-1 bg-purple-500 rounded-full mt-2 flex-shrink-0"></div>
                          <span className="text-slate-600 dark:text-slate-400">{finding}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {index < (analysis.narrative_sections?.length || 1) - 1 && (
                  <div className="my-8 w-24 h-px bg-gradient-to-r from-purple-300 to-blue-300"></div>
                )}
              </div>
            )) || (
              // Fallback for old format
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
            )}
          </div>

          {/* Strategic Recommendations */}
          {(analysis.recommendations?.length > 0 || analysis.insights?.length > 0) && (
            <div className="bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-950/30 dark:to-blue-950/30 rounded-xl p-6 border border-purple-200 dark:border-purple-800/30 shadow-md shadow-purple-500/10">
              <h4 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <div className="w-2 h-2 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full"></div>
                <span className="bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">Strategic Recommendations</span>
              </h4>
              <div className="space-y-4">
                {analysis.recommendations?.map((rec: any, index: number) => (
                  <div key={index} className="space-y-2">
                    <h5 className="font-medium text-sm bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">{rec.title}</h5>
                    <p className="text-sm text-slate-700 dark:text-slate-300 leading-6 pl-3 border-l-2 border-purple-300 dark:border-purple-700">
                      {rec.action}
                    </p>
                  </div>
                )) || (
                  // Fallback for old format
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
                )}
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}