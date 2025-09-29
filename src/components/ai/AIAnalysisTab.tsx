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
      {/* Header Section - Teal theme */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Business Intelligence Report</h2>
          <p className="text-sm text-muted-foreground">
            Last updated: {format(new Date(analysis.generated_at), 'PPp')}
          </p>
        </div>
        {/* Purple AI Button */}
        <Button 
          onClick={handleRefresh} 
          disabled={refreshing} 
          className="bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh Analysis
        </Button>
      </div>

      {/* Data Snapshot - Teal theme */}
      {analysis.metrics && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-3xl font-bold">{analysis.metrics.total_sources || 0}</p>
                  <p className="text-sm text-muted-foreground">Total Sources</p>
                </div>
                <TrendingUp className="h-8 w-8 text-primary opacity-20" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-3xl font-bold">{analysis.metrics.total_patients || 0}</p>
                  <p className="text-sm text-muted-foreground">Total Patients</p>
                </div>
                <Users className="h-8 w-8 text-primary opacity-20" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-3xl font-bold">{analysis.metrics.active_campaigns || 0}</p>
                  <p className="text-sm text-muted-foreground">Active Campaigns</p>
                </div>
                <Star className="h-8 w-8 text-primary opacity-20" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Narrative Sections */}
      <div className="space-y-6">
        {analysis.narrative_sections?.map((section: any, index: number) => (
          <Card key={index}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                {section.title}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Section Content */}
              {section.content && (
                <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">
                  {section.content}
                </p>
              )}
              
              {/* Key Findings */}
              {section.key_findings && section.key_findings.length > 0 && (
                <div className="bg-muted/50 rounded-lg p-4">
                  <p className="font-medium mb-2">Key Findings:</p>
                  <ul className="space-y-2">
                    {section.key_findings.map((finding: string, fIndex: number) => (
                      <li key={fIndex} className="flex items-start gap-2">
                        <span className="text-primary mt-1">•</span>
                        <span className="text-sm">{finding}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
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

      {/* Strategic Recommendations - Purple AI accent */}
      {analysis.recommendations && analysis.recommendations.length > 0 && (
        <Card className="border-purple-200 bg-gradient-to-br from-purple-50/50 to-blue-50/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-purple-600" />
              Strategic Recommendations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {analysis.recommendations.map((rec: any, index: number) => (
                <div key={index} className="bg-white rounded-lg p-4 border border-purple-100">
                  <h4 className="font-semibold text-purple-900 mb-1">{rec.title}</h4>
                  <p className="text-sm text-muted-foreground">{rec.action}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}