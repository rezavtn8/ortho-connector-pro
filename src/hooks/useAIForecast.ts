import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface OverallForecast {
  next_month_predicted: number;
  month2_predicted: number;
  month3_predicted: number;
  growth_rate_percent: number;
  growth_phase: 'expansion' | 'plateau' | 'decline';
  confidence: 'high' | 'medium' | 'low';
  summary: string;
}

export interface SourceForecast {
  source_name: string;
  predicted_next_month: number;
  trend: 'growing' | 'stable' | 'declining' | 'at_risk';
  risk_level: 'none' | 'low' | 'medium' | 'high';
  note: string;
}

export interface StrategicAction {
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  category: 'retain' | 'grow' | 'reactivate' | 'optimize';
}

export interface RiskAlert {
  source_name: string;
  alert_type: 'declining_volume' | 'gone_cold' | 'inconsistent' | 'new_risk';
  message: string;
}

export interface HistoricalTotal {
  month: string;
  total: number;
}

export interface ForecastData {
  overall_forecast: OverallForecast;
  source_forecasts: SourceForecast[];
  strategic_actions: StrategicAction[];
  risk_alerts: RiskAlert[];
  historical_totals: HistoricalTotal[];
}

export function useAIForecast() {
  const [forecast, setForecast] = useState<ForecastData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  const loadForecast = async (refresh = false) => {
    if (!user) return;
    setLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('ai-forecast', {
        body: { refresh }
      });

      if (fnError) throw fnError;
      if (!data?.success || !data?.forecast) {
        throw new Error(data?.error || 'Failed to generate forecast');
      }

      setForecast(data.forecast);
    } catch (err: any) {
      console.error('Forecast error:', err);
      setError(err.message || 'Failed to load forecast');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) loadForecast();
  }, [user]);

  return {
    forecast,
    loading,
    error,
    refreshForecast: () => loadForecast(true),
  };
}
