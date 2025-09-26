import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  MessageSquare, 
  Send, 
  Bot, 
  User, 
  Lightbulb, 
  BarChart3, 
  FileText, 
  Users,
  RefreshCw,
  Edit3,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Clock,
  MoreVertical
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { chatStorage, ChatMessage } from '@/lib/chatStorage';
import { messageQueue } from '@/lib/messageQueue';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

const MESSAGES_PER_LOAD = 10;

// Quick action prompts - limited to 4 most relevant ones
const QUICK_ACTIONS = [
  {
    icon: BarChart3,
    label: 'Analyze Performance',
    prompt: 'Analyze my practice performance and identify key trends and opportunities'
  },
  {
    icon: Lightbulb,
    label: 'Growth Strategies',
    prompt: 'Suggest specific growth strategies based on my current referral patterns'
  },
  {
    icon: Users,
    label: 'Referral Insights',
    prompt: 'What insights can you provide about my referral network and relationships?'
  },
  {
    icon: FileText,
    label: 'Content Ideas',
    prompt: 'Generate marketing content ideas to strengthen referral relationships'
  }
];

interface TypingIndicatorProps {
  visible: boolean;
}

function TypingIndicator({ visible }: TypingIndicatorProps) {
  if (!visible) return null;

  return (
    <div className="flex items-center space-x-2 p-3 bg-muted/50 rounded-lg w-fit">
      <Bot className="h-4 w-4 text-muted-foreground" />
      <div className="flex space-x-1">
        <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce [animation-delay:-0.3s]" />
        <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce [animation-delay:-0.15s]" />
        <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" />
      </div>
      <span className="text-sm text-muted-foreground">AI is thinking...</span>
    </div>
  );
}

interface MessageStatusProps {
  status?: 'sending' | 'sent' | 'failed';
  timestamp: Date;
}

function MessageStatus({ status, timestamp }: MessageStatusProps) {
  const formatTime = (date: Date) => {
    try {
      const dateObj = date instanceof Date ? date : new Date(date);
      if (isNaN(dateObj.getTime())) {
        return 'Invalid time';
      }
      return dateObj.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return 'Invalid time';
    }
  };

  return (
    <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
      <span>{formatTime(timestamp)}</span>
      {status === 'sending' && <Loader2 className="h-3 w-3 animate-spin" />}
      {status === 'sent' && <CheckCircle2 className="h-3 w-3 text-green-500" />}
      {status === 'failed' && <AlertTriangle className="h-3 w-3 text-destructive" />}
    </div>
  );
}

interface ChatMessageBubbleProps {
  message: ChatMessage;
  onRetry?: () => void;
  onEdit?: () => void;
}

