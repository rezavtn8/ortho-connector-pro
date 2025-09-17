import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Wand2, Download, X, Loader2, FileText, Sparkles } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface WelcomeBookletProps {
  isOpen: boolean;
  onClose: () => void;
  businessProfile?: any;
}

interface BookletData {
  // Pages 1-2: Basic Information
  practiceName: string;
  doctorName: string;
  tagline: string;
  specialty: string;
  
  // Page 3: About Practice
  practiceDescription: string;
  missionStatement: string;
  
  // Page 4: Doctor Profile
  welcomeMessage: string;
  doctorMessageParagraph: string;
  education: string;
  experience: string;
  
  // Page 5: Services
  service1: string;
  service2: string;
  service3: string;
  service4: string;
  service5: string;
  
  // Pages 6-7: Contact & Operations
  officeHours: string;
  address: string;
  contactInfo: string;
  
  // Page 8: Insurance & Billing
  insuranceInfo: string;
  paymentOptions: string;
  
  // Page 9-10: Patient Resources
  patientPortalInfo: string;
  appointmentInfo: string;
  
  // Page 11: Emergency & Support
  emergencyInfo: string;
  supportServices: string;
  
  // Page 12: Testimonials & Cases
  testimonial1: string;
  testimonial2: string;
  case1Description: string;
  case2Description: string;
}

const defaultBookletData: BookletData = {
  // Pages 1-2: Basic Information
  practiceName: '',
  doctorName: '',
  tagline: '',
  specialty: '',
  
  // Page 3: About Practice
  practiceDescription: '',
  missionStatement: '',
  
  // Page 4: Doctor Profile
  welcomeMessage: '',
  doctorMessageParagraph: '',
  education: '',
  experience: '',
  
  // Page 5: Services
  service1: '',
  service2: '',
  service3: '',
  service4: '',
  service5: '',
  
  // Pages 6-7: Contact & Operations
  officeHours: '',
  address: '',
  contactInfo: '',
  
  // Page 8: Insurance & Billing
  insuranceInfo: '',
  paymentOptions: '',
  
  // Page 9-10: Patient Resources
  patientPortalInfo: '',
  appointmentInfo: '',
  
  // Page 11: Emergency & Support
  emergencyInfo: '',
  supportServices: '',
  
  // Page 12: Testimonials & Cases
  testimonial1: '',
  testimonial2: '',
  case1Description: '',
  case2Description: ''
};

