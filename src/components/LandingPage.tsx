import React, { Suspense, lazy } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowRight, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { NexoraLogo } from '@/components/NexoraLogo';
import { useSubscription } from '@/hooks/useSubscription';
import { useIntersectionObserver } from '@/hooks/useIntersectionObserver';

// Only rendered once the visitor clicks through to sign in. Loading it lazily keeps
// zod, react-hook-form and @hookform/resolvers out of the initial bundle, which every
// anonymous visitor pays for.
const AuthForm = lazy(() => import('./AuthForm').then((m) => ({ default: m.AuthForm })));

interface LandingPageProps {
  onGetStarted: () => void;
  showAuth?: boolean;
}

/** Small caps section marker, sitting on the hairline rule that runs down the page. */
function SectionMark({ n, label, className = '' }: { n: string; label: string; className?: string }) {
  return (
    <div className={`flex items-baseline gap-3 ${className}`}>
      <span className="text-connection-primary text-xs font-medium tabular-nums">{n}</span>
      <span className="h-px w-8 bg-connection-primary/30 translate-y-[-3px]" />
      <span className="text-[11px] uppercase tracking-[0.18em] text-connection-muted">{label}</span>
    </div>
  );
}

/**
 * Prose sections put the marker in its own left column, so the text keeps a readable
 * measure without leaving the right half of a wide screen looking abandoned.
 */
function ProseSection({
  n,
  label,
  children,
}: {
  n: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="max-w-6xl mx-auto grid lg:grid-cols-[auto_minmax(0,42rem)] gap-y-8 gap-x-16 lg:gap-x-24">
      <SectionMark n={n} label={label} className="lg:pt-2" />
      <div>{children}</div>
    </div>
  );
}

/**
 * The hero artifact. A plain reading of one month, which is the whole product in
 * miniature: you can see at a glance that Kingsway has gone quiet. Deliberately built
 * from type and rules rather than a screenshot, so it stays sharp and weighs nothing.
 */
