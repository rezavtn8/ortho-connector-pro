import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Wand2, Download, X, Loader2, FileText } from 'lucide-react';
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
        <div class="cover-content">
          <h1>Welcome to {{practiceName}}</h1>
          <h2>{{tagline}}</h2>
          <div class="doctor-info">
            <h3>Dr. {{doctorName}}</h3>
            <p>{{specialty}}</p>
          </div>
        </div>
      </div>

      <!-- Page 2: Welcome Message -->
      <div class="booklet-page">
        <h2>Welcome</h2>
        <div class="content">
          <p>{{welcomeMessage}}</p>
          <p>{{practiceDescription}}</p>
        </div>
      </div>

      <!-- Page 3: About Our Practice -->
      <div class="booklet-page">
        <h2>About Our Practice</h2>
        <div class="content">
          <p>At {{practiceName}}, we are committed to providing exceptional healthcare services in a comfortable and caring environment.</p>
          <h3>Our Mission</h3>
          <p>{{missionStatement}}</p>
        </div>
      </div>

      <!-- Page 4: Meet Dr. {{doctorName}} -->
      <div class="booklet-page">
        <h2>Meet Dr. {{doctorName}}</h2>
        <div class="content">
          <div class="doctor-profile">
            <p>{{doctorMessageParagraph}}</p>
            <h3>Education & Training</h3>
            <p>{{education}}</p>
            <h3>Experience</h3>
            <p>{{experience}}</p>
          </div>
        </div>
      </div>

      <!-- Page 5: Our Services -->
      <div class="booklet-page">
        <h2>Our Services</h2>
        <div class="content">
          <p>We offer comprehensive medical services to meet all your healthcare needs:</p>
          <ul class="services-list">
            {{services}}
          </ul>
        </div>
      </div>

      <!-- Page 6: Office Hours & Location -->
      <div class="booklet-page">
        <h2>Office Hours & Location</h2>
        <div class="content">
          <h3>Office Hours</h3>
          <p>{{officeHours}}</p>
          <h3>Location</h3>
          <p>{{address}}</p>
          <h3>Contact Information</h3>
          <p>{{contactInfo}}</p>
        </div>
      </div>

      <!-- Page 7: Insurance & Billing -->
      <div class="booklet-page">
        <h2>Insurance & Billing</h2>
        <div class="content">
          <h3>Insurance Information</h3>
          <p>{{insuranceInfo}}</p>
          <h3>Payment Options</h3>
          <p>{{paymentOptions}}</p>
        </div>
      </div>

      <!-- Page 8: Patient Portal -->
      <div class="booklet-page">
        <h2>Patient Portal</h2>
        <div class="content">
          <h3>Access Your Health Information Online</h3>
          <p>{{patientPortalInfo}}</p>
          <h3>Portal Features</h3>
          <ul>
            <li>View test results</li>
            <li>Request appointments</li>
            <li>Communicate with your care team</li>
            <li>Access medical records</li>
          </ul>
        </div>
      </div>

      <!-- Page 9: Appointment Information -->
      <div class="booklet-page">
        <h2>Scheduling Your Appointment</h2>
        <div class="content">
          <p>{{appointmentInfo}}</p>
          <h3>What to Bring</h3>
          <ul>
            <li>Valid photo ID</li>
            <li>Insurance card</li>
            <li>List of current medications</li>
            <li>Medical history forms</li>
          </ul>
        </div>
      </div>

      <!-- Page 10: Emergency Information -->
      <div class="booklet-page">
        <h2>Emergency Information</h2>
        <div class="content">
          <h3>After Hours & Emergency Care</h3>
          <p>{{emergencyInfo}}</p>
          <h3>What Constitutes an Emergency</h3>
          <ul>
            <li>Severe chest pain</li>
            <li>Difficulty breathing</li>
            <li>Severe bleeding</li>
            <li>Loss of consciousness</li>
          </ul>
        </div>
      </div>

      <!-- Page 11: Patient Resources -->
      <div class="booklet-page">
        <h2>Patient Resources</h2>
        <div class="content">
          <h3>Health Education</h3>
          <p>We provide various resources to help you maintain optimal health and wellness.</p>
          <h3>Support Services</h3>
          <p>{{supportServices}}</p>
          <h3>Patient Testimonials</h3>
          <div class="testimonial">
            <p>"{{testimonial1}}"</p>
          </div>
          <div class="testimonial">
            <p>"{{testimonial2}}"</p>
          </div>
        </div>
      </div>

      <!-- Page 12: Contact & Follow-up -->
      <div class="booklet-page">
        <h2>Stay Connected</h2>
        <div class="content">
          <h3>We're Here for You</h3>
          <p>Your health and satisfaction are our top priorities. Please don't hesitate to contact us with any questions or concerns.</p>
          <h3>Case Studies</h3>
          <div class="case-study">
            <p>{{case1Description}}</p>
          </div>
          <div class="case-study">
            <p>{{case2Description}}</p>
          </div>
          <div class="contact-summary">
            <h4>{{practiceName}}</h4>
            <p>{{address}}</p>
            <p>{{contactInfo}}</p>
          </div>
          <p class="thank-you">Thank you for choosing {{practiceName}} for your healthcare needs!</p>
        </div>
      </div>
    </div>

    <style>
      .booklet-container {
        max-width: 800px;
        margin: 0 auto;
        font-family: 'Arial', sans-serif;
        line-height: 1.6;
        color: #333;
      }

      .booklet-page {
        background: white;
        padding: 40px;
        margin-bottom: 20px;
        border: 1px solid #e0e0e0;
        border-radius: 8px;
        min-height: 500px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        page-break-after: always;
      }

      .cover-page {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        text-align: center;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
      }

      .cover-page h1 {
        font-size: 3em;
        margin-bottom: 20px;
        font-weight: bold;
      }

      .cover-page h2 {
        font-size: 1.5em;
        margin-bottom: 40px;
        opacity: 0.9;
      }

      .doctor-info h3 {
        font-size: 2em;
        margin-bottom: 10px;
      }

      .doctor-info p {
        font-size: 1.2em;
        opacity: 0.8;
      }

      .booklet-page h2 {
        color: #667eea;
        border-bottom: 3px solid #667eea;
        padding-bottom: 10px;
        margin-bottom: 30px;
        font-size: 2em;
      }

      .booklet-page h3 {
        color: #5a67d8;
        margin-top: 25px;
        margin-bottom: 15px;
        font-size: 1.3em;
      }

      .booklet-page h4 {
        color: #4c51bf;
        margin-top: 20px;
        margin-bottom: 10px;
      }

      .content {
        font-size: 1.1em;
      }

      .content p {
        margin-bottom: 15px;
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

  const handleRegenerate = async () => {
    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-assistant', {
        body: {
          prompt: `Generate comprehensive content for a 12-page medical practice welcome booklet. Return ONLY a JSON object with the following structure:

{
  "practiceName": "${bookletData.practiceName || 'Modern Medical Practice'}",
  "doctorName": "${bookletData.doctorName || 'Dr. Smith'}",
  "tagline": "Compelling practice tagline",
  "specialty": "${bookletData.specialty || 'General Medicine'}",
  "practiceDescription": "Detailed practice description (2-3 paragraphs)",
  "missionStatement": "Clear mission statement",
  "welcomeMessage": "Warm welcome message (2-3 paragraphs)",
  "doctorMessageParagraph": "Personal message from the doctor",
  "education": "Doctor's education and training",
  "experience": "Doctor's experience and qualifications",
  "service1": "Primary service offering",
  "service2": "Second service offering",
  "service3": "Third service offering", 
  "service4": "Fourth service offering",
  "service5": "Fifth service offering",
  "officeHours": "Complete office hours schedule",
  "address": "${bookletData.address || 'Practice address'}",
  "contactInfo": "${bookletData.contactInfo || 'Contact information'}",
  "insuranceInfo": "Insurance plans accepted and billing information",
  "paymentOptions": "Available payment methods and financial policies",
  "patientPortalInfo": "Patient portal access and features",
  "appointmentInfo": "How to schedule appointments and preparation instructions",
  "emergencyInfo": "After-hours and emergency contact procedures",
  "supportServices": "Additional support services offered",
  "testimonial1": "Realistic patient testimonial",
  "testimonial2": "Second realistic patient testimonial",
  "case1Description": "Success story or case study",
  "case2Description": "Second success story or case study"
}

Make all content professional, welcoming, and specific to healthcare. Ensure testimonials and case studies are realistic but anonymized.`,
          context: 'welcome_booklet_json_generation'
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
          toast.success('Content regenerated successfully!');
        } else {
          throw new Error('No JSON found in response');
        }
      } catch (parseError) {
        console.error('JSON parse error, falling back to text parsing:', parseError);
        // Fallback to text parsing if JSON fails
        setBookletData(prev => ({
          ...prev,
          welcomeMessage: aiContent.includes('welcome') ? aiContent : prev.welcomeMessage,
        }));
        toast.success('Content partially regenerated!');
      }
    } catch (error) {
      console.error('Error regenerating content:', error);
      toast.error('Failed to regenerate content. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownloadPDF = () => {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(previewHTML);
      printWindow.document.close();
      printWindow.print();
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
                  <Button
                    onClick={handleRegenerate}
                    disabled={isGenerating}
                    className="flex items-center gap-2"
                  >
                    {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                    Regenerate
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
                          placeholder="Enter doctor name"
                        />
                      </div>
                      <div>
                        <Label htmlFor="tagline">Tagline</Label>
                        <Input
                          id="tagline"
                          value={bookletData.tagline}
                          onChange={(e) => updateField('tagline', e.target.value)}
                          placeholder="Your practice tagline"
                        />
                      </div>
                      <div>
                        <Label htmlFor="specialty">Specialty</Label>
                        <Input
                          id="specialty"
                          value={bookletData.specialty}
                          onChange={(e) => updateField('specialty', e.target.value)}
                          placeholder="Enter specialty"
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
                          rows={3}
                        />
                      </div>
                      <div>
                        <Label htmlFor="missionStatement">Mission Statement</Label>
                        <Textarea
                          id="missionStatement"
                          value={bookletData.missionStatement}
                          onChange={(e) => updateField('missionStatement', e.target.value)}
                          placeholder="Your practice mission statement"
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
                          placeholder="Monday - Friday: 9:00 AM - 5:00 PM"
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
                          placeholder="Phone, email, website"
                          rows={2}
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
                          rows={2}
                        />
                      </div>
                      <div>
                        <Label htmlFor="paymentOptions">Payment Options</Label>
                        <Textarea
                          id="paymentOptions"
                          value={bookletData.paymentOptions}
                          onChange={(e) => updateField('paymentOptions', e.target.value)}
                          placeholder="Available payment methods"
                          rows={2}
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
                          placeholder="Patient portal access instructions"
                          rows={2}
                        />
                      </div>
                      <div>
                        <Label htmlFor="appointmentInfo">Appointment Information</Label>
                        <Textarea
                          id="appointmentInfo"
                          value={bookletData.appointmentInfo}
                          onChange={(e) => updateField('appointmentInfo', e.target.value)}
                          placeholder="How to schedule appointments"
                          rows={2}
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
                          placeholder="After hours and emergency contact info"
                          rows={2}
                        />
                      </div>
                      <div>
                        <Label htmlFor="supportServices">Support Services</Label>
                        <Textarea
                          id="supportServices"
                          value={bookletData.supportServices}
                          onChange={(e) => updateField('supportServices', e.target.value)}
                          placeholder="Additional support services offered"
                          rows={2}
                        />
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="testimonials-cases">
                    <AccordionTrigger className="text-left">
                      Page 12: Testimonials & Cases
                    </AccordionTrigger>
                    <AccordionContent className="space-y-4 pt-4">
                      <div>
                        <Label htmlFor="testimonial1">Patient Testimonial 1</Label>
                        <Textarea
                          id="testimonial1"
                          value={bookletData.testimonial1}
                          onChange={(e) => updateField('testimonial1', e.target.value)}
                          placeholder="First patient testimonial"
                          rows={2}
                        />
                      </div>
                      <div>
                        <Label htmlFor="testimonial2">Patient Testimonial 2</Label>
                        <Textarea
                          id="testimonial2"
                          value={bookletData.testimonial2}
                          onChange={(e) => updateField('testimonial2', e.target.value)}
                          placeholder="Second patient testimonial"
                          rows={2}
                        />
                      </div>
                      <div>
                        <Label htmlFor="case1Description">Case Study 1</Label>
                        <Textarea
                          id="case1Description"
                          value={bookletData.case1Description}
                          onChange={(e) => updateField('case1Description', e.target.value)}
                          placeholder="First success story or case study"
                          rows={2}
                        />
                      </div>
                      <div>
                        <Label htmlFor="case2Description">Case Study 2</Label>
                        <Textarea
                          id="case2Description"
                          value={bookletData.case2Description}
                          onChange={(e) => updateField('case2Description', e.target.value)}
                          placeholder="Second success story or case study"
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