// Enhanced HTML template with comprehensive placeholder support
const generateBookletHTML = (data: BookletData) => {
  const replaceTokens = (template: string, data: BookletData) => {
    return template
      .replace(/{{practiceName}}/g, data.practiceName || '[Practice Name]')
      .replace(/{{doctorName}}/g, data.doctorName || '[Doctor Name]')
      .replace(/{{tagline}}/g, data.tagline || '[Your Guide to Quality Care]')
      .replace(/{{specialty}}/g, data.specialty || '[Specialty]')
      .replace(/{{practiceDescription}}/g, data.practiceDescription || '[Practice Description]')
      .replace(/{{missionStatement}}/g, data.missionStatement || '[Mission Statement]')
      .replace(/{{welcomeMessage}}/g, data.welcomeMessage || '[Welcome Message]')
      .replace(/{{doctorMessageParagraph}}/g, data.doctorMessageParagraph || '[Doctor Message]')
      .replace(/{{education}}/g, data.education || '[Education & Training]')
      .replace(/{{experience}}/g, data.experience || '[Experience]')
      .replace(/{{officeHours}}/g, data.officeHours || '[Office Hours]')
      .replace(/{{contactInfo}}/g, data.contactInfo || '[Contact Information]')
      .replace(/{{address}}/g, data.address || '[Practice Address]')
      .replace(/{{insuranceInfo}}/g, data.insuranceInfo || '[Insurance Information]')
      .replace(/{{paymentOptions}}/g, data.paymentOptions || '[Payment Options]')
      .replace(/{{patientPortalInfo}}/g, data.patientPortalInfo || '[Patient Portal Information]')
      .replace(/{{appointmentInfo}}/g, data.appointmentInfo || '[Appointment Information]')
      .replace(/{{emergencyInfo}}/g, data.emergencyInfo || '[Emergency Information]')
      .replace(/{{supportServices}}/g, data.supportServices || '[Support Services]')
      .replace(/{{testimonial1}}/g, data.testimonial1 || '[Patient Testimonial 1]')
      .replace(/{{testimonial2}}/g, data.testimonial2 || '[Patient Testimonial 2]')
      .replace(/{{case1Description}}/g, data.case1Description || '[Case Study 1]')
      .replace(/{{case2Description}}/g, data.case2Description || '[Case Study 2]')
      .replace(/{{services}}/g, [data.service1, data.service2, data.service3, data.service4, data.service5]
        .filter(s => s && s.trim()).map(service => `<li>${service}</li>`).join(''));
  };

  const template = `
    <div class="booklet-container">
      <!-- Page 1: Cover -->
      <div class="booklet-page cover-page">
        <div class="cover-header">
          <h1>{{practiceName}}</h1>
          <h2>{{tagline}}</h2>
          <div class="specialty-badge">{{specialty}}</div>
        </div>
        <div class="cover-footer">
          <p class="doctor-name">{{doctorName}}</p>
          <p class="welcome-note">Welcome to Our Practice</p>
        </div>
      </div>

      <!-- Page 2: Welcome Message -->
      <div class="booklet-page">
        <h2>Welcome</h2>
        <div class="content">
          <p>{{welcomeMessage}}</p>
        </div>
      </div>

      <!-- Page 3: About Our Practice -->
      <div class="booklet-page">
        <h2>About Our Practice</h2>
        <div class="content">
          <h3>Practice Overview</h3>
          <p>{{practiceDescription}}</p>
          
          <h3>Our Mission</h3>
          <p>{{missionStatement}}</p>
        </div>
      </div>

      <!-- Page 4: Meet the Doctor -->
      <div class="booklet-page">
        <h2>Meet {{doctorName}}</h2>
        <div class="content">
          <p>{{doctorMessageParagraph}}</p>
          
          <h3>Education & Training</h3>
          <p>{{education}}</p>
          
          <h3>Experience</h3>
          <p>{{experience}}</p>
        </div>
      </div>

      <!-- Page 5: Our Services -->
      <div class="booklet-page">
        <h2>Our Services</h2>
        <div class="content">
          <p>We provide comprehensive care including:</p>
          <ul class="services-list">
            {{services}}
          </ul>
        </div>
      </div>

      <!-- Page 6: Office Hours & Location -->
      <div class="booklet-page">
        <h2>Visit Us</h2>
        <div class="content">
          <h3>Office Hours</h3>
          <p>{{officeHours}}</p>
          
          <h3>Location</h3>
          <p>{{address}}</p>
          
          <div class="contact-summary">
            <p>{{contactInfo}}</p>
          </div>
        </div>
      </div>

      <!-- Page 7: Contact Information -->
      <div class="booklet-page">
        <h2>How to Reach Us</h2>
        <div class="content">
          <h3>Contact Information</h3>
          <p>{{contactInfo}}</p>
          
          <h3>Appointment Scheduling</h3>
          <p>{{appointmentInfo}}</p>
        </div>
      </div>

      <!-- Page 8: Insurance & Billing -->
      <div class="booklet-page">
        <h2>Insurance & Billing</h2>
        <div class="content">
          <h3>Insurance Plans</h3>
          <p>{{insuranceInfo}}</p>
          
          <h3>Payment Options</h3>
          <p>{{paymentOptions}}</p>
        </div>
      </div>

      <!-- Page 9: Patient Resources -->
      <div class="booklet-page">
        <h2>Patient Resources</h2>
        <div class="content">
          <h3>Patient Portal</h3>
          <p>{{patientPortalInfo}}</p>
          
          <h3>Appointments</h3>
          <p>{{appointmentInfo}}</p>
        </div>
      </div>

      <!-- Page 10: Support Services -->
      <div class="booklet-page">
        <h2>Additional Support</h2>
        <div class="content">
          <h3>Support Services</h3>
          <p>{{supportServices}}</p>
        </div>
      </div>

      <!-- Page 11: Emergency Information -->
      <div class="booklet-page">
        <h2>Emergency Care</h2>
        <div class="content">
          <h3>After-Hours & Emergencies</h3>
          <p>{{emergencyInfo}}</p>
        </div>
      </div>

      <!-- Page 12: Testimonials -->
      <div class="booklet-page">
        <h2>What Our Patients Say</h2>
        <div class="content">
          <div class="testimonial">
            <p>"{{testimonial1}}"</p>
          </div>
          
          <div class="testimonial">
            <p>"{{testimonial2}}"</p>
          </div>
          
          <h3>Success Stories</h3>
          <div class="case-study">
            <p>{{case1Description}}</p>
          </div>
          
          <div class="case-study">
            <p>{{case2Description}}</p>
          </div>
          
          <div class="thank-you">
            Thank you for choosing {{practiceName}}!
          </div>
        </div>
      </div>
    </div>

    <style>
      .booklet-container {
        font-family: Georgia, serif;
        line-height: 1.6;
        color: #333;
        max-width: 210mm;
        margin: 0 auto;
      }

      .booklet-page {
        min-height: 297mm;
        padding: 40px;
        margin-bottom: 20px;
        background: white;
        box-shadow: 0 0 10px rgba(0,0,0,0.1);
        border-radius: 8px;
        page-break-after: always;
        page-break-inside: avoid;
      }

      .cover-page {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        text-align: center;
      }

      .cover-header h1 {
        font-size: 3em;
        margin-bottom: 20px;
        font-weight: bold;
      }

      .cover-header h2 {
        font-size: 1.5em;
        margin-bottom: 30px;
        opacity: 0.9;
        font-style: italic;
      }

      .specialty-badge {
        display: inline-block;
        padding: 15px 30px;
        background: rgba(255,255,255,0.2);
        border-radius: 25px;
        font-size: 1.2em;
        font-weight: bold;
        margin: 20px 0;
      }

      .cover-footer .doctor-name {
        font-size: 1.8em;
        font-weight: bold;
        margin-bottom: 10px;
      }

      .cover-footer .welcome-note {
        font-size: 1.2em;
        opacity: 0.8;
      }

      .booklet-page h2 {
        color: #667eea;
        border-bottom: 3px solid #667eea;
        padding-bottom: 10px;
        margin-bottom: 30px;
        font-size: 2.2em;
      }

      .booklet-page h3 {
        color: #555;
        margin-top: 25px;
        margin-bottom: 15px;
        font-size: 1.3em;
      }

      .content p {
        margin-bottom: 20px;
        font-size: 1.1em;
      }

      .services-list, .content ul {
        list-style-type: none;
        padding-left: 0;
      }

      .services-list li, .content ul li {
        background: #f7fafc;
        padding: 10px 15px;
        margin-bottom: 8px;
        border-left: 4px solid #667eea;
        border-radius: 4px;
      }

      .contact-summary {
        background: #edf2f7;
        padding: 20px;
        border-radius: 8px;
        margin: 20px 0;
        text-align: center;
      }

      .thank-you {
        font-weight: bold;
        text-align: center;
        font-size: 1.2em;
        color: #667eea;
        margin-top: 30px;
      }

      .testimonial, .case-study {
        background: #f8fafc;
        padding: 15px;
        border-left: 4px solid #667eea;
        margin: 15px 0;
        border-radius: 4px;
        font-style: italic;
      }

      @media print {
        .booklet-page {
          margin-bottom: 0;
          box-shadow: none;
          border: none;
          page-break-after: always;
          page-break-inside: avoid;
        }
        
        .booklet-container {
          font-size: 12pt;
          line-height: 1.5;
        }
        
        .cover-page h1 {
          font-size: 24pt;
        }
        
        .booklet-page h2 {
          font-size: 18pt;
        }
        
        .booklet-page h3 {
          font-size: 14pt;
        }
      }
    </style>
  `;

  return replaceTokens(template, data);
};

