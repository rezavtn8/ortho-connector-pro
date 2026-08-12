import React, { Suspense, lazy } from 'react';
import { Loader2, ArrowRight } from 'lucide-react';
import { NexoraLogo } from '@/components/NexoraLogo';
import { useSubscription } from '@/hooks/useSubscription';

// Only rendered once the visitor clicks through to sign in. Loading it lazily keeps
// zod, react-hook-form and @hookform/resolvers out of the initial bundle, which every
// anonymous visitor pays for.
const AuthForm = lazy(() => import('./AuthForm').then((m) => ({ default: m.AuthForm })));

interface LandingPageProps {
  onGetStarted: () => void;
  showAuth?: boolean;
}

const CENTER = 200;
const RADIUS = 150;

/**
 * One referral path: a source on the ring, curving in to the practice at the centre.
 * The control point is pushed off the radius so the line arrives with a bend rather
 * than a spoke, which reads as flow instead of a diagram.
 */
function path(deg: number, bend: number) {
  const a = (deg * Math.PI) / 180;
  const x = CENTER + RADIUS * Math.cos(a);
  const y = CENTER + RADIUS * Math.sin(a);
  const cx = CENTER + (RADIUS / 2) * Math.cos(a) + bend * Math.cos(a + Math.PI / 2);
  const cy = CENTER + (RADIUS / 2) * Math.sin(a) + bend * Math.sin(a + Math.PI / 2);
  // Drawn centre-outwards so a positive dash offset travels inwards, towards you.
  return { x, y, d: `M ${CENTER} ${CENTER} Q ${cx} ${cy} ${x} ${y}` };
}

const SOURCES = [
  { deg: -152, bend: 30, delay: 0 },
  { deg: -104, bend: -26, delay: 1.3 },
  { deg: -48, bend: 28, delay: 2.6 },
  { deg: 14, bend: -30, delay: 0.65 },
  { deg: 74, bend: 26, delay: null }, // gone quiet
  { deg: 138, bend: -28, delay: 1.95 },
];

/**
 * The entire pitch, drawn rather than written: five sources still sending, one that
 * stopped. Built from type-free geometry so it stays sharp at any size and costs
 * nothing to ship.
 */
function Inflow({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 400 400"
      className={className}
      role="img"
      aria-label="Six referral sources feeding one practice. One has gone quiet."
    >
      <circle cx={CENTER} cy={CENTER} r={RADIUS} fill="none" strokeWidth={1} className="stroke-connection-primary/10" />
      <circle cx={CENTER} cy={CENTER} r={RADIUS * 0.62} fill="none" strokeWidth={1} className="stroke-connection-primary/[0.06]" />

      {SOURCES.map((s) => {
        const { x, y, d } = path(s.deg, s.bend);
        const quiet = s.delay === null;

        return (
          <g key={s.deg} className={quiet ? 'animate-quiet opacity-50' : undefined}>
            <path d={d} fill="none" strokeWidth={1} className="stroke-connection-primary/25" />

            {!quiet && (
              <path
                d={d}
                pathLength={100}
                fill="none"
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeDasharray="3 97"
                className="stroke-connection-primary animate-inflow"
                style={{ animationDelay: `${s.delay}s` }}
              />
            )}

            <circle cx={x} cy={y} r={3} className="fill-connection-primary/70" />
          </g>
        );
      })}

      <circle cx={CENTER} cy={CENTER} r={22} className="fill-connection-primary animate-breathe" />
      <circle cx={CENTER} cy={CENTER} r={6} className="fill-connection-primary" />
    </svg>
  );
}

