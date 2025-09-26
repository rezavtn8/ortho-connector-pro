import { useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
}

export function useAIChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const conversationRef = useRef<string>(crypto.randomUUID());

  const logMessage = async (message: Message) => {
    if (!user) return;

    try {
      await supabase
        .from('ai_generated_content')
        .insert({
          user_id: user.id,
          content_type: 'chat_message',
          generated_text: message.content,
          status: 'generated',
          metadata: {
            role: message.role,
            conversation_id: conversationRef.current,
            timestamp: message.timestamp.toISOString()
          }
        });
    } catch (error) {
      console.error('Error logging message:', error);
    }
  };

  const sendMessage = async (content: string) => {
    if (!user || loading) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      content,
      role: 'user',
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setLoading(true);

    // Log user message
    await logMessage(userMessage);

    try {
      const conversationHistory = [...messages, userMessage].map(m => ({
        role: m.role,
        content: m.content
      }));

      const { data, error } = await supabase.functions.invoke('ai-chat-assistant', {
        body: {
          message: content,
          conversation_history: conversationHistory
        }
      });

      if (error) throw error;

      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        content: data.response,
        role: 'assistant',
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, assistantMessage]);
      
      // Log assistant message
      await logMessage(assistantMessage);

    } catch (error: any) {
      console.error('Chat error:', error);
      
      const errorMessage: Message = {
        id: crypto.randomUUID(),
        content: 'I apologize, but I encountered an error processing your request. Please try again.',
        role: 'assistant',
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const clearChat = () => {
    setMessages([]);
    conversationRef.current = crypto.randomUUID();
  };

  return {
    messages,
    loading,
    sendMessage,
    clearChat,
  };
}