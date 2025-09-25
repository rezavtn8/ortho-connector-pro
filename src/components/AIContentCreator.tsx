import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Palette, FileText, Heart, GraduationCap, Eye, Download, Loader2, Wand2, Send, Bot, User, Sparkles, MessageSquare, BookOpen, Database, Brain } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useUnifiedAIData } from '@/hooks/useUnifiedAIData';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ScrollArea } from '@/components/ui/scroll-area';
import { WelcomeBooklet } from '@/components/WelcomeBooklet';

interface Template {
  id: string;
  title: string;
  description: string;
  type: 'brochure' | 'welcome' | 'thank-you' | 'announcement';
  thumbnail: string;
  content: {
    headline: string;
    subheading: string;
    body: string;
    callToAction: string;
  };
}

const templates: Template[] = [
  {
    id: 'general-brochure',
    title: 'General Practice Brochure',
    description: 'Multi-page brochure for referring offices showcasing your practice.',
    type: 'brochure',
    thumbnail: '📋',
    content: {
      headline: 'Welcome to {{practice_name}}',
      subheading: 'Excellence in {{specialty}} Care',
      body: 'Our practice has been serving the community with dedication and expertise. Led by {{doctor_name}}, we provide comprehensive care with a personal touch.',
      callToAction: 'Contact us today to schedule a consultation'
    }
  },
  {
    id: 'welcome-card',
    title: 'Patient Welcome Card',
    description: 'Warm welcome card for new patients joining your practice.',
    type: 'welcome',
    thumbnail: '👋',
    content: {
      headline: 'Welcome to {{practice_name}}!',
      subheading: 'We\'re delighted to have you as our patient',
      body: 'Thank you for choosing {{practice_name}} for your healthcare needs. Dr. {{doctor_name}} and our team are committed to providing you with exceptional care.',
      callToAction: 'Questions? Contact us anytime'
    }
  },
  {
    id: 'thank-you-card',
    title: 'Patient Thank You Card',
    description: 'Express gratitude to patients for their trust and loyalty.',
    type: 'thank-you',
    thumbnail: '💝',
    content: {
      headline: 'Thank You',
      subheading: 'for your trust',
      body: 'We appreciate your confidence in {{practice_name}}. It has been our privilege to care for you and your family.',
      callToAction: 'Refer a friend and help us grow our family'
    }
  },
  {
    id: 'ce-announcement',
    title: 'CE Announcement Card',
    description: 'Announce continuing education achievements and new capabilities.',
    type: 'announcement',
    thumbnail: '🎓',
    content: {
      headline: 'Exciting News from {{practice_name}}',
      subheading: 'Advancing Our Expertise',
      body: 'We\'re pleased to announce that Dr. {{doctor_name}} has completed advanced training, bringing new capabilities to better serve you.',
      callToAction: 'Schedule your appointment to experience our enhanced services'
    }
  }
];

interface FormData {
  practiceName: string;
  doctorName: string;
  specialty: string;
  practiceDescription: string;
  contactInfo: string;
  socialHandles: string;
  address: string;
  logo: File | null;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  suggestions?: string[];
  template?: Template;
}

interface AIContentCreatorProps {
  businessProfile?: any;
}

