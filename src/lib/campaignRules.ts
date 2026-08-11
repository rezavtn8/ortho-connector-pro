/**
 * Campaign domain rules — pure, side-effect free, and safe to unit test.
 *
 * Everything here was previously duplicated (and drifting) across seven components:
 * status casing, per-method progress, and gift-bundle cost. `campaigns.ts` holds the
 * database side and re-exports this module, so importers only need one path.
 */

import { FileText, Gift, Mail, type LucideIcon } from 'lucide-react';
import { startOfDay } from 'date-fns';
import { now } from '@/lib/dateSync';

export type DeliveryMethod = 'email' | 'letter' | 'physical';
export const DELIVERY_METHODS: DeliveryMethod[] = ['email', 'letter', 'physical'];

/**
 * Statuses are free-form `text` in Postgres and older rows carry every casing
 * (`draft`, `Draft`, `active`…). Compare through `normalizeStatus`, never directly.
 */
export type CampaignStatus = 'Draft' | 'Active' | 'Completed';
export const CAMPAIGN_STATUSES: CampaignStatus[] = ['Draft', 'Active', 'Completed'];

export function normalizeStatus(raw: string | null | undefined): CampaignStatus {
  switch ((raw ?? '').trim().toLowerCase()) {
    case 'active':
    case 'in progress':
    case 'in_progress':
      return 'Active';
    case 'completed':
    case 'complete':
    case 'done':
      return 'Completed';
    default:
      return 'Draft';
  }
}

export function normalizeMethod(raw: string | null | undefined): DeliveryMethod {
  const v = (raw ?? '').trim().toLowerCase();
  if (v === 'email') return 'email';
  if (v === 'letter') return 'letter';
  return 'physical';
}

interface MethodMeta {
  label: string;
  /** What the creator produces, singular. */
  noun: string;
  icon: LucideIcon;
  /** Button copy on a card / detail dialog. */
  action: string;
  /** Past-tense word for a completed delivery — "sent", "drafted", "delivered". */
  doneVerb: string;
  /** Tailwind classes for the icon chip. */
  chip: string;
  /** Tailwind classes for a solid accent (progress bar, board column rail). */
  accent: string;
  /** Foreground-only accent, for text and outline badges. */
  text: string;
}

export const METHOD_META: Record<DeliveryMethod, MethodMeta> = {
  email: {
    label: 'Email',
    noun: 'email',
    icon: Mail,
    action: 'Draft & send emails',
    doneVerb: 'sent',
    chip: 'bg-primary/10 text-primary',
    accent: 'bg-primary',
    text: 'text-primary',
  },
  letter: {
    label: 'Letter',
    noun: 'letter',
    icon: FileText,
    action: 'Write & print letters',
    doneVerb: 'drafted',
    chip: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
    accent: 'bg-sky-500',
    text: 'text-sky-600 dark:text-sky-400',
  },
  physical: {
    label: 'Gift',
    noun: 'gift',
    icon: Gift,
    action: 'Track deliveries',
    doneVerb: 'delivered',
    chip: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    accent: 'bg-amber-500',
    text: 'text-amber-600 dark:text-amber-400',
  },
};

/** Aggregate of a campaign's `campaign_deliveries` rows. */
export interface DeliveryStats {
  total: number;
  /** Email/letter body written (`email_status` is `ready` or `sent`). */
  drafted: number;
  sent: number;
  delivered: number;
  failed: number;
  /** Referral tier → office count, for the tier mix bar. */
  tiers: Record<string, number>;
  /** Offices in this campaign — powers the network-coverage figure. */
  officeIds: string[];
}

export const EMPTY_STATS: DeliveryStats = {
  total: 0,
  drafted: 0,
  sent: 0,
  delivered: 0,
  failed: 0,
  tiers: {},
  officeIds: [],
};

export interface DeliveryRow {
  campaign_id: string;
  office_id: string;
  referral_tier: string | null;
  email_status: string | null;
  gift_status: string | null;
}

export function aggregateDeliveries(rows: DeliveryRow[]): Map<string, DeliveryStats> {
  const byCampaign = new Map<string, DeliveryStats>();

  for (const row of rows) {
    let stats = byCampaign.get(row.campaign_id);
    if (!stats) {
      stats = { total: 0, drafted: 0, sent: 0, delivered: 0, failed: 0, tiers: {}, officeIds: [] };
      byCampaign.set(row.campaign_id, stats);
    }

    stats.total++;
    stats.officeIds.push(row.office_id);
    const email = (row.email_status ?? '').toLowerCase();
    const gift = (row.gift_status ?? '').toLowerCase();
    if (email === 'ready' || email === 'sent') stats.drafted++;
    if (email === 'sent') stats.sent++;
    if (gift === 'delivered') stats.delivered++;
    if (gift === 'failed') stats.failed++;
    if (row.referral_tier) {
      stats.tiers[row.referral_tier] = (stats.tiers[row.referral_tier] || 0) + 1;
    }
  }

  return byCampaign;
}

