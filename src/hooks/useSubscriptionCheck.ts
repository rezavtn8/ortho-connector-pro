import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function useSubscriptionCheck() {
  const { data: hasActiveSubscription, isLoading } = useQuery({
    queryKey: ['subscription-check'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;

      const { data, error } = await supabase
        .from('subscriptions')
        .select('status')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .maybeSingle();

      if (error) throw error;
      return !!data;
    },
  });

  return {
    hasActiveSubscription,
    isLoading,
    needsSubscription: !isLoading && !hasActiveSubscription,
  };
}