/**
 * Drives one conversation with the referral-network assistant.
 *
 * Streams over `fetch` rather than `supabase.functions.invoke`, which buffers the
 * whole response before resolving and would discard the point of streaming.
 *
 * Conversations persist to localStorage. The previous chat lived in component state
 * and was destroyed by navigating away — so following the assistant's own advice
 * ("open Westside's page") cost you the analysis that sent you there. That is a
 * strange thing for a tool to do, and it trained users not to trust the thread with
 * anything they wanted to keep.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  type AgentEvent,
  type AgentMessage,
  type ProposalRecord,
  type ProposalState,
  type ToolTrace,
} from '@/lib/agentProtocol';

const STORAGE_KEY = 'nexora.assistant.thread.v1';

/** Older turns are dropped from what is sent; the whole thread stays on screen. */
const HISTORY_TURNS = 20;

/** Beyond this the thread is trimmed on save, so localStorage cannot grow unbounded. */
const MAX_STORED = 60;

const FUNCTIONS_URL = `${
  import.meta.env.VITE_SUPABASE_URL ?? 'https://vqkzqwibbcvmdwgqladn.supabase.co'
}/functions/v1/ai-agent`;

function newId(): string {
  return crypto.randomUUID();
}

function load(): AgentMessage[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // A half-written turn from a reload mid-stream would otherwise render as an empty
    // assistant bubble forever.
    return parsed.filter(
      (m): m is AgentMessage =>
        m && typeof m.content === 'string' && (m.role === 'user' || m.role === 'assistant'),
    );
  } catch {
    return [];
  }
}

function save(messages: AgentMessage[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-MAX_STORED)));
  } catch {
    // Quota or private mode. Losing history is not worth breaking the conversation.
  }
}

export interface UseAgentChat {
  messages: AgentMessage[];
  /** True from send until the stream closes. */
  streaming: boolean;
  send: (text: string) => Promise<void>;
  stop: () => void;
  clear: () => void;
  /** Records a proposal's outcome so the card stops offering a button. */
  resolveProposal: (
    messageId: string,
    proposalId: string,
    state: ProposalState,
    extra?: { resultHref?: string; error?: string },
  ) => void;
}

export function useAgentChat(pageContext?: string): UseAgentChat {
  const [messages, setMessages] = useState<AgentMessage[]>(load);
  const [streaming, setStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // Persist on change rather than inside every mutation, so a stream that writes a
  // hundred deltas does not write localStorage a hundred times mid-flight.
  useEffect(() => {
    if (!streaming) save(messages);
  }, [messages, streaming]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const patch = useCallback((id: string, fn: (m: AgentMessage) => AgentMessage) => {
    setMessages((prev) => prev.map((m) => (m.id === id ? fn(m) : m)));
  }, []);

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || abortRef.current) return;

      const userMessage: AgentMessage = {
        id: newId(),
        role: 'user',
        content: trimmed,
        at: Date.now(),
      };
      const replyId = newId();
      const reply: AgentMessage = {
        id: replyId,
        role: 'assistant',
        content: '',
        at: Date.now(),
        traces: [],
        proposals: [],
      };

      // Captured before the state update so the request carries the thread as it was,
      // without the empty reply we are about to render.
      const history = messages.slice(-HISTORY_TURNS).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      setMessages((prev) => [...prev, userMessage, reply]);
      setStreaming(true);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) throw new Error('Your session expired. Sign in again.');

        const response = await fetch(FUNCTIONS_URL, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: trimmed,
            history: history.filter((h) => h.content),
            page_context: pageContext,
          }),
          signal: controller.signal,
        });

        if (!response.ok || !response.body) {
          // The function reports pre-stream failures as JSON; anything else is the
          // platform, and its HTML body is no use to the user.
          const detail = await response.json().catch(() => null);
          throw new Error(detail?.error ?? 'The assistant could not be reached.');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        const handle = (event: AgentEvent) => {
          switch (event.type) {
            case 'text':
              patch(replyId, (m) => ({ ...m, content: m.content + event.delta }));
              break;
            case 'tool_start':
              patch(replyId, (m) => ({
                ...m,
                traces: [...(m.traces ?? []), { id: event.id, name: event.name, summary: null, ok: true }],
              }));
              break;
            case 'tool_end':
              patch(replyId, (m) => ({
                ...m,
                traces: (m.traces ?? []).map((t): ToolTrace =>
                  t.id === event.id ? { ...t, summary: event.summary, ok: event.ok } : t,
                ),
              }));
              break;
            case 'proposal':
              patch(replyId, (m) => ({
                ...m,
                proposals: [
                  ...(m.proposals ?? []),
                  { id: event.id, proposal: event.proposal, state: 'pending' } as ProposalRecord,
                ],
              }));
              break;
            case 'error':
              patch(replyId, (m) => ({ ...m, error: event.message }));
              break;
            case 'done':
              break;
          }
        };

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';
          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              handle(JSON.parse(line) as AgentEvent);
            } catch {
              // A frame split across reads; the remainder is still in `buffer`.
            }
          }
        }
      } catch (err) {
        const aborted = err instanceof DOMException && err.name === 'AbortError';
        patch(replyId, (m) => ({
          ...m,
          // A stopped turn keeps whatever it had already said; only a real failure
          // gets an error notice.
          error: aborted
            ? m.content
              ? undefined
              : 'Stopped.'
            : err instanceof Error
              ? err.message
              : 'Something went wrong.',
        }));
      } finally {
        abortRef.current = null;
        setStreaming(false);
      }
    },
    [messages, pageContext, patch],
  );

  const stop = useCallback(() => abortRef.current?.abort(), []);

  const clear = useCallback(() => {
    abortRef.current?.abort();
    setMessages([]);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* see save() */
    }
  }, []);

  const resolveProposal = useCallback<UseAgentChat['resolveProposal']>(
    (messageId, proposalId, state, extra) => {
      patch(messageId, (m) => ({
        ...m,
        proposals: (m.proposals ?? []).map((p) =>
          p.id === proposalId ? { ...p, state, ...extra } : p,
        ),
      }));
    },
    [patch],
  );

  return { messages, streaming, send, stop, clear, resolveProposal };
}
