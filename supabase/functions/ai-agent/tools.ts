/**
 * What the assistant is allowed to do.
 *
 * TWO KINDS OF TOOL, AND THE LINE BETWEEN THEM
 *
 * Read tools run queries and return facts. Action tools return a *proposal* — a
 * structured description of a change — and write nothing. The client renders the
 * proposal as a card, the user presses a button, and the client performs the write
 * through the same code path the rest of the app uses.
 *
 * So the model cannot create a campaign, log a visit, or email anyone. It can only
 * ask. That is not a limitation to be engineered away later: a model that emails a
 * referring dentist on a misread of its own tool output damages the exact
 * relationships this product exists to protect, and no amount of prompt care makes
 * that risk worth taking. The confirmation step is the product.
 *
 * Every query runs through a Supabase client carrying the caller's JWT, so row level
 * security is what actually bounds the data — not the filters written here. A bug in
 * a filter below leaks nothing across accounts.
 */

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import {
  buildMonthlySeries,
  computeMomentum,
  deriveOfficeMetrics,
  monthKey,
  shiftMonth,
  type FlowTier,
  type MonthlyRow,
  type MonthlySeries,
  type OfficeMetrics,
} from '../_shared/referral.ts';

/** How many rows any single tool may return. Keeps a reply inside the context budget. */
const MAX_ROWS = 40;

/** Months of history a per-office answer carries. Matches the product's L12 promise. */
const HISTORY_MONTHS = 12;

export interface ToolResult {
  /** Serialised back to the model. */
  data: unknown;
  /** One line shown in the UI's tool trace, so the user sees what was consulted. */
  summary: string;
  /** Present only for action tools. Streamed to the client as a confirmation card. */
  proposal?: Proposal;
}

export type Proposal =
  | {
      kind: 'visit';
      title: string;
      rationale: string;
      offices: Array<{ id: string; name: string }>;
      visit_date: string;
      visit_type: string;
      notes: string;
    }
  | {
      kind: 'campaign';
      title: string;
      rationale: string;
      offices: Array<{ id: string; name: string }>;
      name: string;
      campaign_type: string;
      delivery_method: 'email' | 'letter' | 'physical';
      notes: string;
    };

type Office = { id: string; name: string } & Record<string, unknown> & OfficeMetrics;

/**
 * Sources, monthly counts and derived tiers, loaded once and reused by every tool in
 * a turn. A single question routinely triggers three or four tool calls; without this
 * each one would re-read the whole network.
 */
class Network {
  private loaded: Promise<{ offices: Office[]; series: MonthlySeries }> | null = null;

  constructor(
    private readonly db: SupabaseClient,
    private readonly userId: string,
    private readonly now: Date,
  ) {}

  load() {
    if (!this.loaded) this.loaded = this.read();
    return this.loaded;
  }

  private async read() {
    const since = shiftMonth(monthKey(this.now), -(HISTORY_MONTHS + 6));
    const [sourcesRes, monthlyRes] = await Promise.all([
      this.db
        .from('patient_sources')
        .select('id, name, source_type, address, phone, email, website, notes, is_active, google_rating, distance_miles')
        .eq('created_by', this.userId),
      this.db
        .from('monthly_patients')
        .select('source_id, year_month, patient_count')
        .eq('user_id', this.userId)
        .gte('year_month', since),
    ]);

    if (sourcesRes.error) throw new Error(`Could not read offices: ${sourcesRes.error.message}`);
    if (monthlyRes.error) throw new Error(`Could not read referrals: ${monthlyRes.error.message}`);

    const series = buildMonthlySeries((monthlyRes.data ?? []) as MonthlyRow[]);
    const offices = deriveOfficeMetrics(
      (sourcesRes.data ?? []) as Array<{ id: string; name: string }>,
      series,
      this.now,
    ) as Office[];

    return { offices, series };
  }

  /** Momentum is read at the last completed month; see `buildBriefing` for why. */
  referenceMonth(): string {
    return shiftMonth(monthKey(this.now), -1);
  }

