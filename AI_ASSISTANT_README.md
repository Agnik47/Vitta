# Vitta AI Assistant - Conversational Shopping Interface

## What's Been Built

A conversational AI interface that lets users shop naturally by asking things like:
- "Search for milk"
- "Add curd to my cart"
- "Show my cart"
- "Place my order"

## Architecture Overview

```
User Message
    ↓
API: POST /api/ai/chat (SSE streaming)
    ↓
Groq LLM (understands intent)
    ↓
Multi-pass Command Selector (3 validation passes)
    ↓
Executes webcmd commands (via gate CLI)
    ↓
Streams response back to UI
```

## Components Created

### Backend (TypeScript)

1. **`src/llm/groq-client.ts`**
   - Groq API client with retry logic
   - Typed request/response handling
   - JSON mode support
   - 10s timeout, 2 retry attempts

2. **`src/llm/command-selector.ts`**
   - Multi-pass command selection algorithm
   - Pass 1: Initial selection based on user intent
   - Pass 2: Validation of selected command
   - Pass 3: Tie-breaker if needed
   - Deterministic via temperature=0.1 and majority voting

3. **`src/llm/conversation-manager.ts`**
   - Manages multi-turn conversation state
   - Tracks: message history, selected products, current cart, merchant preference
   - Auto-expires sessions after 30 minutes
   - Keeps last 20 messages for context

4. **`dashboard/app/api/ai/chat/route.ts`**
   - POST endpoint for chat messages
   - SSE streaming responses
   - Events: thinking → command_selected → executing → result → response → done
   - Integrates with conversation manager & command selector

### Frontend (React/Next.js)

5. **`dashboard/app/ai-assistant/page.tsx`**
   - Full-page conversational chat UI (primary interface)
   - Dark theme with gradient background
   - Real-time streaming responses
   - Auto-scrolling message history
   - Typing indicators while processing

### Generated Artifacts

6. **`skills/webcmd-commands.md`**
   - Auto-generated from 807 webcmd commands in manifest.json
   - Grouped by merchant (amazon, amazon-in, blinkit, zepto, etc.)
   - Separated read vs write commands
   - Format optimized for LLM understanding

## Environment Setup

Add to `.env`:
```bash
GROQ_API_KEY=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
```

## How to Access

1. Run dashboard: `cd dashboard && npm run dev`
2. Visit: `http://localhost:3000/ai-assistant`
3. Chat naturally with the AI

## API Endpoint

**POST /api/ai/chat**

Request:
```json
{
  "message": "search for milk",
  "sessionId": "uuid-here"
}
```

Response: SSE stream with events
```
data: {"type":"thinking"}
data: {"type":"command_selected","data":{...}}
data: {"type":"executing","content":"..."}
data: {"type":"result","data":{...}}
data: {"type":"response","content":"..."}
data: {"type":"done"}
```

## TODO: Next Steps

1. **Execute webcmd commands** - Replace mock execution with actual `gate` CLI spawning
2. **Product selection UI** - Interactive buttons when search returns results
3. **Cart integration** - Show current cart, handle add/remove/checkout
4. **Confirmation flows** - Explicit confirmation for write operations (add-to-cart, place-order)
5. **Navigation integration** - Add "🤖 AI Assistant" link to sidebar (make it primary)
6. **Audit logging** - Log all AI selections to `ai-selections.jsonl`
7. **Rate limiting** - Implement per-session rate limiting (10 calls/min)

## Flow Examples

### Example 1: Simple Search
```
User: "search for butter"
AI: Selects: blinkit/search {query: "butter"}
AI: Executes search, shows 5 products
AI: "Found 5 butter products. Which one?"
User: "the first one"
AI: Shows product details
```

### Example 2: Add to Cart with Confirmation
```
User: "add milk to my cart"
AI: Selects: blinkit/search {query: "milk"} first
AI: Shows results, waits for selection OR if confident enough...
AI: "I'll add Amul Milk 1L to your cart. Confirm? Say yes or no"
User: "yes"
AI: Executes add-to-cart
AI: "✅ Added to cart! Current total: ₹350"
```

## Architecture Decisions

- **Why multi-pass validation?** Non-determinism in LLMs is smoothed by majority voting across 3 passes
- **Why SSE instead of polling?** Real-time streaming for smooth UX, exact event ordering
- **Why conversation manager?** Tracks context so "the first one" or "yes" work naturally
- **Why not chat history in URL?** Security & complexity; session-based is simpler
- **Why Groq instead of OpenAI?** Fast API, good for low-latency shopping flows

## Security Notes

- ✅ Command whitelist (manifest.json only)
- ✅ No direct shell execution (spawn with arg array)
- ✅ Write commands require confirmation
- ❌ TODO: Audit logging not yet implemented
- ❌ TODO: Rate limiting not yet implemented

## Testing Locally

```bash
# Terminal 1: Build backend
cd /Users/ujwal/Desktop/projects/webcmd_project/main/Vitta
npm run build

# Terminal 2: Run dashboard dev server
cd dashboard
npm run dev

# Terminal 3: Test API (optional)
curl -X POST http://localhost:3000/api/ai/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"search for milk","sessionId":"test-123"}'
```

Visit `http://localhost:3000/ai-assistant` and start chatting!
