/**
 * What changed in the referral network, computed rather than generated.
 *
 * The assistant opens with this. Every line it shows is arithmetic over
 * `monthly_patients`, `marketing_visits` and `review_status` — there is no model in
 * this path, so there is nothing here to hallucinate. That is the point: the numbers
 * a practice would act on are the numbers it must be able to trust, and a language
 * model is the wrong instrument for producing them. The model's job starts one step
 * later, when someone asks *why* or *what should I do about it*.
 *
 * Ranked by patients per month at stake, not by recency or severity label. A VIP
 * shedding four a month outranks a Cold office that went to zero, because the first
 * is a quarter of revenue and the second is noise — and the product exists to catch
 * exactly the decline that stays near the top of every list while it dies.
 *
 * Deliberately pure: no React, no Supabase, no clock. `nowDate` is injected, which is
 * what makes every threshold in here testable.
 */

import {
  computeMomentum,
  monthKey,
  shiftMonth,
  type FlowTier,
  type Momentum,
  type MonthlySeries,
  type OfficeMetrics,
} from './officeMetrics';

export type SignalKind =
  | 'quiet'
  | 'slipping'
  | 'rising'
  | 'new'
  | 'visit_overdue'
  | 'reviews_unanswered'
  | 'no_entries';

/** Drives colour and icon only. Ordering is by `stake`, never by this. */
export type SignalTone = 'risk' | 'watch' | 'good' | 'todo';

export interface Signal {
  /** Stable across recomputes so React keys and dismissals survive a refetch. */
  id: string;
  kind: SignalKind;
  tone: SignalTone;
  /** One line, already formatted for display. Never a sentence fragment. */
  headline: string;
  /** The supporting arithmetic, spelled out so the user can check it. */
  detail: string;
  /**
   * Patients per month this signal is worth. The sort key, and the honest answer to
   * "why is this at the top". Zero for signals that are chores rather than money.
   */
  stake: number;
  officeId?: string;
  officeName?: string;
  /** Route to the thing the signal is about, for the primary action. */
  href?: string;
  /**
   * The question this signal would have you ask the assistant. Clicking a signal
   * sends this, which is what stops the briefing and the conversation from being two
   * disconnected products.
   */
  ask: string;
}

/** Only what the briefing reads. Keeps callers free to pass richer office rows. */
export type BriefingOffice = { id: string; name: string } & Pick<
  OfficeMetrics,
  'tier' | 'l12' | 'r3' | 'mslr' | 'totalReferrals' | 'lastActiveMonth'
>;

export interface BriefingInput {
  offices: readonly BriefingOffice[];
  series: MonthlySeries;
  /** officeId -> most recent visit date, ISO or `YYYY-MM-DD`. */
  lastVisitByOffice: ReadonlyMap<string, string>;
  reviewsUnanswered: number;
  /** Whether any patient was recorded in the current month. Drives `no_entries`. */
  entriesThisMonth: number;
  nowDate: Date;
}

export interface Briefing {
  signals: Signal[];
  /** Practice-level totals, so the header can state the base the signals move. */
  totals: {
    activeOffices: number;
    l12: number;
    r3: number;
    /** Patients per month being lost across every `quiet` and `slipping` office. */
    atRisk: number;
  };
}

/**
 * A relationship worth visiting should be seen about this often.
 *
 * Ninety days is one quarter — the same window the product promises to beat on
 * detection. An office that has not been seen in longer has, in practice, stopped
 * being a relationship and started being a name in a table.
 */
const VISIT_STALE_DAYS = 90;

/** Below this the arithmetic is real but the amount is not worth a line of attention. */
const MIN_STAKE = 0.5;

/** Tiers where a stale visit is worth surfacing. Cold and Dormant get campaigns, not visits. */
const VISIT_TIERS: readonly FlowTier[] = ['VIP', 'Warm'];

const MS_PER_DAY = 1000 * 60 * 60 * 24;

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** `3.5` -> `"3.5"`, `4` -> `"4"`. Trailing `.0` reads as false precision. */
function num(n: number): string {
  return String(round1(n));
}

function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

/**
 * Whole days between two dates, or null if the date is missing or unparseable.
 *
 * Bad date strings are treated as "never visited" by the caller rather than as zero
 * days ago — the failure mode of a silently-fresh visit is that a dying relationship
 * never surfaces, which is the one thing this module must not do.
 */
