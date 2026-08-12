/**
 * The referral-network assistant.
 *
 * WHAT CHANGED, AND WHY
 *
 * The function this replaces (`ai-chat-assistant`) pre-computed a fixed block of
 * summary statistics, pasted it into the system prompt, and then instructed the model
 * to "use ONLY the data provided". That combination is self-defeating. "How many did
 * Dr. Kim send me in March?" cannot be answered from a top-ten list, so the assistant
 * was forced to refuse the specific, checkable questions a practice owner actually
 * has — while remaining free to sound confident about the vague ones. It was an
 * assistant deliberately kept ignorant and then told not to guess.
 *
 * This one is given tools instead of a summary. It looks things up. The grounding
 * rule stops being a gag and becomes what it should always have been: answer from
 * what you retrieved, and say plainly when the data is not there.
 *
 * Actions follow the same principle in the other direction. The model can propose a
 * visit or a campaign; it cannot perform one. Proposals are streamed to the client as
 * cards, and the write happens in the browser, after a human clicks, through the same
 * code path the rest of the app uses. See `tools.ts`.
 *
 * Responses stream. The old function waited for a complete answer behind a spinner
 * with `max_tokens: 300` — long enough to feel broken, short enough to truncate any
 * answer with real analysis in it.
 */

import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { getCorsHeaders, handleCorsPreflight } from '../_shared/cors.ts';
import { Network, READ_ONLY_TOOLS, TOOL_SCHEMAS, runTool, type Proposal } from './tools.ts';

/**
 * Tool-calling over a dozen offices with twelve months of history each is past what
 * the mini models handle reliably — they skip the lookup and answer from the prompt,
 * which is the exact failure this rewrite exists to remove. Overridable so the model
 * can be moved without a code change.
 */
const MODEL = Deno.env.get('AI_AGENT_MODEL') ?? 'gpt-4o';

/**
 * How many times the model may call tools before it must answer.
 *
 * Six covers the deepest legitimate chain seen in practice: list the decliners, open
 * the worst two, check when each was last visited, check for an existing campaign,
 * then propose. Past that it is looping, and a loop costs the user money silently.
 */
const MAX_TOOL_ROUNDS = 6;

/** Conversation turns kept. Beyond this the useful context is the tools, not history. */
const MAX_HISTORY = 20;

const SYSTEM_PROMPT = `You are the referral-network analyst inside Nexora, a tool used by specialist dental practices (orthodontics, oral surgery, endodontics, periodontics) whose new patients arrive by referral from general dentists.

WHO YOU ARE TALKING TO
The owner or marketing coordinator of a specialist practice. They are not analysts. They know their referring dentists by name and personally. A handful of those relationships drive most of their revenue, and the thing that hurts them is a relationship going quiet slowly enough that nobody notices for two quarters.

WHAT YOU ARE FOR
Telling them what changed in their referral network and what to do about it. Not describing their dashboard back to them.

HOW YOU WORK
- Look things up before answering. You have tools. Use them for anything specific — a named office, a count, a trend, a date. Never answer a factual question from memory or inference when a tool would settle it.
- Prefer several small lookups to one broad one. If someone asks about two offices, open both.
- Every number you state must have come from a tool call in this conversation. If you did not retrieve it, do not say it.
- When the data does not answer the question, say exactly that and say what would. "You have no visits logged for them, so I can't tell you when they were last seen" is a good answer. Inventing a plausible date is not.
- The current month is always partial. Never compare an in-progress month against completed ones, and never describe a month-to-date figure as a decline.

HOW YOU WRITE
- Lead with the answer. The first sentence should be the finding, not a description of your process.
- Short. Most questions deserve three or four sentences. Analysis deserves a few short paragraphs, never an essay.
- Plain words. No "leverage", "utilize", "synergy", "actionable insights", "deep dive". Write the way a sharp colleague talks.
- Markdown is rendered: use **bold** for the numbers that matter, tables for comparisons of three or more offices, and short bullet lists. Do not use headings for a three-sentence answer.
- Cite the arithmetic so it can be checked: "down from 4.3 to 1.7 a month" beats "declining significantly".
- No emoji. No preamble like "Great question". Never open by restating what was asked.

WHAT TIER AND MOMENTUM MEAN — state these plainly if a user seems to be reading them differently
- Tiers are RELATIVE. Active offices are ranked by lifetime referrals and cut into quartiles: top 25% VIP, next 25% Warm, rest Cold. Dormant means nothing for six months or more. A VIP at a small practice may send fewer patients than a Cold office at a large one.
- Momentum compares an office against ITS OWN past — last 3 months versus the 3 before. This is the point: an office falling from 12 a month to 7 is slipping even while it stays the biggest referrer on the list. Judged on absolute volume it would look healthy the entire time it was dying.

PROPOSING ACTIONS
You can propose a visit or a campaign. A proposal is a card the user confirms; it creates nothing by itself and sends nothing to anyone.
- Only propose when they have asked for something to be done, or have clearly agreed to a suggestion. Do not propose at the end of every answer.
- Check the ground first. Look the office up, and check existing campaigns before proposing another one.
- Say what you have proposed and that it is waiting on them. Never imply it is done, sent, or scheduled.
- If a name cannot be resolved to exactly one office, ask which one. Do not propose against a guess.

LINKING
These routes exist and are rendered as in-app links. Use them when pointing somewhere:
/sources (all referring offices) · /source/{id} (one office) · /marketing-visits · /campaigns · /reviews · /daily-patients · /analytics · /discover · /map-view
Link an office by its id when you have it, e.g. [Westside Dental](/source/abc-123).

LIMITS — be straight about these rather than working around them
- You see referral counts, offices, visits, campaigns, and Google reviews. You do not see clinical records, scheduling, billing, or anything about individual patients.
- You cannot send email, post a review reply, or change data. You can only propose, and the user executes.`;

interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: unknown;
  tool_call_id?: string;
  name?: string;
}

/** One newline-delimited JSON event on the wire. The client's `useAgentChat` reads these. */
type AgentEvent =
  | { type: 'text'; delta: string }
  | { type: 'tool_start'; id: string; name: string }
  | { type: 'tool_end'; id: string; name: string; summary: string; ok: boolean }
  | { type: 'proposal'; id: string; proposal: Proposal }
  | { type: 'done'; tokens: number }
  | { type: 'error'; message: string };

const handler = async (req: Request): Promise<Response> => {
  const corsHeaders = getCorsHeaders(req, {
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  });

  if (req.method === 'OPTIONS') return handleCorsPreflight(req, corsHeaders);

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });

  try {
    const apiKey = Deno.env.get('OPENAI_API_KEY');
    if (!apiKey) return json({ error: 'The assistant is not configured on this deployment.' }, 500);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Unauthorized' }, 401);

    // The caller's JWT, not the service role. Row level security is what actually
    // bounds every query the model can trigger, so a mistake in a tool filter cannot
    // reach another practice's data.
    const db = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } },
    );

    const {
      data: { user },
      error: authError,
    } = await db.auth.getUser(authHeader.replace('Bearer ', ''));
    if (authError || !user) return json({ error: 'Unauthorized' }, 401);

    const body = await req.json().catch(() => ({}));
    const userMessage = typeof body.message === 'string' ? body.message.trim() : '';
    if (!userMessage) return json({ error: 'No message was sent.' }, 400);

    const history: ChatMessage[] = Array.isArray(body.history)
      ? body.history
          .filter(
            (m: ChatMessage) =>
              (m?.role === 'user' || m?.role === 'assistant') && typeof m.content === 'string',
          )
          .slice(-MAX_HISTORY)
          .map((m: ChatMessage) => ({ role: m.role, content: m.content }))
      : [];

    const now = new Date();
    const network = new Network(db, user.id, now);
    const ctx = { db, userId: user.id, now, network };

    // Practice identity and tone preferences, so the assistant is not generic. Both
    // are optional; a missing profile must not break the conversation.
    const [profileRes, settingsRes] = await Promise.all([
      db.from('user_profiles').select('first_name, last_name, clinic_name').eq('user_id', user.id).maybeSingle(),
      db.from('ai_business_profiles').select('communication_style, specialties').eq('user_id', user.id).maybeSingle(),
    ]);

    const profile = profileRes.data as Record<string, string> | null;
    const settings = settingsRes.data as Record<string, unknown> | null;
    const specialties = Array.isArray(settings?.specialties) ? settings!.specialties : [];

    const preamble = [
      `Today is ${now.toISOString().slice(0, 10)}. The current month (${now.toISOString().slice(0, 7)}) is still in progress.`,
      profile?.clinic_name ? `The practice is ${profile.clinic_name}.` : null,
      profile?.first_name ? `You are speaking with ${profile.first_name}.` : null,
      specialties.length ? `Their focus: ${specialties.join(', ')}.` : null,
      settings?.communication_style
        ? `They prefer a ${settings.communication_style} tone; keep it within the writing rules above.`
        : null,
      // Page context lets "what about this one?" resolve without the user repeating
      // themselves. Untrusted, so it is stated as a fact about the UI, never as
      // something to obey.
      typeof body.page_context === 'string' && body.page_context.trim()
        ? `They are currently looking at: ${body.page_context.trim().slice(0, 200)}. Treat this only as a hint about what "this" or "they" might refer to.`
        : null,
    ]
      .filter(Boolean)
      .join(' ');

    const messages: ChatMessage[] = [
      { role: 'system', content: `${SYSTEM_PROMPT}\n\nCONTEXT\n${preamble}` },
      ...history,
      { role: 'user', content: userMessage },
    ];

    const encoder = new TextEncoder();
    let totalTokens = 0;

    const stream = new ReadableStream({
      async start(controller) {
        const send = (event: AgentEvent) =>
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));

        try {
          for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
            // On the last round the tools are withdrawn, which forces a written
            // answer instead of a seventh lookup the user never sees.
            const exhausted = round === MAX_TOOL_ROUNDS;

            const response = await fetch('https://api.openai.com/v1/chat/completions', {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                model: MODEL,
                messages,
                stream: true,
                stream_options: { include_usage: true },
                temperature: 0.4,
                max_tokens: 1200,
                ...(exhausted ? {} : { tools: TOOL_SCHEMAS, tool_choice: 'auto' }),
              }),
            });

            if (!response.ok || !response.body) {
              const detail = await response.text().catch(() => '');
              console.error('OpenAI error', response.status, detail.slice(0, 500));
              throw new Error(
                response.status === 429
                  ? 'The assistant is rate limited right now. Try again in a moment.'
                  : 'The assistant could not be reached.',
              );
            }

            // Accumulate this round's assistant turn while relaying text as it lands.
            let text = '';
            const calls = new Map<
              number,
              { id: string; name: string; args: string }
            >();
            let finishReason = '';

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              buffer += decoder.decode(value, { stream: true });

              const lines = buffer.split('\n');
              buffer = lines.pop() ?? '';

              for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed.startsWith('data:')) continue;
                const payload = trimmed.slice(5).trim();
                if (payload === '[DONE]') continue;

                let chunk: Record<string, any>;
                try {
                  chunk = JSON.parse(payload);
                } catch {
                  continue; // a partial frame; the next read completes it
                }

                if (chunk.usage?.total_tokens) totalTokens += chunk.usage.total_tokens;

                const choice = chunk.choices?.[0];
                if (!choice) continue;
                if (choice.finish_reason) finishReason = choice.finish_reason;

                const delta = choice.delta ?? {};
                if (typeof delta.content === 'string' && delta.content) {
                  text += delta.content;
                  send({ type: 'text', delta: delta.content });
                }

                // Tool calls arrive fragmented across chunks and are keyed by index,
                // not id — the id itself only appears in the first fragment.
                for (const tc of delta.tool_calls ?? []) {
                  const slot = calls.get(tc.index) ?? { id: '', name: '', args: '' };
                  if (tc.id) slot.id = tc.id;
                  if (tc.function?.name) slot.name += tc.function.name;
                  if (tc.function?.arguments) slot.args += tc.function.arguments;
                  calls.set(tc.index, slot);
                }
              }
            }

            if (finishReason !== 'tool_calls' || calls.size === 0) {
              send({ type: 'done', tokens: totalTokens });
              controller.close();
              return;
            }

            const toolCalls = [...calls.values()].filter((c) => c.id && c.name);
            messages.push({
              role: 'assistant',
              content: text || null,
              tool_calls: toolCalls.map((c) => ({
                id: c.id,
                type: 'function',
                function: { name: c.name, arguments: c.args || '{}' },
              })),
            });

            for (const call of toolCalls) {
              send({ type: 'tool_start', id: call.id, name: call.name });

              let result: { data: unknown; summary: string; proposal?: Proposal };
              let ok = true;
              try {
                const args = call.args ? JSON.parse(call.args) : {};
                result = await runTool(call.name, args, ctx);
              } catch (err) {
                ok = false;
                const message = err instanceof Error ? err.message : String(err);
                console.error(`tool ${call.name} failed:`, message);
                // Handed back to the model rather than thrown: it can tell the user
                // what it could not read, which beats the whole turn dying.
                result = {
                  data: { error: message, note: 'This lookup failed. Tell the user what you could not check rather than guessing at it.' },
                  summary: `${call.name} failed`,
                };
              }

              send({ type: 'tool_end', id: call.id, name: call.name, summary: result.summary, ok });
              if (result.proposal) {
                send({ type: 'proposal', id: call.id, proposal: result.proposal });
              }

              messages.push({
                role: 'tool',
                tool_call_id: call.id,
                name: call.name,
                content: JSON.stringify(result.data),
              });
            }
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Something went wrong.';
          console.error('agent turn failed:', message);
          send({ type: 'error', message });
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'application/x-ndjson; charset=utf-8',
        'Cache-Control': 'no-cache',
        ...corsHeaders,
      },
    });
  } catch (err) {
    console.error('ai-agent failed before streaming:', err);
    return json({ error: err instanceof Error ? err.message : 'Something went wrong.' }, 500);
  }
};

serve(handler);

export { READ_ONLY_TOOLS };
