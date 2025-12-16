import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, Gift, Calendar, TrendingUp, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useOffices } from '@/hooks/useOffices';
import { format, subMonths } from 'date-fns';

interface Recommendation {
  id: string;
  type: 'thank-you' | 're-engage' | 'schedule-visit' | 'celebrate' | 'alert';
  icon: React.ReactNode;
  title: string;
  description: string;
  action: { label: string; path: string; params?: string };
  priority: 'high' | 'medium' | 'low';
}

export function AIRecommendations() {
  const navigate = useNavigate();
  const { data: offices } = useOffices();

  const recommendations = useMemo((): Recommendation[] => {
    if (!offices || offices.length === 0) return [];

    const recs: Recommendation[] = [];
    const now = new Date();
    const threeMonthsAgo = format(subMonths(now, 3), 'yyyy-MM');

    // VIP offices with recent activity - send thank you
    const activeVIPs = offices.filter(o => 
      o.tier === 'VIP' && 
      o.r3 && o.r3 > 0
    );
    if (activeVIPs.length > 0) {
      recs.push({
        id: 'thank-vip',
        type: 'thank-you',
        icon: <Gift className="h-5 w-5 text-purple-500" />,
        title: 'Send thank-you to active VIPs',
        description: `${activeVIPs.length} VIP office${activeVIPs.length > 1 ? 's have' : ' has'} sent referrals recently. Show appreciation!`,
        action: { 
          label: 'Create Campaign', 
          path: '/campaigns',
          params: `action=new-gift&tier=VIP`
        },
        priority: 'high',
      });
    }

    // Dormant offices - re-engage
    const dormantOffices = offices.filter(o => o.tier === 'Dormant');
    if (dormantOffices.length > 3) {
      recs.push({
        id: 're-engage-dormant',
        type: 're-engage',
        icon: <AlertCircle className="h-5 w-5 text-amber-500" />,
        title: 'Re-engage dormant offices',
        description: `${dormantOffices.length} offices haven't sent referrals in 3+ months. Time to reconnect!`,
        action: { 
          label: 'View Dormant', 
          path: '/offices',
          params: 'tier=Dormant'
        },
        priority: 'medium',
      });
    }

    // Warm offices with high potential - schedule visits
    const warmOffices = offices.filter(o => 
      o.tier === 'Warm' && 
      o.l12 && o.l12 >= 3
    );
    if (warmOffices.length > 0) {
      recs.push({
        id: 'visit-warm',
        type: 'schedule-visit',
        icon: <Calendar className="h-5 w-5 text-blue-500" />,
        title: 'Schedule visits for warm offices',
        description: `${warmOffices.length} warm office${warmOffices.length > 1 ? 's show' : ' shows'} potential. A visit could turn them into VIPs!`,
        action: { 
          label: 'Schedule Visits', 
          path: '/marketing-visits',
          params: `action=schedule&tier=Warm`
        },
        priority: 'medium',
      });
    }

    // Growing offices - celebrate
    const growingOffices = offices.filter(o => 
      o.r3 && o.l12 && 
      o.r3 > (o.l12 / 4) // Above average recent performance
    );
    if (growingOffices.length > 0 && growingOffices.length <= 5) {
      recs.push({
        id: 'celebrate-growth',
        type: 'celebrate',
        icon: <TrendingUp className="h-5 w-5 text-green-500" />,
        title: 'Celebrate growing partnerships',
        description: `${growingOffices.length} office${growingOffices.length > 1 ? 's are' : ' is'} sending more referrals than usual. Acknowledge their support!`,
        action: { 
          label: 'Send Thank You', 
          path: '/campaigns',
          params: `action=new-email&ids=${growingOffices.map(o => o.id).join(',')}`
        },
        priority: 'low',
      });
    }

    // Cold offices with history - worth trying
    const coldWithHistory = offices.filter(o => 
      o.tier === 'Cold' && 
      o.totalReferrals > 0
    );
    if (coldWithHistory.length > 5) {
      recs.push({
        id: 'revive-cold',
        type: 're-engage',
        icon: <Sparkles className="h-5 w-5 text-cyan-500" />,
        title: 'Revive old partnerships',
        description: `${coldWithHistory.length} offices used to refer patients. A campaign might rekindle the relationship.`,
        action: { 
          label: 'Create Campaign', 
          path: '/campaigns',
          params: `action=new-email&tier=Cold`
        },
        priority: 'low',
      });
    }

    // Sort by priority
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return recs.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
  }, [offices]);

  if (recommendations.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Sparkles className="h-5 w-5 text-primary" />
          AI Recommendations
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {recommendations.slice(0, 3).map((rec) => (
          <div
            key={rec.id}
            className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
          >
            <div className="mt-0.5">{rec.icon}</div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm">{rec.title}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{rec.description}</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(rec.action.params ? `${rec.action.path}?${rec.action.params}` : rec.action.path)}
            >
              {rec.action.label}
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