function daysSince(iso: string | undefined, nowDate: Date): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return null;
  return Math.floor((nowDate.getTime() - t) / MS_PER_DAY);
}

/** A per-office month map as a plain record, which is what `computeMomentum` takes. */
function monthlyRecord(series: MonthlySeries, officeId: string): Record<string, number> {
  const byMonth = series.get(officeId);
  if (!byMonth) return {};
  const out: Record<string, number> = {};
  for (const [ym, count] of byMonth) out[ym] = count;
  return out;
}

/**
 * Read the network and return what is worth saying about it, most valuable first.
 *
 * Momentum is evaluated at last *completed* month, not the current one. A month in
 * progress is always short against a full baseline, so reading it live would report
 * every office in the network as slipping on the first of each month — an alarm that
 * fires monthly regardless of the business is an alarm people learn to ignore.
 */
export function buildBriefing(input: BriefingInput): Briefing {
  const { offices, series, lastVisitByOffice, reviewsUnanswered, entriesThisMonth, nowDate } =
    input;

  const referenceMonth = shiftMonth(monthKey(nowDate), -1);
  const signals: Signal[] = [];
  let atRisk = 0;

  for (const office of offices) {
    const monthly = monthlyRecord(series, office.id);
    const reading = computeMomentum(monthly, referenceMonth);
    const { momentum, recent, baseline, perMonthDelta } = reading;

    const shared = {
      officeId: office.id,
      officeName: office.name,
      href: `/source/${office.id}`,
    };

    if (momentum === 'quiet' && perMonthDelta >= MIN_STAKE) {
      atRisk += perMonthDelta;
      signals.push({
        ...shared,
        id: `quiet:${office.id}`,
        kind: 'quiet',
        tone: 'risk',
        headline: `${office.name} has stopped referring`,
        detail:
          `Was ${num(baseline / 3)}/month, now zero for 3 months` +
          (office.mslr < 999 ? ` · last referral ${plural(office.mslr, 'month')} ago` : ''),
        stake: perMonthDelta,
        ask: `${office.name} has gone quiet — they were sending about ${num(baseline / 3)} patients a month and have sent none in three months. What likely happened, and what should I do about it?`,
      });
      continue;
    }

    if (momentum === 'slipping' && perMonthDelta >= MIN_STAKE) {
      atRisk += perMonthDelta;
      signals.push({
        ...shared,
        id: `slipping:${office.id}`,
        kind: 'slipping',
        tone: 'watch',
        headline: `${office.name} is slipping`,
        detail: `${num(baseline / 3)} → ${num(recent / 3)} per month · ${num(perMonthDelta)}/month lost`,
        stake: perMonthDelta,
        ask: `${office.name} has dropped from about ${num(baseline / 3)} patients a month to ${num(recent / 3)}. Show me their history and tell me whether this is a real decline or seasonal noise.`,
      });
      continue;
    }

    // Gains are ranked by the same yardstick, so a real win can outrank a small loss.
    // A briefing that only ever reports bad news gets read as a nag and then not read.
    if (momentum === 'rising' && -perMonthDelta >= MIN_STAKE) {
      signals.push({
        ...shared,
        id: `rising:${office.id}`,
        kind: 'rising',
        tone: 'good',
        headline: `${office.name} is sending more`,
        detail: `${num(baseline / 3)} → ${num(recent / 3)} per month · up ${num(-perMonthDelta)}/month`,
        stake: -perMonthDelta,
        ask: `${office.name} has grown from about ${num(baseline / 3)} to ${num(recent / 3)} patients a month. What changed, and how do I keep it going?`,
      });
      continue;
    }

    if (momentum === 'new' && recent >= 1) {
      signals.push({
        ...shared,
        id: `new:${office.id}`,
        kind: 'new',
        tone: 'good',
        headline: `${office.name} started referring`,
        detail: `First ${plural(recent, 'patient')} in the last 3 months`,
        stake: recent / 3,
        ask: `${office.name} has just started referring to us. How should I follow up to turn a first referral into a habit?`,
      });
    }
  }

  // Visits are a chore rather than a sum of money, so they carry zero stake and sort
  // below anything with patients attached — but only after the money has been read.
  const stale = offices
    .filter((o) => VISIT_TIERS.includes(o.tier) && o.l12 > 0)
    .map((o) => ({ office: o, days: daysSince(lastVisitByOffice.get(o.id), nowDate) }))
    .filter(({ days }) => days === null || days >= VISIT_STALE_DAYS)
    .sort((a, b) => b.office.l12 - a.office.l12);

  if (stale.length > 0) {
    const worst = stale[0];
    const others = stale.length - 1;
    signals.push({
      id: 'visit_overdue',
      kind: 'visit_overdue',
      tone: 'todo',
      headline:
        stale.length === 1
          ? `${worst.office.name} is overdue a visit`
          : `${plural(stale.length, 'office is', 'offices are')} overdue a visit`,
      detail:
        `${worst.office.name} — ${worst.days === null ? 'never visited' : `last seen ${plural(worst.days, 'day')} ago`}` +
        (others > 0 ? ` · and ${others} more` : ''),
      stake: 0,
      officeId: worst.office.id,
      officeName: worst.office.name,
      href: '/marketing-visits',
      ask: `Which of my VIP and Warm offices are overdue a visit, and in what order should I see them? Take referral volume into account, not just how long it has been.`,
    });
  }

  if (reviewsUnanswered > 0) {
    signals.push({
      id: 'reviews_unanswered',
      kind: 'reviews_unanswered',
      tone: 'todo',
      headline: `${plural(reviewsUnanswered, 'review')} awaiting a reply`,
      detail: 'Unanswered reviews stay visible to every patient searching for you',
      stake: 0,
      href: '/reviews',
      ask: `Which reviews still need a reply, and which should I answer first?`,
    });
  }

  // Last, and only when true: the briefing is worthless if the month has no data in
  // it, and saying so plainly is more useful than silently reporting on nothing.
  if (entriesThisMonth === 0) {
    signals.push({
      id: 'no_entries',
      kind: 'no_entries',
      tone: 'todo',
      headline: 'No patients recorded this month yet',
      detail: 'Trends below are read from last month and earlier',
      stake: 0,
      href: '/daily-patients',
      ask: `I have not logged any patients this month. What am I unable to see until I do?`,
    });
  }

  signals.sort((a, b) => b.stake - a.stake);

  const active = offices.filter((o) => o.tier !== 'Dormant');
  return {
    signals,
    totals: {
      activeOffices: active.length,
      l12: offices.reduce((sum, o) => sum + o.l12, 0),
      r3: offices.reduce((sum, o) => sum + o.r3, 0),
      atRisk: round1(atRisk),
    },
  };
}

