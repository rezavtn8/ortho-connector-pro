import React, { Suspense, lazy } from 'react';
import { Loader2, ArrowRight, ArrowUpRight, ArrowDownRight } from 'lucide-react';
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
 * nothing to ship. `hub` is off where the logo is laid over the centre instead.
 */
function Inflow({ className = '', hub = true }: { className?: string; hub?: boolean }) {
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
      {hub && <circle cx={CENTER} cy={CENTER} r={6} className="fill-connection-primary" />}
    </svg>
  );
}

/**
 * The brand moment: the mark sitting where the referrals arrive, with the diagram
 * running behind it. The logo settles in on load and the halo keeps breathing under it.
 */
function Hub({ className = '', logoSize = 46 }: { className?: string; logoSize?: number }) {
  // The mark carries an opaque plate the width of its own artwork, so the disc has to
  // clear the plate's diagonal (x1.5) or its square corners show over the lines.
  const disc = Math.round(logoSize * 1.6);

  return (
    <div className={`relative ${className}`}>
      <Inflow className="w-full h-auto" hub={false} />
      <div className="absolute inset-0 grid place-items-center">
        <div
          className="animate-logo-in grid place-items-center rounded-full bg-white shadow-card"
          style={{ width: disc, height: disc }}
        >
          <NexoraLogo size={logoSize} />
        </div>
      </div>
    </div>
  );
}

/**
 * One month, read plainly. This is the product in miniature — you can see at a glance
 * that Kingsway has gone quiet — and it is built from type and rules rather than a
 * screenshot, so it stays sharp and weighs nothing.
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
    <div className="rounded-2xl border border-connection-primary/15 bg-white/80 backdrop-blur-sm shadow-card overflow-hidden">
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

/** A title and a half-line each. Anything longer belongs in the product, not here. */
const SOLUTIONS = [
  { n: '01', title: 'Sources', body: 'Where each patient came from.' },
  { n: '02', title: 'Offices', body: 'A page per referring office.' },
  { n: '03', title: 'Visits', body: 'Planned, then recorded.' },
  { n: '04', title: 'Campaigns', body: 'Letters and mailing labels.' },
  { n: '05', title: 'Reviews', body: 'Google reviews, in one place.' },
  { n: '06', title: 'Discover', body: 'Practices you have not met.' },
  { n: '07', title: 'History', body: 'Twelve months of it.' },
  { n: '08', title: 'Analytics', body: 'Every number, one place.' },
  { n: '09', title: 'AI agent', body: 'Reads the data, drafts the reply.' },
];

type Tab = 'home' | 'solutions' | 'pricing';

