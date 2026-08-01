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

    // Get or create conversation
    let state = conversationManager.getConversation(sessionId);
    if (!state) {
      state = conversationManager.createConversation(sessionId);
    }

    // Add user message
    conversationManager.addMessage(sessionId, 'user', message);

    // Mock selection for testing
    const mockSelection: WebcmdSelection = {
      site: 'blinkit',
      command: 'search',
      args: { query: message.replace(/search for /i, '').trim() },
      confidence: 0.95,
      reasoning: 'User requested search for products',
    };

    // Record command
    conversationManager.recordCommand(
      sessionId,
      mockSelection.site,
      mockSelection.command,
      mockSelection.args
    );

    // Mock result
    const result = {
      ok: true,
      data: [
        { id: '1', name: 'Amul Butter 500g', price: 280 },
        { id: '2', name: 'Mother Dairy Curd', price: 45 },
      ],
    };

    // Format response
    const responseMsg = `Found ${result.data.length} products matching your request.`;
    conversationManager.addMessage(sessionId, 'assistant', responseMsg);

    // Return SSE stream with mock data
    const events = [
      { type: 'thinking' },
      {
        type: 'command_selected',
        data: {
          site: mockSelection.site,
          command: mockSelection.command,
          args: mockSelection.args,
          confidence: mockSelection.confidence,
        },
      },
      { type: 'executing', content: `Executing: blinkit/search` },
      { type: 'result', data: result },
      { type: 'response', content: responseMsg },
      { type: 'done' },
    ];

    const streamText = events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join('');

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
