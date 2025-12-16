import { ChevronRight, FileText } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { HelpCategory } from './helpData';

interface HelpCategoryCardProps {
  category: HelpCategory;
  onClick: () => void;
}

export function HelpCategoryCard({ category, onClick }: HelpCategoryCardProps) {
  const Icon = category.icon;
  
  return (
    <Card 
      className={cn(
        "group cursor-pointer transition-all duration-300 hover:shadow-lg border-2 hover:border-primary/30",
        "bg-gradient-to-br from-background to-muted/30"
      )}
      onClick={onClick}
    >
      <CardContent className="p-6">
        <div className="flex items-start gap-4">
          <div className={cn(
            "p-3 rounded-xl bg-gradient-to-br",
            category.color,
            "text-white shadow-lg shadow-primary/20 transition-transform duration-300 group-hover:scale-110"
          )}>
            <Icon className="h-6 w-6" />
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                {category.title}
              </h3>
              <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
            </div>
            <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
              {category.description}
            </p>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs gap-1">
                <FileText className="h-3 w-3" />
                {category.articles.length} articles
              </Badge>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