export const LandingPage: React.FC<LandingPageProps> = ({ onGetStarted, showAuth = false }) => {
  const { createCheckoutSession } = useSubscription();
  const [selectedPlan, setSelectedPlan] = React.useState<string | null>(null);
  const [tab, setTab] = React.useState<Tab>('home');

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

  const navLink = (to: Tab, label: string) => (
    <button
      key={to}
      onClick={() => setTab(to)}
      aria-current={tab === to ? 'page' : undefined}
      className={`transition-colors ${
        tab === to ? 'text-connection-text' : 'text-connection-muted hover:text-connection-text'
      }`}
    >
      {label}
    </button>
  );

  const header = (
    <header className="px-6 md:px-10 pt-7">
      <nav className="max-w-5xl mx-auto flex items-center justify-between">
        <button
          onClick={() => setTab('home')}
          className="flex items-center gap-2.5"
          aria-label="Nexora, home"
        >
          <NexoraLogo size={24} />
          <span className="text-[16px] tracking-tight text-connection-text font-medium">Nexora</span>
        </button>
        {!showAuth && (
          <div className="flex items-center gap-5 sm:gap-7 text-sm">
            {navLink('solutions', 'Solutions')}
            {navLink('pricing', 'Pricing')}
            <button
              onClick={onGetStarted}
              className="text-connection-muted hover:text-connection-text transition-colors"
            >
              Sign in
            </button>
          </div>
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
          <Hub className="w-44 mb-8" logoSize={38} />
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

  const home = (
    <>
      <section className="px-6 md:px-10 pt-16 pb-20 md:pt-20 md:pb-24">
        <div className="max-w-5xl mx-auto grid lg:grid-cols-[1fr_minmax(0,26rem)] gap-14 lg:gap-20 items-center">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-connection-muted">
              For dental practices
            </p>

            {/* The full stop is the same dot the lines run into, over on the right. */}
            <h1 className="mt-6 font-playfair text-[2.4rem] sm:text-[3rem] lg:text-[3.6rem] leading-[1.05] text-connection-text text-balance">
              Where patients come from
              <span className="text-connection-primary">.</span>
            </h1>

            <p className="mt-6 text-[17px] leading-relaxed text-connection-muted max-w-md">
              Nexora keeps the record. Every referring office, every review, every visit.
            </p>

            <div className="mt-9 flex flex-wrap items-center gap-x-7 gap-y-4">
              <button
                onClick={onGetStarted}
                className="group inline-flex items-center gap-2 rounded-full bg-connection-primary text-white h-12 px-8 text-[15px] shadow-elegant hover:shadow-glow hover:bg-connection-primary/90 transition-all"
              >
                Start
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </button>
              <button
                onClick={() => setTab('solutions')}
                className="text-sm text-connection-muted hover:text-connection-text transition-colors"
              >
                What it does
              </button>
            </div>
          </div>

          <Hub className="w-[min(76vw,380px)] mx-auto lg:w-full animate-fade-in" />
        </div>
      </section>

      {/* The artifact. One month, with a referral quietly halving in it — the argument
          the abstract diagram can only gesture at. */}
      <section className="px-6 md:px-10 py-20 md:py-24 border-t border-connection-primary/10 bg-white/40">
        <div className="max-w-5xl mx-auto grid lg:grid-cols-[1fr_minmax(0,26rem)] gap-12 lg:gap-20 items-start">
          <div className="lg:pt-3">
            <p className="text-[11px] uppercase tracking-[0.18em] text-connection-muted">
              One month
            </p>
            <p className="mt-6 font-playfair text-[1.7rem] sm:text-[2rem] leading-[1.25] text-connection-text text-balance">
              Kingsway used to be your second best source.
            </p>
            <p className="mt-5 text-connection-muted leading-relaxed max-w-md">
              Four patients a month, then two, then one. Nobody notices, because nobody is
              counting.
            </p>
          </div>

          <div>
            <SourceLedger />
            <p className="mt-4 text-xs text-connection-muted/80">An example month.</p>
          </div>
        </div>
      </section>

      {/* Breadth, without a paragraph about it. */}
      <section className="px-6 md:px-10 py-12 border-t border-connection-primary/10">
        {/* The separator dots are hidden where the row wraps, since a wrap can otherwise
            leave one stranded at the start of a line, reading as a bullet. */}
        <div className="max-w-5xl mx-auto flex flex-wrap items-center gap-x-5 sm:gap-x-4 gap-y-3 text-sm text-connection-muted">
          {SOLUTIONS.map((s, i) => (
            <React.Fragment key={s.n}>
              {i > 0 && <span className="hidden sm:block h-1 w-1 rounded-full bg-connection-primary/25" />}
              <span>{s.title}</span>
            </React.Fragment>
          ))}
          <button
            onClick={() => setTab('solutions')}
            className="group ml-auto inline-flex items-center gap-2 text-connection-text hover:text-connection-primary transition-colors"
          >
            All of it
            <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </button>
        </div>
      </section>
    </>
  );

  /**
   * Seven lines, one each. The numbers run down their own column so the titles and
   * the sentences both start on a rule of their own — the list reads as an index,
   * which is what it is.
   */
  const solutions = (
    <section className="px-6 py-16 md:py-24 animate-fade-in">
      <div className="max-w-2xl mx-auto">
        <p className="text-[11px] uppercase tracking-[0.18em] text-connection-muted mb-10">
          What it does
        </p>

        <dl className="border-t border-connection-primary/15">
          {SOLUTIONS.map((s) => (
            <div
              key={s.n}
              className="group grid grid-cols-[2.5rem_1fr] sm:grid-cols-[2.5rem_9rem_1fr] items-baseline gap-y-1.5 py-6 border-b border-connection-primary/15"
            >
              <span className="text-xs tabular-nums text-connection-muted/60 group-hover:text-connection-primary transition-colors">
                {s.n}
              </span>
              <dt className="text-[15px] font-medium text-connection-text">{s.title}</dt>
              <dd className="col-start-2 sm:col-start-3 text-sm leading-relaxed text-connection-muted">
                {s.body}
              </dd>
            </div>
          ))}
        </dl>

        <button
          onClick={onGetStarted}
          className="group mt-12 inline-flex items-center gap-2 text-[15px] text-connection-text hover:text-connection-primary transition-colors"
        >
          Start
          <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
        </button>
      </div>
    </section>
  );

  const pricing = (
    <section className="px-6 py-16 md:py-24 animate-fade-in">
      <div className="max-w-2xl mx-auto">
        <p className="text-[11px] uppercase tracking-[0.18em] text-connection-muted mb-10">
          Per month
        </p>

        <div className="border-t border-connection-primary/15">
          {plans.map((p) => (
            <button
              key={p.id}
              onClick={() => handlePlanSelect(p.id)}
              disabled={createCheckoutSession.isPending}
              className="group w-full flex items-baseline gap-4 py-6 text-left border-b border-connection-primary/15 transition-colors hover:bg-white/60 disabled:opacity-50"
            >
              <span className="text-[15px] font-medium text-connection-text w-16 shrink-0">{p.name}</span>
              <span className="text-sm text-connection-muted flex-1">{p.seats}</span>
              <span className="font-playfair text-2xl text-connection-text tabular-nums">${p.price}</span>
              <ArrowRight className="w-4 h-4 text-connection-primary opacity-0 group-hover:opacity-100 -translate-x-1 group-hover:translate-x-0 transition-all" />
            </button>
          ))}
        </div>

        <p className="mt-6 text-xs text-connection-muted">Cancel whenever.</p>
      </div>
    </section>
  );

  return (
    <div className="min-h-screen flex flex-col bg-gradient-connection">
      {header}

      {/* flex-1 in a min-h-screen column: on the short tabs main grows to hold the
          footer down, without pinning a height the long tabs would have to fill.
          Keyed so switching tabs remounts the panel and its fade actually plays. */}
      <main key={tab} className="flex-1">
        {tab === 'home' ? home : tab === 'solutions' ? solutions : pricing}
      </main>

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