export const LandingPage: React.FC<LandingPageProps> = ({ onGetStarted, showAuth = false }) => {
  const { createCheckoutSession } = useSubscription();
  const [selectedPlan, setSelectedPlan] = React.useState<string | null>(null);

  const handlePlanSelect = (planId: string) => {
    setSelectedPlan(planId);
    if (!showAuth) onGetStarted();
  };

  React.useEffect(() => {
    if (showAuth && selectedPlan) {
      createCheckoutSession.mutate(selectedPlan);
      setSelectedPlan(null);
    }
  }, [showAuth, selectedPlan, createCheckoutSession]);

  const plans = [
    { id: 'solo', name: 'Solo', seats: 'One seat', price: '149' },
    { id: 'group', name: 'Group', seats: 'Ten seats', price: '399' },
    { id: 'multi', name: 'Multi', seats: 'Unlimited', price: '799' },
  ];

  const header = (
    <header className="px-6 md:px-10 pt-7">
      <nav className="max-w-5xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <NexoraLogo size={24} />
          <span className="text-[16px] tracking-tight text-connection-text font-medium">Nexora</span>
        </div>
        {!showAuth && (
          <button
            onClick={onGetStarted}
            className="text-sm text-connection-muted hover:text-connection-text transition-colors"
          >
            Sign in
          </button>
        )}
      </nav>
    </header>
  );

  // Signing in: the diagram shrinks to a mark above the form and says nothing at all.
  if (showAuth) {
    return (
      <div className="min-h-screen bg-gradient-connection flex flex-col">
        {header}
        <div className="flex-1 flex flex-col items-center justify-center w-full px-6 py-12">
          <Inflow className="w-24 h-24 mb-10 opacity-80" />
          <div className="w-full max-w-[400px] rounded-2xl border border-connection-primary/15 bg-white/80 backdrop-blur-md shadow-elegant p-7 md:p-8">
            <Suspense
              fallback={
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="h-5 w-5 animate-spin text-connection-primary" />
                </div>
              }
            >
              <AuthForm embedded />
            </Suspense>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-connection">
      {header}

      <section className="px-6 flex flex-col items-center justify-center text-center min-h-[86vh] pt-10 pb-16">
        <Inflow className="w-[min(72vw,330px)] h-auto animate-fade-in" />

        {/* The full stop is the same dot the lines run into. */}
        <h1 className="mt-12 md:mt-14 font-playfair text-[2.1rem] sm:text-[2.8rem] lg:text-[3.4rem] leading-[1.1] text-connection-text text-balance">
          Where patients come from
          <span className="text-connection-primary">.</span>
        </h1>

        <button
          onClick={onGetStarted}
          className="group mt-10 inline-flex items-center gap-2 rounded-full bg-connection-primary text-white h-12 px-8 text-[15px] shadow-elegant hover:shadow-glow hover:bg-connection-primary/90 transition-all"
        >
          Start
          <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
        </button>

        {/* Wordless scroll cue: a dot falling down a hairline. */}
        <a
          href="#pricing"
          aria-label="Pricing"
          className="mt-14 h-10 w-px bg-connection-primary/15 relative"
        >
          <span className="animate-drift absolute -left-[2px] top-0 h-1.5 w-1.5 rounded-full bg-connection-primary" />
        </a>
      </section>

      <section id="pricing" className="px-6 pb-24 scroll-mt-10">
        <div className="max-w-lg mx-auto">
          <p className="text-[11px] uppercase tracking-[0.18em] text-connection-muted text-center mb-6">
            Per month
          </p>

          <div className="border-t border-connection-primary/15">
            {plans.map((p) => (
              <button
                key={p.id}
                onClick={() => handlePlanSelect(p.id)}
                disabled={createCheckoutSession.isPending}
                className="group w-full flex items-baseline gap-4 py-5 px-2 border-b border-connection-primary/15 text-left transition-colors hover:bg-white/60 disabled:opacity-50"
              >
                <span className="text-[15px] text-connection-text font-medium w-16 shrink-0">{p.name}</span>
                <span className="text-sm text-connection-muted flex-1">{p.seats}</span>
                <span className="font-playfair text-2xl text-connection-text tabular-nums">${p.price}</span>
                <ArrowRight className="w-4 h-4 text-connection-primary opacity-0 group-hover:opacity-100 -translate-x-1 group-hover:translate-x-0 transition-all" />
              </button>
            ))}
          </div>
        </div>
      </section>

      <footer className="px-6 py-8 border-t border-connection-primary/10">
        <div className="max-w-5xl mx-auto flex items-center justify-between text-xs text-connection-muted">
          <NexoraLogo size={18} />
          <a href="mailto:admin@nexoradental.com" className="hover:text-connection-text transition-colors">
            admin@nexoradental.com
          </a>
          <span>&copy; {new Date().getFullYear()}</span>
        </div>
      </footer>
    </div>
  );
};
