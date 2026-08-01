/**
 * Conversation state manager for multi-turn AI interactions
 * Tracks context, history, and pending confirmations
 */

export interface ConversationState {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  messages: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
  }>;
  context: {
    currentMerchant?: string;
    currentCart?: Record<string, unknown>;
    recentSearchResults?: Array<{
      id: string;
      name: string;
      price?: number;
    }>;
    selectedProduct?: {
      id: string;
      name: string;
      price?: number;
      description?: string;
    };
    pendingConfirmation?: {
      type: 'add-to-cart' | 'place-order' | 'apply-coupon';
      details: Record<string, unknown>;
    };
    commandHistory: Array<{
      site: string;
      command: string;
      args: Record<string, unknown>;
      status: 'executed' | 'failed' | 'pending';
      timestamp: Date;
    }>;
  };
}

export class ConversationManager {
  private conversations = new Map<string, ConversationState>();
  private sessionTimeout = 30 * 60 * 1000; // 30 minutes

  createConversation(sessionId: string): ConversationState {
    const state: ConversationState = {
      id: sessionId,
      createdAt: new Date(),
      updatedAt: new Date(),
      messages: [],
      context: {
        commandHistory: [],
      },
    };

    this.conversations.set(sessionId, state);
    return state;
  }

  getConversation(sessionId: string): ConversationState | undefined {
    const conv = this.conversations.get(sessionId);
    if (conv) {
      // Check if expired
      const age = Date.now() - conv.updatedAt.getTime();
      if (age > this.sessionTimeout) {
        this.conversations.delete(sessionId);
        return undefined;
      }
    }
    return conv;
  }

  addMessage(
    sessionId: string,
    role: 'user' | 'assistant',
    content: string
  ): void {
    let state = this.getConversation(sessionId);
    if (!state) {
      state = this.createConversation(sessionId);
    }

    state.messages.push({
      role,
      content,
      timestamp: new Date(),
    });
    state.updatedAt = new Date();

    // Keep last 20 messages for context
    if (state.messages.length > 20) {
      state.messages = state.messages.slice(-20);
    }
  }

  setMerchant(sessionId: string, merchant: string): void {
    const state = this.getConversation(sessionId);
    if (state) {
      state.context.currentMerchant = merchant;
      state.updatedAt = new Date();
    }
  }

  setSearchResults(
    sessionId: string,
    results: Array<{ id: string; name: string; price?: number }>
  ): void {
    const state = this.getConversation(sessionId);
    if (state) {
      state.context.recentSearchResults = results;
      state.updatedAt = new Date();
    }
  }

  selectProduct(
    sessionId: string,
    product: { id: string; name: string; price?: number; description?: string }
  ): void {
    const state = this.getConversation(sessionId);
    if (state) {
      state.context.selectedProduct = product;
      state.updatedAt = new Date();
    }
  }

  recordCommand(
    sessionId: string,
    site: string,
    command: string,
    args: Record<string, unknown>,
    status: 'executed' | 'failed' | 'pending' = 'executed'
  ): void {
    const state = this.getConversation(sessionId);
    if (state) {
      state.context.commandHistory.push({
        site,
        command,
        args,
        status,
        timestamp: new Date(),
      });
      state.updatedAt = new Date();

      // Keep last 50 commands
      if (state.context.commandHistory.length > 50) {
        state.context.commandHistory =
          state.context.commandHistory.slice(-50);
      }
    }
  }

  setPendingConfirmation(
    sessionId: string,
    type: 'add-to-cart' | 'place-order' | 'apply-coupon',
    details: Record<string, unknown>
  ): void {
    const state = this.getConversation(sessionId);
    if (state) {
      state.context.pendingConfirmation = { type, details };
      state.updatedAt = new Date();
    }
  }

  clearPendingConfirmation(sessionId: string): void {
    const state = this.getConversation(sessionId);
    if (state) {
      state.context.pendingConfirmation = undefined;
      state.updatedAt = new Date();
    }
  }

  getLastCommand(
    sessionId: string
  ): ConversationState['context']['commandHistory'][0] | undefined {
    const state = this.getConversation(sessionId);
    if (state && state.context.commandHistory.length > 0) {
      return state.context.commandHistory[
        state.context.commandHistory.length - 1
      ];
    }
    return undefined;
  }

  getConversationContext(sessionId: string) {
    const state = this.getConversation(sessionId);
    if (!state) return null;

    return {
      conversationHistory: state.messages,
      currentMerchant: state.context.currentMerchant,
      recentSearchResults: state.context.recentSearchResults,
      selectedProduct: state.context.selectedProduct,
      pendingConfirmation: state.context.pendingConfirmation,
      lastCommand: state.context.commandHistory[
        state.context.commandHistory.length - 1
      ],
    };
  }

  clearConversation(sessionId: string): void {
    this.conversations.delete(sessionId);
  }
}

export const conversationManager = new ConversationManager();
export default ConversationManager;