function SourceLedger() {
  const rows = [
    { name: 'Google', kind: 'Online', count: 19, dir: 'up' as const, note: 'best month so far' },
    { name: 'Bayview Family Dental', kind: 'Referring office', count: 12, dir: 'up' as const, note: 'up from 9' },
    { name: 'Kingsway Dental', kind: 'Referring office', count: 3, dir: 'down' as const, note: 'was 14 in March' },
    { name: 'Northside Orthodontics', kind: 'Referring office', count: 6, dir: 'flat' as const, note: 'steady' },
    { name: 'Walk in', kind: 'Direct', count: 4, dir: 'flat' as const, note: '' },
  ];

  return (
    <div className="rounded-2xl border border-connection-primary/15 bg-white/70 backdrop-blur-sm shadow-card overflow-hidden">
      <div className="flex items-baseline justify-between px-6 py-4 border-b border-connection-primary/10">
        <span className="text-[11px] uppercase tracking-[0.18em] text-connection-muted">
          New patients, this month
        </span>
        <span className="text-sm tabular-nums text-connection-text font-medium">44</span>
      </div>

      <ul>
        {rows.map((r) => (
          <li
            key={r.name}
            className="flex items-center gap-4 px-6 py-3.5 border-b border-connection-primary/[0.07] last:border-b-0"
          >
            <div className="min-w-0 flex-1">
              <div className="text-sm text-connection-text truncate">{r.name}</div>
              <div className="text-xs text-connection-muted mt-0.5">{r.kind}</div>
            </div>

            {r.note && (
              <span
                className={`hidden sm:inline text-xs ${
                  r.dir === 'down' ? 'text-connection-text/70' : 'text-connection-muted'
                }`}
              >
                {r.note}
              </span>
            )}

            <div className="flex items-center gap-1.5 w-14 justify-end">
              {r.dir === 'up' && <ArrowUpRight className="w-3.5 h-3.5 text-connection-primary" />}
              {r.dir === 'down' && <ArrowDownRight className="w-3.5 h-3.5 text-connection-primary" />}
              <span className="text-sm tabular-nums text-connection-text font-medium">{r.count}</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export const LandingPage: React.FC<LandingPageProps> = ({ onGetStarted, showAuth = false }) => {
  const { createCheckoutSession } = useSubscription();
  const [selectedPlan, setSelectedPlan] = React.useState<string | null>(null);

  const work = useIntersectionObserver({ threshold: 0.08 });
  const pricing = useIntersectionObserver({ threshold: 0.08 });

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

  const capabilities = [
    {
      title: 'Patient sources',
      body: 'Every new patient gets attributed to wherever they came from. A referring office, Google, a campaign, or the front door. The count is there whether or not anyone remembers to mention it.',
    },
    {
      title: 'A page per office',
      body: 'Who referred, how often, when you last visited, who you spoke to and what was said. The things that normally live in one person’s head.',
    },
    {
      title: 'Reviews',
      body: 'Your Google reviews in one list, with the practices near you alongside them. Replies can be drafted for you. Nothing gets posted until you say so.',
    },
    {
      title: 'Visits and campaigns',
      body: 'Plan the visit, print the labels, send the letters, then record what actually came of it. The follow up is the part that usually gets lost.',
    },
    {
      title: 'Finding practices',
      body: 'Search the area around you for practices you have not met yet, filtered by distance, rating and type.',
    },
    {
      title: 'Twelve months of history',
      body: 'Enough history that a slow decline looks like a slow decline, instead of looking like a quiet week.',
    },
  ];

  const plans = [
    {
      id: 'solo',
      name: 'Solo',
      price: '149',
      for: 'One dentist, up to 50 referring offices',
      points: ['One account', 'Sources, offices, visits and reviews', 'Email campaigns'],
      featured: false,
    },
    {
      id: 'group',
      name: 'Group',
      price: '399',
      for: 'A team, up to 200 referring offices',
      points: [
        'Ten accounts',
        'Everything in Solo',
        'Drafted review replies, posted to Google',
        'Full analytics and automation',
      ],
      featured: true,
    },
    {
      id: 'multi',
      name: 'Multi location',
      price: '799',
      for: 'Several practices, no limit on offices',
      points: ['Unlimited accounts', 'Everything in Group', 'API access', 'Someone to call'],
      featured: false,
    },
  ];

  const header = (
    <header className="px-6 md:px-10 pt-7">
      <nav className="max-w-6xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <NexoraLogo size={26} />
          <span className="text-[17px] tracking-tight text-connection-text font-medium">Nexora</span>
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

  // Signing in: the page steps back to a quiet two column split so the form is the
  // only thing asking for attention.
  if (showAuth) {
    return (
      <div className="min-h-screen bg-gradient-connection flex flex-col">
        {header}
        <div className="flex-1 flex flex-col md:flex-row items-center max-w-6xl mx-auto w-full px-6 md:px-10 py-12 gap-16">
          <div className="hidden md:block flex-1">
            <h1 className="font-playfair text-4xl lg:text-5xl leading-[1.1] text-connection-text">
              Welcome back.
            </h1>
            <p className="mt-5 text-connection-muted leading-relaxed max-w-sm">
              Your offices, sources and reviews are where you left them.
            </p>
            <div className="mt-12 max-w-sm">
              <SourceLedger />
            </div>
          </div>

          <div className="w-full md:w-[420px] shrink-0">
            <div className="rounded-2xl border border-connection-primary/15 bg-white/80 backdrop-blur-md shadow-elegant p-7 md:p-8">
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
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-connection">
      {header}

      {/* Hero */}
      <section className="px-6 md:px-10 pt-20 md:pt-28 pb-20">
        <div className="max-w-6xl mx-auto grid lg:grid-cols-[1.15fr_0.85fr] gap-14 lg:gap-20 items-center">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-connection-muted mb-7">
              For dental practices
            </p>

            {/* text-balance keeps the rag even. Without it the measure is narrow enough
                that "from." gets stranded on a line of its own. */}
            <h1 className="font-playfair text-[2.4rem] sm:text-[2.9rem] lg:text-[3.15rem] leading-[1.1] text-connection-text text-balance">
              Most practices guess where their patients come from.
              <span className="block mt-2.5 text-connection-primary font-light italic">
                Yours does not have to.
              </span>
            </h1>

            <p className="mt-7 text-[17px] leading-relaxed text-connection-muted max-w-lg">
              Nexora keeps a running record of every referring office, every review and every
              visit your team makes. So when you sit down to plan the quarter, you are working
              from what happened rather than what you remember.
            </p>

            <div className="mt-9 flex flex-wrap items-center gap-x-7 gap-y-4">
              <Button
                size="lg"
                onClick={onGetStarted}
                className="group bg-connection-primary hover:bg-connection-primary/90 text-white rounded-xl px-7 h-12 text-[15px] shadow-elegant hover:shadow-glow transition-all"
              >
                Start tracking
                <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </Button>
              <button
                onClick={() => document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })}
                className="text-sm text-connection-muted hover:text-connection-text transition-colors"
              >
                See pricing
              </button>
            </div>
          </div>

          <div className="lg:pl-4">
            <SourceLedger />
            <p className="mt-4 text-xs text-connection-muted/80 leading-relaxed">
              An example month. Kingsway used to be your second best source.
            </p>
          </div>
        </div>
      </section>

      {/* The problem */}
      <section className="px-6 md:px-10 py-20 md:py-28 border-t border-connection-primary/10 bg-white/50">
        <ProseSection n="01" label="Why this exists">
          <p className="font-playfair text-[1.7rem] sm:text-[2rem] leading-[1.3] text-connection-text text-balance">
            A referral relationship goes quiet slowly.
          </p>
          <div className="mt-6 space-y-5 text-connection-muted leading-relaxed">
            <p>
              Four patients a month, then two, then one. Nobody notices, because nobody is
              counting. Six months later someone asks why the schedule looks thin and the honest
              answer is that no one is quite sure.
            </p>
            <p>
              The information was never really missing. It was spread across a receptionist’s
              memory, a spreadsheet somebody stopped updating and a stack of referral pads. This
              is a place to keep it instead.
            </p>
          </div>
        </ProseSection>
      </section>

      {/* What it does */}
      <section className="px-6 md:px-10 py-20 md:py-28" ref={work.ref}>
        <div className="max-w-6xl mx-auto">
          <SectionMark n="02" label="What it does" className="mb-10" />

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-12 gap-y-12 lg:gap-y-14">
            {capabilities.map((c, i) => (
              <div
                key={c.title}
                className={work.isVisible ? 'animate-fade-in' : 'opacity-0'}
                style={{
                  animationDelay: work.isVisible ? `${i * 0.06}s` : '0s',
                  animationFillMode: 'both',
                }}
              >
                <div className="h-px w-full bg-connection-primary/15 mb-5" />
                <h3 className="text-[15px] font-medium text-connection-text mb-3">{c.title}</h3>
                <p className="text-sm leading-relaxed text-connection-muted">{c.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* The honest note about the assistant */}
      <section className="px-6 md:px-10 py-20 md:py-24 border-y border-connection-primary/10 bg-white/50">
        <ProseSection n="03" label="About the assistant">
          <p className="text-connection-muted leading-relaxed">
            There is an assistant built in. It drafts replies to reviews, writes first versions of
            outreach letters and points out which offices have gone quiet. It is genuinely useful
            and it is also just a first draft. It does not send anything, it does not decide
            anything, and you can ignore it entirely and the rest of the product still works. That
            felt like the right way round.
          </p>
        </ProseSection>
      </section>

      {/* Pricing */}
      <section id="pricing" className="px-6 md:px-10 py-20 md:py-28" ref={pricing.ref}>
        <div className="max-w-6xl mx-auto">
          <SectionMark n="04" label="Pricing" className="mb-10" />

          <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
            {plans.map((p, i) => (
              <div
                key={p.id}
                className={`rounded-2xl border p-7 flex flex-col transition-colors ${
                  p.featured
                    ? 'border-connection-primary/40 bg-white/80'
                    : 'border-connection-primary/15 bg-white/50 hover:border-connection-primary/30'
                } ${pricing.isVisible ? 'animate-fade-in' : 'opacity-0'}`}
                style={{
                  animationDelay: pricing.isVisible ? `${i * 0.08}s` : '0s',
                  animationFillMode: 'both',
                }}
              >
                <div className="flex items-baseline justify-between">
                  <h3 className="text-[15px] font-medium text-connection-text">{p.name}</h3>
                  {p.featured && (
                    <span className="text-[10px] uppercase tracking-[0.16em] text-connection-primary">
                      Most chosen
                    </span>
                  )}
                </div>

                <p className="mt-2 text-sm text-connection-muted">{p.for}</p>

                <div className="mt-7 flex items-baseline gap-1.5">
                  <span className="font-playfair text-4xl text-connection-text tabular-nums">
                    ${p.price}
                  </span>
                  <span className="text-sm text-connection-muted">a month</span>
                </div>

                <ul className="mt-7 space-y-2.5 flex-1">
                  {p.points.map((pt) => (
                    <li key={pt} className="flex gap-2.5 text-sm text-connection-muted">
                      <span className="mt-[9px] h-px w-3 shrink-0 bg-connection-primary/40" />
                      <span className="leading-relaxed">{pt}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  onClick={() => handlePlanSelect(p.id)}
                  disabled={createCheckoutSession.isPending}
                  className={`mt-8 w-full rounded-xl h-11 text-sm transition-all ${
                    p.featured
                      ? 'bg-connection-primary text-white hover:bg-connection-primary/90'
                      : 'bg-transparent text-connection-text border border-connection-primary/25 hover:bg-connection-primary hover:text-white hover:border-connection-primary'
                  }`}
                >
                  Choose {p.name}
                </Button>
              </div>
            ))}
          </div>

          <p className="mt-8 text-xs text-connection-muted">
            Prices are per practice. You can change plan or cancel whenever you like.
          </p>
        </div>
      </section>

      {/* Close */}
      <section className="px-6 md:px-10 py-24 md:py-32 border-t border-connection-primary/10">
        <div className="max-w-6xl mx-auto">
          <div className="max-w-xl">
            <h2 className="font-playfair text-[2rem] sm:text-[2.4rem] leading-[1.15] text-connection-text">
              Start with one month of numbers.
            </h2>
            <p className="mt-5 text-connection-muted leading-relaxed">
              Add your referring offices, record where this month’s patients came from, and see
              what it tells you. That is usually enough to be worth it.
            </p>
            <Button
              size="lg"
              onClick={onGetStarted}
              className="group mt-8 bg-connection-primary hover:bg-connection-primary/90 text-white rounded-xl px-7 h-12 text-[15px] shadow-elegant hover:shadow-glow transition-all"
            >
              Create an account
              <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </Button>
          </div>
        </div>
      </section>

      <footer className="px-6 md:px-10 py-10 border-t border-connection-primary/10">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
          <div className="flex items-center gap-2.5">
            <NexoraLogo size={20} />
            <span className="text-sm text-connection-text">Nexora</span>
            <span className="text-xs text-connection-muted ml-2">
              Built for dental practices
            </span>
          </div>
          <div className="flex items-center gap-6 text-xs text-connection-muted">
            <a href="mailto:admin@nexoradental.com" className="hover:text-connection-text transition-colors">
              admin@nexoradental.com
            </a>
            <span>&copy; {new Date().getFullYear()} Nexora</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