export function AIContentCreator({ businessProfile }: AIContentCreatorProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [isCustomizing, setIsCustomizing] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedContent, setGeneratedContent] = useState<any>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [userInput, setUserInput] = useState('');
  const [isAIMode, setIsAIMode] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [isWelcomeBookletOpen, setIsWelcomeBookletOpen] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();
  const { data: unifiedData, loading: unifiedLoading, fetchAllData } = useUnifiedAIData();
  
  const [formData, setFormData] = useState<FormData>({
    practiceName: '',
    doctorName: '',
    specialty: '',
    practiceDescription: '',
    contactInfo: '',
    socialHandles: '',
    address: '',
    logo: null
  });

  // Auto-fill form data from business profile
  useEffect(() => {
    if (businessProfile?.business_persona) {
      setFormData(prev => ({
        ...prev,
        practiceName: businessProfile.business_persona.practice_name || '',
        doctorName: businessProfile.business_persona.owner_name || '',
        specialty: businessProfile.business_persona.specialty || '',
        practiceDescription: businessProfile.business_persona.practice_description || '',
        contactInfo: businessProfile.contact_info || '',
        address: businessProfile.practice_address || ''
      }));
    }
  }, [businessProfile]);

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
        content: `Hi! I'm your AI content creator assistant. I can help you create professional marketing materials for your practice. What would you like to create today?`,
        timestamp: new Date(),
        suggestions: [
          'Create a thank you card for patients',
          'Design a practice brochure',
          'Make a welcome card for new patients',
          'Announce a new service or achievement'
        ]
      }]);
    }
  }, []);

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
      // Fetch unified data if not already loaded
      let currentData = unifiedData;
      if (!currentData && !unifiedLoading) {
        currentData = await fetchAllData();
      }

      const { data, error } = await supabase.functions.invoke('ai-assistant', {
        body: {
          task_type: 'content_creation',
          context: {
            business_profile: businessProfile || currentData?.business_profile,
            practice_data: currentData,
            user_request: userInput,
            available_templates: templates.map(t => ({ id: t.id, title: t.title, type: t.type })),
            form_data: formData
          },
          prompt: `You are a helpful AI assistant that helps create marketing materials for medical practices. The user said: "${userInput}". 
          
          Based on their request, either:
          1. Suggest a specific template from: brochure, welcome card, thank you card, or announcement
          2. Ask clarifying questions about their practice
          3. Provide helpful suggestions for content creation
          
          Be conversational, helpful, and professional. If you suggest a template, mention why it would be good for their needs.
          
          Practice info: ${formData.practiceName ? `Practice: ${formData.practiceName}` : 'No practice info yet'}
          ${formData.specialty ? `Specialty: ${formData.specialty}` : ''}
          
          Available platform data: ${currentData ? 'Full practice data available including referral sources, campaigns, and analytics' : 'Limited data'}`
        },
        headers: {
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
      });

      if (error) throw error;

      const aiResponse = data.content || data.response || "I'd be happy to help you create marketing materials! What type of content are you looking for?";
      
      // Determine if AI suggests a template
      let suggestedTemplate = null;
      let suggestions = [];
      
      if (aiResponse.toLowerCase().includes('thank you')) {
        suggestedTemplate = templates.find(t => t.type === 'thank-you');
        suggestions = ['Customize this template', 'Show me other options', 'Tell me more about thank you cards'];
      } else if (aiResponse.toLowerCase().includes('welcome')) {
        suggestedTemplate = templates.find(t => t.type === 'welcome');
        suggestions = ['Customize this template', 'Show me other options', 'Tell me more about welcome cards'];
      } else if (aiResponse.toLowerCase().includes('brochure')) {
        suggestedTemplate = templates.find(t => t.type === 'brochure');
        suggestions = ['Customize this template', 'Show me other options', 'Tell me more about brochures'];
      } else if (aiResponse.toLowerCase().includes('announcement')) {
        suggestedTemplate = templates.find(t => t.type === 'announcement');
        suggestions = ['Customize this template', 'Show me other options', 'Tell me more about announcements'];
      } else {
        suggestions = [
          'Create a thank you card',
          'Design a welcome card', 
          'Make a practice brochure',
          'Announce something new'
        ];
      }

      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: aiResponse,
        timestamp: new Date(),
        suggestions,
        template: suggestedTemplate || undefined
      };

      setChatMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: "I'm sorry, I'm having trouble responding right now. But I can still help you create great content! What would you like to make?",
        timestamp: new Date(),
        suggestions: [
          'Create a thank you card',
          'Design a welcome card', 
          'Make a practice brochure'
        ]
      };
      setChatMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setUserInput(suggestion);
    handleSendMessage();
  };

  const handleCustomize = (template: Template) => {
    setSelectedTemplate(template);
    setIsCustomizing(true);
  };

  const handleGenerateContent = async () => {
    if (!selectedTemplate) return;
    
    setIsGenerating(true);
    try {
      // Fetch unified data if not already loaded
      let currentData = unifiedData;
      if (!currentData && !unifiedLoading) {
        currentData = await fetchAllData();
      }

      const { data, error } = await supabase.functions.invoke('ai-assistant', {
        body: {
          task_type: 'content_creation',
          context: {
            business_profile: businessProfile || currentData?.business_profile,
            practice_data: currentData,
            template_info: selectedTemplate,
            form_data: formData
          },
          prompt: `Generate content for a ${selectedTemplate.type} template with the following details:
            Practice: ${formData.practiceName}
            Doctor: ${formData.doctorName}
            Specialty: ${formData.specialty}
            Description: ${formData.practiceDescription}
            
            Please create engaging, professional content for:
            - Headline (catchy, under 8 words)
            - Subheading (descriptive, under 15 words)
            - Body paragraph (2-3 sentences, warm and professional)
            - Call to action (clear, actionable)
            
            Make it sound personal and reflect the practice's expertise. Use comprehensive practice data when available: ${currentData ? 'Full practice analytics available' : 'Limited data'}.`
        },
        headers: {
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
      });

      if (error) throw error;

      // Parse AI response and update content
      const aiContent = data.content || data.response;
      setGeneratedContent({
        headline: aiContent.match(/Headline[:\s]*([^\n]+)/i)?.[1] || selectedTemplate.content.headline,
        subheading: aiContent.match(/Subheading[:\s]*([^\n]+)/i)?.[1] || selectedTemplate.content.subheading,
        body: aiContent.match(/Body[:\s]*([^]+?)(?=Call to action|$)/i)?.[1]?.trim() || selectedTemplate.content.body,
        callToAction: aiContent.match(/Call to action[:\s]*([^\n]+)/i)?.[1] || selectedTemplate.content.callToAction
      });

      toast.success('Content generated successfully!');
    } catch (error) {
      console.error('Error generating content:', error);
      toast.error('Failed to generate content. Please try again.');
      // Fallback to template content with replacements
      setGeneratedContent(replaceTokens(selectedTemplate.content));
    } finally {
      setIsGenerating(false);
    }
  };

  const replaceTokens = (content: any) => {
    const replacements = {
      '{{practice_name}}': formData.practiceName,
      '{{doctor_name}}': formData.doctorName,
      '{{specialty}}': formData.specialty
    };

    return Object.keys(content).reduce((acc, key) => {
      acc[key] = Object.entries(replacements).reduce(
        (str, [token, value]) => str.replace(new RegExp(token, 'g'), value || token),
        content[key]
      );
      return acc;
    }, {} as any);
  };

  const handlePreview = () => {
    if (!generatedContent) {
      setGeneratedContent(replaceTokens(selectedTemplate?.content || {}));
    }
    setIsPreviewOpen(true);
  };

  const handleDownloadPDF = () => {
    toast.info('PDF download feature coming soon!');
  };

  const getTemplateIcon = (type: Template['type']) => {
    switch (type) {
      case 'brochure': return <FileText className="h-8 w-8 text-primary" />;
      case 'welcome': return <Heart className="h-8 w-8 text-primary" />;
      case 'thank-you': return <Heart className="h-8 w-8 text-primary" />;
      case 'announcement': return <GraduationCap className="h-8 w-8 text-primary" />;
      default: return <FileText className="h-8 w-8 text-primary" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold mb-2">AI Content Creator</h3>
          <p className="text-sm text-muted-foreground">Chat with AI to create personalized marketing materials</p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant={isAIMode ? "default" : "outline"} 
            onClick={() => setIsAIMode(true)}
            className="flex items-center gap-2"
          >
            <Bot className="h-4 w-4" />
            AI Chat
          </Button>
          <Button 
            variant={!isAIMode ? "default" : "outline"} 
            onClick={() => setIsAIMode(false)}
            className="flex items-center gap-2"
          >
            <Palette className="h-4 w-4" />
            Templates
          </Button>
        </div>
      </div>

      {isAIMode ? (
        <Card className="h-[600px] flex flex-col">
          <CardHeader className="border-b bg-gradient-to-r from-primary/5 to-primary/10">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center bg-primary rounded-full">
                <Sparkles className="h-5 w-5 text-primary-foreground" />
              </div>
              <div>
                <CardTitle className="text-lg">AI Creative Assistant</CardTitle>
                <p className="text-sm text-muted-foreground">Tell me what you want to create, and I'll help you design it!</p>
              </div>
            </div>
          </CardHeader>
          
          <CardContent className="flex-1 flex flex-col p-0">
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4">
                {chatMessages.map((message) => (
                  <div key={message.id} className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`flex gap-3 max-w-[80%] ${message.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                      <div className={`flex h-8 w-8 items-center justify-center rounded-full ${
                        message.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'
                      }`}>
                        {message.role === 'user' ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                      </div>
                      <div className="space-y-2">
                        <div className={`rounded-lg p-3 ${
                          message.role === 'user' 
                            ? 'bg-primary text-primary-foreground' 
                            : 'bg-muted'
                        }`}>
                          <p className="text-sm">{message.content}</p>
                        </div>
                        
                        {message.template && (
                          <div className="bg-gradient-to-r from-primary/5 to-primary/10 rounded-lg p-3 border border-primary/20">
                            <div className="flex items-center gap-2 mb-2">
                              <Sparkles className="h-4 w-4 text-primary" />
                              <span className="text-sm font-medium">Suggested Template</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="text-2xl">{message.template.thumbnail}</div>
                              <div className="flex-1">
                                <h4 className="font-medium text-sm">{message.template.title}</h4>
                                <p className="text-xs text-muted-foreground">{message.template.description}</p>
                              </div>
                              <Button 
                                size="sm" 
                                onClick={() => handleCustomize(message.template!)}
                                className="flex items-center gap-1"
                              >
                                <Palette className="h-3 w-3" />
                                Use This
                              </Button>
                            </div>
                          </div>
                        )}
                        
                        {message.suggestions && message.suggestions.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {message.suggestions.map((suggestion, idx) => (
                              <Button
                                key={idx}
                                variant="outline"
                                size="sm"
                                onClick={() => handleSuggestionClick(suggestion)}
                                className="text-xs h-7"
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
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                      <Bot className="h-4 w-4" />
                    </div>
                    <div className="bg-muted rounded-lg p-3">
                      <div className="flex gap-1">
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <div ref={chatEndRef} />
            </ScrollArea>
            
            <div className="border-t p-4">
              <div className="flex gap-2">
                <Input
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value)}
                  placeholder="Tell me what you want to create... (e.g., 'I need a thank you card for my dental practice')"
                  onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                  className="flex-1"
                />
                <Button onClick={handleSendMessage} disabled={!userInput.trim() || isTyping}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div>
          <div className="mb-6">
            <h4 className="text-md font-medium mb-2">Template Gallery</h4>
            <p className="text-sm text-muted-foreground">Browse and customize pre-made templates</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
            {/* Welcome Booklet Card */}
            <Card className="hover:shadow-lg transition-all duration-300 cursor-pointer group border-2 hover:border-primary/20">
              <CardHeader className="text-center pb-4 bg-gradient-to-br from-blue-50 to-indigo-50">
                <div className="flex justify-center mb-3">
                  <div className="text-5xl group-hover:scale-110 transition-transform duration-300">📖</div>
                </div>
                <CardTitle className="text-xl font-playfair">Welcome Booklet</CardTitle>
              </CardHeader>
              <CardContent className="pt-2">
                <div className="mb-4 p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg min-h-[80px] flex items-center justify-center">
                  <div className="text-center">
                    <div className="space-y-1">
                      <BookOpen className="h-8 w-8 text-blue-600 mx-auto mb-2" />
                      <div className="text-sm font-medium text-blue-700">12-Page Guide</div>
                      <div className="text-xs text-blue-600">Comprehensive patient welcome</div>
                    </div>
                  </div>
                </div>
                
                <p className="text-sm text-muted-foreground mb-4 text-center">
                  Professional welcome booklet for new patients with practice information, services, and guidelines
                </p>
                
                <Button 
                  onClick={() => setIsWelcomeBookletOpen(true)}
                  className="w-full"
                  variant="outline"
                >
                  Create Booklet
                </Button>
              </CardContent>
            </Card>
            
            {templates.map((template) => (
          <Card key={template.id} className="hover:shadow-lg transition-all duration-300 cursor-pointer group border-2 hover:border-primary/20">
            <CardHeader className="text-center pb-4 bg-gradient-to-br from-gray-50 to-white">
              <div className="flex justify-center mb-3">
                <div className="text-5xl group-hover:scale-110 transition-transform duration-300">{template.thumbnail}</div>
              </div>
              <CardTitle className="text-xl font-playfair">{template.title}</CardTitle>
            </CardHeader>
            <CardContent className="pt-2">
              <div className="mb-4 p-4 bg-gray-50 rounded-lg min-h-[80px] flex items-center justify-center">
                <div className="text-center">
                  {template.type === 'thank-you' ? (
                    <div className="space-y-1">
                      <div className="text-lg font-inter font-light tracking-wider text-gray-700 uppercase">THANK</div>
                      <div className="text-2xl font-script text-gray-600">You</div>
                      <div className="text-xs font-inter text-gray-500 mt-1">FOR YOUR TRUST</div>
                    </div>
                  ) : template.type === 'welcome' ? (
                    <div className="space-y-1">
                      <div className="text-sm font-playfair text-gray-700">Welcome to</div>
                      <div className="text-lg font-script text-primary">Your Practice</div>
                    </div>
                  ) : template.type === 'brochure' ? (
                    <div className="space-y-1">
                      <div className="text-lg font-playfair font-bold text-gray-700">Practice Name</div>
                      <div className="text-sm font-inter text-primary">Excellence in Care</div>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <div className="text-lg font-playfair text-gray-700">Announcement</div>
                      <div className="text-sm font-inter text-primary">New Achievement</div>
                    </div>
                  )}
                </div>
              </div>
              <p className="text-sm text-muted-foreground mb-4 min-h-[3rem] font-inter">
                {template.description}
              </p>
              <Sheet open={isCustomizing && selectedTemplate?.id === template.id} onOpenChange={setIsCustomizing}>
                <SheetTrigger asChild>
                  <Button 
                    className="w-full group-hover:bg-primary group-hover:text-primary-foreground transition-colors font-inter" 
                    onClick={() => handleCustomize(template)}
                  >
                    <Palette className="h-4 w-4 mr-2" />
                    Customize
                  </Button>
                </SheetTrigger>
                <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto">
                  <SheetHeader>
                    <SheetTitle>Customize {template.title}</SheetTitle>
                    <SheetDescription>
                      Fill in your practice details to personalize this template
                    </SheetDescription>
                  </SheetHeader>

                  <div className="space-y-4 mt-6">
                    <div className="space-y-2">
                      <Label htmlFor="practiceName">Practice Name</Label>
                      <Input
                        id="practiceName"
                        value={formData.practiceName}
                        onChange={(e) => setFormData(prev => ({ ...prev, practiceName: e.target.value }))}
                        placeholder="Enter your practice name"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="doctorName">Doctor Name</Label>
                      <Input
                        id="doctorName"
                        value={formData.doctorName}
                        onChange={(e) => setFormData(prev => ({ ...prev, doctorName: e.target.value }))}
                        placeholder="Enter doctor's name"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="specialty">Specialty</Label>
                      <Input
                        id="specialty"
                        value={formData.specialty}
                        onChange={(e) => setFormData(prev => ({ ...prev, specialty: e.target.value }))}
                        placeholder="e.g., Family Medicine, Cardiology"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="practiceDescription">Practice Description</Label>
                      <Textarea
                        id="practiceDescription"
                        value={formData.practiceDescription}
                        onChange={(e) => setFormData(prev => ({ ...prev, practiceDescription: e.target.value }))}
                        placeholder="Brief description of your practice"
                        rows={3}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="contactInfo">Contact Information</Label>
                      <Input
                        id="contactInfo"
                        value={formData.contactInfo}
                        onChange={(e) => setFormData(prev => ({ ...prev, contactInfo: e.target.value }))}
                        placeholder="Phone, email, website"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="address">Address</Label>
                      <Input
                        id="address"
                        value={formData.address}
                        onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                        placeholder="Practice address"
                      />
                    </div>

                    <div className="flex gap-2 mt-6">
                      <Button 
                        onClick={handleGenerateContent} 
                        disabled={isGenerating}
                        className="flex-1"
                      >
                        {isGenerating ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Generating...
                          </>
                        ) : (
                          <>
                            <Wand2 className="h-4 w-4 mr-2" />
                            Generate Content
                          </>
                        )}
                      </Button>
                      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
                        <DialogTrigger asChild>
                          <Button variant="outline" onClick={handlePreview}>
                            <Eye className="h-4 w-4 mr-2" />
                            Preview
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl">
                          <DialogHeader>
                            <DialogTitle>{selectedTemplate?.title} Preview</DialogTitle>
                            <DialogDescription>
                              This is how your customized template will look
                            </DialogDescription>
                          </DialogHeader>
                          
          <div className="bg-white border-2 border-gray-200 shadow-elegant rounded-lg overflow-hidden print:shadow-none max-w-md mx-auto">
            <div className="p-12 text-center space-y-6 min-h-[400px] flex flex-col justify-center">
              {selectedTemplate?.type === 'thank-you' ? (
                <>
                  <div className="space-y-3">
                    <h1 className="text-4xl font-inter font-light tracking-wider text-gray-800 uppercase">
                      THANK
                    </h1>
                    <h2 className="text-5xl font-script text-gray-700 -mt-2">
                      {generatedContent?.headline?.includes('You') ? 'You' : 'You'}
                    </h2>
                  </div>
                  <div className="space-y-4 pt-4">
                    <p className="text-sm font-inter font-medium text-gray-600 tracking-widest uppercase">
                      {generatedContent?.subheading?.replace(/['"]/g, '') || 'FOR YOUR TRUST'}
                    </p>
                    <p className="text-xs font-inter text-gray-500 tracking-wider">
                      @{formData.practiceName.replace(/\s+/g, '').toLowerCase() || 'yourpractice'}
                    </p>
                  </div>
                </>
              ) : selectedTemplate?.type === 'welcome' ? (
                <>
                  <div className="space-y-4">
                    <h1 className="text-3xl font-playfair font-semibold text-gray-800">
                      Welcome to
                    </h1>
                    <h2 className="text-4xl font-script text-primary">
                      {formData.practiceName || '{{practice_name}}'}
                    </h2>
                  </div>
                  <div className="space-y-3 pt-4 border-t border-gray-200">
                    <p className="text-sm font-inter text-gray-600 leading-relaxed">
                      {generatedContent?.body?.replace(/['"]/g, '\"') || selectedTemplate?.content.body}
                    </p>
                  </div>
                </>
              ) : selectedTemplate?.type === 'brochure' ? (
                <>
                  <div className="space-y-4">
                    <h1 className="text-4xl font-playfair font-bold text-gray-800">
                      {formData.practiceName || '{{practice_name}}'}
                    </h1>
                    <h2 className="text-xl font-inter font-light text-primary tracking-wide">
                      {generatedContent?.subheading?.replace(/['"]/g, '\"') || 'Excellence in Dental Care'}
                    </h2>
                  </div>
                  <div className="space-y-4 pt-4">
                    <p className="text-sm font-inter text-gray-700 leading-relaxed">
                      {generatedContent?.body?.replace(/['"]/g, '\"') || selectedTemplate?.content.body}
                    </p>
                    <div className="bg-primary/5 p-4 rounded-lg">
                      <p className="text-sm font-inter font-medium text-primary">
                        {generatedContent?.callToAction?.replace(/['"]/g, '\"') || selectedTemplate?.content.callToAction}
                      </p>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-4">
                    <h1 className="text-3xl font-playfair font-semibold text-gray-800">
                      {generatedContent?.headline?.replace(/['"]/g, '\"') || selectedTemplate?.content.headline}
                    </h1>
                    <h2 className="text-xl font-script text-primary">
                      {generatedContent?.subheading?.replace(/['"]/g, '\"') || selectedTemplate?.content.subheading}
                    </h2>
                  </div>
                  <div className="space-y-4 pt-4 border-t border-gray-200">
                    <p className="text-sm font-inter text-gray-700 leading-relaxed">
                      {generatedContent?.body?.replace(/['"]/g, '\"') || selectedTemplate?.content.body}
                    </p>
                    <p className="text-sm font-inter font-medium text-primary">
                      {generatedContent?.callToAction?.replace(/['"]/g, '\"') || selectedTemplate?.content.callToAction}
                    </p>
                  </div>
                </>
              )}
              
              {formData.contactInfo && (
                <div className="pt-6 border-t border-gray-100 mt-8">
                  <p className="text-xs font-inter text-gray-500 leading-relaxed">{formData.contactInfo}</p>
                  {formData.address && (
                    <p className="text-xs font-inter text-gray-500 mt-1">{formData.address}</p>
                  )}
                </div>
              )}
            </div>
          </div>
                          
                          <div className="flex justify-end">
                            <Button onClick={handleDownloadPDF}>
                              <Download className="h-4 w-4 mr-2" />
                              Download PDF
                            </Button>
                          </div>
                         </DialogContent>
                       </Dialog>
                     </div>
                   </div>
                 </SheetContent>
               </Sheet>
             </CardContent>
           </Card>
         ))}
          </div>
        </div>
      )}

      <WelcomeBooklet
        isOpen={isWelcomeBookletOpen}
        onClose={() => setIsWelcomeBookletOpen(false)}
        businessProfile={businessProfile}
      />
    </div>
  );
}