import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Lightbulb } from 'lucide-react';
import { quickTips } from './helpData';
import { cn } from '@/lib/utils';

export function QuickTipsGrid() {
  return (
    <Card className="border-2">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Lightbulb className="h-5 w-5 text-amber-500" />
          Power User Tips
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {quickTips.map((tip, index) => {
            const Icon = tip.icon;
            return (
              <div
                key={index}
                className={cn(
                  "group p-4 rounded-xl border bg-background/50 transition-all duration-200",
                  "hover:bg-primary/5 hover:border-primary/30"
                )}
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-muted rounded-lg group-hover:bg-primary/10 transition-colors">
                    <Icon className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium text-sm">{tip.title}</h4>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        {tip.category}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {tip.description}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
