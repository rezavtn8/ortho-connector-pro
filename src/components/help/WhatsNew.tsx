import { Sparkles, TrendingUp, Wrench, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { changelog } from './helpData';
import { cn } from '@/lib/utils';

export function WhatsNew() {
  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'feature': return Sparkles;
      case 'improvement': return TrendingUp;
      case 'fix': return Wrench;
      default: return Sparkles;
    }
  };
  
  const getTypeColor = (type: string) => {
    switch (type) {
      case 'feature': return 'text-emerald-500 bg-emerald-500/10';
      case 'improvement': return 'text-blue-500 bg-blue-500/10';
      case 'fix': return 'text-amber-500 bg-amber-500/10';
      default: return 'text-primary bg-primary/10';
    }
  };
  
  return (
    <Card className="border-2">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="h-5 w-5 text-primary" />
            What's New
          </CardTitle>
          <Badge variant="secondary" className="text-xs">
            v{changelog[0]?.version}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[280px] pr-4">
          <div className="space-y-4">
            {changelog.map((entry, index) => {
              const Icon = getTypeIcon(entry.type);
              const colorClass = getTypeColor(entry.type);
              
              return (
                <div 
                  key={entry.version}
                  className={cn(
                    "relative pl-8 pb-4",
                    index !== changelog.length - 1 && "border-l-2 border-border ml-3"
                  )}
                >
                  {/* Timeline dot */}
                  <div className={cn(
                    "absolute -left-0.5 top-0 w-7 h-7 rounded-full flex items-center justify-center",
                    colorClass,
                    index === 0 && "ring-4 ring-background"
                  )}>
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  
                  <div className="ml-4">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-foreground">
                        {entry.title}
                      </span>
                      {entry.isNew && (
                        <Badge className="bg-primary text-primary-foreground text-[10px] px-1.5 py-0">
                          NEW
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mb-1.5">
                      {entry.description}
                    </p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>v{entry.version}</span>
                      <span>•</span>
                      <span>{new Date(entry.date).toLocaleDateString('en-US', { 
                        month: 'short', 
                        day: 'numeric',
                        year: 'numeric'
                      })}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
        
        <div className="pt-4 border-t mt-4">
          <Button variant="ghost" size="sm" className="w-full gap-2 text-muted-foreground hover:text-foreground">
            View full changelog
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
