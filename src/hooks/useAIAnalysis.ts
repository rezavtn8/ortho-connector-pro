import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface AIAnalysis {
  id: string;
  insights?: any[];
  narrative_sections?: {
    title: string;
    content: string;
    key_findings: string[];
  }[];
  recommendations?: {
    title: string;
    action: string;
  }[];
  metrics: {
    total_sources: number;
    total_patients: number;
    active_campaigns: number;
  };
  generated_at: string;
  cached_until: string;
}

export function useAIAnalysis() {
  const [analysis, setAnalysis] = useState<AIAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  const fetchCachedAnalysis = async () => {
    if (!user) return null;

    try {
      const { data, error } = await supabase
        .from('ai_generated_content')
        .select('*')
        .eq('user_id', user.id)
        .eq('content_type', 'business_analysis')
        .eq('status', 'generated')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        const analysisData = JSON.parse(data.generated_text);
        const cacheExpiry = new Date(data.created_at);
        cacheExpiry.setHours(cacheExpiry.getHours() + 24); // Cache for 24 hours
        
        if (new Date() < cacheExpiry) {
          return {
            ...analysisData,
            id: data.id,
            generated_at: data.created_at,
            cached_until: cacheExpiry.toISOString(),
          };
        }
      }

      return null;
    } catch (err: any) {
      console.error('Error fetching cached analysis:', err);
      return null;
    }
  };

  const generateNewAnalysis = async () => {
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase.functions.invoke('ai-business-analysis', {
      body: { refresh: true }
    });

    if (error) throw error;
    if (!data || data.success === false || !data.analysis) {
      throw new Error((data as any)?.error || 'Failed to generate analysis');
    }

    // Cache the new analysis only if we have valid JSON
    const generatedText = JSON.stringify(data.analysis);
    if (generatedText) {
      const { error: insertError } = await supabase
        .from('ai_generated_content')
        .insert({
          user_id: user.id,
          content_type: 'business_analysis',
          generated_text: generatedText,
          status: 'generated',
          metadata: { tokens_used: (data as any).usage?.tokens_used }
        });

      if (insertError) {
        console.error('Error caching analysis:', insertError);
      }
    }

    const cacheExpiry = new Date();
    cacheExpiry.setHours(cacheExpiry.getHours() + 24);

    return {
      ...data.analysis,
      id: crypto.randomUUID(),
      generated_at: new Date().toISOString(),
      cached_until: cacheExpiry.toISOString(),
    };
  };

  const refreshAnalysis = async () => {
    setLoading(true);
    setError(null);

    try {
      const newAnalysis = await generateNewAnalysis();
      setAnalysis(newAnalysis);
    } catch (err: any) {
      setError(err.message || 'Failed to generate analysis');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user) return;

    const loadAnalysis = async () => {
      setLoading(true);
      setError(null);

      try {
        // First, try to get cached analysis
        const cachedAnalysis = await fetchCachedAnalysis();
        
        if (cachedAnalysis) {
          setAnalysis(cachedAnalysis);
        } else {
          // No valid cache, generate new analysis
          const newAnalysis = await generateNewAnalysis();
          setAnalysis(newAnalysis);
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load analysis');
      } finally {
        setLoading(false);
      }
    };

    loadAnalysis();
  }, [user]);

  return {
    analysis,
    loading,
    error,
    refreshAnalysis,
  };
}