import { useSearchParams, useNavigate } from 'react-router-dom';
import { X, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useOfficeContext } from '@/hooks/useOfficeContext';

interface ContextBannerProps {
  entityName?: string;
}

export function ContextBanner({ entityName = 'offices' }: ContextBannerProps) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { officeIds, tierFilter, sourceContext, hasContext } = useOfficeContext();

  if (!hasContext) return null;

  const clearContext = () => {
    const newParams = new URLSearchParams();
    // Keep any non-context params
    searchParams.forEach((value, key) => {
      if (!['ids', 'tier', 'source', 'action'].includes(key)) {
        newParams.set(key, value);
      }
    });
    setSearchParams(newParams);
  };

  const goBack = () => {
    if (sourceContext) {
      navigate(sourceContext);
    } else {
      navigate(-1);
    }
  };

  const contextText = tierFilter
    ? `Showing ${officeIds.length} ${tierFilter} Partner ${entityName}`
    : `Showing ${officeIds.length} selected ${entityName}`;

  return (
    <div className="bg-primary/10 border border-primary/20 rounded-lg px-4 py-3 mb-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={goBack}
          className="h-8 px-2"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back
        </Button>
        <div className="w-px h-6 bg-primary/30" />
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{contextText}</span>
          {sourceContext && (
            <span className="text-xs text-muted-foreground">
              (from {sourceContext.replace('/', '')})
            </span>
          )}
        </div>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={clearContext}
        className="h-8 px-2 text-muted-foreground hover:text-foreground"
      >
        <X className="h-4 w-4 mr-1" />
        Clear filter
      </Button>
    </div>
  );
}
