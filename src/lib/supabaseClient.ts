// Simple wrapper that just uses the original Supabase client with basic retry
import { supabase } from '@/integrations/supabase/client';

const retryWithBackoff = async <T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      if (attempt === maxRetries) {
        throw error;
      }

      // Don't retry on authentication errors or 4xx client errors
      if (error?.status >= 400 && error?.status < 500) {
        throw error;
      }

      // Exponential backoff with jitter
      const delay = baseDelay * Math.pow(2, attempt - 1) + Math.random() * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw new Error('Max retries exceeded');
};

export const resilientSupabase = {
  from: (table: any) => supabase.from(table),
  rpc: (fn: any, args?: any) => supabase.rpc(fn, args),
  auth: supabase.auth,
  original: supabase,
  healthCheck: async (): Promise<boolean> => {
    try {
      const { error } = await supabase.from('user_profiles').select('id').limit(1);
      return !error;
    } catch {
      return false;
    }
  }
};