  monthlyFor(series: MonthlySeries, id: string): Record<string, number> {
    return Object.fromEntries(series.get(id) ?? new Map());
  }
}

/**
 * Resolve a name the user typed to an office on record.
 *
 * Users say "Westside" for "Westside Family Dental" and "Dr Kim" for "Kim
 * Orthodontics, PC". Exact match first, then prefix, then substring, then a loose
 * token overlap. Returning several candidates rather than guessing is deliberate:
 * the model is told to ask which one, and an assistant that reports the wrong
 * office's decline is worse than one that asks a clarifying question.
 */
function matchOffices(offices: Office[], query: string): Office[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const norm = (s: string) => s.toLowerCase().replace(/[.,'’]/g, '');
  const nq = norm(q);

  const exact = offices.filter((o) => norm(o.name) === nq);
  if (exact.length) return exact;

  const prefix = offices.filter((o) => norm(o.name).startsWith(nq));
  if (prefix.length) return prefix;

  const substring = offices.filter((o) => norm(o.name).includes(nq));
  if (substring.length) return substring;

  // Drop honorifics and legal suffixes before comparing words — they match everything
  // and would rank every "Dr." in the network as an equally good candidate.
  const NOISE = new Set(['dr', 'doctor', 'dds', 'dmd', 'pc', 'llc', 'inc', 'the', 'and', 'of']);
  const tokens = nq.split(/\s+/).filter((t) => t.length > 1 && !NOISE.has(t));
  if (!tokens.length) return [];

  return offices
    .map((o) => {
      const words = norm(o.name).split(/\s+/);
      const hits = tokens.filter((t) => words.some((w) => w.startsWith(t))).length;
      return { office: o, hits };
    })
    .filter((m) => m.hits > 0)
    .sort((a, b) => b.hits - a.hits || b.office.l12 - a.office.l12)
    .slice(0, 5)
    .map((m) => m.office);
}

/** The shape every office-returning tool uses, so the model sees one vocabulary. */
function officeRow(office: Office, series: MonthlySeries, refMonth: string) {
  const monthly = Object.fromEntries(series.get(office.id) ?? new Map());
  const reading = computeMomentum(monthly, refMonth);
  return {
    id: office.id,
    name: office.name,
    tier: office.tier,
    patients_last_12_months: office.l12,
    patients_last_3_months: office.r3,
    months_since_last_referral: office.mslr >= 999 ? null : office.mslr,
    momentum: reading.momentum,
    per_month_now: Math.round((reading.recent / 3) * 10) / 10,
    per_month_before: Math.round((reading.baseline / 3) * 10) / 10,
  };
}

function plural(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}

/** ISO date `n` days from now, for proposal defaults. */
function isoDate(now: Date, offsetDays = 0): string {
  const d = new Date(now.getTime() + offsetDays * 86400000);
  return d.toISOString().slice(0, 10);
}

/**
 * The JSON Schema the model sees. Descriptions here are load-bearing — they are the
 * only place the model learns what `momentum` means or that `quiet` outranks
 * `slipping`, so they are written for a reader who has never seen this codebase.
 */
export const TOOL_SCHEMAS = [
  {
    type: 'function',
    function: {
      name: 'list_offices',
      description:
        'List referring offices with their referral volume, tier and momentum. Use this for any question about groups of offices — who is declining, who is biggest, who has gone quiet. Prefer this over asking the user.',
      parameters: {
        type: 'object',
        properties: {
          tier: {
            type: 'string',
            enum: ['VIP', 'Warm', 'Cold', 'Dormant'],
            description:
              'Tiers are relative, not absolute: active offices are ranked by lifetime referrals and split into quartiles (top 25% VIP, next 25% Warm, rest Cold). Dormant means no referrals for 6+ months.',
          },
          momentum: {
            type: 'string',
            enum: ['quiet', 'slipping', 'steady', 'rising', 'new'],
            description:
              'Direction against the office\'s own past 3 months vs the 3 before. "quiet" = was referring, now zero. "slipping" = down 25%+. "rising" = up 25%+. "new" = no baseline, referring now.',
          },
          sort: {
            type: 'string',
            enum: ['volume', 'decline', 'growth', 'recency'],
            description:
              'volume = most patients first. decline = biggest per-month loss first. growth = biggest gain first. recency = longest since a referral first.',
          },
          limit: { type: 'integer', description: `Default 10, max ${MAX_ROWS}.` },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_office',
      description:
        'Full detail for one referring office by name: month-by-month referral history, momentum, contact details, recent visits. Use whenever the user names a specific office. Name matching is fuzzy, so pass the name as the user said it.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'The office name as the user wrote it.' },
        },
        required: ['name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'referral_trend',
      description:
        'Practice-wide patient volume month by month. Use for questions about overall growth, seasonality or totals — not for per-office questions.',
      parameters: {
        type: 'object',
        properties: {
          months: { type: 'integer', description: 'How many months back. Default 12, max 24.' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_visits',
      description:
        'Marketing visits already logged, most recent first. Use to answer when an office was last seen, or what was discussed.',
      parameters: {
        type: 'object',
        properties: {
          office_name: { type: 'string', description: 'Restrict to one office. Fuzzy matched.' },
          days: { type: 'integer', description: 'Only visits within this many days. Default 180.' },
          limit: { type: 'integer', description: `Default 20, max ${MAX_ROWS}.` },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_reviews',
      description:
        'Google reviews for the practice, newest first, with whether each has been replied to.',
      parameters: {
        type: 'object',
        properties: {
          needs_reply_only: { type: 'boolean', description: 'Default true.' },
          limit: { type: 'integer', description: `Default 10, max ${MAX_ROWS}.` },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_campaigns',
      description:
        'Outreach campaigns with recipient counts and delivery progress. Use before proposing a new campaign, so you do not duplicate one already running.',
      parameters: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['Draft', 'Active', 'Completed'] },
          limit: { type: 'integer', description: `Default 15, max ${MAX_ROWS}.` },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'propose_visit',
      description:
        'Propose logging a marketing visit. This does NOT create anything — it shows the user a card they can accept or dismiss. Call it only when the user has asked for an action, and only after you have checked the office with get_office. Say in your reply that you have put a proposal up for them to confirm.',
      parameters: {
        type: 'object',
        properties: {
          office_names: {
            type: 'array',
            items: { type: 'string' },
            description: 'One or more offices to visit. Fuzzy matched.',
          },
          visit_date: { type: 'string', description: 'YYYY-MM-DD. Defaults to a week out.' },
          visit_type: {
            type: 'string',
            description: 'e.g. "Drop-by", "Lunch", "Check-in". Short.',
          },
          rationale: {
            type: 'string',
            description:
              'Why this visit, citing the numbers you found. Shown on the card above the button.',
          },
          notes: { type: 'string', description: 'What to raise on the visit. One or two lines.' },
        },
        required: ['office_names', 'rationale'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'propose_campaign',
      description:
        'Propose an outreach campaign to a set of offices. This does NOT create or send anything — it shows the user a card they can accept, which opens the campaign already filled in. Check list_campaigns first so you do not duplicate existing outreach.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Short campaign name the user will see.' },
          office_names: {
            type: 'array',
            items: { type: 'string' },
            description: 'Recipients. Fuzzy matched against the referral network.',
          },
          delivery_method: {
            type: 'string',
            enum: ['email', 'letter', 'physical'],
            description: '"physical" means a gift or dropped-off item.',
          },
          rationale: {
            type: 'string',
            description: 'Why these offices and why now, citing the numbers you found.',
          },
          notes: { type: 'string', description: 'What the message should get across.' },
        },
        required: ['name', 'office_names', 'delivery_method', 'rationale'],
      },
    },
  },
] as const;

export const READ_ONLY_TOOLS = new Set([
  'list_offices',
  'get_office',
  'referral_trend',
  'list_visits',
  'list_reviews',
  'list_campaigns',
]);

function clamp(n: unknown, fallback: number, max: number): number {
  const v = typeof n === 'number' && Number.isFinite(n) ? Math.floor(n) : fallback;
  return Math.max(1, Math.min(max, v));
}

/**
 * Run one tool call. Throws only on genuine failure; "found nothing" is a normal
 * result the model must be able to read and report honestly.
 */
export async function runTool(
  name: string,
  args: Record<string, unknown>,
  ctx: { db: SupabaseClient; userId: string; now: Date; network: Network },
): Promise<ToolResult> {
  const { db, userId, now, network } = ctx;

  switch (name) {
    case 'list_offices': {
      const { offices, series } = await network.load();
      const refMonth = network.referenceMonth();
      const limit = clamp(args.limit, 10, MAX_ROWS);

      let rows = offices.map((o) => ({ office: o, row: officeRow(o, series, refMonth) }));

      if (typeof args.tier === 'string') {
        rows = rows.filter((r) => r.office.tier === (args.tier as FlowTier));
      }
      if (typeof args.momentum === 'string') {
        rows = rows.filter((r) => r.row.momentum === args.momentum);
      }

      const sort = typeof args.sort === 'string' ? args.sort : 'volume';
      rows.sort((a, b) => {
        switch (sort) {
          case 'decline':
            return b.row.per_month_before - b.row.per_month_now - (a.row.per_month_before - a.row.per_month_now);
          case 'growth':
            return b.row.per_month_now - b.row.per_month_before - (a.row.per_month_now - a.row.per_month_before);
          case 'recency':
            return (b.row.months_since_last_referral ?? 999) - (a.row.months_since_last_referral ?? 999);
          default:
            return b.row.patients_last_12_months - a.row.patients_last_12_months;
        }
      });

      const out = rows.slice(0, limit).map((r) => r.row);
      return {
        data: { matched: rows.length, returned: out.length, offices: out },
        summary:
          `Read ${plural(rows.length, 'office')}` +
          (args.tier ? ` · ${args.tier}` : '') +
          (args.momentum ? ` · ${args.momentum}` : ''),
      };
    }

    case 'get_office': {
      const { offices, series } = await network.load();
      const refMonth = network.referenceMonth();
      const matches = matchOffices(offices, String(args.name ?? ''));

      if (matches.length === 0) {
        return {
          data: {
            found: false,
            message: `No office on record matches "${args.name}". Do not guess — tell the user it is not in their network and offer to look under a different name.`,
          },
          summary: `No match for "${args.name}"`,
        };
      }

      // Several plausible matches: hand them all back and let the model ask, rather
      // than silently reporting on whichever sorted first.
      if (matches.length > 1) {
        return {
          data: {
            found: true,
            ambiguous: true,
            message: 'Several offices match. Ask the user which one before answering.',
            candidates: matches.map((o) => officeRow(o, series, refMonth)),
          },
          summary: `${matches.length} offices match "${args.name}"`,
        };
      }

      const office = matches[0];
      const monthly = network.monthlyFor(series, office.id);
      const history: Array<{ month: string; patients: number }> = [];
      for (let i = HISTORY_MONTHS - 1; i >= 0; i--) {
        const m = shiftMonth(monthKey(now), -i);
        history.push({ month: m, patients: monthly[m] ?? 0 });
      }

      const [visitsRes, contactsRes] = await Promise.all([
        db
          .from('marketing_visits')
          .select('visit_date, visit_type, contact_person, star_rating, follow_up_notes, visited')
          .eq('user_id', userId)
          .eq('office_id', office.id)
          .order('visit_date', { ascending: false })
          .limit(5),
        db
          .from('office_contacts')
          .select('name, role, email, phone, is_primary')
          .eq('user_id', userId)
          .eq('office_id', office.id)
          .order('is_primary', { ascending: false })
          .limit(5),
      ]);

      return {
        data: {
          found: true,
          ...officeRow(office, series, refMonth),
          source_type: office.source_type ?? null,
          address: office.address ?? null,
          phone: office.phone ?? null,
          email: office.email ?? null,
          notes: office.notes ?? null,
          lifetime_patients: office.totalReferrals,
          monthly_history: history,
          recent_visits: visitsRes.data ?? [],
          contacts: contactsRes.data ?? [],
        },
        summary: `Read ${office.name} — ${plural(office.l12, 'patient')} in 12 months`,
      };
    }

    case 'referral_trend': {
      const { series } = await network.load();
      const count = clamp(args.months, 12, 24);

      const totals: Record<string, number> = {};
      for (const byMonth of series.values()) {
        for (const [ym, n] of byMonth) totals[ym] = (totals[ym] ?? 0) + n;
      }

      const history: Array<{ month: string; patients: number }> = [];
      for (let i = count - 1; i >= 0; i--) {
        const m = shiftMonth(monthKey(now), -i);
        history.push({ month: m, patients: totals[m] ?? 0 });
      }

      // The current month is partial by definition. Flagging it stops the model
      // reporting an in-progress month as a crash, which it otherwise reliably does.
      return {
        data: {
          months: history,
          note: `The final month (${monthKey(now)}) is still in progress and is not comparable to the completed months before it.`,
        },
        summary: `Read ${plural(count, 'month')} of practice volume`,
      };
    }

    case 'list_visits': {
      const { offices } = await network.load();
      const limit = clamp(args.limit, 20, MAX_ROWS);
      const days = clamp(args.days, 180, 3650);
      const since = isoDate(now, -days);

      let q = db
        .from('marketing_visits')
        .select('office_id, visit_date, visit_type, rep_name, contact_person, star_rating, follow_up_notes, visited')
        .eq('user_id', userId)
        .gte('visit_date', since)
        .order('visit_date', { ascending: false })
        .limit(limit);

      if (typeof args.office_name === 'string' && args.office_name.trim()) {
        const matches = matchOffices(offices, args.office_name);
        if (matches.length === 0) {
          return {
            data: { found: false, message: `No office matches "${args.office_name}".` },
            summary: `No match for "${args.office_name}"`,
          };
        }
        q = q.in('office_id', matches.map((o) => o.id));
      }

      const { data, error } = await q;
      if (error) throw new Error(`Could not read visits: ${error.message}`);

      const names = new Map(offices.map((o) => [o.id, o.name]));
      const visits = (data ?? []).map((v: Record<string, unknown>) => ({
        office: names.get(v.office_id as string) ?? 'Unknown office',
        date: v.visit_date,
        type: v.visit_type,
        rep: v.rep_name,
        contact: v.contact_person,
        rating: v.star_rating,
        notes: v.follow_up_notes,
        completed: v.visited,
      }));

      return {
        data: { window_days: days, visits },
        summary: `Read ${plural(visits.length, 'visit')} in the last ${days} days`,
      };
    }

    case 'list_reviews': {
      const limit = clamp(args.limit, 10, MAX_ROWS);
      const needsReplyOnly = args.needs_reply_only !== false;

      const { data, error } = await db
        .from('google_reviews')
        .select('author_name, rating, review_text, posted_at, review_reply, needs_attention')
        .eq('user_id', userId)
        .order('posted_at', { ascending: false })
        // When filtering to unanswered, over-fetch and filter in memory: `review_reply`
        // is nullable text, so a `.is(null)` filter misses rows storing an empty string.
        .limit(needsReplyOnly ? MAX_ROWS : limit);

      if (error) throw new Error(`Could not read reviews: ${error.message}`);

      let rows = (data ?? []) as Array<Record<string, unknown>>;
      if (needsReplyOnly) {
        rows = rows.filter((r) => !String(r.review_reply ?? '').trim()).slice(0, limit);
      }

      return {
        data: {
          reviews: rows.map((r) => ({
            author: r.author_name,
            rating: r.rating,
            comment: r.review_text,
            date: r.posted_at,
            replied: Boolean(String(r.review_reply ?? '').trim()),
            flagged: r.needs_attention,
          })),
        },
        summary: `Read ${plural(rows.length, 'review')}${needsReplyOnly ? ' awaiting a reply' : ''}`,
      };
    }

    case 'list_campaigns': {
      const limit = clamp(args.limit, 15, MAX_ROWS);
      let q = db
        .from('campaigns')
        .select('id, name, campaign_type, status, created_at, notes')
        .eq('created_by', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (typeof args.status === 'string') q = q.ilike('status', args.status);

      const { data, error } = await q;
      if (error) throw new Error(`Could not read campaigns: ${error.message}`);

      const campaigns = (data ?? []) as Array<Record<string, unknown>>;
      const ids = campaigns.map((c) => c.id as string);

      // One grouped read rather than a query per campaign.
      const counts = new Map<string, { total: number; done: number }>();
      if (ids.length) {
        const { data: deliveries } = await db
          .from('campaign_deliveries')
          .select('campaign_id, email_sent_at, delivered_at')
          .in('campaign_id', ids);
        for (const d of (deliveries ?? []) as Array<Record<string, unknown>>) {
          const key = d.campaign_id as string;
          const entry = counts.get(key) ?? { total: 0, done: 0 };
          entry.total += 1;
          if (d.email_sent_at || d.delivered_at) entry.done += 1;
          counts.set(key, entry);
        }
      }

      return {
        data: {
          campaigns: campaigns.map((c) => ({
            name: c.name,
            type: c.campaign_type,
            status: c.status,
            created: c.created_at,
            recipients: counts.get(c.id as string)?.total ?? 0,
            reached: counts.get(c.id as string)?.done ?? 0,
          })),
        },
        summary: `Read ${plural(campaigns.length, 'campaign')}`,
      };
    }

    case 'propose_visit':
    case 'propose_campaign': {
      const { offices } = await network.load();
      const requested = Array.isArray(args.office_names) ? args.office_names.map(String) : [];

      const resolved: Array<{ id: string; name: string }> = [];
      const unresolved: string[] = [];
      for (const raw of requested) {
        // Only an unambiguous match may enter a proposal. A card offering to email
        // the wrong practice is the failure this whole design exists to prevent.
        const matches = matchOffices(offices, raw);
        if (matches.length === 1) resolved.push({ id: matches[0].id, name: matches[0].name });
        else unresolved.push(raw);
      }

      if (resolved.length === 0) {
        return {
          data: {
            proposed: false,
            message:
              unresolved.length > 0
                ? `Could not pin down ${unresolved.join(', ')} to a single office. Ask the user which they mean; do not propose anything yet.`
                : 'No offices were given, so there is nothing to propose.',
          },
          summary: 'Proposal not created — offices unresolved',
        };
      }

      const rationale = String(args.rationale ?? '').trim();
      const notes = String(args.notes ?? '').trim();

      const proposal: Proposal =
        name === 'propose_visit'
          ? {
              kind: 'visit',
              title:
                resolved.length === 1
                  ? `Log a visit to ${resolved[0].name}`
                  : `Log visits to ${plural(resolved.length, 'office')}`,
              rationale,
              offices: resolved,
              visit_date:
                typeof args.visit_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(args.visit_date)
                  ? args.visit_date
                  : isoDate(now, 7),
              visit_type: String(args.visit_type ?? 'Check-in').slice(0, 40),
              notes,
            }
          : {
              kind: 'campaign',
              title: `Create "${String(args.name ?? 'Outreach').slice(0, 60)}"`,
              rationale,
              offices: resolved,
              name: String(args.name ?? 'Outreach').slice(0, 60),
              campaign_type:
                args.delivery_method === 'physical'
                  ? 'Gift Drop'
                  : args.delivery_method === 'letter'
                    ? 'Letter'
                    : 'Email',
              delivery_method:
                args.delivery_method === 'physical'
                  ? 'physical'
                  : args.delivery_method === 'letter'
                    ? 'letter'
                    : 'email',
              notes,
            };

      return {
        proposal,
        data: {
          proposed: true,
          offices: resolved.map((o) => o.name),
          unresolved,
          message:
            `A confirmation card has been shown to the user for ${plural(resolved.length, 'office')}. Nothing has been created or sent. Tell them it is waiting for their approval.` +
            (unresolved.length
              ? ` These names could not be resolved and were left out: ${unresolved.join(', ')}.`
              : ''),
        },
        summary: `Proposed: ${proposal.title}`,
      };
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

export { Network };
