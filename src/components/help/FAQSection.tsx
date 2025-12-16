import { useState } from 'react';
import { HelpCircle, ThumbsUp, ThumbsDown } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { faqs } from './helpData';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

type FAQCategory = 'all' | 'General' | 'Technical' | 'Features';

export function FAQSection() {
  const [activeCategory, setActiveCategory] = useState<FAQCategory>('all');
  const [helpful, setHelpful] = useState<Record<string, boolean | null>>({});
  
  const categories: FAQCategory[] = ['all', 'General', 'Technical', 'Features'];
  
  const filteredFaqs = activeCategory === 'all' 
    ? faqs 
    : faqs.filter(faq => faq.category === activeCategory);
  
  const handleFeedback = (id: string, isHelpful: boolean) => {
    setHelpful(prev => ({ ...prev, [id]: isHelpful }));
    toast.success(isHelpful ? 'Thanks for your feedback!' : 'We\'ll work on improving this');
  };
  
  return (
    <Card className="border-2">
      <CardHeader className="pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <HelpCircle className="h-5 w-5 text-blue-500" />
            Frequently Asked Questions
          </CardTitle>
          <div className="flex gap-1.5 flex-wrap">
            {categories.map(cat => (
              <Button
                key={cat}
                size="sm"
                variant={activeCategory === cat ? "default" : "outline"}
                className="h-7 text-xs px-3"
                onClick={() => setActiveCategory(cat)}
              >
                {cat === 'all' ? 'All' : cat}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Accordion type="single" collapsible className="space-y-2">
          {filteredFaqs.map((faq, index) => {
            const id = `faq-${index}`;
            const feedbackGiven = helpful[id] !== undefined;
            
            return (
              <AccordionItem 
                key={index} 
                value={id}
                className={cn(
                  "border rounded-xl px-4 data-[state=open]:bg-muted/30 transition-colors",
                  "hover:border-primary/30"
                )}
              >
                <AccordionTrigger className="text-left hover:no-underline py-4">
                  <div className="flex items-start gap-3 pr-4">
                    <span className="font-medium text-sm">{faq.question}</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pb-4">
                  <div className="pl-0">
                    <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                      {faq.answer}
                    </p>
                    
                    {/* Feedback */}
                    <div className="flex items-center gap-3 pt-3 border-t">
                      <span className="text-xs text-muted-foreground">Was this helpful?</span>
                      {!feedbackGiven ? (
                        <div className="flex gap-1">
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            className="h-7 px-2"
                            onClick={() => handleFeedback(id, true)}
                          >
                            <ThumbsUp className="h-3.5 w-3.5" />
                          </Button>
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            className="h-7 px-2"
                            onClick={() => handleFeedback(id, false)}
                          >
                            <ThumbsDown className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ) : (
                        <Badge variant="secondary" className="text-xs">
                          Thanks for feedback!
                        </Badge>
                      )}
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      </CardContent>
    </Card>
  );
}
