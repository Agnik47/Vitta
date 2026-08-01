'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { X, Send, MessageSquare } from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export function AIChatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: 'Hello! I\'m your Vitta dashboard assistant. I can help you understand your mandates, spending policies, and transaction history. What would you like to know?',
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    // Simulate AI response (replace with actual API call)
    setTimeout(() => {
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: generateResponse(userMessage.content),
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, aiMessage]);
      setIsLoading(false);
    }, 1000);
  };

  const generateResponse = (query: string): string => {
    const lowerQuery = query.toLowerCase();
    
    if (lowerQuery.includes('mandate') || lowerQuery.includes('spending cap')) {
      return 'You currently have an active mandate with a ₹1,000 spending cap at Blinkit. The mandate allows up to 1 transaction with a maximum of ₹800 per order. You can view the full details on the Overview page.';
    }
    
    if (lowerQuery.includes('receipt') || lowerQuery.includes('transaction')) {
      return 'All transactions are recorded as cryptographically signed receipts. You can view the complete receipt chain on the Proof Chain page. Each receipt is Ed25519-signed and hash-linked to its predecessor.';
    }
    
    if (lowerQuery.includes('policy') || lowerQuery.includes('rule')) {
      return 'The gate policy engine enforces 9 rules on every transaction: signature verification, expiry check, command validation, merchant authorization, amount parsing, per-transaction cap, total cap, and transaction limit. All rules must pass for a transaction to execute.';
    }
    
    if (lowerQuery.includes('help') || lowerQuery.includes('what can you')) {
      return 'I can help you with:\n- Understanding your active mandates and spending limits\n- Explaining transaction receipts and the verification chain\n- Navigating the dashboard features\n- Clarifying policy rules and decisions\n- Providing information about Blinkit orders\n\nWhat would you like to know more about?';
    }
    
    return 'I can help you understand your mandates, policies, and transaction history. Try asking about your spending cap, receipts, or policy rules. You can also explore the different pages: Overview for mandate status, Decisions for policy logs, and Proof Chain for receipt verification.';
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      {/* Floating button */}
      {!isOpen && (
        <Button
          onClick={() => setIsOpen(true)}
          size="lg"
          className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg hover:scale-110 transition-transform z-50"
          aria-label="Open AI Chat"
        >
          <MessageSquare className="h-6 w-6" />
        </Button>
      )}

      {/* Chat window */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 z-50 flex items-start gap-2">
          {/* Close button beside the window */}
          <Button
            variant="secondary"
            size="icon"
            onClick={() => setIsOpen(false)}
            aria-label="Close chat"
            className="mt-2 shrink-0 shadow-md"
          >
            <X className="h-4 w-4" />
          </Button>

          <Card className="w-[400px] h-[600px] shadow-2xl flex flex-col">
          {/* Header */}
          <div className="flex items-center gap-2 p-4 border-b">
            <div className="h-3 w-3 rounded-full bg-green-500 animate-pulse" />
            <h3 className="font-semibold">Vitta AI Assistant</h3>
          </div>

          {/* Messages */}
          <div ref={scrollContainerRef} className="flex-1 overflow-y-scroll p-4 min-h-0 [scrollbar-width:thin] [scrollbar-color:theme(colors.border)_transparent]">
            <div className="space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg px-4 py-2 ${
                      message.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted'
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                    <p className="text-xs opacity-70 mt-1">
                      {message.timestamp.toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-muted rounded-lg px-4 py-2">
                    <div className="flex gap-1">
                      <div className="h-2 w-2 rounded-full bg-foreground/40 animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="h-2 w-2 rounded-full bg-foreground/40 animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="h-2 w-2 rounded-full bg-foreground/40 animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Input */}
          <div className="p-4 border-t">
            <div className="flex gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask about mandates, policies, or receipts..."
                disabled={isLoading}
                className="flex-1"
              />
              <Button
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
                size="icon"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </Card>
        </div>
      )}
    </>
  );
}
