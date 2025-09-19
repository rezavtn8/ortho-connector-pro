import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, CheckCircle, TrendingUp, Target, Users, Activity, Zap, Brain, RefreshCw, BarChart3, MapPin, Calendar, ChevronDown, ChevronUp } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface AIInsight {
  id: string;
  type: 'summary' | 'action' | 'improvement' | 'alert';
  title: string;
  summary: string;
  content: string;
  priority: 'high' | 'medium' | 'low';
  icon: any;
  actionableSteps?: string[];
}

export function AIDataAnalysis() {
  const [insights, setInsights] = useState<AIInsight[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasAnalysis, setHasAnalysis] = useState(false);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const { user } = useAuth();

  const generateAIAnalysis = async () => {
    if (!user) return;
    
    setLoading(true);
    setHasAnalysis(false);

    try {
      // Fetch comprehensive business data
      const [sourcesResult, monthlyResult, visitsResult, campaignsResult, businessProfileResult] = await Promise.all([
        supabase.from('patient_sources').select('*').eq('created_by', user.id),
        supabase.from('monthly_patients').select('*').eq('user_id', user.id),
        supabase.from('marketing_visits').select('*').eq('user_id', user.id),
        supabase.from('campaigns').select('*').eq('created_by', user.id),
        supabase.functions.invoke('ai-business-context', {
          body: { action: 'get' },
          headers: {
            Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          },
        })
      ]);

      const sources = sourcesResult.data || [];
      const monthlyData = monthlyResult.data || [];
      const visits = visitsResult.data || [];
      const campaigns = campaignsResult.data || [];
      const businessProfile = businessProfileResult.data?.profile || {};

      // Prepare comprehensive data for AI analysis
      const currentMonth = new Date().toISOString().slice(0, 7);
      const analysisData = {
        business_profile: businessProfile,
        sources: sources,
        monthly_data: monthlyData,
        visits: visits,
        campaigns: campaigns,
        total_sources: sources.length,
        total_referrals: monthlyData.reduce((sum, m) => sum + (m.patient_count || 0), 0),
        active_sources_this_month: monthlyData.filter(m => 
          m.year_month === currentMonth && m.patient_count > 0
        ).length,
        source_types: sources.reduce((acc, s) => {
          acc[s.source_type] = (acc[s.source_type] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
        geographic_distribution: sources.reduce((acc, s) => {
          if (s.address) {
            const city = s.address.split(',')[1]?.trim() || 'Unknown';
            acc[city] = (acc[city] || 0) + 1;
          }
          return acc;
        }, {} as Record<string, number>),
        recent_visits: visits.filter(v => {
          const visitDate = new Date(v.visit_date);
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
          return visitDate >= thirtyDaysAgo;
        }),
        campaign_performance: campaigns.map(c => ({
          name: c.name,
          status: c.status,
          type: c.campaign_type,
          delivery_method: c.delivery_method
        })),
        last_6_months: monthlyData.filter(m => {
          const monthDate = new Date(m.year_month + '-01');
          const sixMonthsAgo = new Date();
          sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
          return monthDate >= sixMonthsAgo;
        })
      };

      // Call AI assistant for comprehensive analysis
      const { data, error } = await supabase.functions.invoke('ai-assistant', {
        body: {
          task_type: 'comprehensive_analysis',
          context: {
            analysis_data: analysisData,
            analysis_type: 'business_intelligence'
          },
          prompt: `Analyze the complete business data and provide 4-6 comprehensive insights. Format each insight as:

1. **Insight Title**
Key summary with specific metrics and trends.

Detailed analysis with specific data points, percentages, and actionable recommendations.

Focus on:
- Referral source distribution and concentration risk analysis
- Performance trends and seasonal patterns identification  
- Geographic distribution and market penetration gaps
- Source quality and reliability assessment
- Specific ROI and growth opportunities with data
- Risk factors and immediate improvement actions

Use actual numbers from the data: ${analysisData.total_referrals} total referrals, ${analysisData.active_sources_this_month} active sources this month, ${analysisData.total_sources} total sources.`,
        },
        headers: {
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
      });

      if (error) throw error;

      // Parse AI response and create insight cards
      const aiContent = data.content || '';
      let parsedInsights: any[] = [];
      
      try {
        // Try to parse as JSON first
        // Try to parse as JSON first
        if (aiContent.startsWith('[') || aiContent.startsWith('{')) {
          parsedInsights = JSON.parse(aiContent);
        } else {
          throw new Error('Not JSON format');
        }
      } catch {
        // Fallback: Parse structured text response
        console.log('Falling back to text parsing');
        const sections = aiContent.split(/\d+\.\s*/);
        parsedInsights = sections.slice(1).map((section, index) => {
          const lines = section.trim().split('\n').filter(line => line.trim());
          const title = lines[0]?.replace(/[*:,-].*/, '').replace(/\*\*/g, '').trim() || `Insight ${index + 1}`;
          const content = lines.slice(1).join('\n').trim() || section.trim();
          
          // Clean up markdown formatting
          const cleanContent = content
            .replace(/\*\*(.*?)\*\*/g, '$1')  // Remove **bold** formatting
            .replace(/^\s*[-•]\s*/gm, '• ')   // Normalize bullet points
            .replace(/\n\s*\n/g, '\n')       // Remove extra line breaks
            .trim();
          
          return {
            title,
            summary: cleanContent.split('.').slice(0, 2).join('.') + (cleanContent.includes('.') ? '.' : ''),
            content: cleanContent,
            priority: cleanContent.toLowerCase().includes('risk') || cleanContent.toLowerCase().includes('critical') ? 'high' : 
                     cleanContent.toLowerCase().includes('opportunity') || cleanContent.toLowerCase().includes('improve') ? 'medium' : 'low',
            actionable_steps: []
          };
        });
      }
      
      const generatedInsights: AIInsight[] = [];
      const icons = [BarChart3, TrendingUp, MapPin, Target, AlertTriangle, Brain];
      const types = ['summary', 'improvement', 'alert', 'action'] as const;

      parsedInsights.forEach((insight, index) => {
        if (insight.title && insight.content && index < 6) {
          generatedInsights.push({
            id: (index + 1).toString(),
            type: types[index % types.length],
            title: insight.title,
            summary: insight.summary || insight.content.split('.').slice(0, 2).join('.') + '.',
            content: insight.content,
            priority: insight.priority || 'medium',
            icon: icons[index % icons.length],
            actionableSteps: insight.actionable_steps || []
          });
        }
      });

      setInsights(generatedInsights);
      setHasAnalysis(true);
      
      toast({
        title: 'Analysis Complete',
        description: 'Your comprehensive business analysis has been generated.',
      });

    } catch (error: any) {
      console.error('Error generating AI analysis:', error);
      toast({
        title: 'Analysis Failed',
        description: 'Unable to generate analysis. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'destructive';
      case 'medium': return 'default';
      case 'low': return 'secondary';
      default: return 'default';
    }
  };

  const getCardBorderClass = (priority: string) => {
    switch (priority) {
      case 'high': return 'border-l-4 border-l-destructive';
      case 'medium': return 'border-l-4 border-l-primary';
      case 'low': return 'border-l-4 border-l-muted-foreground';
      default: return '';
    }
  };

  const toggleCardExpansion = (cardId: string) => {
    setExpandedCards(prev => {
      const newSet = new Set(prev);
      if (newSet.has(cardId)) {
        newSet.delete(cardId);
      } else {
        newSet.add(cardId);
      }
      return newSet;
    });
  };

  if (!hasAnalysis && !loading) {
    return (
      <div className="text-center space-y-4 py-8">
        <div className="w-16 h-16 mx-auto bg-primary/10 rounded-full flex items-center justify-center">
          <Brain className="h-8 w-8 text-primary" />
        </div>
        <div>
          <h3 className="text-lg font-semibold mb-2">Generate AI Business Analysis</h3>
          <p className="text-muted-foreground mb-4 max-w-md mx-auto">
            Get comprehensive insights about your referral patterns, source distribution, performance trends, and actionable recommendations based on your complete practice data.
          </p>
          <Button onClick={generateAIAnalysis} className="bg-primary hover:bg-primary/90">
            <BarChart3 className="h-4 w-4 mr-2" />
            Generate Analysis
          </Button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="text-center py-4">
          <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
            <div className="animate-spin">
              <RefreshCw className="h-4 w-4" />
            </div>
            Analyzing your practice data...
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-5 bg-muted rounded w-3/4"></div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="h-4 bg-muted rounded"></div>
                  <div className="h-4 bg-muted rounded w-5/6"></div>
                  <div className="h-4 bg-muted rounded w-4/6"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">AI Business Intelligence</h3>
          <p className="text-sm text-muted-foreground">Data-driven insights and recommendations</p>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={generateAIAnalysis}
          disabled={loading}
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh Analysis
        </Button>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {insights.map((insight) => {
          const IconComponent = insight.icon;
          const isExpanded = expandedCards.has(insight.id);
          
          return (
            <Card key={insight.id} className={`${getCardBorderClass(insight.priority)} hover:shadow-md transition-all duration-200`}>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <IconComponent className="h-5 w-5 text-primary" />
                    <span className="line-clamp-2">{insight.title}</span>
                  </div>
                  <Badge variant={getPriorityColor(insight.priority) as any} className="text-xs flex-shrink-0">
                    {insight.priority.toUpperCase()}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Nutshell Summary */}
                <div className="text-sm text-muted-foreground leading-relaxed">
                  {insight.summary}
                </div>
                
                {/* Expandable Content */}
                {isExpanded && (
                  <div className="space-y-4">
                    <div className="text-sm leading-relaxed whitespace-pre-line">
                      {insight.content.split('\n').map((line, idx) => {
                        // Handle markdown-style formatting
                        if (line.trim().startsWith('**') && line.trim().endsWith('**')) {
                          const cleanLine = line.replace(/^\*\*|\*\*$/g, '').trim();
                          return (
                            <h4 key={idx} className="font-semibold text-foreground mb-2 mt-3 first:mt-0">
                              {cleanLine}
                            </h4>
                          );
                        }
                        
                        // Handle bullet points
                        if (line.trim().startsWith('•') || line.trim().startsWith('-')) {
                          return (
                            <div key={idx} className="flex items-start gap-2 mb-1">
                              <span className="text-primary mt-1">•</span>
                              <span>{line.replace(/^[•-]\s*/, '').trim()}</span>
                            </div>
                          );
                        }
                        
                        // Handle bold text within lines
                        const parts = line.split(/(\*\*.*?\*\*)/g);
                        const formattedLine = parts.map((part, partIdx) => {
                          if (part.startsWith('**') && part.endsWith('**')) {
                            return (
                              <strong key={partIdx} className="font-semibold text-foreground">
                                {part.replace(/^\*\*|\*\*$/g, '')}
                              </strong>
                            );
                          }
                          return part;
                        });
                        
                        return line.trim() ? (
                          <p key={idx} className="mb-2 last:mb-0">
                            {formattedLine}
                          </p>
                        ) : (
                          <br key={idx} />
                        );
                      })}
                    </div>
                    
                    {/* Actionable Steps */}
                    {insight.actionableSteps && insight.actionableSteps.length > 0 && (
                      <div className="bg-muted/30 rounded-lg p-3">
                        <h4 className="text-sm font-medium mb-2">Action Steps:</h4>
                        <ul className="text-sm space-y-1">
                          {insight.actionableSteps.map((step, index) => (
                            <li key={index} className="flex items-start gap-2">
                              <span className="text-primary font-medium">{index + 1}.</span>
                              <span>{step}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
                
                {/* More/Less Button */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleCardExpansion(insight.id)}
                  className="w-full h-8 text-xs"
                >
                  {isExpanded ? (
                    <>
                      <ChevronUp className="h-3 w-3 mr-1" />
                      Show Less
                    </>
                  ) : (
                    <>
                      <ChevronDown className="h-3 w-3 mr-1" />
                      Show More
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}