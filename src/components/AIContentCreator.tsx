import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Palette, FileText, Heart, GraduationCap, Save, Download, Send, Loader2, Wand2, Clock, ChevronDown, Edit3, Sparkles } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useUnifiedAIData } from '@/hooks/useUnifiedAIData';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';

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

interface GeneratedContent {
  headline: string;
  subheading: string;
  body: string;
  callToAction: string;
}

interface SavedCreation {
  id: string;
  content_type: string;
  generated_text: string;
  metadata: any;
  created_at: string;
  status: string;
}

const templates: Template[] = [
  {
    id: 'general-brochure',
    title: 'Practice Brochure',
    description: 'Professional brochure showcasing your practice',
    type: 'brochure',
    thumbnail: '📋',
    content: {
      headline: 'Excellence in {{specialty}} Care',
      subheading: 'Professional healthcare you can trust',
      body: 'Our practice provides comprehensive medical care with a personal touch.',
      callToAction: 'Schedule your consultation today'
    }
  },
  {
    id: 'welcome-card',
    title: 'Welcome Card',
    description: 'Warm welcome card for new patients',
    type: 'welcome',
    thumbnail: '👋',
    content: {
      headline: 'Welcome to {{practice_name}}!',
      subheading: 'We\'re delighted to have you as our patient',
      body: 'Thank you for choosing our practice for your healthcare needs.',
      callToAction: 'Questions? Contact us anytime'
    }
  },
  {
    id: 'thank-you-card',
    title: 'Thank You Card',
    description: 'Express gratitude to your patients',
    type: 'thank-you',
    thumbnail: '💝',
    content: {
      headline: 'Thank You',
      subheading: 'for your trust',
      body: 'We appreciate your confidence in our practice.',
      callToAction: 'Refer a friend and help us grow our family'
    }
  },
  {
    id: 'ce-announcement',
    title: 'CE Announcement',
    description: 'Announce continuing education achievements',
    type: 'announcement',
    thumbnail: '🎓',
    content: {
      headline: 'Exciting News from {{practice_name}}',
      subheading: 'Advancing Our Expertise',
      body: 'We\'re pleased to announce new training and capabilities.',
      callToAction: 'Schedule your appointment to experience our enhanced services'
    }
  }
];

interface AIContentCreatorProps {
  businessProfile?: any;
}

