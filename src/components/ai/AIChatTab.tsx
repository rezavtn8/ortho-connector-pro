import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, Bot, User, Loader2 } from 'lucide-react';
import { useAIChat } from '@/hooks/useAIChat';
import { cn } from '@/lib/utils';

interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
}

export function AIChatTab() {
  const [input, setInput] = useState('');
  const { messages, loading, sendMessage, clearChat } = useAIChat();
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput('');
    await sendMessage(userMessage);
  };

  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <div className="flex flex-col h-[600px]">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-r from-purple-500 to-blue-500 flex items-center justify-center shadow-md shadow-purple-500/30">
            <Bot className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">AI Chat Assistant</h2>
            <p className="text-sm text-muted-foreground">
              Ask questions about your business data and get instant insights
            </p>
          </div>
        </div>
        {messages.length > 0 && (
          <Button variant="outline" onClick={clearChat} className="border-purple-200 dark:border-purple-800 hover:bg-purple-50 dark:hover:bg-purple-950/20">
            Clear Chat
          </Button>
        )}
      </div>

      <Card className="flex-1 flex flex-col border-purple-200/50 dark:border-purple-800/50">
        <CardContent className="p-0 flex-1 flex flex-col">
          <ScrollArea className="flex-1 p-4" ref={scrollAreaRef}>
            {messages.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 rounded-full bg-gradient-to-r from-purple-500 to-blue-500 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-purple-500/30">
                  <Bot className="h-8 w-8 text-white" />
                </div>
                <h3 className="text-lg font-semibold mb-2 bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">Start a conversation</h3>
                <p className="text-muted-foreground mb-4">
                  Ask me anything about your business data, patient sources, or campaigns
                </p>
                <div className="flex flex-wrap gap-2 justify-center">
                  {[
                    "How are my patient sources performing?",
                    "What campaigns should I focus on?",
                    "Show me this month's trends"
                  ].map((suggestion) => (
                    <Button
                      key={suggestion}
                      variant="outline"
                      size="sm"
                      onClick={() => setInput(suggestion)}
                      className="text-xs border-purple-200 dark:border-purple-800 hover:bg-purple-50 dark:hover:bg-purple-950/20"
                    >
                      {suggestion}
                    </Button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={cn(
                      "flex gap-3 max-w-[80%]",
                      message.role === 'user' ? "ml-auto" : "mr-auto"
                    )}
                  >
                    <div className={cn(
                      "flex gap-3",
                      message.role === 'user' ? "flex-row-reverse" : "flex-row"
                    )}>
                      <div className={cn(
                        "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center",
                        message.role === 'user' 
                          ? "bg-gradient-to-r from-purple-500 to-blue-500 text-white shadow-md shadow-purple-500/30" 
                          : "bg-gradient-to-r from-purple-100 to-blue-100 dark:from-purple-900/50 dark:to-blue-900/50 text-purple-600 dark:text-purple-300"
                      )}>
                        {message.role === 'user' ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                      </div>
                      <div className={cn(
                        "rounded-lg px-4 py-2 max-w-full",
                        message.role === 'user'
                          ? "bg-gradient-to-r from-purple-500 to-blue-500 text-white shadow-sm"
                          : "bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800"
                      )}>
                        <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                        <p className="text-xs opacity-70 mt-1">
                          {message.timestamp.toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
                {loading && (
                  <div className="flex gap-3 mr-auto max-w-[80%]">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-r from-purple-100 to-blue-100 dark:from-purple-900/50 dark:to-blue-900/50 text-purple-600 dark:text-purple-300 flex items-center justify-center">
                      <Bot className="h-4 w-4" />
                    </div>
                    <div className="bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 rounded-lg px-4 py-2">
                      <div className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin text-purple-600" />
                        <span className="text-sm">Thinking...</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>
          
          <div className="p-4 border-t border-purple-200/50 dark:border-purple-800/50">
            <form onSubmit={handleSubmit} className="flex gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about your business data..."
                disabled={loading}
                className="flex-1 border-purple-200 dark:border-purple-800 focus-visible:ring-purple-500"
              />
              <Button type="submit" disabled={!input.trim() || loading} className="bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 shadow-md shadow-purple-500/20">
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </form>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}