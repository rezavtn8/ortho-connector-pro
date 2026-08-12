/**
 * The conversation column: opening state, message list, composer.
 *
 * Two departures from the chat this replaces.
 *
 * The assistant speaks first, and what it says is the computed briefing — so the user
 * arrives at an answer rather than at a prompt they have to invent. And there are no
 * chat bubbles: the user's turn is a short right-aligned line, the assistant's is
 * plain text on the page. Bubbles are for messaging between people. This is a
 * document being written to you, and reading a table inside a rounded blue lozenge is
 * worse than reading it on the page.
 */

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ArrowUp, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { AssistantMarkdown } from './AssistantMarkdown';
import { ProposalCard } from './ProposalCard';
import { ToolTraceStrip } from './ToolTraceStrip';
import { cn } from '@/lib/utils';
import type { AgentMessage, ProposalRecord } from '@/lib/agentProtocol';

interface ConversationProps {
  messages: AgentMessage[];
  streaming: boolean;
  /** Computed opening line, shown above the first turn. */
  summary: string;
  briefingLoading: boolean;
  starters: string[];
  onSend: (text: string) => void;
  onStop: () => void;
  onAcceptProposal: (messageId: string, record: ProposalRecord) => Promise<void>;
  onDismissProposal: (messageId: string, record: ProposalRecord) => void;
}

export function Conversation({
  messages,
  streaming,
  summary,
  briefingLoading,
  starters,
  onSend,
  onStop,
  onAcceptProposal,
  onDismissProposal,
}: ConversationProps) {
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const pinnedRef = useRef(true);

  // Follow the stream only while the user is already at the bottom. Yanking them back
  // down mid-scroll makes a long answer impossible to read as it arrives.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      pinnedRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  useLayoutEffect(() => {
    if (!pinnedRef.current) return;
    const end = endRef.current;
    // Guarded because this runs inside a layout effect: anything that throws here
    // unmounts the page behind the error boundary, so a missing scroll primitive
    // would cost the entire assistant rather than just the auto-scroll.
    if (typeof end?.scrollIntoView === 'function') end.scrollIntoView({ block: 'end' });
  }, [messages]);

  const submit = () => {
    const text = input.trim();
    if (!text || streaming) return;
    setInput('');
    pinnedRef.current = true;
    onSend(text);
  };

  return (
    <div className="flex h-full flex-col">
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-5 sm:px-6">
        <div className="mx-auto max-w-3xl space-y-6">
          <Opening
            summary={summary}
            loading={briefingLoading}
            starters={starters}
            show={messages.length === 0}
            onPick={(q) => {
              pinnedRef.current = true;
              onSend(q);
            }}
          />

          {messages.map((message, index) =>
            message.role === 'user' ? (
              <div key={message.id} className="flex justify-end">
                <p className="max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-3.5 py-2 text-sm text-primary-foreground">
                  {message.content}
                </p>
              </div>
            ) : (
              <AssistantTurn
                key={message.id}
                message={message}
                streaming={streaming && index === messages.length - 1}
                onAcceptProposal={onAcceptProposal}
                onDismissProposal={onDismissProposal}
              />
            ),
          )}
          <div ref={endRef} />
        </div>
      </div>

      <div className="border-t border-border/60 bg-background/80 px-4 py-3 backdrop-blur sm:px-6">
        <div className="mx-auto max-w-3xl">
          <div
            className={cn(
              'flex items-end gap-2 rounded-xl border bg-card px-3 py-2 transition-colors',
              'border-border/70 focus-within:border-primary/50',
            )}
          >
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                // Enter sends, Shift+Enter breaks the line. Most turns are one line,
                // and reaching for a button every time is friction the whole surface
                // is meant to remove.
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
              }}
              rows={1}
              placeholder="Ask about an office, a trend, or what to do next…"
              className={cn(
                'max-h-40 min-h-0 resize-none border-0 bg-transparent p-0 text-sm shadow-none',
                'focus-visible:ring-0 focus-visible:ring-offset-0',
              )}
            />
            {streaming ? (
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 shrink-0"
                onClick={onStop}
                aria-label="Stop generating"
              >
                <Square className="h-3.5 w-3.5 fill-current" aria-hidden />
              </Button>
            ) : (
              <Button
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={submit}
                disabled={!input.trim()}
                aria-label="Send"
              >
                <ArrowUp className="h-4 w-4" aria-hidden />
              </Button>
            )}
          </div>
          <p className="mt-1.5 px-1 text-[11px] text-muted-foreground">
            Reads your referral data. It can propose actions, but nothing is created or sent
            without your approval.
          </p>
        </div>
      </div>
    </div>
  );
}

function Opening({
  summary,
  loading,
  starters,
  show,
  onPick,
}: {
  summary: string;
  loading: boolean;
  starters: string[];
  show: boolean;
  onPick: (q: string) => void;
}) {
  if (!show) return null;

  return (
    <div className="pt-2">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Your network right now
      </p>
      {loading ? (
        <div className="mt-2 space-y-2">
          <div className="h-4 w-full animate-pulse rounded bg-muted" />
          <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
        </div>
      ) : (
        <p className="mt-2 text-[15px] leading-relaxed text-foreground">{summary}</p>
      )}

      {starters.length > 0 && (
        <div className="mt-5 flex flex-wrap gap-2">
          {starters.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => onPick(q)}
              className={cn(
                'rounded-full border border-border/70 px-3 py-1.5 text-xs text-muted-foreground',
                'transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-foreground',
              )}
            >
              {q}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function AssistantTurn({
  message,
  streaming,
  onAcceptProposal,
  onDismissProposal,
}: {
  message: AgentMessage;
  streaming: boolean;
  onAcceptProposal: ConversationProps['onAcceptProposal'];
  onDismissProposal: ConversationProps['onDismissProposal'];
}) {
  const traces = message.traces ?? [];
  const proposals = message.proposals ?? [];
  const empty = !message.content && !message.error;

  return (
    <div>
      <ToolTraceStrip traces={traces} running={streaming} />

      {message.content && <AssistantMarkdown>{message.content}</AssistantMarkdown>}

      {/* Only before any text or tool call has landed — once either is on screen the
          user can see progress and a second indicator is noise. */}
      {empty && traces.length === 0 && streaming && (
        <div className="flex items-center gap-1.5" aria-label="Working">
          {[0, 150, 300].map((delay) => (
            <span
              key={delay}
              className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted-foreground/50"
              style={{ animationDelay: `${delay}ms` }}
            />
          ))}
        </div>
      )}

      {proposals.map((record) => (
        <ProposalCard
          key={record.id}
          record={record}
          onAccept={() => onAcceptProposal(message.id, record)}
          onDismiss={() => onDismissProposal(message.id, record)}
        />
      ))}

      {message.error && (
        <p className="mt-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          {message.error}
        </p>
      )}
    </div>
  );
}
