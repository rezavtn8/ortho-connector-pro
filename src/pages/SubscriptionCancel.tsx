import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { XCircle } from 'lucide-react';

export default function SubscriptionCancel() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
            <XCircle className="h-6 w-6 text-orange-600" />
          </div>
          <CardTitle>Checkout Cancelled</CardTitle>
          <CardDescription>
            You cancelled the subscription process
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground text-center">
            No charges were made. You can try again anytime.
          </p>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => navigate('/')}>
              Go Home
            </Button>
            <Button className="flex-1" onClick={() => navigate('/settings')}>
              View Plans
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}