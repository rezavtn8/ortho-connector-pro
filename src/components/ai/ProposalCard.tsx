/**
 * A change the assistant is asking permission to make.
 *
 * The card is the whole safety model made visible. The model produced this; it did
 * not perform it, and it cannot. Everything a confirmation depends on is on the face
 * of the card — which offices, what it will create, and the explicit statement that
 * nothing is sent — because a confirmation the user cannot check is not consent, it
 * is a slower version of letting the model act on its own.
 *
 * The affirmative button says what will happen ("Create draft campaign"), never
 * "Confirm". A button labelled with its consequence is the last defence against a
 * user approving something they misread.
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  CalendarDays,
  Check,
  Loader2,
  Mail,
  Gift,
  FileText,
  ShieldCheck,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { ProposalRecord } from '@/lib/agentProtocol';

const METHOD_ICON = { email: Mail, letter: FileText, physical: Gift } as const;

export function ProposalCard({
  record,
  onAccept,
  onDismiss,
}: {
  record: ProposalRecord;
  onAccept: () => Promise<void>;
  onDismiss: () => void;
}) {
  const [working, setWorking] = useState(false);
  const { proposal, state } = record;

  const Icon =
    proposal.kind === 'visit' ? CalendarDays : METHOD_ICON[proposal.delivery_method] ?? Mail;

  const actionLabel =
    proposal.kind === 'visit'
      ? proposal.offices.length === 1
        ? 'Schedule this visit'
        : `Schedule ${proposal.offices.length} visits`
      : 'Create draft campaign';

  const handleAccept = async () => {
    setWorking(true);
    try {
      await onAccept();
    } finally {
      setWorking(false);
    }
  };

  return (
    <div
      className={cn(
        'mt-3 overflow-hidden rounded-xl border transition-colors',
        state === 'pending' && 'border-primary/30 bg-primary/[0.03]',
        state === 'accepted' && 'border-primary/20 bg-muted/30',
        state === 'dismissed' && 'border-border/60 bg-muted/20 opacity-70',
        state === 'failed' && 'border-destructive/40 bg-destructive/5',
      )}
    >
      <div className="flex items-start gap-3 p-4">
        <div
          className={cn(
            'mt-0.5 rounded-lg p-2',
            state === 'dismissed' ? 'bg-muted' : 'bg-primary/10',
          )}
        >
          <Icon
            className={cn(
              'h-4 w-4',
              state === 'dismissed' ? 'text-muted-foreground' : 'text-primary',
            )}
            aria-hidden
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-foreground">{proposal.title}</p>
            {state === 'pending' && (
              <Badge variant="outline" className="border-primary/30 text-[10px] text-primary">
                Needs your approval
              </Badge>
            )}
            {state === 'accepted' && (
              <Badge variant="outline" className="border-primary/30 text-[10px] text-primary">
                Created
              </Badge>
            )}
            {state === 'dismissed' && (
              <Badge variant="outline" className="text-[10px] text-muted-foreground">
                Dismissed
              </Badge>
            )}
          </div>

          {proposal.rationale && (
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
              {proposal.rationale}
            </p>
          )}

          <dl className="mt-3 grid gap-x-6 gap-y-1.5 text-xs sm:grid-cols-[auto_1fr]">
            <dt className="text-muted-foreground">
              {proposal.offices.length === 1 ? 'Office' : 'Offices'}
            </dt>
            <dd className="text-foreground">
              {proposal.offices.map((o) => o.name).join(', ')}
            </dd>

            {proposal.kind === 'visit' ? (
              <>
                <dt className="text-muted-foreground">Date</dt>
                <dd className="text-foreground">
                  {proposal.visit_date} · {proposal.visit_type}
                </dd>
              </>
            ) : (
              <>
                <dt className="text-muted-foreground">Type</dt>
                <dd className="capitalize text-foreground">
                  {proposal.delivery_method} · {proposal.campaign_type}
                </dd>
              </>
            )}

            {proposal.notes && (
              <>
                <dt className="text-muted-foreground">Notes</dt>
                <dd className="text-foreground">{proposal.notes}</dd>
              </>
            )}
          </dl>

          {state === 'pending' && (
            <>
              {/* Stated on every card, not just campaign ones. The fear that stops
                  people using an assistant near their client relationships is that it
                  might have already contacted someone. */}
              <p className="mt-3 flex items-start gap-1.5 text-xs text-muted-foreground">
                <ShieldCheck className="mt-px h-3.5 w-3.5 shrink-0 text-primary/70" aria-hidden />
                <span>
                  Nothing has been created or sent.
                  {proposal.kind === 'campaign' &&
                    ' Accepting saves a draft — you still send it yourself.'}
                </span>
              </p>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button size="sm" onClick={handleAccept} disabled={working}>
                  {working ? (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden />
                  ) : (
                    <Check className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                  )}
                  {actionLabel}
                </Button>
                <Button size="sm" variant="ghost" onClick={onDismiss} disabled={working}>
                  <X className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                  Dismiss
                </Button>
              </div>
            </>
          )}

          {state === 'accepted' && record.resultHref && (
            <Button asChild size="sm" variant="outline" className="mt-3">
              <Link to={record.resultHref}>
                Open it
                <ArrowRight className="ml-1.5 h-3.5 w-3.5" aria-hidden />
              </Link>
            </Button>
          )}

          {state === 'failed' && (
            <p className="mt-3 text-xs text-destructive">
              {record.error ?? 'That could not be created.'}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
