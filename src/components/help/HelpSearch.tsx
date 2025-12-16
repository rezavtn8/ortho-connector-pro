import { useState, useMemo, useCallback } from 'react';
import { Search, FileText, HelpCircle, Lightbulb, ArrowRight, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { getSearchableContent } from './helpData';

interface HelpSearchProps {
  onSelectResult?: (type: string, id: string, categoryId?: string) => void;
}

export function HelpSearch({ onSelectResult }: HelpSearchProps) {
  const [query, setQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  
  const searchableContent = useMemo(() => getSearchableContent(), []);
  
  const results = useMemo(() => {
    if (!query.trim()) return [];
    
    const searchTerms = query.toLowerCase().split(' ').filter(Boolean);
    
    return searchableContent
      .map(item => {
        const titleLower = item.title.toLowerCase();
        const descLower = item.description.toLowerCase();
        
        let score = 0;
        searchTerms.forEach(term => {
          if (titleLower.includes(term)) score += 10;
          if (descLower.includes(term)) score += 5;
          if (titleLower.startsWith(term)) score += 5;
        });
        
        return { ...item, score };
      })
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8);
  }, [query, searchableContent]);
  
  const handleSelect = useCallback((item: typeof results[0]) => {
    onSelectResult?.(item.type, item.id, item.categoryId);
    setQuery('');
  }, [onSelectResult]);
  
  const getIcon = (type: string) => {
    switch (type) {
      case 'article': return FileText;
      case 'faq': return HelpCircle;
      case 'tip': return Lightbulb;
      default: return FileText;
    }
  };
  
  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'article': return { label: 'Article', variant: 'default' as const };
      case 'faq': return { label: 'FAQ', variant: 'secondary' as const };
      case 'tip': return { label: 'Tip', variant: 'outline' as const };
      default: return { label: type, variant: 'outline' as const };
    }
  };
  
  const showResults = isFocused && query.trim().length > 0;
  
  return (
    <div className="relative w-full max-w-2xl mx-auto">
      <div className={cn(
        "relative transition-all duration-200",
        isFocused && "scale-[1.02]"
      )}>
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Search help articles, FAQs, and tips..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setTimeout(() => setIsFocused(false), 200)}
          className={cn(
            "pl-12 pr-12 h-14 text-base bg-background border-2 transition-all duration-200",
            isFocused 
              ? "border-primary shadow-lg shadow-primary/10" 
              : "border-border hover:border-primary/50"
          )}
        />
        {query && (
          <button
            onClick={() => setQuery('')}
            className="absolute right-4 top-1/2 -translate-y-1/2 p-1 hover:bg-muted rounded-full transition-colors"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        )}
      </div>
      
      {/* Results dropdown */}
      {showResults && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-card border-2 border-border rounded-xl shadow-xl z-50 overflow-hidden">
          {results.length > 0 ? (
            <ScrollArea className="max-h-[400px]">
              <div className="p-2">
                {results.map((item, index) => {
                  const Icon = getIcon(item.type);
                  const badge = getTypeBadge(item.type);
                  
                  return (
                    <button
                      key={`${item.type}-${item.id}`}
                      onClick={() => handleSelect(item)}
                      className={cn(
                        "w-full flex items-start gap-3 p-3 rounded-lg text-left transition-colors",
                        "hover:bg-primary/5 focus:bg-primary/5 focus:outline-none"
                      )}
                    >
                      <div className="p-2 bg-muted rounded-lg shrink-0">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-foreground truncate">
                            {item.title}
                          </span>
                          <Badge variant={badge.variant} className="text-xs shrink-0">
                            {badge.label}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-1">
                          {item.description}
                        </p>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
                    </button>
                  );
                })}
              </div>
            </ScrollArea>
          ) : (
            <div className="p-8 text-center">
              <HelpCircle className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground mb-2">No results found for "{query}"</p>
              <p className="text-sm text-muted-foreground">
                Try different keywords or{' '}
                <button className="text-primary hover:underline">
                  contact support
                </button>
              </p>
            </div>
          )}
        </div>
      )}
      
      {/* Keyboard hint */}
      {!isFocused && !query && (
        <div className="absolute right-4 top-1/2 -translate-y-1/2 hidden md:flex items-center gap-1 text-muted-foreground">
          <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono">⌘</kbd>
          <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono">K</kbd>
        </div>
      )}
    </div>
  );
}
