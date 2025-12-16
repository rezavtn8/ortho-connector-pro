import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Circle, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useOffices } from '@/hooks/useOffices';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface SetupChecklistProps {
  showCard?: boolean;
}

interface ChecklistItem {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  action?: { label: string; path: string };
}

export function SetupChecklist({ showCard = true }: SetupChecklistProps) {
  const navigate = useNavigate();
  const { data: offices } = useOffices();

  // Fetch clinic data
  const { data: clinic } = useQuery({
    queryKey: ['user-clinic'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data } = await supabase
        .from('user_profiles')
        .select('clinic_id')
        .eq('user_id', user.id)
        .single();

      if (!data?.clinic_id) return null;

      const { data: clinicData } = await supabase
        .from('clinics')
        .select('*')
        .eq('id', data.clinic_id)
        .single();

      return clinicData;
    },
  });

  // Fetch campaigns count
  const { data: campaignsCount } = useQuery({
    queryKey: ['campaigns-count'],
    queryFn: async () => {
      const { count } = await supabase
        .from('campaigns')
        .select('*', { count: 'exact', head: true });
      return count || 0;
    },
  });

  // Fetch marketing visits count
  const { data: visitsCount } = useQuery({
    queryKey: ['visits-count'],
    queryFn: async () => {
      const { count } = await supabase
        .from('marketing_visits')
        .select('*', { count: 'exact', head: true });
      return count || 0;
    },
  });

  // Fetch discovery sessions count
  const { data: discoveriesCount } = useQuery({
    queryKey: ['discoveries-count'],
    queryFn: async () => {
      const { count } = await supabase
        .from('discovery_sessions')
        .select('*', { count: 'exact', head: true });
      return count || 0;
    },
  });

  const checklist: ChecklistItem[] = useMemo(() => [
    {
      id: 'clinic',
      title: 'Set up your clinic',
      description: 'Add your clinic name and location',
      completed: !!clinic,
      action: { label: 'Go to Settings', path: '/settings' },
    },
    {
      id: 'offices',
      title: 'Add partner offices',
      description: 'Add at least 5 partner offices',
      completed: (offices?.length || 0) >= 5,
      action: { label: 'Add Partners', path: '/offices' },
    },
    {
      id: 'discover',
      title: 'Run a discovery search',
      description: 'Find new potential partners nearby',
      completed: (discoveriesCount || 0) > 0,
      action: { label: 'Discover', path: '/discover' },
    },
    {
      id: 'campaign',
      title: 'Create your first campaign',
      description: 'Send an email or gift campaign',
      completed: (campaignsCount || 0) > 0,
      action: { label: 'Create Campaign', path: '/campaigns' },
    },
    {
      id: 'visit',
      title: 'Log a marketing visit',
      description: 'Track your office visits',
      completed: (visitsCount || 0) > 0,
      action: { label: 'Log Visit', path: '/marketing-visits' },
    },
  ], [clinic, offices, campaignsCount, visitsCount, discoveriesCount]);

  const completedCount = checklist.filter(item => item.completed).length;
  const progress = (completedCount / checklist.length) * 100;
  const isComplete = completedCount === checklist.length;

  const content = (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">{completedCount} of {checklist.length} complete</p>
          <p className="text-xs text-muted-foreground">
            {isComplete ? 'Great job! You\'re all set.' : 'Complete these steps to get the most out of Nexora'}
          </p>
        </div>
        <span className="text-2xl font-bold">{Math.round(progress)}%</span>
      </div>
      
      <Progress value={progress} className="h-2" />

      {!isComplete && (
        <div className="space-y-2 pt-2">
          {checklist.map((item) => (
            <div
              key={item.id}
              className={`flex items-center justify-between p-3 rounded-lg border ${
                item.completed ? 'bg-muted/50' : 'bg-card'
              }`}
            >
              <div className="flex items-center gap-3">
                {item.completed ? (
                  <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                    <Check className="h-4 w-4 text-primary-foreground" />
                  </div>
                ) : (
                  <Circle className="h-6 w-6 text-muted-foreground" />
                )}
                <div>
                  <p className={`text-sm font-medium ${item.completed ? 'line-through text-muted-foreground' : ''}`}>
                    {item.title}
                  </p>
                  <p className="text-xs text-muted-foreground">{item.description}</p>
                </div>
              </div>
              {!item.completed && item.action && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate(item.action!.path)}
                >
                  {item.action.label}
                  <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  if (!showCard) return content;

  // Don't show if complete
  if (isComplete) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Getting Started</CardTitle>
      </CardHeader>
      <CardContent>
        {content}
      </CardContent>
    </Card>
  );
}