export function AIContentCreator({ businessProfile }: AIContentCreatorProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [generatedContent, setGeneratedContent] = useState<GeneratedContent | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [recentCreations, setRecentCreations] = useState<SavedCreation[]>([]);
  const [showRecent, setShowRecent] = useState(false);
  const [practiceInfo, setPracticeInfo] = useState({
    practiceName: '',
    doctorName: '',
    specialty: '',
    practiceDescription: '',
    contactInfo: '',
    address: ''
  });

  const { user } = useAuth();
  const { data: unifiedData, loading: unifiedLoading, fetchAllData } = useUnifiedAIData();

  // Auto-fill practice info from business profile
  useEffect(() => {
    if (businessProfile?.business_persona) {
      setPracticeInfo({
        practiceName: businessProfile.business_persona.practice_name || '',
        doctorName: businessProfile.business_persona.owner_name || '',
        specialty: businessProfile.business_persona.specialty || '',
        practiceDescription: businessProfile.business_persona.practice_description || '',
        contactInfo: businessProfile.contact_info || '',
        address: businessProfile.practice_address || ''
      });
    }
  }, [businessProfile]);

  // Load recent creations
  useEffect(() => {
    if (user) {
      loadRecentCreations();
    }
  }, [user]);

  const loadRecentCreations = async () => {
    try {
      const { data, error } = await supabase
        .from('ai_generated_content')
        .select('id, content_type, generated_text, metadata, created_at, status')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) throw error;
      setRecentCreations(data || []);
    } catch (error) {
      console.error('Error loading recent creations:', error);
    }
  };

  const handleTemplateSelect = async (template: Template) => {
    setSelectedTemplate(template);
    setIsGenerating(true);
    
    try {
      // Fetch unified data if needed
      let currentData = unifiedData;
      if (!currentData && !unifiedLoading) {
        currentData = await fetchAllData();
      }

      const { data, error } = await supabase.functions.invoke('unified-ai-service', {
        body: {
          task_type: 'content',
          prompt: `Generate personalized content for a ${template.type} template for ${practiceInfo.practiceName || 'the practice'}. 
          
          Practice Details:
          - Name: ${practiceInfo.practiceName}
          - Doctor: ${practiceInfo.doctorName}
          - Specialty: ${practiceInfo.specialty}
          - Description: ${practiceInfo.practiceDescription}
          
          Template: ${selectedTemplate.type} - ${selectedTemplate.title}
          Description: ${selectedTemplate.description}
          
          Create engaging, professional content with:
          - Headline: Catchy and under 8 words
          - Subheading: Descriptive and under 15 words
          - Body: 2-3 sentences, warm and professional
          - Call to Action: Clear and actionable
          
          Make it personal and reflect the practice's expertise. Use the practice data to create relevant, data-driven content.`,
          context: {
            business_profile: businessProfile || currentData?.business_profile,
            practice_data: currentData,
            template_info: template,
            practice_info: practiceInfo
          },
        },
        headers: {
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
      });

      if (error) throw error;

      if (!data?.success) {
        throw new Error(data?.error || 'Content generation failed');
      }

      // Parse AI response
      const aiContent = data.data || '';
      const parsedContent = {
        headline: extractSection(aiContent, 'headline') || template.content.headline,
        subheading: extractSection(aiContent, 'subheading') || template.content.subheading,
        body: extractSection(aiContent, 'body') || template.content.body,
        callToAction: extractSection(aiContent, 'call to action') || template.content.callToAction
      };

      // Replace template tokens as fallback
      const finalContent = replaceTokens(parsedContent);
      setGeneratedContent(finalContent);
      
      toast.success('Content generated successfully!');
    } catch (error) {
      console.error('Error generating content:', error);
      toast.error('Failed to generate content. Using template as fallback.');
      setGeneratedContent(replaceTokens(template.content));
    } finally {
      setIsGenerating(false);
    }
  };

  const extractSection = (text: string, sectionName: string): string | null => {
    const patterns = [
      new RegExp(`${sectionName}[:\\s]*([^\\n]+)`, 'i'),
      new RegExp(`\\*\\*${sectionName}\\*\\*[:\\s]*([^\\n]+)`, 'i'),
      new RegExp(`${sectionName.toUpperCase()}[:\\s]*([^\\n]+)`, 'i')
    ];
    
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        return match[1].trim().replace(/^["']|["']$/g, '');
      }
    }
    return null;
  };

  const replaceTokens = (content: GeneratedContent): GeneratedContent => {
    const replacements = {
      '{{practice_name}}': practiceInfo.practiceName || 'Your Practice',
      '{{doctor_name}}': practiceInfo.doctorName || 'Dr. Smith',
      '{{specialty}}': practiceInfo.specialty || 'Healthcare'
    };

    return {
      headline: applyReplacements(content.headline, replacements),
      subheading: applyReplacements(content.subheading, replacements),
      body: applyReplacements(content.body, replacements),
      callToAction: applyReplacements(content.callToAction, replacements)
    };
  };

  const applyReplacements = (text: string, replacements: Record<string, string>): string => {
    let result = text;
    Object.entries(replacements).forEach(([token, value]) => {
      result = result.replace(new RegExp(token, 'g'), value);
    });
    return result;
  };

  const handleFieldEdit = (field: string, value: string) => {
    if (generatedContent) {
      setGeneratedContent(prev => ({
        ...prev!,
        [field]: value
      }));
    }
  };

  const handleSave = async () => {
    if (!selectedTemplate || !generatedContent || !user) {
      toast.error('Please select a template and generate content first.');
      return;
    }

    setIsSaving(true);
    try {
      const { data, error } = await supabase
        .from('ai_generated_content')
        .insert({
          user_id: user.id,
          content_type: selectedTemplate.type,
          generated_text: JSON.stringify(generatedContent),
          status: 'final',
          metadata: {
            template_id: selectedTemplate.id,
            template_title: selectedTemplate.title,
            practice_info: practiceInfo
          }
        });

      if (error) throw error;
      
      toast.success('Content saved successfully!');
      await loadRecentCreations();
    } catch (error) {
      console.error('Error saving content:', error);
      toast.error('Failed to save content.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleExportPDF = async () => {
    if (!generatedContent || !selectedTemplate) {
      toast.error('No content to export.');
      return;
    }

    setIsExporting(true);
    try {
      // Create a print-friendly version and trigger print
      const printContent = `
        <html>
          <head>
            <title>${selectedTemplate.title}</title>
            <style>
              body { font-family: Arial, sans-serif; padding: 40px; background: white; }
              .content { max-width: 400px; margin: 0 auto; text-align: center; }
              .headline { font-size: 32px; font-weight: bold; margin-bottom: 20px; }
              .subheading { font-size: 18px; margin-bottom: 30px; }
              .body { font-size: 14px; line-height: 1.6; margin-bottom: 30px; }
              .cta { font-size: 16px; font-weight: bold; color: #2563eb; }
              .footer { margin-top: 40px; font-size: 12px; color: #666; }
            </style>
          </head>
          <body>
            <div class="content">
              <div class="headline">${generatedContent.headline}</div>
              <div class="subheading">${generatedContent.subheading}</div>
              <div class="body">${generatedContent.body}</div>
              <div class="cta">${generatedContent.callToAction}</div>
              <div class="footer">
                ${practiceInfo.contactInfo}<br>
                ${practiceInfo.address}
              </div>
            </div>
          </body>
        </html>
      `;

      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(printContent);
        printWindow.document.close();
        setTimeout(() => {
          printWindow.print();
          printWindow.close();
        }, 500);
      }

      toast.success('PDF export initiated!');
    } catch (error) {
      console.error('Error exporting PDF:', error);
      toast.error('Failed to export PDF.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleSendEmail = () => {
    if (!generatedContent) {
      toast.error('No content to send.');
      return;
    }
    
    // Create email content
    const subject = `${selectedTemplate?.title} - ${practiceInfo.practiceName}`;
    const body = `${generatedContent.headline}\n\n${generatedContent.subheading}\n\n${generatedContent.body}\n\n${generatedContent.callToAction}`;
    
    // Open email client
    const mailtoLink = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(mailtoLink);
    
    toast.success('Email client opened!');
  };

  const loadCreation = (creation: SavedCreation) => {
    try {
      const content = JSON.parse(creation.generated_text);
      const template = templates.find(t => t.id === creation.metadata?.template_id);
      
      if (template) {
        setSelectedTemplate(template);
        setGeneratedContent(content);
        toast.success('Creation loaded!');
      }
    } catch (error) {
      console.error('Error loading creation:', error);
      toast.error('Failed to load creation.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold mb-2">AI Content Creator</h3>
        <p className="text-sm text-muted-foreground">Select a template to instantly generate personalized content</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Template Gallery - Left Side */}
        <div className="lg:col-span-1">
          <h4 className="text-md font-medium mb-4">Templates</h4>
          <div className="grid grid-cols-1 gap-4">
            {templates.map((template) => (
              <Card 
                key={template.id} 
                className={`hover:shadow-lg transition-all duration-300 cursor-pointer group border-2 ${
                  selectedTemplate?.id === template.id ? 'border-primary bg-primary/5' : 'hover:border-primary/20'
                }`}
                onClick={() => handleTemplateSelect(template)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="text-2xl">{template.thumbnail}</div>
                    <div className="flex-1">
                      <h5 className="font-medium text-sm">{template.title}</h5>
                      <p className="text-xs text-muted-foreground">{template.description}</p>
                    </div>
                    {selectedTemplate?.id === template.id && (
                      <Badge variant="default" className="text-xs">Active</Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Live Editor - Right Side */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-md font-medium">Live Editor</h4>
            {selectedTemplate && (
              <Badge variant="outline" className="text-xs">
                {selectedTemplate.title}
              </Badge>
            )}
          </div>

          <Card className="min-h-[500px]">
            <CardContent className="p-8">
              {isGenerating ? (
                <div className="flex items-center justify-center h-[400px]">
                  <div className="text-center">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
                    <p className="text-sm text-muted-foreground">Generating personalized content...</p>
                  </div>
                </div>
              ) : selectedTemplate && generatedContent ? (
                <div className="space-y-6 text-center">
                  {/* Headline */}
                  <div 
                    className={`cursor-pointer p-2 rounded transition-colors ${
                      editingField === 'headline' ? 'bg-primary/10' : 'hover:bg-gray-50'
                    }`}
                    onClick={() => setEditingField('headline')}
                  >
                    {editingField === 'headline' ? (
                      <Textarea
                        value={generatedContent.headline}
                        onChange={(e) => handleFieldEdit('headline', e.target.value)}
                        onBlur={() => setEditingField(null)}
                        className="text-3xl font-bold text-center resize-none border-0 p-0 bg-transparent"
                        rows={1}
                        autoFocus
                      />
                    ) : (
                      <div className="flex items-center justify-center gap-2">
                        <h1 className="text-3xl font-bold">{generatedContent.headline}</h1>
                        <Edit3 className="h-4 w-4 opacity-0 group-hover:opacity-50" />
                      </div>
                    )}
                  </div>

                  {/* Subheading */}
                  <div 
                    className={`cursor-pointer p-2 rounded transition-colors ${
                      editingField === 'subheading' ? 'bg-primary/10' : 'hover:bg-gray-50'
                    }`}
                    onClick={() => setEditingField('subheading')}
                  >
                    {editingField === 'subheading' ? (
                      <Textarea
                        value={generatedContent.subheading}
                        onChange={(e) => handleFieldEdit('subheading', e.target.value)}
                        onBlur={() => setEditingField(null)}
                        className="text-xl text-primary text-center resize-none border-0 p-0 bg-transparent"
                        rows={1}
                        autoFocus
                      />
                    ) : (
                      <div className="flex items-center justify-center gap-2">
                        <h2 className="text-xl text-primary">{generatedContent.subheading}</h2>
                        <Edit3 className="h-4 w-4 opacity-0 group-hover:opacity-50" />
                      </div>
                    )}
                  </div>

                  {/* Body */}
                  <div 
                    className={`cursor-pointer p-4 rounded transition-colors ${
                      editingField === 'body' ? 'bg-primary/10' : 'hover:bg-gray-50'
                    }`}
                    onClick={() => setEditingField('body')}
                  >
                    {editingField === 'body' ? (
                      <Textarea
                        value={generatedContent.body}
                        onChange={(e) => handleFieldEdit('body', e.target.value)}
                        onBlur={() => setEditingField(null)}
                        className="text-sm text-center resize-none border-0 p-0 bg-transparent"
                        rows={3}
                        autoFocus
                      />
                    ) : (
                      <div className="flex items-start justify-center gap-2">
                        <p className="text-sm leading-relaxed">{generatedContent.body}</p>
                        <Edit3 className="h-4 w-4 opacity-0 group-hover:opacity-50 mt-1" />
                      </div>
                    )}
                  </div>

                  {/* Call to Action */}
                  <div 
                    className={`cursor-pointer p-3 rounded-lg bg-primary/5 border border-primary/20 transition-colors ${
                      editingField === 'callToAction' ? 'bg-primary/20' : 'hover:bg-primary/10'
                    }`}
                    onClick={() => setEditingField('callToAction')}
                  >
                    {editingField === 'callToAction' ? (
                      <Textarea
                        value={generatedContent.callToAction}
                        onChange={(e) => handleFieldEdit('callToAction', e.target.value)}
                        onBlur={() => setEditingField(null)}
                        className="text-sm font-medium text-primary text-center resize-none border-0 p-0 bg-transparent"
                        rows={1}
                        autoFocus
                      />
                    ) : (
                      <div className="flex items-center justify-center gap-2">
                        <p className="text-sm font-medium text-primary">{generatedContent.callToAction}</p>
                        <Edit3 className="h-4 w-4 opacity-0 group-hover:opacity-50" />
                      </div>
                    )}
                  </div>

                  {/* Contact Info */}
                  {(practiceInfo.contactInfo || practiceInfo.address) && (
                    <div className="pt-6 border-t border-gray-100">
                      <p className="text-xs text-muted-foreground">{practiceInfo.contactInfo}</p>
                      {practiceInfo.address && (
                        <p className="text-xs text-muted-foreground mt-1">{practiceInfo.address}</p>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-center h-[400px]">
                  <div className="text-center">
                    <Sparkles className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="font-medium mb-2">Select a Template to Start</h3>
                    <p className="text-sm text-muted-foreground">Choose from the templates on the left to generate personalized content</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Action Bar */}
      {selectedTemplate && generatedContent && (
        <Card className="sticky bottom-4 bg-white/95 backdrop-blur border shadow-lg">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge variant="outline">{selectedTemplate.title}</Badge>
                <span className="text-xs text-muted-foreground">Click any text above to edit</span>
              </div>
              <div className="flex items-center gap-2">
                <Button onClick={handleSave} disabled={isSaving} size="sm">
                  {isSaving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Save
                    </>
                  )}
                </Button>
                <Button onClick={handleExportPDF} disabled={isExporting} variant="outline" size="sm">
                  {isExporting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Exporting...
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4 mr-2" />
                      Export PDF
                    </>
                  )}
                </Button>
                <Button onClick={handleSendEmail} variant="outline" size="sm">
                  <Send className="h-4 w-4 mr-2" />
                  Send Email
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Creations */}
      {recentCreations.length > 0 && (
        <Collapsible open={showRecent} onOpenChange={setShowRecent}>
          <CollapsibleTrigger asChild>
            <Card className="cursor-pointer hover:bg-gray-50 transition-colors">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    <span className="font-medium">Recent Creations</span>
                    <Badge variant="secondary">{recentCreations.length}</Badge>
                  </div>
                  <ChevronDown className={`h-4 w-4 transition-transform ${showRecent ? 'rotate-180' : ''}`} />
                </div>
              </CardContent>
            </Card>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
              {recentCreations.map((creation) => (
                <Card 
                  key={creation.id}
                  className="cursor-pointer hover:shadow-md transition-all"
                  onClick={() => loadCreation(creation)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <Badge variant="outline" className="text-xs">
                        {creation.metadata?.template_title || creation.content_type}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {new Date(creation.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="text-sm">
                      {(() => {
                        try {
                          const content = JSON.parse(creation.generated_text);
                          return (
                            <div>
                              <p className="font-medium truncate">{content.headline}</p>
                              <p className="text-xs text-muted-foreground truncate">{content.subheading}</p>
                            </div>
                          );
                        } catch {
                          return <p className="text-xs text-muted-foreground">Invalid content</p>;
                        }
                      })()}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}