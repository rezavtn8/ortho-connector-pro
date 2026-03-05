import React from 'react';
import { CompetitorBenchmarking } from '@/components/analytics/CompetitorBenchmarking';
import { Shield } from 'lucide-react';

export default function CompetitorWatch() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Shield className="h-6 w-6 text-primary" />
          Competitor Watch
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Monitor same-specialty practices near you and benchmark your performance
        </p>
      </div>
      <CompetitorBenchmarking />
    </div>
  );
}
