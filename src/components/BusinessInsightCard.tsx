import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { 
  AlertCircle, 
  CheckCircle2, 
  ChevronRight, 
  RefreshCw 
} from 'lucide-react';

interface BusinessInsight {
  title: string;
  priority: 'high' | 'medium' | 'low';
  summary: string;
  recommendation: string;
  detailedAnalysis: string;
  keyMetrics: string[];
  actionItems: string[];
  icon: React.ComponentType<any>;
}

interface BusinessInsightCardProps {
  insight: BusinessInsight;
  index: number;
  onRetry?: () => void;
}

class InsightErrorBoundary extends React.Component<
  { children: React.ReactNode; onRetry?: () => void },
  { hasError: boolean; error?: Error }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('Insight card error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <Card className="border-destructive/20">
          <CardContent className="py-6">
            <div className="text-center space-y-3">
              <AlertCircle className="h-8 w-8 text-destructive mx-auto" />
              <div>
                <h3 className="font-semibold text-destructive">Error Loading Insight</h3>
                <p className="text-sm text-muted-foreground">
                  Failed to render this insight card
                </p>
              </div>
              {this.props.onRetry && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    this.setState({ hasError: false });
                    this.props.onRetry?.();
                  }}
                >
                  <RefreshCw className="h-3 w-3 mr-1" />
                  Retry
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      );
    }

    return this.props.children;
  }
}

export function BusinessInsightCard({ insight, index, onRetry }: BusinessInsightCardProps) {
  const getPriorityVariant = (priority: string) => {
    switch (priority) {
      case 'high': return 'destructive';
      case 'medium': return 'default';
      case 'low': return 'secondary';
      default: return 'default';
    }
  };

  return (
    <InsightErrorBoundary onRetry={onRetry}>
      <Card className="relative group hover:shadow-md transition-shadow">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <insight.icon className="h-5 w-5 text-primary" />
              <Badge variant={getPriorityVariant(insight.priority) as any}>
                {insight.priority}
              </Badge>
            </div>
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <insight.icon className="h-5 w-5 text-primary" />
                    {insight.title}
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-6">
                  <div>
                    <h4 className="font-semibold mb-2">Detailed Analysis</h4>
                    <p className="text-muted-foreground leading-relaxed">
                      {insight.detailedAnalysis}
                    </p>
                  </div>
                  
                  <div>
                    <h4 className="font-semibold mb-2">Key Metrics</h4>
                    <div className="grid grid-cols-2 gap-2">
                      {insight.keyMetrics.map((metric, idx) => (
                        <div key={idx} className="flex items-center gap-2 p-2 bg-muted/50 rounded-md">
                          <CheckCircle2 className="h-3 w-3 text-green-500" />
                          <span className="text-sm">{metric}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="font-semibold mb-2">Action Items</h4>
                    <div className="space-y-2">
                      {insight.actionItems.map((item, idx) => (
                        <div key={idx} className="flex items-start gap-2 p-2 bg-muted/50 rounded-md">
                          <div className="h-2 w-2 bg-primary rounded-full mt-2" />
                          <span className="text-sm">{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <h3 className="font-semibold text-base mb-2">{insight.title}</h3>
            <p className="text-muted-foreground text-sm leading-relaxed">
              {insight.summary}
            </p>
          </div>
          
          <div className="p-3 bg-muted/50 rounded-md">
            <h4 className="font-medium text-sm mb-1">Recommendation</h4>
            <p className="text-xs text-muted-foreground">
              {insight.recommendation}
            </p>
          </div>
        </CardContent>
      </Card>
    </InsightErrorBoundary>
  );
}