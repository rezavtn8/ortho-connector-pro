import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAIForecast, type SourceForecast, type StrategicAction, type RiskAlert } from '@/hooks/useAIForecast';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { RefreshCw, TrendingUp, TrendingDown, AlertTriangle, Target, Shield, Zap, RotateCcw, ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';

export function AIForecastTab() {
  const { forecast, loading, error, refreshForecast } = useAIForecast();

  if (loading) return <ForecastSkeleton />;

  if (error) {
    return (
      <div className="text-center py-12 space-y-4">
        <AlertTriangle className="w-10 h-10 text-destructive mx-auto" />
        <p className="text-muted-foreground">{error}</p>
        <Button onClick={refreshForecast} variant="outline" size="sm">
          <RefreshCw className="w-4 h-4 mr-2" /> Try Again
        </Button>
      </div>
    );
  }

  if (!forecast) return null;

  const { overall_forecast, source_forecasts, strategic_actions, risk_alerts, historical_totals } = forecast;

  // Build chart data: historical + projected
  // Build chart data: historical + projected
  const mergedChart: { month: string; actual?: number; forecast?: number }[] = 
    historical_totals.map(h => ({ month: h.month.slice(5), actual: h.total }));
  
  const lastMonth = historical_totals[historical_totals.length - 1]?.month;
  if (lastMonth) {
    const [y, m] = lastMonth.split('-').map(Number);
    const nextMonths = [1, 2, 3].map(i => {
      const d = new Date(y, m - 1 + i, 1);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    });
    // Bridge point
    mergedChart.push({ month: mergedChart[mergedChart.length - 1]?.month, forecast: historical_totals[historical_totals.length - 1]?.total });
    mergedChart.push({ month: nextMonths[0].slice(5), forecast: overall_forecast.next_month_predicted });
    mergedChart.push({ month: nextMonths[1].slice(5), forecast: overall_forecast.month2_predicted });
    mergedChart.push({ month: nextMonths[2].slice(5), forecast: overall_forecast.month3_predicted });
  }

  const phaseColors: Record<string, string> = {
    expansion: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300',
    plateau: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
    decline: 'bg-rose-100 text-rose-700 dark:bg-rose-900 dark:text-rose-300',
  };

  const confidenceColors: Record<string, string> = {
    high: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300',
    medium: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
    low: 'bg-rose-100 text-rose-700 dark:bg-rose-900 dark:text-rose-300',
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Referral Forecast</h3>
          <p className="text-sm text-muted-foreground">AI-powered predictions based on your historical data</p>
        </div>
        <Button onClick={refreshForecast} variant="outline" size="sm">
          <RefreshCw className="w-4 h-4 mr-2" /> Refresh
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-border/50">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Next Month</p>
            <p className="text-2xl font-bold text-foreground">{overall_forecast.next_month_predicted}</p>
            <p className="text-xs text-muted-foreground">predicted patients</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Growth Rate</p>
            <div className="flex items-center gap-1">
              {overall_forecast.growth_rate_percent >= 0 ? (
                <ArrowUpRight className="w-4 h-4 text-emerald-500" />
              ) : (
                <ArrowDownRight className="w-4 h-4 text-rose-500" />
              )}
              <p className="text-2xl font-bold text-foreground">{overall_forecast.growth_rate_percent > 0 ? '+' : ''}{overall_forecast.growth_rate_percent}%</p>
            </div>
            <p className="text-xs text-muted-foreground">monthly</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Growth Phase</p>
            <Badge className={`mt-1 ${phaseColors[overall_forecast.growth_phase] || ''}`}>
              {overall_forecast.growth_phase}
            </Badge>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Confidence</p>
            <Badge className={`mt-1 ${confidenceColors[overall_forecast.confidence] || ''}`}>
              {overall_forecast.confidence}
            </Badge>
          </CardContent>
        </Card>
      </div>

      {/* Forecast Narrative */}
      <Card className="border-border/50">
        <CardContent className="p-4">
          <p className="text-sm text-foreground leading-relaxed">{overall_forecast.summary}</p>
        </CardContent>
      </Card>

      {/* Projection Chart */}
      <Card className="border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">3-Month Projection</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={mergedChart}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                <XAxis dataKey="month" className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
                <Area type="monotone" dataKey="actual" stroke="hsl(var(--primary))" fill="hsl(var(--primary) / 0.15)" strokeWidth={2} connectNulls={false} name="Actual" />
                <Area type="monotone" dataKey="forecast" stroke="hsl(var(--primary))" fill="hsl(var(--primary) / 0.08)" strokeWidth={2} strokeDasharray="6 4" connectNulls={false} name="Forecast" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Risk Alerts */}
      {risk_alerts.length > 0 && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-destructive" /> Risk Alerts
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {risk_alerts.map((alert: RiskAlert, i: number) => (
              <div key={i} className="flex items-start gap-3 p-2 rounded-lg bg-background/50">
                <AlertTriangle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-foreground">{alert.source_name}</p>
                  <p className="text-xs text-muted-foreground">{alert.message}</p>
                </div>
                <Badge variant="outline" className="ml-auto shrink-0 text-xs">
                  {alert.alert_type.replace('_', ' ')}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Source Predictions Table */}
      {source_forecasts.length > 0 && (
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Source-Level Predictions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50">
                    <th className="text-left py-2 font-medium text-muted-foreground">Source</th>
                    <th className="text-center py-2 font-medium text-muted-foreground">Predicted</th>
                    <th className="text-center py-2 font-medium text-muted-foreground">Trend</th>
                    <th className="text-center py-2 font-medium text-muted-foreground">Risk</th>
                    <th className="text-left py-2 font-medium text-muted-foreground hidden md:table-cell">Note</th>
                  </tr>
                </thead>
                <tbody>
                  {source_forecasts.map((sf: SourceForecast, i: number) => (
                    <tr key={i} className="border-b border-border/20">
                      <td className="py-2 font-medium text-foreground">{sf.source_name}</td>
                      <td className="py-2 text-center text-foreground">{sf.predicted_next_month}</td>
                      <td className="py-2 text-center">
                        <TrendIcon trend={sf.trend} />
                      </td>
                      <td className="py-2 text-center">
                        <RiskBadge level={sf.risk_level} />
                      </td>
                      <td className="py-2 text-xs text-muted-foreground hidden md:table-cell">{sf.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Strategic Actions */}
      <Card className="border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Target className="w-4 h-4 text-primary" /> Strategic Recommendations
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {strategic_actions.map((action: StrategicAction, i: number) => (
            <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 border border-border/30">
              <CategoryIcon category={action.category} />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-foreground">{action.title}</p>
                  <Badge variant={action.priority === 'high' ? 'destructive' : action.priority === 'medium' ? 'secondary' : 'outline'} className="text-xs">
                    {action.priority}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1">{action.description}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function TrendIcon({ trend }: { trend: string }) {
  switch (trend) {
    case 'growing': return <TrendingUp className="w-4 h-4 text-emerald-500 mx-auto" />;
    case 'declining': case 'at_risk': return <TrendingDown className="w-4 h-4 text-rose-500 mx-auto" />;
    default: return <Minus className="w-4 h-4 text-muted-foreground mx-auto" />;
  }
}

function RiskBadge({ level }: { level: string }) {
  const colors: Record<string, string> = {
    none: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400',
    low: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-400',
    medium: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400',
    high: 'bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-400',
  };
  return <Badge className={`text-xs ${colors[level] || ''}`}>{level}</Badge>;
}

function CategoryIcon({ category }: { category: string }) {
  const iconClass = "w-5 h-5 mt-0.5 shrink-0";
  switch (category) {
    case 'retain': return <Shield className={`${iconClass} text-blue-500`} />;
    case 'grow': return <Zap className={`${iconClass} text-emerald-500`} />;
    case 'reactivate': return <RotateCcw className={`${iconClass} text-amber-500`} />;
    case 'optimize': return <Target className={`${iconClass} text-purple-500`} />;
    default: return <Target className={`${iconClass} text-muted-foreground`} />;
  }
}

function ForecastSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div><Skeleton className="h-6 w-48 mb-2" /><Skeleton className="h-4 w-64" /></div>
        <Skeleton className="h-9 w-24" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => <Card key={i} className="border-border/50"><CardContent className="p-4"><Skeleton className="h-4 w-20 mb-2" /><Skeleton className="h-8 w-16" /></CardContent></Card>)}
      </div>
      <Card className="border-border/50"><CardContent className="p-4"><Skeleton className="h-4 w-full mb-2" /><Skeleton className="h-4 w-3/4" /></CardContent></Card>
      <Card className="border-border/50"><CardContent className="p-6"><Skeleton className="h-64 w-full" /></CardContent></Card>
    </div>
  );
}
