import { useMemo } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface OfficeHealthScoreProps {
  l12: number;
  r3: number;
  mslr: number;
  totalReferrals: number;
  tier?: string;
  showTrend?: boolean;
}

export function useOfficeHealthScore(props: OfficeHealthScoreProps) {
  const { l12, r3, mslr, totalReferrals, tier } = props;

  return useMemo(() => {
    let score = 0;
    let trend: 'up' | 'down' | 'stable' = 'stable';

    // Referral frequency (40% weight)
    // Based on L12 - last 12 months
    if (l12 >= 12) score += 40;
    else if (l12 >= 6) score += 30;
    else if (l12 >= 3) score += 20;
    else if (l12 >= 1) score += 10;

    // Engagement recency (30% weight)
    // Based on MSLR - months since last referral
    if (mslr === 0) score += 30;
    else if (mslr <= 1) score += 25;
    else if (mslr <= 3) score += 15;
    else if (mslr <= 6) score += 5;

    // Recent momentum (20% weight)
    // R3 vs expected from L12
    const expectedR3 = l12 / 4;
    if (r3 > expectedR3 * 1.5) {
      score += 20;
      trend = 'up';
    } else if (r3 >= expectedR3) {
      score += 15;
    } else if (r3 >= expectedR3 * 0.5) {
      score += 10;
      trend = 'down';
    } else if (r3 > 0) {
      score += 5;
      trend = 'down';
    } else if (l12 > 0) {
      trend = 'down';
    }

    // Tier bonus (10% weight)
    if (tier === 'VIP') score += 10;
    else if (tier === 'Warm') score += 7;
    else if (tier === 'Dormant') score += 3;

    // Clamp to 0-100
    score = Math.min(100, Math.max(0, score));

    // Determine health level
    let level: 'excellent' | 'good' | 'fair' | 'poor' = 'poor';
    if (score >= 80) level = 'excellent';
    else if (score >= 60) level = 'good';
    else if (score >= 40) level = 'fair';

    return { score, trend, level };
  }, [l12, r3, mslr, tier]);
}

export function OfficeHealthScore({ l12, r3, mslr, totalReferrals, tier, showTrend = true }: OfficeHealthScoreProps) {
  const { score, trend, level } = useOfficeHealthScore({ l12, r3, mslr, totalReferrals, tier });

  const levelColors = {
    excellent: 'bg-green-100 text-green-700 border-green-200',
    good: 'bg-blue-100 text-blue-700 border-blue-200',
    fair: 'bg-amber-100 text-amber-700 border-amber-200',
    poor: 'bg-red-100 text-red-700 border-red-200',
  };

  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
  const trendColor = trend === 'up' ? 'text-green-600' : trend === 'down' ? 'text-red-600' : 'text-muted-foreground';

  return (
    <Tooltip>
      <TooltipTrigger>
        <div className="flex items-center gap-1">
          <Badge variant="outline" className={levelColors[level]}>
            {score}
          </Badge>
          {showTrend && (
            <TrendIcon className={`h-4 w-4 ${trendColor}`} />
          )}
        </div>
      </TooltipTrigger>
      <TooltipContent>
        <div className="text-sm">
          <p className="font-medium">Health Score: {score}/100</p>
          <p className="text-muted-foreground">
            {level === 'excellent' && 'Excellent partnership health'}
            {level === 'good' && 'Good partnership health'}
            {level === 'fair' && 'Fair - consider reaching out'}
            {level === 'poor' && 'Needs attention'}
          </p>
          {showTrend && (
            <p className="text-xs mt-1">
              Trend: {trend === 'up' ? '↑ Improving' : trend === 'down' ? '↓ Declining' : '→ Stable'}
            </p>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
