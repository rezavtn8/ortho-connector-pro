import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { timestamp } from '@/lib/dateSync';
import { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

interface SubscriptionConfig {
  table: string;
  event?: '*' | 'INSERT' | 'UPDATE' | 'DELETE';
  schema?: string;
  filter?: string;
}

interface UseRealtimeSubscriptionProps {
  subscriptions: SubscriptionConfig[];
  onUpdate?: (payload: RealtimePostgresChangesPayload<any>) => void;
  channelName?: string;
  enabled?: boolean;
}

/**
 * Optimized hook for managing Supabase realtime subscriptions
 * with proper cleanup and memory leak prevention
 */
export function useRealtimeSubscription({
  subscriptions,
  onUpdate,
  channelName = 'realtime-channel',
  enabled = true
}: UseRealtimeSubscriptionProps) {
  const channelRef = useRef<any>(null);
  const isMountedRef = useRef(true);

  const handleChange = useCallback((payload: RealtimePostgresChangesPayload<any>) => {
    if (isMountedRef.current && onUpdate) {
      onUpdate(payload);
    }
  }, [onUpdate]);

  useEffect(() => {
    if (!enabled || subscriptions.length === 0) return;

    // Clean up previous subscription
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    // Create new channel
    const channel = supabase.channel(`${channelName}-${timestamp()}`);

    // Add all subscriptions to the channel
    subscriptions.forEach(({ table, event = '*', schema = 'public', filter }) => {
      const config: any = {
        event,
        schema,
        table
      };

      if (filter) {
        config.filter = filter;
      }

      channel.on('postgres_changes', config, handleChange);
    });

    // Subscribe to the channel
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log(`Realtime subscription active: ${channelName}`);
      }
    });

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [subscriptions, handleChange, channelName, enabled]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, []);

  const unsubscribe = useCallback(() => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
  }, []);

  return { unsubscribe };
}