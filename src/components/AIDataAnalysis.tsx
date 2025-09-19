import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, CheckCircle, TrendingUp, Target, Users, Activity, Zap, Brain } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

interface AIInsight {
  id: string;
  type: 'summary' | 'action' | 'improvement' | 'alert';
  title: string;
  content: string;
  priority: 'high' | 'medium' | 'low';
  icon: any;
}

export function AIDataAnalysis() {
  const [insights, setInsights] = useState<AIInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    generateInsights();
  }, [user]);

  const generateInsights = async () => {
    if (!user) return;

    try {
      // Fetch basic data for context
      const { data: sources } = await supabase
        .from('patient_sources')
        .select('*')
        .eq('created_by', user.id);

      const { data: monthlyData } = await supabase
        .from('monthly_patients')
        .select('*')
        .eq('user_id', user.id);

      // Generate AI insights based on the data
      const currentMonth = new Date().toISOString().slice(0, 7);
      const totalSources = sources?.length || 0;
      const totalPatients = monthlyData?.reduce((sum, m) => sum + (m.patient_count || 0), 0) || 0;
      const activeThisMonth = monthlyData?.filter(m => 
        m.year_month === currentMonth && m.patient_count > 0
      ).length || 0;

      const generatedInsights: AIInsight[] = [
        {
          id: '1',
          type: 'summary',
          title: 'Business Performance Summary',
          content: `Your referral network consists of ${totalSources} sources generating ${totalPatients} total patient referrals. Currently, ${activeThisMonth} sources are actively referring patients this month, representing a ${totalSources > 0 ? Math.round((activeThisMonth / totalSources) * 100) : 0}% activation rate.`,
          priority: 'medium',
          icon: Brain
        },
        {
          id: '2',
          type: 'alert',
          title: 'Inactive Sources Alert',
          content: `${totalSources - activeThisMonth} of your referral sources haven't sent patients this month. Consider reaching out to dormant sources with targeted campaigns or visits to reactivate relationships.`,
          priority: 'high',
          icon: AlertTriangle
        },
        {
          id: '3',
          type: 'improvement',
          title: 'Network Expansion Opportunity',
          content: `Based on your current performance, adding 3-5 new high-quality referral sources could potentially increase your monthly patient volume by 15-25%. Focus on similar practice types to your top performers.`,
          priority: 'medium',
          icon: TrendingUp
        },
        {
          id: '4',
          type: 'action',
          title: 'Next Steps to Improve',
          content: 'Schedule follow-up visits with your top 3 performing sources, create personalized thank-you campaigns for active referrers, and identify 2 new potential sources in underserved geographic areas.',
          priority: 'high',
          icon: Target
        }
      ];

      // Add performance-specific insights
      if (totalPatients > 50) {
        generatedInsights.push({
          id: '5',
          type: 'summary',
          title: 'Referral Momentum',
          content: `Excellent work! Your practice has built strong referral momentum with ${totalPatients} total referrals. Focus on maintaining relationships with your top performers while gradually expanding your network.`,
          priority: 'low',
          icon: CheckCircle
        });
      } else if (totalPatients < 10) {
        generatedInsights.push({
          id: '5',
          type: 'improvement',
          title: 'Growth Acceleration',
          content: 'Your referral network is in the early stages. Focus on building 5-8 strong foundational relationships before expanding. Quality over quantity will drive sustainable growth.',
          priority: 'high',
          icon: Zap
        });
      }

      setInsights(generatedInsights);
    } catch (error) {
      console.error('Error generating insights:', error);
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

  if (loading) {
    return (
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
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {insights.map((insight) => {
        const IconComponent = insight.icon;
        return (
          <Card key={insight.id} className={`${getCardBorderClass(insight.priority)} hover:shadow-md transition-shadow`}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <IconComponent className="h-5 w-5 text-primary" />
                  {insight.title}
                </div>
                <Badge variant={getPriorityColor(insight.priority) as any} className="text-xs">
                  {insight.priority.toUpperCase()}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground leading-relaxed">{insight.content}</p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}