import React from 'react';
import { TrendingUp, Heart, Target } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export function PerformanceOverview() {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-connection-primary to-connection-secondary p-8 text-white shadow-glow">
      {/* Background glow effects */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-32 translate-x-32" />
      <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full blur-2xl translate-y-24 -translate-x-24" />
      
      <div className="relative z-10">
        <div className="mb-6">
          <h2 className="text-2xl font-bold mb-2">Practice Performance Overview</h2>
          <p className="text-white/90 text-lg">
            Your practice shows strong referral patterns with room for optimization in key areas.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Active Referral Rate */}
          <Card className="bg-white/15 backdrop-blur-sm border-white/20 text-white">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-5 h-5 text-success" />
                <span className="text-sm font-medium text-white/90">Active Referral Rate</span>
              </div>
              <div className="flex items-end gap-2">
                <span className="text-3xl font-bold">73%</span>
                <Badge className="bg-success/20 text-success border-success/30 text-xs">
                  +5%
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Network Health */}
          <Card className="bg-white/15 backdrop-blur-sm border-white/20 text-white">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Heart className="w-5 h-5 text-success" />
                <span className="text-sm font-medium text-white/90">Network Health</span>
              </div>
              <div className="flex items-end gap-2">
                <span className="text-3xl font-bold">Good</span>
                <Badge className="bg-success/20 text-success border-success/30 text-xs">
                  45 active
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Growth Potential */}
          <Card className="bg-white/15 backdrop-blur-sm border-white/20 text-white">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Target className="w-5 h-5 text-warning" />
                <span className="text-sm font-medium text-white/90">Growth Potential</span>
              </div>
              <div className="flex items-end gap-2">
                <span className="text-3xl font-bold">High</span>
                <Badge className="bg-warning/20 text-warning border-warning/30 text-xs">
                  32% share
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}