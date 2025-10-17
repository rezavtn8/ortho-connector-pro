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
    <section id="pricing" className="py-20 bg-gradient-to-b from-background to-muted/20">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-3">
            Simple, Transparent Pricing
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Choose the plan that fits your practice
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {plans.map((plan) => (
            <Card
              key={plan.id}
              variant="glass"
              className={`relative overflow-hidden transition-all duration-300 ${
                plan.popular
                  ? 'border-primary/50 ring-2 ring-primary/20'
                  : 'border-border/50 hover:border-primary/30'
              }`}
            >
              {plan.popular && (
                <div className="absolute top-0 right-0 bg-primary text-primary-foreground px-3 py-1 text-xs font-semibold rounded-bl-lg">
                  Most Popular
                </div>
              )}
              <CardContent className="p-6 space-y-6">
                <div>
                  <h3 className="text-lg font-bold text-foreground mb-1">{plan.name}</h3>
                  <p className="text-xs text-muted-foreground">{plan.description}</p>
                </div>
                
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold text-foreground">${plan.price}</span>
                  <span className="text-sm text-muted-foreground">/mo</span>
                </div>

                <ul className="space-y-2">
                  {plan.features.map((feature, featureIndex) => (
                    <li key={featureIndex} className="flex items-start gap-2 text-sm">
                      <CheckCircle className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                      <span className="text-muted-foreground leading-relaxed">{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  className={`w-full ${
                    plan.popular
                      ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                      : 'bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground'
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