import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useSubscription } from '@/hooks/useSubscription';
import { format } from 'date-fns';
import { Check, X } from 'lucide-react';

export function SubscriptionManagement() {
  const { subscription, plans, isLoading, createCheckoutSession, cancelSubscription } = useSubscription();

  if (isLoading) {
    return <div>Loading subscription details...</div>;
  }

  const currentPlan = subscription?.subscription_plans;

  return (
    <div className="space-y-6">
      {/* Current Subscription */}
      {subscription && currentPlan && (
        <Card>
          <CardHeader>
            <CardTitle>Current Subscription</CardTitle>
            <CardDescription>Manage your subscription plan</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">{currentPlan.name}</h3>
                <p className="text-sm text-muted-foreground">
                  ${currentPlan.price_monthly}/month
                </p>
              </div>
              <Badge variant={subscription.status === 'active' ? 'default' : 'secondary'}>
                {subscription.status}
              </Badge>
            </div>

            {subscription.current_period_end && (
              <p className="text-sm text-muted-foreground">
                {subscription.cancel_at_period_end ? 'Expires' : 'Renews'} on{' '}
                {format(new Date(subscription.current_period_end), 'MMMM d, yyyy')}
              </p>
            )}

            <div className="space-y-2">
              <h4 className="text-sm font-medium">Plan Features:</h4>
              <ul className="space-y-1">
                {(currentPlan.features as string[]).map((feature, index) => (
                  <li key={index} className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-primary" />
                    {feature}
                  </li>
                ))}
              </ul>
            </div>

            {!subscription.cancel_at_period_end && (
              <Button
                variant="destructive"
                onClick={() => cancelSubscription.mutate()}
                disabled={cancelSubscription.isPending}
              >
                Cancel Subscription
              </Button>
            )}

            {subscription.cancel_at_period_end && (
              <div className="flex items-center gap-2 text-sm text-orange-600">
                <X className="h-4 w-4" />
                Subscription will be cancelled at period end
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Available Plans */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">
          {subscription ? 'Upgrade or Downgrade' : 'Choose a Plan'}
        </h3>
        <div className="grid gap-4 md:grid-cols-3">
          {plans?.map((plan) => {
            const features = plan.features as string[];
            const isCurrentPlan = currentPlan?.plan_id === plan.plan_id;

            return (
              <Card key={plan.id} className={isCurrentPlan ? 'border-primary' : ''}>
                <CardHeader>
                  <CardTitle>{plan.name}</CardTitle>
                  <CardDescription>
                    <span className="text-2xl font-bold">${plan.price_monthly}</span>/month
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ul className="space-y-2">
                    {features.map((feature, index) => (
                      <li key={index} className="flex items-center gap-2 text-sm">
                        <Check className="h-4 w-4 text-primary flex-shrink-0" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>

                  {isCurrentPlan ? (
                    <Badge className="w-full justify-center">Current Plan</Badge>
                  ) : (
                    <Button
                      className="w-full"
                      onClick={() => createCheckoutSession.mutate(plan.plan_id)}
                      disabled={createCheckoutSession.isPending}
                    >
                      {subscription ? 'Switch Plan' : 'Get Started'}
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}