import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { X } from 'lucide-react';

interface InsightDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  insight: {
    title: string;
    content: string;
    priority: 'high' | 'medium' | 'low';
    icon: any;
  } | null;
}

export function InsightDetailModal({ isOpen, onClose, insight }: InsightDetailModalProps) {
  if (!insight) return null;

  const IconComponent = insight.icon;
  
  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'high': 
        return { 
          className: 'bg-red-500/10 text-red-700 border-red-200 dark:bg-red-500/20 dark:text-red-300 dark:border-red-800',
          label: 'High Risk'
        };
      case 'medium': 
        return { 
          className: 'bg-orange-500/10 text-orange-700 border-orange-200 dark:bg-orange-500/20 dark:text-orange-300 dark:border-orange-800',
          label: 'Medium'
        };
      case 'low': 
        return { 
          className: 'bg-green-500/10 text-green-700 border-green-200 dark:bg-green-500/20 dark:text-green-300 dark:border-green-800',
          label: 'Low Risk'
        };
      default: 
        return { 
          className: 'bg-blue-500/10 text-blue-700 border-blue-200 dark:bg-blue-500/20 dark:text-blue-300 dark:border-blue-800',
          label: 'Info'
        };
    }
  };

  const formatContent = (content: string) => {
    // Remove markdown symbols and format for structured display
    const cleanContent = content
      .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold markdown
      .replace(/\*(.*?)\*/g, '$1') // Remove italic markdown
      .replace(/###\s*/g, '') // Remove heading symbols
      .replace(/--+/g, '') // Remove dashes
      .replace(/^\s*[\-\*\+]\s*/gm, '• ') // Convert list items to bullets
      .trim();

    const sections = cleanContent.split(/\n\s*\n/); // Split on double line breaks
    
    return sections.map((section, index) => {
      const lines = section.split('\n').filter(line => line.trim());
      
      if (lines.length === 0) return null;
      
      // Check if this might be a structured section
      const firstLine = lines[0];
      const isStructuredSection = firstLine.toLowerCase().includes('executive') || 
                                 firstLine.toLowerCase().includes('data') ||
                                 firstLine.toLowerCase().includes('insight') ||
                                 firstLine.toLowerCase().includes('action');
      
      if (isStructuredSection && lines.length > 1) {
        return (
          <div key={index} className="mb-6">
            <h4 className="text-lg font-semibold text-foreground mb-3 pb-2 border-b border-border">
              {firstLine.replace(/[:\-]/g, '')}
            </h4>
            <div className="space-y-2 text-muted-foreground">
              {lines.slice(1).map((line, lineIndex) => {
                if (line.startsWith('• ')) {
                  return (
                    <div key={lineIndex} className="flex items-start gap-2">
                      <span className="text-primary font-bold text-sm mt-1">•</span>
                      <span className="flex-1 leading-relaxed">{line.substring(2)}</span>
                    </div>
                  );
                }
                return line.trim() && (
                  <p key={lineIndex} className="leading-relaxed">
                    {line}
                  </p>
                );
              })}
            </div>
          </div>
        );
      }
      
      // Regular content section
      return (
        <div key={index} className="mb-6">
          <div className="space-y-2 text-muted-foreground">
            {lines.map((line, lineIndex) => {
              if (line.startsWith('• ')) {
                return (
                  <div key={lineIndex} className="flex items-start gap-2">
                    <span className="text-primary font-bold text-sm mt-1">•</span>
                    <span className="flex-1 leading-relaxed">{line.substring(2)}</span>
                  </div>
                );
              }
              return line.trim() && (
                <p key={lineIndex} className="leading-relaxed">
                  {line}
                </p>
              );
            })}
          </div>
        </div>
      );
    }).filter(Boolean);
  };

  const badgeInfo = getPriorityBadge(insight.priority);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden animate-scale-in">
        <DialogHeader className="pb-4 border-b border-border">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="p-2 bg-primary/10 rounded-lg flex-shrink-0">
                <IconComponent className="h-5 w-5 text-primary" />
              </div>
              <DialogTitle className="text-xl font-bold text-foreground leading-tight">
                {insight.title}
              </DialogTitle>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Badge className={`${badgeInfo.className} text-xs font-medium px-3 py-1 rounded-full border`}>
                {badgeInfo.label}
              </Badge>
            </div>
          </div>
        </DialogHeader>
        
        <div className="overflow-y-auto flex-1 pr-2">
          <div className="py-4">
            {formatContent(insight.content)}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}