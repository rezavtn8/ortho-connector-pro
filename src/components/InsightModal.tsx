import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { X } from 'lucide-react';

interface InsightModalProps {
  isOpen: boolean;
  onClose: () => void;
  insight: {
    title: string;
    content: string;
    priority: 'high' | 'medium' | 'low';
    icon: any;
  } | null;
}

export function InsightModal({ isOpen, onClose, insight }: InsightModalProps) {
  if (!insight) return null;

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'high': 
        return { 
          className: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/50 dark:text-red-300 dark:border-red-800',
          label: 'High Risk'
        };
      case 'medium': 
        return { 
          className: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800',
          label: 'Medium'
        };
      case 'low': 
        return { 
          className: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800',
          label: 'Low Risk'
        };
      default: 
        return { 
          className: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800',
          label: 'Info'
        };
    }
  };

  const formatContent = (content: string) => {
    return content
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // Convert ** to bold
      .replace(/\*(.*?)\*/g, '<em>$1</em>') // Convert * to italic
      .replace(/###\s*/g, '') // Remove heading symbols
      .replace(/--+/g, '') // Remove dashes
      .replace(/^\s*[\-\*\+]\s*/gm, '• '); // Convert list items to bullets
  };

  const IconComponent = insight.icon;
  const badgeInfo = getPriorityBadge(insight.priority);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="p-2 bg-cyan-50 dark:bg-cyan-950/50 rounded-lg flex-shrink-0">
                <IconComponent className="h-6 w-6 text-cyan-600 dark:text-cyan-400" />
              </div>
              <div className="min-w-0 flex-1">
                <DialogTitle className="text-xl font-bold text-foreground leading-tight">
                  {insight.title}
                </DialogTitle>
              </div>
            </div>
            <Badge 
              className={`${badgeInfo.className} text-xs font-medium px-3 py-1 rounded-full border flex-shrink-0`}
            >
              {badgeInfo.label}
            </Badge>
          </div>
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto">
          <div className="space-y-4">
            <div className="h-px bg-border"></div>
            <div 
              className="text-muted-foreground leading-relaxed prose prose-sm max-w-none dark:prose-invert"
              dangerouslySetInnerHTML={{ __html: formatContent(insight.content) }}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}