export function WelcomeBooklet({ isOpen, onClose, businessProfile }: WelcomeBookletProps) {
  const [bookletData, setBookletData] = useState<BookletData>(defaultBookletData);
  const [isGenerating, setIsGenerating] = useState(false);
  const [previewHTML, setPreviewHTML] = useState('');
  const { user } = useAuth();

  // Auto-fill form data from business profile
  useEffect(() => {
    if (businessProfile?.business_persona) {
      setBookletData(prev => ({
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

  // Generate preview when data changes
  useEffect(() => {
    setPreviewHTML(generateBookletHTML(bookletData));
  }, [bookletData]);

  const handleGenerateWithAI = async () => {
    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-assistant', {
        body: {
          prompt: `Generate content for a 12-page endodontic welcome booklet. Include fields such as practice name, tagline, doctor introduction, service list, testimonial quotes, referral explanation, and contact info. Return ONLY a JSON object with the following structure:

{
  "practiceName": "${bookletData.practiceName || 'Endodontic Specialists'}",
  "doctorName": "${bookletData.doctorName || 'Dr. Johnson'}",
  "tagline": "Compelling endodontic practice tagline focused on root canal excellence",
  "specialty": "Endodontics",
  "practiceDescription": "Detailed endodontic practice description highlighting expertise in root canal therapy and dental pain management (2-3 paragraphs)",
  "missionStatement": "Clear mission statement focused on preserving natural teeth through advanced endodontic care",
  "welcomeMessage": "Warm welcome message explaining endodontic specialty and patient comfort (2-3 paragraphs)",
  "doctorMessageParagraph": "Personal message from the endodontist about expertise and patient care philosophy",
  "education": "Endodontist's specialized education, residency, and board certifications",
  "experience": "Years of endodontic experience, case volume, and specialized training",
  "service1": "Root Canal Therapy",
  "service2": "Endodontic Retreatment",
  "service3": "Apicoectomy (Root-End Surgery)",
  "service4": "Traumatic Dental Injuries",
  "service5": "Cracked Tooth Treatment",
  "officeHours": "Complete office hours schedule including emergency availability",
  "address": "${bookletData.address || 'Endodontic practice address'}",
  "contactInfo": "${bookletData.contactInfo || 'Phone, email, emergency contact'}",
  "insuranceInfo": "Insurance plans accepted, pre-authorization requirements, and billing procedures for endodontic treatment",
  "paymentOptions": "Payment methods, financing options, and cost information for root canal procedures",
  "patientPortalInfo": "Patient portal features including pre-operative instructions and post-treatment care",
  "appointmentInfo": "How to schedule endodontic consultations, referral process, and what to expect",
  "emergencyInfo": "After-hours emergency procedures for severe dental pain and trauma",
  "supportServices": "Sedation options, comfort amenities, and post-treatment support",
  "testimonial1": "Realistic patient testimonial about successful root canal treatment and pain relief",
  "testimonial2": "Second patient testimonial about professional care and positive experience",
  "case1Description": "Endodontic success story about saving a severely damaged tooth",
  "case2Description": "Case study about complex retreatment or surgical endodontics"
}

Make all content professional, welcoming, and specific to endodontic care. Focus on pain management, tooth preservation, and advanced techniques. Ensure testimonials are realistic but anonymized.`,
          context: 'endodontic_welcome_booklet_generation'
        },
        headers: {
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
      });

      if (error) throw error;

      const aiContent = data.content || data.response;
      
      try {
        // Try to parse as JSON first
        const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsedData = JSON.parse(jsonMatch[0]);
          setBookletData(prev => ({ ...prev, ...parsedData }));
          toast.success('Content generated successfully with AI!');
        } else {
          throw new Error('No JSON found in response');
        }
      } catch (parseError) {
        console.error('JSON parse error, falling back to text parsing:', parseError);
        toast.success('Content partially generated!');
      }
    } catch (error) {
      console.error('Error generating content with AI:', error);
      toast.error('Failed to generate content. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const updateField = (field: keyof BookletData, value: string | string[]) => {
    setBookletData(prev => ({ ...prev, [field]: value }));
  };

  const fillExampleData = () => {
    setBookletData({
      practiceName: 'Wellness Medical Center',
      doctorName: 'Dr. Sarah Johnson',
      tagline: 'Your Partner in Health and Wellness',
      specialty: 'Family Medicine',
      practiceDescription: 'At Wellness Medical Center, we provide comprehensive healthcare services with a focus on preventive care and patient education. Our modern facility is equipped with the latest medical technology.',
      missionStatement: 'To deliver personalized, compassionate healthcare that exceeds our patients\' expectations while maintaining the highest standards of medical excellence.',
      welcomeMessage: 'Welcome to our practice! We are committed to providing you and your family with exceptional medical care in a comfortable environment.',
      doctorMessageParagraph: 'As your physician, I am dedicated to understanding your unique health needs and working with you to achieve optimal wellness.',
      education: 'MD from Johns Hopkins University, Residency in Family Medicine at Mayo Clinic',
      experience: '15+ years of experience in family medicine with specialization in preventive care and chronic disease management',
      service1: 'Annual Physical Exams',
      service2: 'Preventive Care Screenings',
      service3: 'Chronic Disease Management',
      service4: 'Minor Procedures',
      service5: 'Health Education & Counseling',
      officeHours: 'Monday-Friday: 8:00 AM - 6:00 PM\nSaturday: 9:00 AM - 2:00 PM\nSunday: Closed',
      address: '123 Health Street\nWellness City, WC 12345',
      contactInfo: 'Phone: (555) 123-4567\nEmail: info@wellnessmc.com',
      insuranceInfo: 'We accept most major insurance plans including Blue Cross, Aetna, UnitedHealth, and Medicare.',
      paymentOptions: 'We accept cash, credit cards, HSA/FSA cards, and offer payment plans for uninsured patients.',
      patientPortalInfo: 'Access your health records, test results, and communicate with our team through our secure online portal.',
      appointmentInfo: 'Schedule appointments online or call us directly. Same-day appointments available for urgent needs.',
      emergencyInfo: 'For after-hours emergencies, call our main number. For life-threatening emergencies, call 911.',
      supportServices: 'We offer nutrition counseling, health screenings, wellness programs, and educational resources.',
      testimonial1: 'Dr. Johnson and her team provide excellent care. They always take time to answer my questions and make me feel heard.',
      testimonial2: 'The staff is incredibly friendly and professional. I feel confident in the care I receive here.',
      case1Description: 'Successfully helped a patient reduce their diabetes medication through lifestyle changes and regular monitoring.',
      case2Description: 'Early detection of cardiovascular risk factors led to preventive treatment and improved patient outcomes.'
    });
    toast.success('Example data filled!');
  };

  const handleDownloadPDF = () => {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(previewHTML);
      printWindow.document.close();
      printWindow.print();
    }
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-screen-xl h-screen max-h-screen p-0 gap-0">
        <div className="flex h-full">
          {/* Left Panel - Preview */}
          <div className="flex-1 bg-gray-50 border-r">
            <div className="h-full flex flex-col">
              <div className="p-4 border-b bg-white flex items-center justify-between">
                <h3 className="font-semibold text-lg">Welcome Booklet Preview</h3>
                <div className="flex gap-2">
                  <Button
                    onClick={fillExampleData}
                    variant="outline"
                    size="sm"
                    className="flex items-center gap-2"
                  >
                    <FileText className="h-4 w-4" />
                    Fill Example
                  </Button>
                  <Button onClick={handleDownloadPDF} variant="outline" className="flex items-center gap-2">
                    <Download className="h-4 w-4" />
                    Download PDF
                  </Button>
                </div>
              </div>
              <ScrollArea className="flex-1 p-4">
                <div dangerouslySetInnerHTML={{ __html: previewHTML }} />
              </ScrollArea>
            </div>
          </div>

          {/* Right Panel - Editable Fields */}
          <div className="w-96 bg-white">
            <div className="h-full flex flex-col">
              <div className="p-4 border-b flex items-center justify-between">
                <h3 className="font-semibold text-lg">Edit Content</h3>
                <Button variant="ghost" size="sm" onClick={onClose}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              
              {/* Generate with AI Button */}
              <div className="p-4 border-b bg-gradient-to-r from-blue-50 to-purple-50">
                <Button
                  onClick={handleGenerateWithAI}
                  disabled={isGenerating}
                  className="w-full flex items-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                >
                  {isGenerating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  {isGenerating ? 'Generating...' : 'Generate with AI'}
                </Button>
                <p className="text-xs text-muted-foreground mt-2 text-center">
                  Fill all pages with endodontic-specific content
                </p>
              </div>
              
              <ScrollArea className="flex-1 p-4">
                <Accordion type="multiple" defaultValue={["basic-info"]} className="space-y-4">
                  
                  <AccordionItem value="basic-info">
                    <AccordionTrigger className="text-left">
                      Pages 1-2: Basic Information
                    </AccordionTrigger>
                    <AccordionContent className="space-y-4 pt-4">
                      <div>
                        <Label htmlFor="practiceName">Practice Name</Label>
                        <Input
                          id="practiceName"
                          value={bookletData.practiceName}
                          onChange={(e) => updateField('practiceName', e.target.value)}
                          placeholder="Enter practice name"
                        />
                      </div>
                      <div>
                        <Label htmlFor="doctorName">Doctor Name</Label>
                        <Input
                          id="doctorName"
                          value={bookletData.doctorName}
                          onChange={(e) => updateField('doctorName', e.target.value)}
                          placeholder="Enter doctor's name"
                        />
                      </div>
                      <div>
                        <Label htmlFor="tagline">Tagline</Label>
                        <Input
                          id="tagline"
                          value={bookletData.tagline}
                          onChange={(e) => updateField('tagline', e.target.value)}
                          placeholder="Practice tagline"
                        />
                      </div>
                      <div>
                        <Label htmlFor="specialty">Specialty</Label>
                        <Input
                          id="specialty"
                          value={bookletData.specialty}
                          onChange={(e) => updateField('specialty', e.target.value)}
                          placeholder="Medical specialty"
                        />
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="about-practice">
                    <AccordionTrigger className="text-left">
                      Page 3: About Practice
                    </AccordionTrigger>
                    <AccordionContent className="space-y-4 pt-4">
                      <div>
                        <Label htmlFor="practiceDescription">Practice Description</Label>
                        <Textarea
                          id="practiceDescription"
                          value={bookletData.practiceDescription}
                          onChange={(e) => updateField('practiceDescription', e.target.value)}
                          placeholder="Describe your practice"
                          rows={4}
                        />
                      </div>
                      <div>
                        <Label htmlFor="missionStatement">Mission Statement</Label>
                        <Textarea
                          id="missionStatement"
                          value={bookletData.missionStatement}
                          onChange={(e) => updateField('missionStatement', e.target.value)}
                          placeholder="Practice mission statement"
                          rows={3}
                        />
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="doctor-profile">
                    <AccordionTrigger className="text-left">
                      Page 4: Doctor Profile
                    </AccordionTrigger>
                    <AccordionContent className="space-y-4 pt-4">
                      <div>
                        <Label htmlFor="welcomeMessage">Welcome Message</Label>
                        <Textarea
                          id="welcomeMessage"
                          value={bookletData.welcomeMessage}
                          onChange={(e) => updateField('welcomeMessage', e.target.value)}
                          placeholder="Personal welcome message"
                          rows={4}
                        />
                      </div>
                      <div>
                        <Label htmlFor="doctorMessageParagraph">Doctor Message</Label>
                        <Textarea
                          id="doctorMessageParagraph"
                          value={bookletData.doctorMessageParagraph}
                          onChange={(e) => updateField('doctorMessageParagraph', e.target.value)}
                          placeholder="Personal message from the doctor"
                          rows={3}
                        />
                      </div>
                      <div>
                        <Label htmlFor="education">Education & Training</Label>
                        <Textarea
                          id="education"
                          value={bookletData.education}
                          onChange={(e) => updateField('education', e.target.value)}
                          placeholder="Doctor's education and training"
                          rows={2}
                        />
                      </div>
                      <div>
                        <Label htmlFor="experience">Experience</Label>
                        <Textarea
                          id="experience"
                          value={bookletData.experience}
                          onChange={(e) => updateField('experience', e.target.value)}
                          placeholder="Professional experience"
                          rows={2}
                        />
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="services">
                    <AccordionTrigger className="text-left">
                      Page 5: Services
                    </AccordionTrigger>
                    <AccordionContent className="space-y-4 pt-4">
                      <div>
                        <Label htmlFor="service1">Service 1</Label>
                        <Input
                          id="service1"
                          value={bookletData.service1}
                          onChange={(e) => updateField('service1', e.target.value)}
                          placeholder="Primary service"
                        />
                      </div>
                      <div>
                        <Label htmlFor="service2">Service 2</Label>
                        <Input
                          id="service2"
                          value={bookletData.service2}
                          onChange={(e) => updateField('service2', e.target.value)}
                          placeholder="Second service"
                        />
                      </div>
                      <div>
                        <Label htmlFor="service3">Service 3</Label>
                        <Input
                          id="service3"
                          value={bookletData.service3}
                          onChange={(e) => updateField('service3', e.target.value)}
                          placeholder="Third service"
                        />
                      </div>
                      <div>
                        <Label htmlFor="service4">Service 4</Label>
                        <Input
                          id="service4"
                          value={bookletData.service4}
                          onChange={(e) => updateField('service4', e.target.value)}
                          placeholder="Fourth service"
                        />
                      </div>
                      <div>
                        <Label htmlFor="service5">Service 5</Label>
                        <Input
                          id="service5"
                          value={bookletData.service5}
                          onChange={(e) => updateField('service5', e.target.value)}
                          placeholder="Fifth service"
                        />
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="contact-operations">
                    <AccordionTrigger className="text-left">
                      Pages 6-7: Contact & Operations
                    </AccordionTrigger>
                    <AccordionContent className="space-y-4 pt-4">
                      <div>
                        <Label htmlFor="officeHours">Office Hours</Label>
                        <Textarea
                          id="officeHours"
                          value={bookletData.officeHours}
                          onChange={(e) => updateField('officeHours', e.target.value)}
                          placeholder="Office hours schedule"
                          rows={3}
                        />
                      </div>
                      <div>
                        <Label htmlFor="address">Address</Label>
                        <Textarea
                          id="address"
                          value={bookletData.address}
                          onChange={(e) => updateField('address', e.target.value)}
                          placeholder="Practice address"
                          rows={2}
                        />
                      </div>
                      <div>
                        <Label htmlFor="contactInfo">Contact Information</Label>
                        <Textarea
                          id="contactInfo"
                          value={bookletData.contactInfo}
                          onChange={(e) => updateField('contactInfo', e.target.value)}
                          placeholder="Phone, email, etc."
                          rows={3}
                        />
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="insurance-billing">
                    <AccordionTrigger className="text-left">
                      Page 8: Insurance & Billing
                    </AccordionTrigger>
                    <AccordionContent className="space-y-4 pt-4">
                      <div>
                        <Label htmlFor="insuranceInfo">Insurance Information</Label>
                        <Textarea
                          id="insuranceInfo"
                          value={bookletData.insuranceInfo}
                          onChange={(e) => updateField('insuranceInfo', e.target.value)}
                          placeholder="Insurance plans accepted"
                          rows={3}
                        />
                      </div>
                      <div>
                        <Label htmlFor="paymentOptions">Payment Options</Label>
                        <Textarea
                          id="paymentOptions"
                          value={bookletData.paymentOptions}
                          onChange={(e) => updateField('paymentOptions', e.target.value)}
                          placeholder="Payment methods and policies"
                          rows={3}
                        />
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="patient-resources">
                    <AccordionTrigger className="text-left">
                      Pages 9-10: Patient Resources
                    </AccordionTrigger>
                    <AccordionContent className="space-y-4 pt-4">
                      <div>
                        <Label htmlFor="patientPortalInfo">Patient Portal Information</Label>
                        <Textarea
                          id="patientPortalInfo"
                          value={bookletData.patientPortalInfo}
                          onChange={(e) => updateField('patientPortalInfo', e.target.value)}
                          placeholder="Patient portal features and access"
                          rows={3}
                        />
                      </div>
                      <div>
                        <Label htmlFor="appointmentInfo">Appointment Information</Label>
                        <Textarea
                          id="appointmentInfo"
                          value={bookletData.appointmentInfo}
                          onChange={(e) => updateField('appointmentInfo', e.target.value)}
                          placeholder="How to schedule appointments"
                          rows={3}
                        />
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="emergency-support">
                    <AccordionTrigger className="text-left">
                      Page 11: Emergency & Support
                    </AccordionTrigger>
                    <AccordionContent className="space-y-4 pt-4">
                      <div>
                        <Label htmlFor="emergencyInfo">Emergency Information</Label>
                        <Textarea
                          id="emergencyInfo"
                          value={bookletData.emergencyInfo}
                          onChange={(e) => updateField('emergencyInfo', e.target.value)}
                          placeholder="After-hours and emergency procedures"
                          rows={3}
                        />
                      </div>
                      <div>
                        <Label htmlFor="supportServices">Support Services</Label>
                        <Textarea
                          id="supportServices"
                          value={bookletData.supportServices}
                          onChange={(e) => updateField('supportServices', e.target.value)}
                          placeholder="Additional support services offered"
                          rows={3}
                        />
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="testimonials">
                    <AccordionTrigger className="text-left">
                      Page 12: Testimonials & Cases
                    </AccordionTrigger>
                    <AccordionContent className="space-y-4 pt-4">
                      <div>
                        <Label htmlFor="testimonial1">Testimonial 1</Label>
                        <Textarea
                          id="testimonial1"
                          value={bookletData.testimonial1}
                          onChange={(e) => updateField('testimonial1', e.target.value)}
                          placeholder="Patient testimonial"
                          rows={2}
                        />
                      </div>
                      <div>
                        <Label htmlFor="testimonial2">Testimonial 2</Label>
                        <Textarea
                          id="testimonial2"
                          value={bookletData.testimonial2}
                          onChange={(e) => updateField('testimonial2', e.target.value)}
                          placeholder="Patient testimonial"
                          rows={2}
                        />
                      </div>
                      <div>
                        <Label htmlFor="case1Description">Case Study 1</Label>
                        <Textarea
                          id="case1Description"
                          value={bookletData.case1Description}
                          onChange={(e) => updateField('case1Description', e.target.value)}
                          placeholder="Success story or case study"
                          rows={2}
                        />
                      </div>
                      <div>
                        <Label htmlFor="case2Description">Case Study 2</Label>
                        <Textarea
                          id="case2Description"
                          value={bookletData.case2Description}
                          onChange={(e) => updateField('case2Description', e.target.value)}
                          placeholder="Success story or case study"
                          rows={2}
                        />
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                </Accordion>
              </ScrollArea>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}