function ChatMessageBubble({ message, onRetry, onEdit }: ChatMessageBubbleProps) {
  const isUser = message.role === 'user';
  
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      <div className={`max-w-[80%] ${isUser ? 'order-2' : 'order-1'}`}>
        <div className={`flex items-start gap-2 ${isUser ? 'flex-row-reverse' : ''}`}>
          <div className={`h-8 w-8 rounded-full flex items-center justify-center ${
            isUser ? 'bg-primary text-primary-foreground' : 'bg-muted'
          }`}>
            {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
          </div>
          
          <div className={`rounded-lg px-4 py-3 ${
            isUser 
              ? 'bg-primary text-primary-foreground' 
              : 'bg-muted text-muted-foreground'
          }`}>
            <div className="text-sm leading-relaxed whitespace-pre-wrap">
              {message.content}
            </div>
            
            <div className={`flex items-center justify-between mt-2 ${
              isUser ? 'flex-row-reverse' : ''
            }`}>
              <MessageStatus status={message.status} timestamp={message.timestamp} />
              
              {(message.status === 'failed' || (isUser && onEdit)) && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                      <MoreVertical className="h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align={isUser ? 'end' : 'start'}>
                    {message.status === 'failed' && onRetry && (
                      <DropdownMenuItem onClick={onRetry}>
                        <RefreshCw className="h-3 w-3 mr-2" />
                        Retry
                      </DropdownMenuItem>
                    )}
                    {isUser && onEdit && (
                      <DropdownMenuItem onClick={onEdit}>
                        <Edit3 className="h-3 w-3 mr-2" />
                        Edit & Resend
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AIChatAssistant() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messageLoadOffset = useRef(0);

  // Auto-save draft
  useEffect(() => {
    if (!user || !inputMessage.trim()) return;

    const timeout = setTimeout(() => {
      chatStorage.saveDraft(user.id, inputMessage);
    }, 1000);

    return () => clearTimeout(timeout);
  }, [inputMessage, user]);

  // Load initial messages and draft
  useEffect(() => {
    if (!user) return;

    loadMessages(true).then(() => {
      // Load draft message
      chatStorage.getDraft(user.id).then(draft => {
        if (draft) {
          setInputMessage(draft);
        }
      });
    });
  }, [user]);

  // Initialize with welcome message if needed
  useEffect(() => {
    if (messages.length === 0) {
      const welcomeMessage: ChatMessage = {
        id: 'welcome',
        role: 'assistant',
        content: "Hi! I'm your AI practice assistant. I can help you analyze your referral patterns, suggest growth strategies, create marketing content, and answer questions about your practice data. What would you like to explore today?",
        timestamp: new Date(),
        type: 'general',
        status: 'sent'
      };
      
      setMessages([welcomeMessage]);
      if (user) {
        chatStorage.saveMessage(user.id, welcomeMessage);
      }
    }
  }, [messages.length, user]);

  const loadMessages = async (reset = false) => {
    if (!user || loadingHistory) return;

    setLoadingHistory(true);
    
    try {
      const offset = reset ? 0 : messageLoadOffset.current;
      const loadedMessages = await chatStorage.getMessages(user.id, MESSAGES_PER_LOAD, offset);
      
      if (reset) {
        setMessages(loadedMessages);
        messageLoadOffset.current = loadedMessages.length;
      } else {
        setMessages(prev => [...loadedMessages, ...prev]);
        messageLoadOffset.current += loadedMessages.length;
      }
      
      setHasMoreMessages(loadedMessages.length === MESSAGES_PER_LOAD);
    } catch (error) {
      console.error('Error loading messages:', error);
      toast({
        title: 'Error',
        description: 'Failed to load message history',
        variant: 'destructive'
      });
    } finally {
      setLoadingHistory(false);
    }
  };

  const scrollToBottom = useCallback(() => {
    if (scrollAreaRef.current) {
      const scrollElement = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollElement) {
        scrollElement.scrollTop = scrollElement.scrollHeight;
      }
    }
  }, []);

  const handleSendMessage = useCallback(async (content: string, isRetry = false, originalMessageId?: string) => {
    if (!user || !content.trim()) return;

    const messageContent = content.trim();
    const messageId = originalMessageId || Date.now().toString();

    // Create optimistic user message
    const userMessage: ChatMessage = {
      id: messageId,
      role: 'user',
      content: messageContent,
      timestamp: new Date(),
      type: 'general',
      status: 'sending'
    };

    // Update UI optimistically
    if (!isRetry) {
      setMessages(prev => [...prev, userMessage]);
      setInputMessage('');
      if (user) {
        await chatStorage.saveMessage(user.id, userMessage);
        chatStorage.clearDraft(user.id);
      }
    } else {
      // Update existing message status for retry
      setMessages(prev => 
        prev.map(msg => 
          msg.id === messageId 
            ? { ...msg, status: 'sending' as const }
            : msg
        )
      );
    }

    scrollToBottom();
    setIsTyping(true);

    // Add to message queue
    await messageQueue.addMessage({
      id: messageId,
      content: messageContent,
      userId: user.id,
      maxRetries: 3,
      onSuccess: async (response: string) => {
        const assistantMessage: ChatMessage = {
          id: Date.now().toString() + '_assistant',
          role: 'assistant',
          content: response,
          timestamp: new Date(),
          type: 'general',
          status: 'sent'
        };

        // Update messages
        setMessages(prev => {
          const updated = prev.map(msg => 
            msg.id === messageId 
              ? { ...msg, status: 'sent' as const }
              : msg
          );
          return [...updated, assistantMessage];
        });

        // Save to storage
        await chatStorage.updateMessage(user.id, messageId, { status: 'sent' });
        await chatStorage.saveMessage(user.id, assistantMessage);
        
        setIsTyping(false);
        scrollToBottom();
      },
      onError: async (error: string) => {
        console.error('Message failed:', error);
        
        // Update message status
        setMessages(prev =>
          prev.map(msg => 
            msg.id === messageId 
              ? { ...msg, status: 'failed' as const }
              : msg
          )
        );

        await chatStorage.updateMessage(user.id, messageId, { status: 'failed' });
        
        setIsTyping(false);
        
        toast({
          title: 'Message Failed',
          description: error || 'Failed to send message. You can retry from the message menu.',
          variant: 'destructive'
        });
      }
    });

    // Save user message to storage
    await chatStorage.saveMessage(user.id, userMessage);
  }, [user, scrollToBottom]);

  const handleQuickAction = (prompt: string) => {
    setInputMessage(prompt);
    textareaRef.current?.focus();
  };

  const handleRetry = (messageId: string) => {
    const message = messages.find(m => m.id === messageId);
    if (message) {
      handleSendMessage(message.content, true, messageId);
    }
  };

  const handleEdit = (messageId: string) => {
    const message = messages.find(m => m.id === messageId);
    if (message) {
      setInputMessage(message.content);
      setEditingMessageId(messageId);
      textareaRef.current?.focus();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (editingMessageId) {
      // Remove the old message and send new one
      setMessages(prev => prev.filter(m => m.id !== editingMessageId));
      chatStorage.deleteMessage(user!.id, editingMessageId);
      setEditingMessageId(null);
    }
    
    handleSendMessage(inputMessage);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const element = e.currentTarget;
    if (element.scrollTop === 0 && hasMoreMessages && !loadingHistory) {
      loadMessages(false);
    }
  };

  return (
    <div className="h-full flex flex-col max-w-4xl mx-auto">
      <Card className="flex-1 flex flex-col">
        <CardHeader className="border-b">
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            AI Practice Assistant
            {messageQueue.isProcessing() && (
              <Badge variant="secondary" className="ml-2">
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
                Processing
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        
        <CardContent className="flex-1 flex flex-col p-0">
          <ScrollArea 
            ref={scrollAreaRef} 
            className="flex-1 p-4"
            onScrollCapture={handleScroll}
          >
            {loadingHistory && (
              <div className="text-center py-4">
                <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                <p className="text-sm text-muted-foreground mt-2">Loading messages...</p>
              </div>
            )}
            
            <div className="space-y-1">
              {messages.map((message) => (
                <ChatMessageBubble
                  key={message.id}
                  message={message}
                  onRetry={message.status === 'failed' ? () => handleRetry(message.id) : undefined}
                  onEdit={message.role === 'user' ? () => handleEdit(message.id) : undefined}
                />
              ))}
              
              <TypingIndicator visible={isTyping} />
            </div>
          </ScrollArea>

          {/* Quick Actions */}
          <div className="border-t p-4 bg-muted/20">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
              {QUICK_ACTIONS.map((action, index) => (
                <Button
                  key={index}
                  variant="outline"
                  size="sm"
                  className="h-auto p-3 text-left justify-start"
                  onClick={() => handleQuickAction(action.prompt)}
                >
                  <action.icon className="h-4 w-4 mr-2 shrink-0" />
                  <span className="text-xs">{action.label}</span>
                </Button>
              ))}
            </div>

            {/* Message Input */}
            <form onSubmit={handleSubmit} className="space-y-2">
              {editingMessageId && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Edit3 className="h-3 w-3" />
                  <span>Editing message</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setEditingMessageId(null);
                      setInputMessage('');
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              )}
              
              <div className="flex gap-2">
                <Textarea
                  ref={textareaRef}
                  placeholder={editingMessageId ? "Edit your message..." : "Ask about your practice data, request analysis, or get recommendations..."}
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="min-h-[80px] resize-none"
                  disabled={isTyping || messageQueue.isProcessing()}
                />
                <Button
                  type="submit"
                  disabled={!inputMessage.trim() || isTyping || messageQueue.isProcessing()}
                  className="shrink-0"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
              
              <div className="text-xs text-muted-foreground">
                Press Enter to send, Shift+Enter for new line
                {messageQueue.getQueueLength() > 0 && (
                  <span className="ml-2">• {messageQueue.getQueueLength()} messages queued</span>
                )}
              </div>
            </form>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}