/**
 * A one-paragraph plain-English reading of the briefing, for the opening message.
 *
 * Also computed, for the same reason the signals are. The assistant's first words to
 * a user should be the ones it is most certain about.
 */
export function summarizeBriefing(briefing: Briefing): string {
  const { signals, totals } = briefing;
  const risky = signals.filter((s) => s.tone === 'risk' || s.tone === 'watch');
  const good = signals.filter((s) => s.tone === 'good');

  if (totals.activeOffices === 0) {
    return 'There are no active referring offices on record yet. Once patients are attributed to sources for a couple of months, this is where the changes worth acting on will appear.';
  }

  const parts: string[] = [
    `${plural(totals.activeOffices, 'active referring office')} sent ${plural(totals.r3, 'patient')} in the last three months.`,
  ];

  if (risky.length > 0) {
    parts.push(
      `${plural(risky.length, 'relationship is', 'relationships are')} moving the wrong way, worth about ${num(totals.atRisk)} patients a month between them.`,
    );
  } else {
    parts.push('Nothing is currently declining enough to be worth flagging.');
  }

  if (good.length > 0) {
    parts.push(`${plural(good.length, 'is', 'are')} moving the right way.`);
  }

  return parts.join(' ');
}

/** Momentum → tone, exported so the rail and the agent's tool output agree on colour. */
export function momentumTone(momentum: Momentum): SignalTone {
  switch (momentum) {
    case 'quiet':
      return 'risk';
    case 'slipping':
      return 'watch';
    case 'rising':
    case 'new':
      return 'good';
    default:
      return 'todo';
  }
}
