import React from 'react';
import { ChevronDown, ChevronUp, TrendingUp, TrendingDown } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

interface InsightCardProps {
  title: string;
  summary: string;
  details: string;
  icon: React.ElementType;
  colorTheme: 'green' | 'blue' | 'red' | 'yellow' | 'purple' | 'cyan';
  isExpanded: boolean;
  onToggle: () => void;
  metrics?: Array<{
    label: string;
    value: string;
    trend?: 'up' | 'down';
    trendValue?: string;
  }>;
  progressBars?: Array<{
    label: string;
    value: number;
    color?: string;
  }>;
  actionItems?: string[];
  offices?: string[];
}

const colorThemes = {
  green: {
    card: 'border-success/20 bg-gradient-to-br from-success/5 to-success/10 hover:shadow-success/20',
    icon: 'text-success bg-success/10',
    badge: 'bg-success/20 text-success border-success/30'
  },
  blue: {
    card: 'border-info/20 bg-gradient-to-br from-info/5 to-info/10 hover:shadow-info/20',
    icon: 'text-info bg-info/10',
    badge: 'bg-info/20 text-info border-info/30'
  },
  red: {
    card: 'border-destructive/20 bg-gradient-to-br from-destructive/5 to-destructive/10 hover:shadow-destructive/20',
    icon: 'text-destructive bg-destructive/10',
    badge: 'bg-destructive/20 text-destructive border-destructive/30'
  },
  yellow: {
    card: 'border-warning/20 bg-gradient-to-br from-warning/5 to-warning/10 hover:shadow-warning/20',
    icon: 'text-warning bg-warning/10',
    badge: 'bg-warning/20 text-warning border-warning/30'
  },
  purple: {
    card: 'border-violet-500/20 bg-gradient-to-br from-violet-500/5 to-violet-500/10 hover:shadow-violet-500/20',
    icon: 'text-violet-600 bg-violet-500/10',
    badge: 'bg-violet-500/20 text-violet-600 border-violet-500/30'
  },
  cyan: {
    card: 'border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10 hover:shadow-primary/20',
    icon: 'text-primary bg-primary/10',
    badge: 'bg-primary/20 text-primary border-primary/30'
  }
};

export function InsightCard({
  title,
  summary,
  details,
  icon: Icon,
  colorTheme,
  isExpanded,
  onToggle,
  metrics,
  progressBars,
  actionItems,
  offices
}: InsightCardProps) {
  const theme = colorThemes[colorTheme];

  return (
    <Card className={`${theme.card} transition-all duration-300 hover:shadow-lg cursor-pointer group`}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${theme.icon}`}>
              <Icon className="w-5 h-5" />
            </div>
            <span className="text-base font-semibold">{title}</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggle}
            className="hover:bg-background/50"
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </Button>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="pt-0">
        <p className="text-sm text-muted-foreground mb-3">{summary}</p>
        
        {/* Quick Metrics */}
        {metrics && !isExpanded && (
          <div className="flex flex-wrap gap-2 mb-3">
            {metrics.slice(0, 2).map((metric, index) => (
              <Badge key={index} variant="outline" className={theme.badge}>
                <span className="text-xs">
                  {metric.label}: {metric.value}
                  {metric.trend && metric.trendValue && (
                    <span className="ml-1">
                      {metric.trend === 'up' ? (
                        <TrendingUp className="w-3 h-3 inline ml-1" />
                      ) : (
                        <TrendingDown className="w-3 h-3 inline ml-1" />
                      )}
                      {metric.trendValue}
                    </span>
                  )}
                </span>
              </Badge>
            ))}
          </div>
        )}

        {isExpanded && (
          <div className="space-y-4 mt-4">
            <div className="text-sm text-foreground">{details}</div>
            
            {/* Detailed Metrics */}
            {metrics && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground">Key Metrics</p>
                <div className="grid grid-cols-1 gap-2">
                  {metrics.map((metric, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-background/50 rounded-lg">
                      <span className="text-xs font-medium">{metric.label}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold">{metric.value}</span>
                        {metric.trend && metric.trendValue && (
                          <div className="flex items-center gap-1">
                            {metric.trend === 'up' ? (
                              <TrendingUp className="w-3 h-3 text-success" />
                            ) : (
                              <TrendingDown className="w-3 h-3 text-destructive" />
                            )}
                            <span className={`text-xs ${metric.trend === 'up' ? 'text-success' : 'text-destructive'}`}>
                              {metric.trendValue}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Progress Bars */}
            {progressBars && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground">Distribution</p>
                {progressBars.map((bar, index) => (
                  <div key={index} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span>{bar.label}</span>
                      <span className="font-medium">{bar.value}%</span>
                    </div>
                    <Progress value={bar.value} className="h-2" />
                  </div>
                ))}
              </div>
            )}

            {/* Action Items */}
            {actionItems && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground">Action Items</p>
                <div className="space-y-1">
                  {actionItems.map((action, index) => (
                    <div key={index} className="text-xs flex items-center gap-2">
                      <div className={`w-1.5 h-1.5 rounded-full ${theme.icon.includes('success') ? 'bg-success' : theme.icon.includes('info') ? 'bg-info' : theme.icon.includes('destructive') ? 'bg-destructive' : theme.icon.includes('warning') ? 'bg-warning' : 'bg-primary'}`} />
                      {action}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Offices List */}
            {offices && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground">Offices</p>
                <div className="space-y-1">
                  {offices.map((office, index) => (
                    <div key={index} className="text-xs p-2 bg-background/50 rounded border-l-2 border-current">
                      {office}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}