export interface Progress {
  done: number;
  total: number;
  /** 0–100, rounded. 0 when the campaign has no offices. */
  pct: number;
  /** "12 of 30 sent" */
  label: string;
}

/**
 * Completion means something different per method: an email is done when it is sent,
 * a letter when its body exists (printing happens outside the app), a gift when it is
 * handed over. The old card read `delivered_count` for every method, so letter and
 * email campaigns sat at 0% forever.
 */
export function progressFor(method: DeliveryMethod, stats: DeliveryStats): Progress {
  const done =
    method === 'email' ? stats.sent : method === 'letter' ? stats.drafted : stats.delivered;
  const total = stats.total;
  return {
    done,
    total,
    pct: total ? Math.round((done / total) * 100) : 0,
    label: total
      ? `${done} of ${total} ${METHOD_META[method].doneVerb}`
      : 'No offices selected',
  };
}

export type AttentionLevel = 'empty' | 'overdue' | 'stalled' | 'closeable';

export interface Attention {
  level: AttentionLevel;
  headline: string;
  detail: string;
}

/** Severity order — the queue at the top of the page sorts by this. */
const ATTENTION_RANK: Record<AttentionLevel, number> = {
  overdue: 0,
  empty: 1,
  stalled: 2,
  closeable: 3,
};

export function attentionRank(level: AttentionLevel): number {
  return ATTENTION_RANK[level];
}

/**
 * The one judgement call on the page: which campaigns are actually asking for work.
 * Returns `null` for a campaign that is on track or already closed.
 */
export function attentionFor(
  campaign: { status: string; planned_delivery_date: string | null; created_at: string },
  method: DeliveryMethod,
  stats: DeliveryStats,
  today: Date = startOfDay(now()),
): Attention | null {
  const status = normalizeStatus(campaign.status);
  const progress = progressFor(method, stats);

  // A closed campaign is finished business, even if it was a dud.
  if (status === 'Completed') return null;

  if (stats.total === 0) {
    return {
      level: 'empty',
      headline: 'No offices attached',
      detail: 'This campaign has nothing to send. Duplicate it or delete it.',
    };
  }

  // Only nag about closing a campaign that was actually put in the field — a draft
  // sitting at 100% has simply had all its material prepared.
  if (progress.pct === 100 && status === 'Active') {
    return {
      level: 'closeable',
      headline: `All ${progress.total} ${METHOD_META[method].doneVerb}`,
      detail: 'Ready to mark completed.',
    };
  }

  const planned = campaign.planned_delivery_date
    ? startOfDay(new Date(`${campaign.planned_delivery_date}T00:00:00`))
    : null;

  if (planned && planned < today) {
    const days = Math.round((today.getTime() - planned.getTime()) / 86_400_000);
    return {
      level: 'overdue',
      headline: `${days} day${days === 1 ? '' : 's'} past its send date`,
      detail: `${progress.total - progress.done} of ${progress.total} still outstanding.`,
    };
  }

  if (status === 'Active' && progress.done === 0) {
    return {
      level: 'stalled',
      headline: 'Active but nothing has gone out',
      detail: `${progress.total} offices are waiting on the first ${METHOD_META[method].noun}.`,
    };
  }

  return null;
}

/** Per-gift cost, tolerating both key spellings written by past versions. */
export function bundleCost(bundle: any): number {
  if (!bundle) return 0;
  const value = bundle.estimatedCost ?? bundle.estimated_cost ?? bundle.cost;
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

/**
 * Columns that may be copied from one campaign row into an insert.
 *
 * The old duplicate action spread the whole in-memory object, which by then carried
 * the derived `office_count` / `sent_count` fields the list query bolts on — PostgREST
 * rejected every insert with "column not found", so duplication never once worked.
 */
const COPYABLE_COLUMNS = [
  'name',
  'campaign_type',
  'delivery_method',
  'planned_delivery_date',
  'notes',
  'campaign_mode',
  'selected_gift_bundle',
  'estimated_cost',
  'materials_checklist',
  'assigned_rep_id',
  'clinic_id',
] as const;

export function copyableCampaignFields(source: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {};
  for (const key of COPYABLE_COLUMNS) {
    if (source[key] !== undefined) out[key] = source[key];
  }
  return out;
}

