import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { TrendingUp, TrendingDown, Minus, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

interface PatientLoadDisplayProps {
  officeId: string;
  patientLoad: number;
  onHistoryClick: () => void;
}

interface TrendData {
  current_count: number;
  previous_count: number;
  trend_direction: 'up' | 'down' | 'stable';
  last_updated: string | null;
}

export function PatientLoadDisplay({ officeId, patientLoad, onHistoryClick }: PatientLoadDisplayProps) {
  const [trendData, setTrendData] = useState<TrendData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTrendData();
  }, [officeId, patientLoad]);

  const loadTrendData = async () => {
    try {
      const { data, error } = await supabase
        .rpc('get_patient_load_trend', { 
          office_id_param: officeId,
          days_back: 30 
        });

      if (error) {
        console.error('Error loading trend data:', error);
        return;
      }

      if (data && data.length > 0) {
        const trendResult = data[0] as {
          current_count: number;
          previous_count: number;
          trend_direction: string;
          last_updated: string | null;
        };
        
        setTrendData({
          ...trendResult,
          trend_direction: trendResult.trend_direction as 'up' | 'down' | 'stable'
        });
      }
    } catch (error) {
      console.error('Error loading trend data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getTrendIcon = () => {
    if (!trendData || loading) return null;
    
    switch (trendData.trend_direction) {
      case 'up':
        return <TrendingUp className="h-3 w-3 text-green-600" />;
      case 'down':
        return <TrendingDown className="h-3 w-3 text-red-600" />;
      default:
        return <Minus className="h-3 w-3 text-gray-500" />;
    }
  };

  const getTrendTooltip = () => {
    if (!trendData) return "No trend data available";
    
    const change = trendData.current_count - trendData.previous_count;
    const direction = change > 0 ? 'increased' : change < 0 ? 'decreased' : 'remained stable';
    const changeText = change !== 0 ? ` (${change > 0 ? '+' : ''}${change})` : '';
    
    let tooltip = `Patient load has ${direction}${changeText} over the last 30 days`;
    
    if (trendData.last_updated) {
      tooltip += `\nLast updated: ${format(new Date(trendData.last_updated), 'MMM dd, yyyy h:mm a')}`;
    }
    
    return tooltip;
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            onClick={onHistoryClick}
            className="h-auto p-0 flex items-center gap-1 hover:bg-transparent"
          >
            <span className="font-medium text-foreground">{patientLoad}</span>
            {getTrendIcon()}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <p className="whitespace-pre-line">{getTrendTooltip()}</p>
          <p className="text-xs text-muted-foreground mt-1">Click to view history and update</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}