/**
 * Conversational AI chat endpoint with SSE streaming
 * POST /api/ai/chat
 */

import { NextRequest, NextResponse } from 'next/server';
import GroqClient from '@/src/llm/groq-client';
import CommandSelector, {
  WebcmdSelection,
} from '@/src/llm/command-selector';
import { conversationManager } from '@/src/llm/conversation-manager';

export const runtime = 'nodejs';

interface ChatRequest {
  message: string;
  sessionId: string;
}

interface ChatEvent {
  type:
    | 'thinking'
    | 'command_selected'
    | 'executing'
    | 'result'
    | 'response'
    | 'error'
    | 'done';
  content?: string;
  data?: Record<string, unknown>;
}

function encodeSSE(event: ChatEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

export async function POST(request: NextRequest) {
  console.log('[AI Chat API] Incoming request');
  try {
    const body = (await request.json()) as ChatRequest;
    const { message, sessionId } = body;
    console.log('[AI Chat API] Message:', message, 'Session:', sessionId);

    if (!message || !sessionId) {
      return NextResponse.json(
        { error: 'Missing message or sessionId' },
        { status: 400 }
      );
    }

    if (!process.env.GROQ_API_KEY) {
      console.error('[AI Chat API] GROQ_API_KEY not configured');
      return NextResponse.json(
        { error: 'GROQ_API_KEY not configured' },
        { status: 500 }
      );
    }

    // Get or create conversation
    let state = conversationManager.getConversation(sessionId);
    if (!state) {
      state = conversationManager.createConversation(sessionId);
    }

    // Add user message
    conversationManager.addMessage(sessionId, 'user', message);

    // Get conversation context
    const context = conversationManager.getConversationContext(sessionId);

    // Build SSE stream
    const events: ChatEvent[] = [];
    events.push({ type: 'thinking' });

    try {
      // Use real Groq API to select command
      const selector = new CommandSelector(process.env.GROQ_API_KEY);
      const selection = await selector.selectCommand(message, {
        conversationHistory: (context?.conversationHistory as any) || [],
        recentSearchResults: context?.recentSearchResults,
        selectedProducts: context?.selectedProduct
          ? [context.selectedProduct]
          : undefined,
        merchantPreference: context?.currentMerchant,
      });

      events.push({
        type: 'command_selected',
        data: {
          site: selection.site,
          command: selection.command,
          args: selection.args,
          confidence: selection.confidence,
        },
      });

      events.push({
        type: 'executing',
        content: `Executing: ${selection.site}/${selection.command}`,
      });

      // Record command
      conversationManager.recordCommand(
        sessionId,
        selection.site,
        selection.command,
        selection.args
      );

      // Mock execution result (replace with real webcmd execution later)
      const result = {
        ok: true,
        data: [
          { id: '1', name: 'Product A', price: 299 },
          { id: '2', name: 'Product B', price: 399 },
        ],
      };

      events.push({ type: 'result', data: result });

      // Format response based on command
      let responseMsg = '';
      if (selection.command === 'search') {
        responseMsg = `Found ${result.data.length} products for "${selection.args.query}". Here are the results.`;
      } else if (selection.command === 'cart-read') {
        responseMsg = 'Here is your current cart.';
      } else {
        responseMsg = `Executed ${selection.command} successfully.`;
      }

      conversationManager.addMessage(sessionId, 'assistant', responseMsg);
      events.push({ type: 'response', content: responseMsg });
      events.push({ type: 'done' });
    } catch (error) {
      const err = error instanceof Error ? error.message : String(error);
      console.error('[AI Chat API] Error:', err);
      events.push({ type: 'error', content: `Error: ${err}` });
      events.push({ type: 'done' });
    }

    const streamText = events
      .map((e) => `data: ${JSON.stringify(e)}\n\n`)
      .join('');

    return new NextResponse(streamText, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    const err = error instanceof Error ? error.message : String(error);
    console.error('Chat API error:', err);
    return NextResponse.json({ error: err }, { status: 500 });
  }
}
