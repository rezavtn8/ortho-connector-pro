import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle } from 'lucide-react';
import { useSubscription } from '@/hooks/useSubscription';
import { useAuth } from '@/hooks/useAuth';

interface PricingSectionProps {
  onPlanSelect: (planId: string) => void;
}

export function PricingSection({ onPlanSelect }: PricingSectionProps) {
  const { createCheckoutSession } = useSubscription();
  const { user } = useAuth();

  const plans = [
    {
      id: 'solo',
      name: 'Solo Practice',
      price: 149,
      description: 'Up to 50 referring offices',
      features: [
        '1 user account',
        'Basic features + email campaigns',
      ],
    },
    {
      id: 'group',
      name: 'Group Practice',
      price: 399,
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
      price: 799,
      description: 'Unlimited referring offices',
      features: [
        'Unlimited users',
        'Unlimited offices and locations',
        'Everything in Group + API access',
        'Dedicated success manager',
      ],
    },
  ];

  const handlePlanClick = (planId: string) => {
    if (user) {
      createCheckoutSession.mutate(planId);
    } else {
      onPlanSelect(planId);
    }
  };

  return (
    <section id="pricing" className="py-24 bg-gradient-to-b from-white to-gray-50">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-connection-text mb-6">
            Simple, Transparent Pricing
          </h2>
          <p className="text-xl text-connection-muted max-w-3xl mx-auto">
            Choose the plan that fits your practice. All plans include core features with no hidden fees.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {plans.map((plan, index) => (
            <Card
              key={plan.id}
              className={`group hover:shadow-elegant transition-all duration-300 ${
                plan.popular
                  ? 'border-connection-primary/40 hover:border-connection-primary bg-gradient-card relative scale-105'
                  : 'border-connection-primary/20 hover:border-connection-primary/40 bg-gradient-card'
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-2 left-1/2 transform -translate-x-1/2">
                  <div className="bg-connection-primary text-white px-3 py-1 rounded-full text-xs font-medium flex items-center space-x-1">
                    <span>⭐</span>
                    <span>Most Popular</span>
                  </div>
                </div>
              )}
              <CardContent className="p-6">
                <div className="text-center mb-6">
                  <h3 className="text-xl font-bold text-connection-text mb-2">{plan.name}</h3>
                  <p className="text-sm text-connection-muted mb-3">{plan.description}</p>
                  <div className="mb-4">
                    <span className="text-3xl font-bold text-connection-primary">${plan.price}</span>
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
                  onClick={() => handlePlanClick(plan.id)}
                  disabled={createCheckoutSession.isPending}
                >
                  Get Started
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}