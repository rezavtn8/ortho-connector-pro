import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CreditCard, ArrowRight } from 'lucide-react';

export function SubscriptionRequired() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
            <CreditCard className="h-6 w-6 text-primary" />
          </div>
          <CardTitle>Subscription Required</CardTitle>
          <CardDescription>
            You need an active subscription to access this feature
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground text-center">
            Choose a plan that fits your practice size and start tracking your referral network today.
          </p>
          <div className="flex flex-col gap-2">
            <Button 
              className="w-full" 
              onClick={() => window.location.href = '/'}
            >
              View Plans
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <Button 
              variant="outline" 
              className="w-full" 
              onClick={() => navigate('/settings')}
            >
              Go to Settings
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}