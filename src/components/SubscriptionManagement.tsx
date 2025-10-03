import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useSubscription } from '@/hooks/useSubscription';
import { format } from 'date-fns';
import { CheckCircle, X } from 'lucide-react';

export function SubscriptionManagement() {
  const { subscription, plans, isLoading, createCheckoutSession, cancelSubscription } = useSubscription();

  if (isLoading) {
    return <div>Loading subscription details...</div>;
  }

  const currentPlan = subscription?.subscription_plans;

  const plansData = [
    {
      id: 'solo',
      name: 'Solo Practice',
      description: 'Up to 50 referring offices',
      features: [
        '1 user account',
        'Basic features + email campaigns',
      ],
    },
    {
      id: 'group',
      name: 'Group Practice',
      description: 'Up to 200 referring offices',
      popular: true,
      features: [
        '10 user accounts',
        'AI Review Writer + Direct Google Reply',
        'Advanced analytics & automation',
      ],
    },
    {
      id: 'multi',
      name: 'Multi-Location',
      description: 'Unlimited referring offices',
      features: [
        'Unlimited users',
        'Unlimited offices and locations',
        'Everything in Group + API access',
        'Dedicated success manager',
      ],
    },
  ];

  return (
    <div className="space-y-8">
      {/* Current Subscription */}
      {subscription && currentPlan && (
        <Card className="bg-gradient-card border-connection-primary/40">
          <CardHeader>
            <CardTitle className="text-connection-text">Current Subscription</CardTitle>
            <CardDescription className="text-connection-muted">Manage your subscription plan</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-connection-text">{currentPlan.name}</h3>
                <p className="text-sm text-connection-muted">
                  ${currentPlan.price_monthly}/month
                </p>
              </div>
              <Badge variant={subscription.status === 'active' ? 'default' : 'secondary'}>
                {subscription.status}
              </Badge>
            </div>

            {subscription.current_period_end && (
              <p className="text-sm text-connection-muted">
                {subscription.cancel_at_period_end ? 'Expires' : 'Renews'} on{' '}
                {format(new Date(subscription.current_period_end), 'MMMM d, yyyy')}
              </p>
            )}

            <div className="space-y-2">
              <h4 className="text-sm font-medium text-connection-text">Plan Features:</h4>
              <ul className="space-y-1">
                {(currentPlan.features as string[]).map((feature, index) => (
                  <li key={index} className="flex items-center gap-2 text-sm text-connection-text">
                    <CheckCircle className="h-4 w-4 text-connection-primary" />
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
      <div className="space-y-6">
        <div className="text-center">
          <h3 className="text-3xl font-bold text-connection-text mb-2">
            {subscription ? 'Upgrade or Downgrade' : 'Choose a Plan'}
          </h3>
          <p className="text-connection-muted">
            {subscription ? 'Switch to a different plan that fits your needs' : 'Select the perfect plan for your practice'}
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {plansData.map((plan) => {
            const dbPlan = plans?.find(p => p.plan_id === plan.id);
            const isCurrentPlan = currentPlan?.plan_id === plan.id;

            return (
              <Card
                key={plan.id}
                className={`group hover:shadow-elegant transition-all duration-300 ${
                  plan.popular
                    ? 'border-connection-primary/40 hover:border-connection-primary bg-gradient-card relative scale-105'
                    : 'border-connection-primary/20 hover:border-connection-primary/40 bg-gradient-card'
                } ${isCurrentPlan ? 'ring-2 ring-connection-primary' : ''}`}
              >
                {plan.popular && (
                  <div className="absolute -top-2 left-1/2 transform -translate-x-1/2">
                    <div className="bg-connection-primary text-white px-3 py-1 rounded-full text-xs font-medium flex items-center space-x-1">
                      <span>⭐</span>
                      <span>Most Popular</span>
                    </div>
                  </div>
                )}
                {isCurrentPlan && (
                  <div className="absolute -top-2 right-4">
                    <div className="bg-connection-primary text-white px-3 py-1 rounded-full text-xs font-medium">
                      Current Plan
                    </div>
                  </div>
                )}
                <CardContent className="p-6">
                  <div className="text-center mb-6">
                    <h3 className="text-xl font-bold text-connection-text mb-2">{plan.name}</h3>
                    <p className="text-sm text-connection-muted mb-3">{plan.description}</p>
                    <div className="mb-4">
                      <span className="text-3xl font-bold text-connection-primary">
                        ${dbPlan?.price_monthly || 0}
                      </span>
                      <span className="text-sm text-connection-muted">/month</span>
                    </div>
                  </div>
                  <ul className="space-y-3 mb-6">
                    {plan.features.map((feature, featureIndex) => (
                      <li key={featureIndex} className="flex items-center space-x-2">
                        <CheckCircle className="w-4 h-4 text-connection-primary flex-shrink-0" />
                        <span className="text-sm text-connection-text">{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <Button
                    className={`w-full transition-all ${
                      plan.popular
                        ? 'bg-connection-primary text-white hover:bg-connection-primary/90'
                        : 'bg-connection-primary/10 text-connection-primary hover:bg-connection-primary hover:text-white'
                    }`}
                    onClick={() => dbPlan && createCheckoutSession.mutate(dbPlan.plan_id)}
                    disabled={createCheckoutSession.isPending || isCurrentPlan || !dbPlan}
                  >
                    {isCurrentPlan ? 'Current Plan' : subscription ? 'Switch Plan' : 'Get Started'}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}