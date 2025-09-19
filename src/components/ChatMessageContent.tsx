import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp, Search, Lightbulb, TrendingUp, Target, AlertTriangle, Users } from 'lucide-react';

interface ChatMessageContentProps {
  content: string;
  isAssistant: boolean;
}

export function ChatMessageContent({ content, isAssistant }: ChatMessageContentProps) {
  const [expandedSections, setExpandedSections] = useState<Record<number, boolean>>({});

  const toggleSection = (index: number) => {
    setExpandedSections(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  if (!isAssistant) {
    return <p className="leading-relaxed">{content}</p>;
  }

  const formatAssistantContent = (text: string) => {
    // Remove markdown artifacts and split into sections
    let formatted = formatContent(text);

    // Check for structured sections (Data, Insight, Action, Executive Summary)
    const hasStructuredSections = /^(Executive Summary|Data Analysis?|Key Insights?|Recommended Actions?|Analysis|Recommendation|Opportunity|Data|Insight|Action|Summary|Conclusion):/mi.test(formatted);

    if (!hasStructuredSections) {
      // Single section, format normally
      return formatSectionContent(formatted);
    }

    // Split content into sections based on common patterns
    const sections = formatted.split(/(?=\n(?:Executive Summary|Data Analysis?|Key Insights?|Recommended Actions?|Analysis|Recommendation|Opportunity|Data|Insight|Action|Summary|Conclusion):\s*)/i);
    
    return (
      <div className="space-y-6">
        {sections.map((section, index) => {
          if (!section.trim()) return null;
          
          const lines = section.trim().split('\n');
          const hasHeader = /^(Executive Summary|Data Analysis?|Key Insights?|Recommended Actions?|Analysis|Recommendation|Opportunity|Data|Insight|Action|Summary|Conclusion):/i.test(lines[0]);
          
          if (!hasHeader && index === 0) {
            // First section without header, show normally with executive summary styling
            return (
              <div key={index}>
                {formatSectionContent(section.trim())}
              </div>
            );
          }

          const header = hasHeader ? lines[0] : `Section ${index + 1}`;
          const sectionContent = hasHeader ? lines.slice(1).join('\n') : section;
          const isExpanded = expandedSections[index] !== false; // Default to expanded
          const isLongContent = sectionContent.length > 300;

          return (
            <div key={index} className="border-l-2 border-cyan-200 dark:border-cyan-800 pl-6">
              <div className="flex items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                  {getSectionIcon(header)}
                  <h4 className="font-bold text-foreground text-base">
                    {header.replace(/^(Executive Summary|Data Analysis?|Key Insights?|Recommended Actions?|Analysis|Recommendation|Opportunity|Data|Insight|Action|Summary|Conclusion):\s*/i, '$1')}
                  </h4>
                </div>
                {isLongContent && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleSection(index)}
                    className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                  >
                    {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  </Button>
                )}
              </div>
              
              <div className="h-px bg-border/50 mb-4"></div>
              
              <div className={`transition-all duration-300 overflow-hidden ${
                isLongContent && !isExpanded ? 'max-h-24' : 'max-h-none'
              }`}>
                {formatSectionContent(sectionContent)}
                {isLongContent && !isExpanded && (
                  <div className="mt-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleSection(index)}
                      className="h-auto p-0 text-xs text-cyan-600 dark:text-cyan-400 hover:underline font-medium"
                    >
                      Show more...
                    </Button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const getSectionIcon = (header: string) => {
    const headerLower = header.toLowerCase();
    if (headerLower.includes('analysis') || headerLower.includes('data')) {
      return <Search className="h-3 w-3 text-cyan-600 dark:text-cyan-400" />;
    }
    if (headerLower.includes('recommendation') || headerLower.includes('action')) {
      return <Lightbulb className="h-3 w-3 text-amber-600 dark:text-amber-400" />;
    }
    if (headerLower.includes('opportunity') || headerLower.includes('insight')) {
      return <Target className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />;
    }
    if (headerLower.includes('trend')) {
      return <TrendingUp className="h-3 w-3 text-blue-600 dark:text-blue-400" />;
    }
    return <Users className="h-3 w-3 text-slate-600 dark:text-slate-400" />;
  };

  const formatContent = (content: string) => {
    return content
      .replace(/###\s*/g, '') // Remove heading symbols
      .replace(/--+/g, '') // Remove dashes
      .replace(/^\s*[\-\*\+]\s*/gm, '• '); // Convert list items to bullets
  };

  const formatSectionContent = (content: string) => {
    const lines = content.trim().split('\n').filter(line => line.trim());
    
    return (
      <div className="space-y-3">
        {lines.map((line, lineIndex) => {
          const trimmedLine = line.trim();
          
          // Handle Executive Summary with bold formatting
          if (trimmedLine.match(/^\*\*(.+?)\*\*/)) {
            return (
              <div key={lineIndex} className="bg-cyan-50 dark:bg-cyan-950/30 p-4 rounded-lg border-l-4 border-cyan-500">
                <div className="font-bold text-foreground text-base leading-relaxed">
                  {formatInlineText(trimmedLine)}
                </div>
              </div>
            );
          }
          
          if (trimmedLine.startsWith('• ')) {
            return (
              <div key={lineIndex} className="flex items-start gap-2 ml-4">
                <span className="text-cyan-600 dark:text-cyan-400 font-bold text-xs mt-1.5">•</span>
                <span className="text-sm text-muted-foreground leading-relaxed flex-1">
                  {formatInlineText(trimmedLine.substring(2))}
                </span>
              </div>
            );
          }
          
          return (
            <p key={lineIndex} className="text-sm text-muted-foreground leading-relaxed">
              {formatInlineText(trimmedLine)}
            </p>
          );
        })}
      </div>
    );
  };

  const formatInlineText = (text: string) => {
    // Convert **bold** to actual bold tags
    return text.split(/(\*\*[^*]+\*\*)/).map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong key={index} className="font-semibold text-foreground">
            {part.slice(2, -2)}
          </strong>
        );
      }
      return part;
    });
  };

  const formatSingleSection = (content: string) => {
    const lines = content.trim().split('\n').filter(line => line.trim());
    
    return (
      <div className="space-y-3">
        {lines.map((line, lineIndex) => {
          const trimmedLine = line.trim();
          
          if (trimmedLine.startsWith('• ')) {
            return (
              <div key={lineIndex} className="flex items-start gap-2">
                <span className="text-cyan-600 dark:text-cyan-400 font-bold text-xs mt-1.5">•</span>
                <span className="text-sm leading-relaxed flex-1">
                  {formatInlineText(trimmedLine.substring(2))}
                </span>
              </div>
            );
          }
          
          return (
            <p key={lineIndex} className="text-sm leading-relaxed">
              {formatInlineText(trimmedLine)}
            </p>
          );
        })}
      </div>
    );
  };

  return formatAssistantContent(content);
}