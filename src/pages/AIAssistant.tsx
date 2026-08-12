/**
 * The assistant.
 *
 * WHY THERE ARE NO LONGER FOUR TABS
 *
 * This page used to be Analysis / Chat / Forecast / Settings. Three of those were the
 * same model answering questions about the same data in three fixed formats, and the
 * user had to guess which tab held the answer before they could ask. Worse, the tab
 * that could actually take a question was the one that had been given the least to
 * work with.
 *
 * There is now one surface. The left rail is what changed, computed from the data and
 * ranked by patients per month at stake. The right is a conversation with an assistant
 * that can look anything up. They are wired together: every signal carries the
 * question it raises, and clicking it asks that question. Analysis was folded into the
 * rail. Forecast and Settings are still here, but as things you open — a forecast is a
 * report and settings are configuration, and neither is a peer of the main task.
 */

import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LineChart, RefreshCw, Settings2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { BriefingRail } from '@/components/ai/BriefingRail';
import { Conversation } from '@/components/ai/Conversation';
import { AIForecastTab } from '@/components/ai/AIForecastTab';
import { AISettingsTab } from '@/components/ai/AISettingsTab';
import { useAgentChat } from '@/hooks/useAgentChat';
import { useBriefing } from '@/hooks/useBriefing';
import { executeProposal } from '@/lib/agentActions';
import { toast } from '@/hooks/use-toast';
import type { ProposalRecord } from '@/lib/agentProtocol';

/**
 * Fallbacks for a network with nothing worth flagging. Deliberately about the
 * practice rather than about the product — "what can you do" teaches the user
 * nothing they wanted to know.
 */
const GENERIC_STARTERS = [
  'Which relationships should I worry about?',
  'How is my patient volume trending?',
  'Who should I visit this month?',
];

export function AIAssistant() {
  const navigate = useNavigate();
  const { briefing, summary, tierByOffice, loading, refresh } = useBriefing();
  const { messages, streaming, send, stop, clear, resolveProposal } = useAgentChat();
  const [forecastOpen, setForecastOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  /**
   * Openers drawn from the user's own signals, so the suggested questions are about
   * their actual network. A generic starter list is the same failure as an empty box,
   * one step later.
   */
  const starters = useMemo(() => {
    const fromSignals = (briefing?.signals ?? [])
      .slice(0, 3)
      .map((s) =>
        s.officeName ? `What should I do about ${s.officeName}?` : s.headline.replace(/\.$/, '?'),
      );
    return [...new Set([...fromSignals, ...GENERIC_STARTERS])].slice(0, 4);
  }, [briefing]);

  const handleAccept = async (messageId: string, record: ProposalRecord) => {
    try {
      const result = await executeProposal(record.proposal, tierByOffice);
      resolveProposal(messageId, record.id, 'accepted', { resultHref: result.href });
      toast({
        title: 'Done',
        description: result.message,
        action: (
          <Button size="sm" variant="outline" onClick={() => navigate(result.href)}>
            Open
          </Button>
        ),
      });
      // A scheduled visit changes the overdue-visit signal; leaving the rail stale
      // would have it recommend the visit that was just booked.
      refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'That could not be created.';
      resolveProposal(messageId, record.id, 'failed', { error: message });
      toast({ title: 'Could not do that', description: message, variant: 'destructive' });
    }
  };

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex h-[calc(100vh-6.5rem)] min-h-[520px] flex-col gap-4 lg:flex-row">
        {/* Rail. Above the conversation on mobile, beside it from lg — a phone should
            show the findings first and the input on the way down, which is the order
            the two are actually used in. */}
        <aside className="w-full shrink-0 overflow-y-auto lg:w-80 lg:pr-1 xl:w-96">
          <BriefingRail
            briefing={briefing}
            loading={loading}
            onAsk={send}
            disabled={streaming}
          />
        </aside>

        <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border/60 bg-card">
          <header className="flex h-12 shrink-0 items-center justify-between border-b border-border/60 px-3 sm:px-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-foreground">Assistant</span>
              <span className="hidden text-xs text-muted-foreground sm:inline">
                reads your referral data
              </span>
            </div>

            <div className="flex items-center gap-0.5">
              {messages.length > 0 && (
                <IconAction label="Clear conversation" onClick={clear}>
                  <Trash2 className="h-4 w-4" aria-hidden />
                </IconAction>
              )}
              <IconAction label="Refresh the briefing" onClick={() => refresh()}>
                <RefreshCw className={loading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} aria-hidden />
              </IconAction>

              <Sheet open={forecastOpen} onOpenChange={setForecastOpen}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <SheetTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Forecast">
                        <LineChart className="h-4 w-4" aria-hidden />
                      </Button>
                    </SheetTrigger>
                  </TooltipTrigger>
                  <TooltipContent>Forecast</TooltipContent>
                </Tooltip>
                <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
                  <SheetHeader className="mb-4">
                    <SheetTitle>Forecast</SheetTitle>
                  </SheetHeader>
                  {/* Mounted only while open: the forecast calls a model, and paying
                      for one on every page load of a surface it is not part of is
                      exactly the waste the tab layout was causing. */}
                  {forecastOpen && <AIForecastTab />}
                </SheetContent>
              </Sheet>

              <Sheet open={settingsOpen} onOpenChange={setSettingsOpen}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <SheetTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Assistant settings">
                        <Settings2 className="h-4 w-4" aria-hidden />
                      </Button>
                    </SheetTrigger>
                  </TooltipTrigger>
                  <TooltipContent>Assistant settings</TooltipContent>
                </Tooltip>
                <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
                  <SheetHeader className="mb-4">
                    <SheetTitle>Assistant settings</SheetTitle>
                  </SheetHeader>
                  {settingsOpen && <AISettingsTab />}
                </SheetContent>
              </Sheet>
            </div>
          </header>

          <div className="min-h-0 flex-1">
            <Conversation
              messages={messages}
              streaming={streaming}
              summary={summary}
              briefingLoading={loading}
              starters={starters}
              onSend={send}
              onStop={stop}
              onAcceptProposal={handleAccept}
              onDismissProposal={(messageId, record) =>
                resolveProposal(messageId, record.id, 'dismissed')
              }
            />
          </div>
        </section>
      </div>
    </TooltipProvider>
  );
}

function IconAction({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClick} aria-label={label}>
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
