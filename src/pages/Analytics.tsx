// src/pages/Analytics.tsx - Optimized Version
import { OptimizedAnalytics } from '@/components/optimized/OptimizedAnalytics';
import { PerformanceErrorBoundary } from '@/components/performance/ErrorBoundary';

export default function Analytics() {
  return (
    <PerformanceErrorBoundary 
      onError={(error) => console.error('Analytics Error:', error)}
      retryable={true}
    >
      <OptimizedAnalytics />
    </PerformanceErrorBoundary>
  );
}