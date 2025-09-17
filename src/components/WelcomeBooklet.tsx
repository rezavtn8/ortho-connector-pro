import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent } from '@/components/ui/card';
import { Wand2, Download, X, Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface WelcomeBookletProps {
  isOpen: boolean;
  onClose: () => void;
  businessProfile?: any;
}

interface BookletData {
  practiceName: string;
  doctorName: string;
  specialty: string;
  practiceDescription: string;
  services: string[];
  welcomeMessage: string;
  officeHours: string;
  contactInfo: string;
  address: string;
  insuranceInfo: string;
  emergencyInfo: string;
  patientPortalInfo: string;
}

const defaultBookletData: BookletData = {
  practiceName: '',
  doctorName: '',
  specialty: '',
  practiceDescription: '',
  services: ['', '', '', '', ''],
  welcomeMessage: '',
  officeHours: '',
  contactInfo: '',
  address: '',
  insuranceInfo: '',
  emergencyInfo: '',
  patientPortalInfo: ''
};

// Sample HTML template structure for 12 pages
const generateBookletHTML = (data: BookletData) => {
  const replaceTokens = (template: string, data: BookletData) => {
    return template
      .replace(/{{practiceName}}/g, data.practiceName || '[Practice Name]')
      .replace(/{{doctorName}}/g, data.doctorName || '[Doctor Name]')
      .replace(/{{specialty}}/g, data.specialty || '[Specialty]')
      .replace(/{{practiceDescription}}/g, data.practiceDescription || '[Practice Description]')
      .replace(/{{welcomeMessage}}/g, data.welcomeMessage || '[Welcome Message]')
      .replace(/{{officeHours}}/g, data.officeHours || '[Office Hours]')
      .replace(/{{contactInfo}}/g, data.contactInfo || '[Contact Information]')
      .replace(/{{address}}/g, data.address || '[Practice Address]')
      .replace(/{{insuranceInfo}}/g, data.insuranceInfo || '[Insurance Information]')
      .replace(/{{emergencyInfo}}/g, data.emergencyInfo || '[Emergency Information]')
      .replace(/{{patientPortalInfo}}/g, data.patientPortalInfo || '[Patient Portal Information]')
      .replace(/{{services}}/g, data.services.filter(s => s.trim()).map(service => `<li>${service}</li>`).join(''));
  };

  const template = `
    <div class="booklet-container">
      <!-- Page 1: Cover -->
      <div class="booklet-page cover-page">
        <div class="cover-content">
          <h1>Welcome to {{practiceName}}</h1>
          <h2>Your Guide to Quality Care</h2>
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
          <p>To deliver personalized, comprehensive healthcare that exceeds our patients' expectations while maintaining the highest standards of medical excellence.</p>
        </div>
      </div>

      <!-- Page 4: Meet Dr. {{doctorName}} -->
      <div class="booklet-page">
        <h2>Meet Dr. {{doctorName}}</h2>
        <div class="content">
          <div class="doctor-profile">
            <p>Dr. {{doctorName}} specializes in {{specialty}} and brings years of experience and expertise to our practice.</p>
            <h3>Education & Training</h3>
            <p>Board-certified with extensive training in modern medical practices and patient care.</p>
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
          <p>We accept various payment methods including cash, credit cards, and most major insurance plans.</p>
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
          <h3>How to Schedule</h3>
          <p>Call us at {{contactInfo}} or use our online patient portal to schedule your appointment.</p>
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
          <ul>
            <li>Nutrition counseling</li>
            <li>Health screenings</li>
            <li>Wellness programs</li>
            <li>Educational materials</li>
          </ul>
        </div>
      </div>

      <!-- Page 12: Contact & Follow-up -->
      <div class="booklet-page">
        <h2>Stay Connected</h2>
        <div class="content">
          <h3>We're Here for You</h3>
          <p>Your health and satisfaction are our top priorities. Please don't hesitate to contact us with any questions or concerns.</p>
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

      @media print {
        .booklet-page {
          margin-bottom: 0;
          box-shadow: none;
          border: none;
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
          prompt: `Generate comprehensive content for a medical practice welcome booklet for:
            Practice: ${bookletData.practiceName}
            Doctor: ${bookletData.doctorName}
            Specialty: ${bookletData.specialty}
            
            Please provide:
            - A warm welcome message (2-3 paragraphs)
            - Practice description (1-2 paragraphs)
            - 5 key services offered
            - Office hours (sample format)
            - Insurance information (general statement)
            - Emergency contact information
            - Patient portal information
            
            Make it professional, welcoming, and informative.`,
          context: 'welcome_booklet_generation'
        },
        headers: {
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
      });

      if (error) throw error;

      const aiContent = data.content || data.response;
      
      // Parse AI response and update booklet data
      setBookletData(prev => ({
        ...prev,
        welcomeMessage: aiContent.match(/Welcome message[:\s]*([^]+?)(?=Practice description|$)/i)?.[1]?.trim() || prev.welcomeMessage,
        practiceDescription: aiContent.match(/Practice description[:\s]*([^]+?)(?=Services|$)/i)?.[1]?.trim() || prev.practiceDescription,
        services: aiContent.match(/Services[:\s]*([^]+?)(?=Office hours|$)/i)?.[1]?.split('\n').filter(s => s.trim()).slice(0, 5) || prev.services,
        officeHours: aiContent.match(/Office hours[:\s]*([^\n]+)/i)?.[1] || prev.officeHours,
        insuranceInfo: aiContent.match(/Insurance[:\s]*([^]+?)(?=Emergency|$)/i)?.[1]?.trim() || prev.insuranceInfo,
        emergencyInfo: aiContent.match(/Emergency[:\s]*([^]+?)(?=Patient portal|$)/i)?.[1]?.trim() || prev.emergencyInfo,
        patientPortalInfo: aiContent.match(/Patient portal[:\s]*([^]+?)$/i)?.[1]?.trim() || prev.patientPortalInfo
      }));

      toast.success('Content regenerated successfully!');
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

  const updateService = (index: number, value: string) => {
    const newServices = [...bookletData.services];
    newServices[index] = value;
    setBookletData(prev => ({ ...prev, services: newServices }));
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
                <div className="space-y-6">
                  <div className="space-y-4">
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
                      <Label htmlFor="specialty">Specialty</Label>
                      <Input
                        id="specialty"
                        value={bookletData.specialty}
                        onChange={(e) => updateField('specialty', e.target.value)}
                        placeholder="Enter specialty"
                      />
                    </div>

                    <div>
                      <Label htmlFor="welcomeMessage">Welcome Message</Label>
                      <Textarea
                        id="welcomeMessage"
                        value={bookletData.welcomeMessage}
                        onChange={(e) => updateField('welcomeMessage', e.target.value)}
                        placeholder="Enter welcome message"
                        rows={4}
                      />
                    </div>

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
                      <Label>Services (up to 5)</Label>
                      {bookletData.services.map((service, index) => (
                        <Input
                          key={index}
                          value={service}
                          onChange={(e) => updateService(index, e.target.value)}
                          placeholder={`Service ${index + 1}`}
                          className="mt-2"
                        />
                      ))}
                    </div>

                    <div>
                      <Label htmlFor="officeHours">Office Hours</Label>
                      <Textarea
                        id="officeHours"
                        value={bookletData.officeHours}
                        onChange={(e) => updateField('officeHours', e.target.value)}
                        placeholder="Monday - Friday: 9:00 AM - 5:00 PM"
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
                      <Label htmlFor="patientPortalInfo">Patient Portal Information</Label>
                      <Textarea
                        id="patientPortalInfo"
                        value={bookletData.patientPortalInfo}
                        onChange={(e) => updateField('patientPortalInfo', e.target.value)}
                        placeholder="Patient portal access instructions"
                        rows={2}
                      />
                    </div>
                  </div>
                </div>
              </ScrollArea>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}