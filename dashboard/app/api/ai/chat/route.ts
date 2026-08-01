/**
 * AI chat endpoint — intent parsing ONLY.
 *
 * Architecture rule: this route does NOT search, does NOT call webcmd, does NOT touch the cart.
 * Its only job is to parse natural language into a structured intent and return it as an SSE event.
 * The actual search is triggered by the client reading the `search_intent` event and programmatically
 * driving the existing LiveSearchResults component — same state changes a user typing in the form
 * would produce, zero duplication of search logic.
 *
 * SSE event types emitted:
 *   { type: "thinking" }
 *   { type: "search_intent", data: { query: string, merchants: string[], quantity?: number } }
 *   { type: "response", content: string }   ← the conversational reply shown in the chat bubble
 *   { type: "error", content: string }
 *   { type: "done" }
 */

import { NextRequest, NextResponse } from 'next/server';
import GroqClient from '@/src/groq-client';
import { conversationManager } from '@/src/conversation-manager';

export const runtime = 'nodejs';

const VALID_MERCHANTS = ['blinkit', 'zepto', 'bigbasket'] as const;
type Merchant = (typeof VALID_MERCHANTS)[number];

interface ParsedIntent {
  /** The product search query, e.g. "paneer" or "Amul butter" */
  query: string;
  /** Which merchants to search. null means "all". */
  merchants: Merchant[] | null;
  /** Desired quantity, if the user stated one explicitly. */
  quantity: number | null;
  /** Short conversational reply to show in the chat bubble. */
  reply: string;
}

const SYSTEM_PROMPT = `You are a shopping assistant for an app that searches Blinkit, Zepto, and BigBasket.

When the user asks to search for, buy, get, or find a product, parse their request and respond with JSON:

{
  "query": "the product name to search for",
  "merchants": ["blinkit"] or ["zepto"] or ["bigbasket"] or null (null means search all),
  "quantity": 2 or null,
  "reply": "Short message to show in chat, e.g. 'Searching Blinkit for paneer…'"
}

Rules:
- "query" must be just the product name, never include quantity or merchant name.
- "merchants" is an array of zero or more of: "blinkit", "zepto", "bigbasket". Use null to mean "all three".
- If the user says "from Blinkit" or "on Blinkit", set merchants to ["blinkit"].
- If no merchant is mentioned, set merchants to null (search all).
- "quantity" is only set when the user explicitly states a number, e.g. "2 packets".
- "reply" should be a single short sentence confirming what you are about to do.
- Only respond with valid JSON, nothing else.`;

function sse(obj: Record<string, unknown>): string {
  return `data: ${JSON.stringify(obj)}\n\n`;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { message?: string; sessionId?: string };
    const { message, sessionId } = body;

    if (!message || !sessionId) {
      return NextResponse.json({ error: 'Missing message or sessionId' }, { status: 400 });
    }

    if (!process.env.GROQ_API_KEY) {
      return NextResponse.json({ error: 'GROQ_API_KEY not configured' }, { status: 500 });
    }

    // Maintain conversation history so follow-ups like "the first one" have context.
    let conv = conversationManager.getConversation(sessionId);
    if (!conv) conv = conversationManager.createConversation(sessionId);
    conversationManager.addMessage(sessionId, 'user', message);

    const context = conversationManager.getConversationContext(sessionId);
    const history = ((context?.conversationHistory ?? []) as Array<{ role: string; content: string }>)
      .slice(-6)
      .map((m) => `${m.role}: ${m.content}`)
      .join('\n');

    const userPrompt = history
      ? `Conversation so far:\n${history}\n\nLatest message: "${message}"`
      : `"${message}"`;

    const events: Record<string, unknown>[] = [];
    events.push({ type: 'thinking' });

    try {
      const groq = new GroqClient(process.env.GROQ_API_KEY);
      const parsed = await groq.parseJsonResponse<ParsedIntent>({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.1,
      });

      // Validate and sanitise merchants list.
      const merchants: Merchant[] | null = parsed.merchants
        ? (parsed.merchants.filter((m): m is Merchant => VALID_MERCHANTS.includes(m as Merchant)))
            .length > 0
          ? (parsed.merchants.filter((m): m is Merchant => VALID_MERCHANTS.includes(m as Merchant)))
          : null
        : null;

      const query = (parsed.query ?? '').trim();
      if (!query) {
        // Not a search intent — just reply conversationally.
        const fallback =
          parsed.reply ||
          "I can help you search for grocery products. Try: 'Buy paneer from Blinkit' or 'Find butter'.";
        conversationManager.addMessage(sessionId, 'assistant', fallback);
        events.push({ type: 'response', content: fallback });
      } else {
        // Emit the structured intent for the UI to consume.
        events.push({
          type: 'search_intent',
          data: {
            query,
            merchants: merchants ?? VALID_MERCHANTS,
            quantity: parsed.quantity ?? null,
          },
        });

        const reply = parsed.reply || `Searching for "${query}"…`;
        conversationManager.addMessage(sessionId, 'assistant', reply);
        events.push({ type: 'response', content: reply });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      events.push({ type: 'error', content: msg });
    }

    events.push({ type: 'done' });

    return new NextResponse(events.map(sse).join(''), {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
