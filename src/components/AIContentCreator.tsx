import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Palette, FileText, Heart, GraduationCap, Eye, Download, Loader2, Wand2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

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

interface AIContentCreatorProps {
  businessProfile?: any;
}

export function AIContentCreator({ businessProfile }: AIContentCreatorProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [isCustomizing, setIsCustomizing] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedContent, setGeneratedContent] = useState<any>(null);
  const { user } = useAuth();
  
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

  const handleCustomize = (template: Template) => {
    setSelectedTemplate(template);
    setIsCustomizing(true);
  };

  const handleGenerateContent = async () => {
    if (!selectedTemplate) return;
    
    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-assistant', {
        body: {
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
            
            Make it sound personal and reflect the practice's expertise.`,
          context: 'content_creation'
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
      <div>
        <h3 className="text-lg font-semibold mb-2">Template Gallery</h3>
        <p className="text-sm text-muted-foreground">Choose a template to customize for your practice</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
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
  );
}