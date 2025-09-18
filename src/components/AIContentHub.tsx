import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Bot, 
  User, 
  Send, 
  Sparkles, 
  FileText, 
  Mail, 
  Smartphone,
  Image,
  Wand2,
  Copy,
  Download,
  Share2,
  Heart,
  Star,
  Target,
  Calendar,
  Users,
  Palette,
  MessageSquare,
  Lightbulb,
  Zap
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  suggestions?: string[];
  contentType?: 'text' | 'template' | 'campaign' | 'image';
  generatedContent?: any;
}

interface AIContentHubProps {
  businessProfile?: any;
}

export function AIContentHub({ businessProfile }: AIContentHubProps) {
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [userInput, setUserInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [selectedMode, setSelectedMode] = useState<'chat' | 'wizard'>('chat');
  const chatEndRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();

  // Scroll to bottom when new messages are added
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // Initialize with welcome message
  useEffect(() => {
    if (chatMessages.length === 0) {
      setChatMessages([{
        id: '1',
        role: 'assistant',
        content: `Hi! I'm your AI Marketing Assistant. I can help you create professional dental marketing materials in seconds. What would you like to create today?`,
        timestamp: new Date(),
        suggestions: [
          'Create a Valentine\'s Day promotion',
          'Design new patient welcome materials',
          'Write social media posts for this week',
          'Generate patient education content',
          'Create referral thank you materials',
          'Design seasonal campaign'
        ]
      }]);
    }
  }, []);

  const contentSuggestions = [
    {
      category: 'Social Media',
      icon: Smartphone,
      color: 'text-blue-600',
      items: [
        'Instagram posts for dental tips',
        'Facebook event for open house',
        'LinkedIn content for professional network',
        'TikTok script for oral hygiene'
      ]
    },
    {
      category: 'Patient Communications',
      icon: Mail,
      color: 'text-green-600',
      items: [
        'Appointment reminder emails',
        'Treatment follow-up messages',
        'Insurance verification letters',
        'Emergency contact information'
      ]
    },
    {
      category: 'Marketing Campaigns',
      icon: Target,
      color: 'text-purple-600',
      items: [
        'Seasonal promotions',
        'New patient specials',
        'Referral incentive programs',
        'Treatment awareness campaigns'
      ]
    },
    {
      category: 'Educational Materials',
      icon: FileText,
      color: 'text-orange-600',
      items: [
        'Oral hygiene guides',
        'Treatment explanation sheets',
        'Pre/post care instructions',
        'Insurance benefit explanations'
      ]
    }
  ];

  const handleSendMessage = async () => {
    if (!userInput.trim()) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: userInput,
      timestamp: new Date()
    };

    setChatMessages(prev => [...prev, userMessage]);
    setUserInput('');
    setIsTyping(true);

    try {
      const { data, error } = await supabase.functions.invoke('ai-assistant', {
        body: {
          prompt: `You are a professional dental marketing assistant. Create engaging, HIPAA-compliant content based on this request: "${userInput}"

          Practice Context: 
          ${businessProfile?.business_persona ? `
          Practice: ${businessProfile.business_persona.practice_name}
          Doctor: ${businessProfile.business_persona.owner_name}
          Specialty: ${businessProfile.business_persona.specialty}
          ` : 'Generic dental practice'}

          Please provide specific, actionable content. If creating marketing materials:
          1. Include compelling headlines
          2. Professional, warm tone
          3. Clear calls-to-action
          4. HIPAA-compliant language
          5. Local market appeal

          Be creative and comprehensive. Provide ready-to-use content.`,
          context: 'ai_content_creation'
        },
        headers: {
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
      });

      if (error) throw error;

      const aiResponse = data.content || data.response || "I'd love to help you create amazing dental marketing content! Could you tell me more about what you're looking for?";
      
      // Determine content type and suggestions
      let contentType: ChatMessage['contentType'] = 'text';
      let suggestions: string[] = [];
      
      if (userInput.toLowerCase().includes('social')) {
        contentType = 'template';
        suggestions = ['Create more social posts', 'Design graphics', 'Schedule posts', 'Analytics setup'];
      } else if (userInput.toLowerCase().includes('email') || userInput.toLowerCase().includes('campaign')) {
        contentType = 'campaign';
        suggestions = ['Create email sequence', 'Design templates', 'Set automation', 'Track results'];
      } else if (userInput.toLowerCase().includes('image') || userInput.toLowerCase().includes('graphic')) {
        contentType = 'image';
        suggestions = ['Generate variations', 'Different sizes', 'Brand colors', 'Download files'];
      } else {
        suggestions = [
          'Expand this content',
          'Create social posts from this',
          'Turn into email campaign',
          'Make it more specific'
        ];
      }

      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: aiResponse,
        timestamp: new Date(),
        suggestions,
        contentType
      };

      setChatMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: "I'm experiencing some technical difficulties. Let me help you with some quick suggestions while we get this sorted out!",
        timestamp: new Date(),
        suggestions: [
          'Create welcome card template',
          'Design thank you note',
          'Write appointment reminders',
          'Generate social media content'
        ]
      };
      setChatMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setUserInput(suggestion);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">AI Content Creation Hub</h2>
          <p className="text-muted-foreground">Generate professional marketing materials in seconds</p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant={selectedMode === 'chat' ? "default" : "outline"}
            onClick={() => setSelectedMode('chat')}
            className="flex items-center gap-2"
          >
            <MessageSquare className="h-4 w-4" />
            AI Chat
          </Button>
          <Button 
            variant={selectedMode === 'wizard' ? "default" : "outline"}
            onClick={() => setSelectedMode('wizard')}
            className="flex items-center gap-2"
          >
            <Wand2 className="h-4 w-4" />
            Quick Wizard
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Main Chat Interface */}
        <div className="lg:col-span-3">
          {selectedMode === 'chat' ? (
            <Card className="h-[700px] flex flex-col">
              <CardHeader className="border-b bg-gradient-to-r from-primary/5 to-primary/10">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center bg-primary rounded-full">
                    <Sparkles className="h-5 w-5 text-primary-foreground" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">AI Marketing Assistant</CardTitle>
                    <p className="text-sm text-muted-foreground">Professional, HIPAA-compliant content generation</p>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="flex-1 flex flex-col p-0">
                <ScrollArea className="flex-1 p-4">
                  <div className="space-y-4">
                    {chatMessages.map((message) => (
                      <div key={message.id} className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`flex gap-3 max-w-[85%] ${message.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                          <div className={`flex h-8 w-8 items-center justify-center rounded-full flex-shrink-0 ${
                            message.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-gradient-to-br from-muted to-accent/20'
                          }`}>
                            {message.role === 'user' ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4 text-primary" />}
                          </div>
                          <div className="space-y-3">
                            <div className={`rounded-lg p-4 ${
                              message.role === 'user' 
                                ? 'bg-primary text-primary-foreground' 
                                : 'bg-gradient-to-br from-muted/80 to-accent/10 border border-border/50'
                            }`}>
                              <div className="text-sm whitespace-pre-wrap">{message.content}</div>
                              
                              {/* Content Actions */}
                              {message.role === 'assistant' && message.content.length > 100 && (
                                <div className="flex gap-2 mt-3 pt-3 border-t border-border/30">
                                  <Button variant="ghost" size="sm" className="h-6 text-xs">
                                    <Copy className="h-3 w-3 mr-1" />
                                    Copy
                                  </Button>
                                  <Button variant="ghost" size="sm" className="h-6 text-xs">
                                    <Download className="h-3 w-3 mr-1" />
                                    Export
                                  </Button>
                                  <Button variant="ghost" size="sm" className="h-6 text-xs">
                                    <Share2 className="h-3 w-3 mr-1" />
                                    Share
                                  </Button>
                                </div>
                              )}
                            </div>
                            
                            {/* Suggestions */}
                            {message.suggestions && (
                              <div className="flex flex-wrap gap-2">
                                {message.suggestions.map((suggestion, index) => (
                                  <Button
                                    key={index}
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleSuggestionClick(suggestion)}
                                    className="text-xs h-6 bg-gradient-to-r from-primary/5 to-primary/10 hover:from-primary/10 hover:to-primary/20 border-primary/20"
                                  >
                                    {suggestion}
                                  </Button>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                    
                    {isTyping && (
                      <div className="flex gap-3 justify-start">
                        <div className="flex gap-3 max-w-[85%]">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-muted to-accent/20">
                            <Bot className="h-4 w-4 text-primary animate-pulse" />
                          </div>
                          <div className="bg-gradient-to-br from-muted/80 to-accent/10 border border-border/50 rounded-lg p-4">
                            <div className="flex space-x-1">
                              <div className="w-2 h-2 bg-primary/60 rounded-full animate-bounce"></div>
                              <div className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                              <div className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                    <div ref={chatEndRef} />
                  </div>
                </ScrollArea>

                {/* Input Area */}
                <div className="border-t p-4 bg-gradient-to-r from-background to-muted/20">
                  <div className="flex gap-2">
                    <div className="flex-1 relative">
                      <Textarea
                        placeholder="Describe what you want to create... (e.g., 'Create a Valentine's Day whitening promotion with social posts and email')"
                        value={userInput}
                        onChange={(e) => setUserInput(e.target.value)}
                        onKeyDown={handleKeyPress}
                        className="min-h-[40px] max-h-[120px] resize-none pr-12 bg-background/50 backdrop-blur-sm border-border/50 focus:border-primary/50"
                        rows={1}
                      />
                      <div className="absolute right-2 bottom-2 flex items-center gap-1">
                        <Badge variant="outline" className="text-xs bg-background/80">
                          {userInput.length}/1000
                        </Badge>
                      </div>
                    </div>
                    <Button 
                      onClick={handleSendMessage}
                      disabled={!userInput.trim() || isTyping}
                      className="self-end px-3 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="h-[700px]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wand2 className="h-5 w-5 text-primary" />
                  Quick Content Wizard
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="social" className="space-y-4">
                  <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="social">Social Media</TabsTrigger>
                    <TabsTrigger value="email">Email</TabsTrigger>
                    <TabsTrigger value="print">Print Materials</TabsTrigger>
                    <TabsTrigger value="education">Education</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="social" className="space-y-4">
                    <div className="text-center py-8">
                      <Smartphone className="h-12 w-12 mx-auto mb-4 text-primary" />
                      <h3 className="text-lg font-semibold mb-2">Social Media Content</h3>
                      <p className="text-muted-foreground mb-4">Create engaging social posts for your practice</p>
                      <Button className="mx-auto">Start Social Wizard</Button>
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="email" className="space-y-4">
                    <div className="text-center py-8">
                      <Mail className="h-12 w-12 mx-auto mb-4 text-primary" />
                      <h3 className="text-lg font-semibold mb-2">Email Campaigns</h3>
                      <p className="text-muted-foreground mb-4">Design professional email templates</p>
                      <Button className="mx-auto">Start Email Wizard</Button>
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="print" className="space-y-4">
                    <div className="text-center py-8">
                      <FileText className="h-12 w-12 mx-auto mb-4 text-primary" />
                      <h3 className="text-lg font-semibold mb-2">Print Materials</h3>
                      <p className="text-muted-foreground mb-4">Generate brochures, cards, and flyers</p>
                      <Button className="mx-auto">Start Print Wizard</Button>
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="education" className="space-y-4">
                    <div className="text-center py-8">
                      <Lightbulb className="h-12 w-12 mx-auto mb-4 text-primary" />
                      <h3 className="text-lg font-semibold mb-2">Patient Education</h3>
                      <p className="text-muted-foreground mb-4">Create educational content and guides</p>
                      <Button className="mx-auto">Start Education Wizard</Button>
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Content Suggestions Sidebar */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Zap className="h-4 w-4 text-primary" />
              Quick Ideas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {contentSuggestions.map((category) => {
                const IconComponent = category.icon;
                return (
                  <div key={category.category} className="space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                      <IconComponent className={`h-4 w-4 ${category.color}`} />
                      {category.category}
                    </div>
                    <div className="space-y-1 ml-6">
                      {category.items.map((item, index) => (
                        <button
                          key={index}
                          onClick={() => handleSuggestionClick(`Create ${item}`)}
                          className="block w-full text-left text-xs text-muted-foreground hover:text-primary transition-colors p-1 rounded hover:bg-muted/50"
                        >
                          {item}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}