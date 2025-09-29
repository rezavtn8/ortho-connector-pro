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
    <div className="space-y-4">
      {/* Header - Teal theme */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Chat with Your Data</h2>
          <p className="text-sm text-muted-foreground">
            Ask questions about your practice and get instant answers
          </p>
        </div>
        {messages.length > 0 && (
          <Button variant="outline" size="sm" onClick={clearChat}>
            Clear Chat
          </Button>
        )}
      </div>

      {/* Chat Interface - Teal Card */}
      <Card className="h-[calc(100vh-280px)] min-h-[500px] flex flex-col">
        <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
          <ScrollArea className="flex-1 px-6 py-4">
            <div className="space-y-4 pb-4">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full py-12">
                {/* Purple AI Bot Icon */}
                <div className="p-4 rounded-full bg-gradient-to-br from-purple-100 to-blue-100 mb-4">
                  <Bot className="h-8 w-8 text-purple-600" />
                </div>
                <h3 className="text-lg font-medium mb-2">Start a Conversation</h3>
                <p className="text-muted-foreground text-center mb-6 max-w-md">
                  Ask me anything about your practice data, patient sources, campaigns, or get strategic advice.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 w-full max-w-2xl">
                  {[
                    "What are my top performing sources?",
                    "How is my patient volume trending?",
                    "Which campaigns are most effective?",
                    "What sources need attention?"
                  ].map((question, index) => (
                    <Button
                      key={index}
                      variant="outline"
                      className="text-left h-auto py-3 px-4 whitespace-normal hover:bg-purple-50 hover:border-purple-200"
                      onClick={() => setInput(question)}
                    >
                      <span className="text-sm">{question}</span>
                    </Button>
                  ))}
                </div>
              </div>
            ) : (
              <>
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
                      {/* Purple AI Bot Avatar */}
                      {message.role === 'assistant' && (
                        <div className="flex-shrink-0">
                          <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500 to-blue-500">
                            <Bot className="h-5 w-5 text-white" />
                          </div>
                        </div>
                      )}
                      <div className={cn(
                        "rounded-lg px-4 py-3 max-w-[80%]",
                        message.role === 'user'
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted"
                      )}>
                        <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                        <p className="text-xs opacity-70 mt-1">
                          {message.timestamp.toLocaleTimeString()}
                        </p>
                      </div>
                      {message.role === 'user' && (
                        <div className="flex-shrink-0">
                          <div className="p-2 rounded-lg bg-primary">
                            <User className="h-5 w-5 text-primary-foreground" />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {loading && (
                  <div className="flex gap-3 justify-start">
                    <div className="flex-shrink-0">
                      <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500 to-blue-500">
                        <Bot className="h-5 w-5 text-white" />
                      </div>
                    </div>
                    <div className="rounded-lg px-4 py-3 bg-muted">
                      <div className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin text-purple-600" />
                        <span className="text-sm text-muted-foreground">Thinking...</span>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
            </div>
          </ScrollArea>

          {/* Input Area - Purple AI Send Button */}
          <div className="border-t p-4">
            <form onSubmit={handleSubmit} className="flex gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about your practice data..."
                disabled={loading}
                className="flex-1"
              />
              <Button 
                type="submit" 
                disabled={loading || !input.trim()}
                className="bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600"
              >
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