import { Mail, MessageSquare, ExternalLink, Clock, Send } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export function ContactSupport() {
  return (
    <Card className="border-2 bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-lg">
          <MessageSquare className="h-5 w-5 text-primary" />
          Need Help?
        </CardTitle>
        <CardDescription>
          Our team is here to help you succeed
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Email Support */}
        <div className="p-4 bg-background rounded-xl border">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Mail className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <h4 className="font-medium mb-1">Email Support</h4>
              <p className="text-sm text-muted-foreground mb-3">
                Get help with technical issues or questions
              </p>
              <Button 
                size="sm" 
                variant="outline"
                className="gap-2"
                onClick={() => window.location.href = 'mailto:support@nexora.app?subject=Help Request'}
              >
                <Send className="h-3.5 w-3.5" />
                Contact Support
              </Button>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-3 pt-3 border-t">
            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">
              Typical response time: <strong className="text-foreground">within 24 hours</strong>
            </span>
          </div>
        </div>
        
        {/* Feature Request */}
        <div className="p-4 bg-background rounded-xl border">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-amber-500/10 rounded-lg">
              <MessageSquare className="h-5 w-5 text-amber-500" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h4 className="font-medium">Feature Requests</h4>
                <Badge variant="outline" className="text-[10px]">We listen!</Badge>
              </div>
              <p className="text-sm text-muted-foreground mb-3">
                Have an idea to make Nexora better?
              </p>
              <Button 
                size="sm" 
                variant="outline"
                className="gap-2"
                onClick={() => window.location.href = 'mailto:feedback@nexora.app?subject=Feature Request'}
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Submit Feedback
              </Button>
            </div>
          </div>
        </div>
        
        {/* Quick Info */}
        <div className="flex items-center justify-center gap-4 pt-2 text-xs text-muted-foreground">
          <span>📧 support@nexora.app</span>
        </div>
      </CardContent>
    </Card>
  );
}
