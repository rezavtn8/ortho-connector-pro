import React from 'react';
import { CompetitorBenchmarking } from '@/components/analytics/CompetitorBenchmarking';

export default function CompetitorWatch() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">Competitor Watch</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Track same-specialty practices near you and benchmark your performance
        </p>
      </div>
      <CompetitorBenchmarking />
    </div>
  );
}
