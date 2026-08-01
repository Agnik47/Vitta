/**
 * Multi-pass command selector using Groq API
 * Provides deterministic command selection with validation
 */

import GroqClient from './groq-client';

export interface WebcmdSelection {
  site: string;
  command: string;
  args: Record<string, string | number | boolean>;
  confidence: number;
  reasoning: string;
}

export interface ConversationContext {
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>;
  recentSearchResults?: Record<string, unknown>[];
  selectedProducts?: Record<string, unknown>[];
  currentCart?: Record<string, unknown>;
  merchantPreference?: string;
}

export class CommandSelector {
  private groq: GroqClient;
  private skillsContext: string;

  constructor(apiKey?: string, skillsContext?: string) {
    this.groq = new GroqClient(apiKey);
    this.skillsContext =
      skillsContext ||
      `You are helping users shop for groceries through conversational commands.

Available merchants: blinkit, zepto, bigbasket, amazon-in
Common commands:
- search <query> — Search for products
- cart-read — View current cart
- add-to-cart <id> --quantity <n> — Add product to cart
- place-order — Place the order
- product-details <id> — Get product info`;
  }

  async selectCommand(
    userIntent: string,
    context?: ConversationContext
  ): Promise<WebcmdSelection> {
    // Pass 1: Initial selection
    const pass1 = await this.initialSelection(userIntent, context);

    // Pass 2: Validation
    const pass2 = await this.validateSelection(pass1, userIntent, context);

    // If high confidence or agreement, return
    if (pass1.confidence >= 0.8 || pass2.confidence >= 0.8) {
      return pass1.confidence > pass2.confidence ? pass1 : pass2;
    }

    // Pass 3: Tie-breaker
    const pass3 = await this.tieBreaker([pass1, pass2], userIntent, context);
    return pass3;
  }

  private async initialSelection(
    userIntent: string,
    context?: ConversationContext
  ): Promise<WebcmdSelection> {
    const conversationContext =
      context?.conversationHistory
        .slice(-4)
        .map((m) => `${m.role}: ${m.content}`)
        .join('\n') || '';

    const systemPrompt = `${this.skillsContext}

You are analyzing a user request and need to determine which webcmd command to execute.

${conversationContext ? `Conversation context:\n${conversationContext}\n` : ''}

User intent: "${userIntent}"

Respond with JSON containing:
{
  "site": "merchant name (blinkit, zepto, bigbasket, or amazon-in)",
  "command": "command name",
  "args": {"arg_name": "arg_value"},
  "confidence": 0.0 to 1.0,
  "reasoning": "brief explanation"
}`;

    const response = await this.groq.parseJsonResponse<WebcmdSelection>({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: systemPrompt }],
      temperature: 0.1,
    });

    return response;
  }

  private async validateSelection(
    selection: WebcmdSelection,
    userIntent: string,
    context?: ConversationContext
  ): Promise<WebcmdSelection> {
    const validationPrompt = `You are validating a command selection.

Original user intent: "${userIntent}"
Proposed command: ${selection.site}/${selection.command}
Arguments: ${JSON.stringify(selection.args)}
Reasoning: ${selection.reasoning}

Does this command match the user intent? Respond with JSON:
{
  "valid": true/false,
  "confidence": 0.0 to 1.0,
  "feedback": "why or why not"
}`;

    const response = await this.groq.parseJsonResponse<{
      valid: boolean;
      confidence: number;
      feedback: string;
    }>({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: validationPrompt }],
      temperature: 0.1,
    });

    // Adjust confidence based on validation
    const adjustedConfidence = response.valid
      ? selection.confidence * 0.9 + response.confidence * 0.1
      : Math.max(0, selection.confidence - 0.2);

    return {
      ...selection,
      confidence: adjustedConfidence,
      reasoning: `${selection.reasoning} [Validation: ${response.feedback}]`,
    };
  }

  private async tieBreaker(
    selections: WebcmdSelection[],
    userIntent: string,
    context?: ConversationContext
  ): Promise<WebcmdSelection> {
    const tiebreakPrompt = `You are a tie-breaker deciding between multiple command suggestions for a user request.

User intent: "${userIntent}"

Option 1: ${selections[0].site}/${selections[0].command}
  Args: ${JSON.stringify(selections[0].args)}
  Confidence: ${selections[0].confidence}
  Reasoning: ${selections[0].reasoning}

Option 2: ${selections[1].site}/${selections[1].command}
  Args: ${JSON.stringify(selections[1].args)}
  Confidence: ${selections[1].confidence}
  Reasoning: ${selections[1].reasoning}

Which option is more appropriate for the user's intent? Respond with JSON:
{
  "choice": 1 or 2,
  "confidence": 0.0 to 1.0,
  "reasoning": "brief explanation"
}`;

    const response = await this.groq.parseJsonResponse<{
      choice: 1 | 2;
      confidence: number;
      reasoning: string;
    }>({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: tiebreakPrompt }],
      temperature: 0.1,
    });

    const chosen = selections[response.choice - 1];
    return {
      ...chosen,
      confidence: response.confidence,
      reasoning: `${chosen.reasoning} [Tie-breaker: ${response.reasoning}]`,
    };
  }
}

export default CommandSelector;
