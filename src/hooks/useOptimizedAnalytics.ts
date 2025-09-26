/**
 * Optimized analytics hook with memoization and performance optimizations
 */
import { useMemo, useCallback } from 'react';
import { useUserSources, useAnalyticsData } from '@/hooks/useCachedData';
import { PatientSource, MonthlyPatients, SourceType } from '@/lib/database.types';

interface SourceAnalytics {
  source: PatientSource;
  totalPatients: number;
  averageMonthly: number;
  trend: 'up' | 'down' | 'stable';
  trendPercentage: number;
  monthlyData: MonthlyPatients[];
}

export function useOptimizedAnalytics(selectedPeriod: '3m' | '6m' | '12m' | 'all') {
  const { data: sourcesData, isLoading: sourcesLoading } = useUserSources();
  const { data: analyticsData, isLoading: analyticsLoading } = useAnalyticsData();

  // Memoized date calculation
  const dateFilter = useMemo(() => {
    const now = new Date();
    let startDate: Date;
    switch (selectedPeriod) {
      case '3m':
        startDate = new Date(now.getFullYear(), now.getMonth() - 3, 1);
        break;
      case '6m':
        startDate = new Date(now.getFullYear(), now.getMonth() - 6, 1);
        break;
      case '12m':
        startDate = new Date(now.getFullYear(), now.getMonth() - 12, 1);
        break;
      default:
        startDate = new Date(2020, 0, 1);
    }
    return `${startDate.getFullYear()}-${(startDate.getMonth() + 1).toString().padStart(2, '0')}`;
  }, [selectedPeriod]);

  // Memoized analytics computation
  const analytics = useMemo((): {
    sources: PatientSource[];
    monthlyData: MonthlyPatients[];
    analytics: SourceAnalytics[];
    loading: boolean;
  } => {
    if (sourcesLoading || analyticsLoading) {
      return { sources: [], monthlyData: [], analytics: [], loading: true };
    }

    const activeSources = (sourcesData || []).filter((s: any) => s.is_active);
    const monthlyDataResult = (analyticsData?.monthly_data || [])
      .filter((m: any) => m.year_month >= dateFilter)
      .sort((a: any, b: any) => a.year_month.localeCompare(b.year_month));

    const analyticsComputed: SourceAnalytics[] = activeSources.map((source: any) => {
      const sourceMonthlyData = monthlyDataResult.filter((m: any) => m.source_id === source.id);
      const totalPatients = sourceMonthlyData.reduce((sum: number, m: any) => sum + (m.patient_count || 0), 0);
      const averageMonthly = sourceMonthlyData.length > 0 ? Math.round(totalPatients / sourceMonthlyData.length) : 0;

      let trend: 'up' | 'down' | 'stable' = 'stable';
      let trendPercentage = 0;
      if (sourceMonthlyData.length >= 2) {
        const recent = sourceMonthlyData[sourceMonthlyData.length - 1].patient_count || 0;
        const previous = sourceMonthlyData[sourceMonthlyData.length - 2].patient_count || 0;
        if (recent > previous) {
          trend = 'up';
          trendPercentage = previous > 0 ? Math.round(((recent - previous) / previous) * 100) : 100;
        } else if (recent < previous) {
          trend = 'down';
          trendPercentage = previous > 0 ? Math.round(((previous - recent) / previous) * -100) : -100;
        }
      }

      return {
        source,
        totalPatients,
        averageMonthly,
        trend,
        trendPercentage,
        monthlyData: sourceMonthlyData as any
      };
    });

    return {
      sources: activeSources as any,
      monthlyData: monthlyDataResult as any,
      analytics: analyticsComputed,
      loading: false
    };
  }, [sourcesData, analyticsData, dateFilter, sourcesLoading, analyticsLoading]);

  // Memoized filter functions
  const getSourceCategory = useCallback((sourceType: SourceType) => {
    switch (sourceType) {
      case 'Yelp':
      case 'Google':
      case 'Website':
      case 'Social Media':
        return 'online';
      case 'Office':
        return 'offices';
      case 'Insurance':
        return 'insurance';
      case 'Word of Mouth':
        return 'word-of-mouth';
      case 'Other':
        return 'other';
      default:
        return 'other';
    }
  }, []);

  // Memoized filtered analytics
  const getFilteredAnalytics = useCallback((filterType: string) => {
    if (filterType === 'all') return analytics.analytics;
    
    if (['online', 'offices', 'insurance', 'word-of-mouth', 'other'].includes(filterType)) {
      return analytics.analytics.filter(a => getSourceCategory(a.source.source_type) === filterType);
    }
    
    return analytics.analytics.filter(a => a.source.source_type === filterType);
  }, [analytics.analytics, getSourceCategory]);

  return {
    ...analytics,
    getFilteredAnalytics,
    getSourceCategory
  };
}