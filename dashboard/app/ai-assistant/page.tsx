'use client';

import { useEffect, useRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface ChatEvent {
  type: string;
  content?: string;
  data?: Record<string, unknown>;
}

export default function AIAssistantPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId] = useState(() => uuidv4());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async () => {
    if (!inputValue.trim()) return;

    const userMessage: Message = {
      role: 'user',
      content: inputValue,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: inputValue,
          sessionId,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response stream');

      const decoder = new TextDecoder();
      let currentMessage = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value);
        const events = text.split('\n\n').filter((e) => e.trim());

        for (const event of events) {
          if (event.startsWith('data: ')) {
            try {
              const eventData = JSON.parse(event.slice(6)) as ChatEvent;

              if (eventData.type === 'response' && eventData.content) {
                currentMessage = eventData.content;
              } else if (eventData.type === 'error' && eventData.content) {
                currentMessage = `❌ Error: ${eventData.content}`;
              }
            } catch (err) {
              console.error('Parse error:', err);
            }
          }
        }
      }

      if (currentMessage) {
        const assistantMessage: Message = {
          role: 'assistant',
          content: currentMessage,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, assistantMessage]);
      }
    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage: Message = {
        role: 'assistant',
        content: '❌ Sorry, there was an error. Please try again.',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900">
      {/* Header */}
      <div className="border-b border-white/10 bg-black/20 backdrop-blur-sm px-8 py-6 shadow-lg">
        <div className="max-w-5xl mx-auto flex items-center gap-4">
          <div className="text-4xl">🛒</div>
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight">
              Vitta AI Shopping Assistant
            </h1>
            <p className="text-sm text-purple-200 mt-1">
              Your smart shopping companion - Just ask naturally!
            </p>
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto px-8 py-8"
      >
        <div className="max-w-5xl mx-auto space-y-6">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-white/70 py-20">
              <div className="text-7xl mb-6">🎯</div>
              <h2 className="text-3xl font-semibold mb-4 text-white">
                Welcome to Vitta AI
              </h2>
              <p className="text-center text-lg max-w-2xl leading-relaxed mb-6">
                I can help you shop across multiple platforms. Try asking:
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full max-w-3xl">
                <div className="bg-white/10 backdrop-blur-sm rounded-lg px-6 py-4 border border-white/20">
                  <p className="text-white">💡 "Search for organic milk on Blinkit"</p>
                </div>
                <div className="bg-white/10 backdrop-blur-sm rounded-lg px-6 py-4 border border-white/20">
                  <p className="text-white">💡 "Show me my cart"</p>
                </div>
                <div className="bg-white/10 backdrop-blur-sm rounded-lg px-6 py-4 border border-white/20">
                  <p className="text-white">💡 "Add paneer to cart"</p>
                </div>
                <div className="bg-white/10 backdrop-blur-sm rounded-lg px-6 py-4 border border-white/20">
                  <p className="text-white">💡 "Find butter on Zepto"</p>
                </div>
              </div>
            </div>
          )}

          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-3xl rounded-2xl px-6 py-4 shadow-lg ${
                  msg.role === 'user'
                    ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white'
                    : 'bg-white/95 text-gray-800 border border-white/20'
                }`}
              >
                <p className="text-base leading-relaxed whitespace-pre-wrap">
                  {msg.content}
                </p>
                <p
                  className={`text-xs mt-2 ${
                    msg.role === 'user'
                      ? 'text-blue-100'
                      : 'text-gray-500'
                  }`}
                >
                  {msg.timestamp.toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-white/95 text-gray-800 rounded-2xl px-6 py-4 shadow-lg border border-white/20">
                <div className="flex items-center gap-3">
                  <div className="flex gap-1.5">
                    <div className="w-2.5 h-2.5 bg-purple-500 rounded-full animate-bounce"></div>
                    <div
                      className="w-2.5 h-2.5 bg-purple-500 rounded-full animate-bounce"
                      style={{ animationDelay: '0.15s' }}
                    ></div>
                    <div
                      className="w-2.5 h-2.5 bg-purple-500 rounded-full animate-bounce"
                      style={{ animationDelay: '0.3s' }}
                    ></div>
                  </div>
                  <span className="text-sm text-gray-600">Thinking...</span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area */}
      <div className="border-t border-white/10 bg-black/20 backdrop-blur-sm px-8 py-6">
        <div className="max-w-5xl mx-auto flex gap-4">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
            placeholder="Ask me anything about shopping..."
            className="flex-1 bg-white/10 backdrop-blur-sm text-white rounded-xl px-6 py-4 text-base outline-none focus:ring-2 focus:ring-purple-400 placeholder-white/50 border border-white/20 transition-all"
            disabled={isLoading}
          />
          <button
            onClick={handleSendMessage}
            disabled={isLoading || !inputValue.trim()}
            className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white rounded-xl px-8 py-4 font-semibold text-base disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl disabled:hover:shadow-lg"
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <svg
                  className="animate-spin h-5 w-5"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
              </span>
            ) : (
              <span>Send 🚀</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
