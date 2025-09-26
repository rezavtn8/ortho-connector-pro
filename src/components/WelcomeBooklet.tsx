import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { X } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { BookletPreview } from './BookletPreview';
import { BookletEditor } from './BookletEditor';

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
  
  // Page 9: Patient Resources
  patientPortalInfo: string;
  appointmentInfo: string;
  emergencyInfo: string;
  supportServices: string;
  
  // Pages 10-11: Testimonials & Success Stories
  testimonial1: string;
  testimonial2: string;
  case1Description: string;
  case2Description: string;
}

const defaultBookletData: BookletData = {
  practiceName: '',
  doctorName: '',
  tagline: '',
  specialty: '',
  practiceDescription: '',
  missionStatement: '',
  welcomeMessage: '',
  doctorMessageParagraph: '',
  education: '',
  experience: '',
  service1: '',
  service2: '',
  service3: '',
  service4: '',
  service5: '',
  officeHours: '',
  address: '',
  contactInfo: '',
  insuranceInfo: '',
  paymentOptions: '',
  patientPortalInfo: '',
  appointmentInfo: '',
  emergencyInfo: '',
  supportServices: '',
  testimonial1: '',
  testimonial2: '',
  case1Description: '',
  case2Description: ''
};

const generateBookletHTML = (data: BookletData): string => {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${data.practiceName} - Welcome Booklet</title>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Playfair+Display:wght@400;500;600;700&display=swap" rel="stylesheet">
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        :root {
          --primary: hsl(222, 84%, 4.9%);
          --primary-foreground: hsl(210, 40%, 98%);
          --secondary: hsl(210, 40%, 96%);
          --secondary-foreground: hsl(222.2, 84%, 4.9%);
          --muted: hsl(210, 40%, 96%);
          --muted-foreground: hsl(215.4, 16.3%, 46.9%);
          --accent: hsl(210, 40%, 96%);
          --accent-foreground: hsl(222.2, 84%, 4.9%);
          --destructive: hsl(0, 84.2%, 60.2%);
          --destructive-foreground: hsl(210, 40%, 98%);
          --border: hsl(214.3, 31.8%, 91.4%);
          --input: hsl(214.3, 31.8%, 91.4%);
          --ring: hsl(222.2, 84%, 4.9%);
          --radius: 0.5rem;
          --gradient-primary: linear-gradient(135deg, hsl(222, 84%, 4.9%), hsl(215, 25%, 15%));
          --gradient-secondary: linear-gradient(135deg, hsl(210, 40%, 96%), hsl(220, 14%, 96%));
          --shadow-elegant: 0 10px 30px -10px hsl(222, 84%, 4.9%, 0.3);
        }

        body {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          line-height: 1.6;
          color: hsl(222.2, 84%, 4.9%);
          background: white;
        }

        .booklet-container {
          max-width: 8.5in;
          margin: 0 auto;
          background: white;
          box-shadow: var(--shadow-elegant);
          border-radius: var(--radius);
          overflow: hidden;
        }

        .booklet-page {
          width: 100%;
          min-height: 11in;
          padding: 2rem;
          page-break-after: always;
          position: relative;
          background: white;
        }

        .booklet-page:last-child {
          page-break-after: avoid;
        }

        .page-header {
          text-align: center;
          margin-bottom: 2rem;
          padding-bottom: 1rem;
          border-bottom: 2px solid var(--border);
        }

        .practice-name {
          font-family: 'Playfair Display', serif;
          font-size: 2.5rem;
          font-weight: 700;
          color: var(--primary);
          margin-bottom: 0.5rem;
          background: var(--gradient-primary);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .tagline {
          font-size: 1.1rem;
          color: var(--muted-foreground);
          font-style: italic;
          font-weight: 300;
        }

        .page-title {
          font-family: 'Playfair Display', serif;
          font-size: 2rem;
          font-weight: 600;
          color: var(--primary);
          margin-bottom: 1.5rem;
          text-align: center;
        }

        .section-title {
          font-family: 'Playfair Display', serif;
          font-size: 1.5rem;
          font-weight: 600;
          color: var(--primary);
          margin: 2rem 0 1rem 0;
          padding-bottom: 0.5rem;
          border-bottom: 1px solid var(--border);
        }

        .content-block {
          margin-bottom: 1.5rem;
        }

        .content-block p {
          margin-bottom: 1rem;
          font-size: 1rem;
          line-height: 1.7;
          color: var(--secondary-foreground);
        }

        .doctor-profile {
          background: var(--gradient-secondary);
          padding: 2rem;
          border-radius: var(--radius);
          margin: 2rem 0;
          border-left: 4px solid var(--primary);
        }

        .services-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 1.5rem;
          margin: 2rem 0;
        }

        .service-card {
          background: white;
          padding: 1.5rem;
          border-radius: var(--radius);
          border: 1px solid var(--border);
          box-shadow: 0 2px 10px -3px hsl(222, 84%, 4.9%, 0.1);
          transition: all 0.3s ease;
        }

        .service-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 20px -5px hsl(222, 84%, 4.9%, 0.15);
        }

        .service-title {
          font-weight: 600;
          font-size: 1.1rem;
          color: var(--primary);
          margin-bottom: 0.5rem;
        }

        .contact-info {
          background: var(--gradient-primary);
          color: var(--primary-foreground);
          padding: 2rem;
          border-radius: var(--radius);
          margin: 2rem 0;
        }

        .contact-info h3 {
          color: var(--primary-foreground);
          margin-bottom: 1rem;
        }

        .contact-info p {
          color: hsl(210, 40%, 96%);
          margin-bottom: 0.5rem;
        }

        .testimonial {
          background: var(--muted);
          padding: 1.5rem;
          border-radius: var(--radius);
          margin: 1.5rem 0;
          border-left: 4px solid var(--primary);
          font-style: italic;
        }

        .testimonial-author {
          text-align: right;
          font-weight: 600;
          margin-top: 1rem;
          color: var(--muted-foreground);
          font-style: normal;
        }

        .case-study {
          background: white;
          padding: 2rem;
          border-radius: var(--radius);
          border: 2px solid var(--border);
          margin: 2rem 0;
        }

        .case-study h4 {
          color: var(--primary);
          font-weight: 600;
          margin-bottom: 1rem;
        }

        .footer {
          text-align: center;
          padding: 2rem;
          background: var(--gradient-secondary);
          margin-top: 3rem;
          border-radius: var(--radius);
        }

        .page-number {
          position: absolute;
          bottom: 1rem;
          right: 2rem;
          font-size: 0.9rem;
          color: var(--muted-foreground);
        }

        @media print {
          .booklet-container {
            box-shadow: none;
            border-radius: 0;
          }
          
          .booklet-page {
            margin: 0;
            box-shadow: none;
            border-radius: 0;
          }
        }

        @media (max-width: 768px) {
          .booklet-page {
            padding: 1rem;
          }
          
          .practice-name {
            font-size: 2rem;
          }
          
          .page-title {
            font-size: 1.5rem;
          }
          
          .services-grid {
            grid-template-columns: 1fr;
          }
        }
      </style>
    </head>
    <body>
      <div class="booklet-container">
        <!-- Page 1: Cover Page -->
        <div class="booklet-page" data-page="1">
          <div class="page-header">
            <h1 class="practice-name">${data.practiceName || 'Practice Name'}</h1>
            <p class="tagline">${data.tagline || 'Professional Excellence in Healthcare'}</p>
          </div>
          <div style="text-align: center; margin-top: 4rem;">
            <h2 style="font-family: 'Playfair Display', serif; font-size: 2.5rem; color: var(--primary); margin-bottom: 2rem;">Welcome</h2>
            <p style="font-size: 1.2rem; color: var(--muted-foreground); max-width: 600px; margin: 0 auto; line-height: 1.8;">
              ${data.welcomeMessage || 'Welcome to our practice. We are dedicated to providing exceptional healthcare with a personal touch.'}
            </p>
          </div>
          <div class="page-number">1</div>
        </div>

        <!-- Page 2: About Our Practice -->
        <div class="booklet-page" data-page="2">
          <h2 class="page-title">About Our Practice</h2>
          <div class="content-block">
            <h3 class="section-title">Our Story</h3>
            <p>${data.practiceDescription || 'Our practice is dedicated to providing exceptional healthcare services with a focus on patient comfort and advanced treatment options.'}</p>
          </div>
          <div class="content-block">
            <h3 class="section-title">Our Mission</h3>
            <p>${data.missionStatement || 'To provide comprehensive, compassionate healthcare while maintaining the highest standards of professional excellence.'}</p>
          </div>
          <div class="page-number">2</div>
        </div>

        <!-- Page 3: Meet the Doctor -->
        <div class="booklet-page" data-page="3">
          <h2 class="page-title">Meet ${data.doctorName || 'Dr. [Name]'}</h2>
          <div class="doctor-profile">
            <h3 style="color: var(--primary); margin-bottom: 1rem;">${data.specialty || 'Healthcare Professional'}</h3>
            <p>${data.doctorMessageParagraph || 'I am committed to providing personalized care and building lasting relationships with my patients. My approach focuses on understanding each patient\'s unique needs and concerns.'}</p>
          </div>
          <div class="content-block">
            <h3 class="section-title">Education & Training</h3>
            <p>${data.education || 'Advanced education and specialized training in modern healthcare practices.'}</p>
          </div>
          <div class="content-block">
            <h3 class="section-title">Experience</h3>
            <p>${data.experience || 'Years of dedicated practice serving the community with expertise and compassion.'}</p>
          </div>
          <div class="page-number">3</div>
        </div>

        <!-- Page 4: Our Services -->
        <div class="booklet-page" data-page="4">
          <h2 class="page-title">Our Services</h2>
          <div class="services-grid">
            ${data.service1 ? `<div class="service-card"><h4 class="service-title">${data.service1}</h4></div>` : ''}
            ${data.service2 ? `<div class="service-card"><h4 class="service-title">${data.service2}</h4></div>` : ''}
            ${data.service3 ? `<div class="service-card"><h4 class="service-title">${data.service3}</h4></div>` : ''}
            ${data.service4 ? `<div class="service-card"><h4 class="service-title">${data.service4}</h4></div>` : ''}
            ${data.service5 ? `<div class="service-card"><h4 class="service-title">${data.service5}</h4></div>` : ''}
          </div>
          <div class="page-number">4</div>
        </div>

        <!-- Page 5: Contact & Hours -->
        <div class="booklet-page" data-page="5">
          <h2 class="page-title">Contact & Hours</h2>
          <div class="contact-info">
            <h3>Get in Touch</h3>
            <p>${data.contactInfo || 'Phone: (555) 123-4567\\nEmail: info@practice.com'}</p>
            <h3 style="margin-top: 2rem;">Our Location</h3>
            <p>${data.address || '123 Healthcare Drive\\nCity, State 12345'}</p>
            <h3 style="margin-top: 2rem;">Office Hours</h3>
            <p>${data.officeHours || 'Monday - Friday: 8:00 AM - 5:00 PM\\nSaturday: 8:00 AM - 2:00 PM\\nSunday: Closed'}</p>
          </div>
          <div class="page-number">5</div>
        </div>

        <!-- Page 6: Insurance & Payment -->
        <div class="booklet-page" data-page="6">
          <h2 class="page-title">Insurance & Payment</h2>
          <div class="content-block">
            <h3 class="section-title">Insurance Information</h3>
            <p>${data.insuranceInfo || 'We accept most major insurance plans. Please contact our office to verify your coverage and benefits.'}</p>
          </div>
          <div class="content-block">
            <h3 class="section-title">Payment Options</h3>
            <p>${data.paymentOptions || 'We offer flexible payment options including cash, check, credit cards, and financing plans to make your care affordable.'}</p>
          </div>
          <div class="page-number">6</div>
        </div>

        <!-- Page 7: Patient Resources -->
        <div class="booklet-page" data-page="7">
          <h2 class="page-title">Patient Resources</h2>
          <div class="content-block">
            <h3 class="section-title">Patient Portal</h3>
            <p>${data.patientPortalInfo || 'Access your health information, schedule appointments, and communicate with our team through our secure patient portal.'}</p>
          </div>
          <div class="content-block">
            <h3 class="section-title">Scheduling Appointments</h3>
            <p>${data.appointmentInfo || 'Schedule your appointment by calling our office or using our online booking system. We offer convenient scheduling options.'}</p>
          </div>
          <div class="content-block">
            <h3 class="section-title">Emergency Information</h3>
            <p>${data.emergencyInfo || 'For after-hours emergencies, please call our main number. Emergency services and instructions are available 24/7.'}</p>
          </div>
          <div class="page-number">7</div>
        </div>

        <!-- Page 8: Patient Testimonials -->
        <div class="booklet-page" data-page="8">
          <h2 class="page-title">What Our Patients Say</h2>
          ${data.testimonial1 ? `
            <div class="testimonial">
              <p>"${data.testimonial1}"</p>
              <div class="testimonial-author">- Satisfied Patient</div>
            </div>
          ` : ''}
          ${data.testimonial2 ? `
            <div class="testimonial">
              <p>"${data.testimonial2}"</p>
              <div class="testimonial-author">- Happy Patient</div>
            </div>
          ` : ''}
          <div class="content-block">
            <h3 class="section-title">Support Services</h3>
            <p>${data.supportServices || 'We provide comprehensive support services to ensure your comfort and satisfaction throughout your care.'}</p>
          </div>
          <div class="page-number">8</div>
        </div>

        <!-- Page 9: Success Stories -->
        <div class="booklet-page" data-page="9">
          <h2 class="page-title">Success Stories</h2>
          ${data.case1Description ? `
            <div class="case-study">
              <h4>Case Study 1</h4>
              <p>${data.case1Description}</p>
            </div>
          ` : ''}
          ${data.case2Description ? `
            <div class="case-study">
              <h4>Case Study 2</h4>
              <p>${data.case2Description}</p>
            </div>
          ` : ''}
          <div class="page-number">9</div>
        </div>

        <!-- Page 10: Thank You -->
        <div class="booklet-page" data-page="10">
          <div style="text-align: center; margin-top: 4rem;">
            <h2 style="font-family: 'Playfair Display', serif; font-size: 2.5rem; color: var(--primary); margin-bottom: 2rem;">Thank You</h2>
            <p style="font-size: 1.2rem; color: var(--muted-foreground); max-width: 600px; margin: 0 auto; line-height: 1.8;">
              Thank you for choosing ${data.practiceName || 'our practice'}. We look forward to serving you and providing the highest quality care.
            </p>
          </div>
          <div class="footer">
            <h3 style="color: var(--primary); margin-bottom: 1rem;">${data.practiceName || 'Practice Name'}</h3>
            <p style="color: var(--muted-foreground);">${data.address || 'Address'}</p>
            <p style="color: var(--muted-foreground);">${data.contactInfo || 'Contact Information'}</p>
          </div>
          <div class="page-number">10</div>
        </div>
      </div>
    </body>
    </html>
  `;
};

export function WelcomeBooklet({ isOpen, onClose, businessProfile }: WelcomeBookletProps) {
  const [bookletData, setBookletData] = useState<BookletData>(defaultBookletData);
  const [previewHTML, setPreviewHTML] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const { user } = useAuth();

  const totalPages = 10;

  // Auto-fill from business profile
  useEffect(() => {
    if (businessProfile && isOpen) {
      setBookletData(prev => ({
        ...prev,
        practiceName: businessProfile.practice_name || prev.practiceName,
        doctorName: businessProfile.owner_name || prev.doctorName,
        address: businessProfile.address || prev.address,
        specialty: businessProfile.specialty || prev.specialty
      }));
    }
  }, [businessProfile, isOpen]);

  // Update preview HTML when data changes
  useEffect(() => {
    setPreviewHTML(generateBookletHTML(bookletData));
  }, [bookletData]);

  const handleGenerateWithAI = async () => {
    if (!user) return;

    setIsGenerating(true);
    try {
      const prompt = `Generate content for a 12-page ${bookletData.specialty || 'healthcare'} welcome booklet. Include fields such as practice name, tagline, doctor introduction, service list, testimonial quotes, referral explanation, and contact info. Return ONLY a JSON object with the following structure:

{
  "practiceName": "${bookletData.practiceName || 'Advanced Healthcare Practice'}",
  "doctorName": "${bookletData.doctorName || 'Dr. [Name]'}",
  "tagline": "Compelling practice tagline focused on excellence",
  "specialty": "${bookletData.specialty || 'Healthcare'}",
  "practiceDescription": "Detailed practice description highlighting expertise (2-3 paragraphs)",
  "missionStatement": "Clear mission statement focused on patient care",
  "welcomeMessage": "Warm welcome message explaining specialty and patient comfort (2-3 paragraphs)",
  "doctorMessageParagraph": "Personal message from the doctor about expertise and patient care philosophy",
  "education": "Doctor's specialized education, residency, and certifications",
  "experience": "Years of experience, case volume, and specialized training",
  "service1": "Primary Service",
  "service2": "Secondary Service", 
  "service3": "Third Service",
  "service4": "Fourth Service",
  "service5": "Fifth Service",
  "officeHours": "Complete office hours schedule including emergency availability",
  "address": "${bookletData.address || 'Practice address'}",
  "contactInfo": "Phone, email, emergency contact",
  "insuranceInfo": "Insurance plans accepted, pre-authorization requirements, and billing procedures",
  "paymentOptions": "Payment methods, financing options, and cost information",
  "patientPortalInfo": "Patient portal features including pre-operative instructions and post-treatment care",
  "appointmentInfo": "How to schedule consultations, referral process, and what to expect",
  "emergencyInfo": "After-hours emergency procedures",
  "supportServices": "Comfort amenities and post-treatment support",
  "testimonial1": "Realistic patient testimonial about successful treatment",
  "testimonial2": "Second patient testimonial about professional care and positive experience",
  "case1Description": "Success story about treatment outcome",
  "case2Description": "Case study about complex treatment or procedure"
}

Make all content professional, welcoming, and specific to ${bookletData.specialty || 'healthcare'} care. Ensure testimonials are realistic but anonymized.`;

      const { data, error } = await supabase.functions.invoke('ai-assistant', {
        body: { 
          prompt,
          context: businessProfile || {}
        },
        headers: {
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
      });

      if (error) throw error;

      if (data?.generatedText) {
        try {
          // Extract JSON from the response
          const jsonMatch = data.generatedText.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const generatedData = JSON.parse(jsonMatch[0]);
            setBookletData(prev => ({
              ...prev,
              ...generatedData
            }));
            toast.success('Booklet content generated successfully!');
          } else {
            throw new Error('No valid JSON found in response');
          }
        } catch (parseError) {
          console.error('Error parsing AI response:', parseError);
          toast.error('Error processing AI response. Please try again.');
        }
      }
    } catch (error: any) {
      console.error('Error generating booklet content:', error);
      toast.error('Failed to generate content. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const fillExampleData = () => {
    setBookletData({
      practiceName: 'Advanced Endodontic Care',
      doctorName: 'Dr. Sarah Johnson, DDS',
      tagline: 'Excellence in Root Canal Therapy',
      specialty: 'Endodontics',
      practiceDescription: 'Advanced Endodontic Care specializes in saving natural teeth through expert root canal therapy and endodontic surgical procedures. Our practice combines state-of-the-art technology with compassionate care to provide the highest standard of endodontic treatment.',
      missionStatement: 'To preserve natural teeth and eliminate dental pain through advanced endodontic techniques, ensuring optimal patient comfort and successful treatment outcomes.',
      welcomeMessage: 'Welcome to Advanced Endodontic Care. We understand that needing endodontic treatment can be concerning, which is why we are committed to making your experience as comfortable and stress-free as possible.',
      doctorMessageParagraph: 'As an endodontist, I am passionate about helping patients save their natural teeth. My extensive training and experience in root canal therapy allows me to provide gentle, effective treatment that eliminates pain and preserves your smile.',
      education: 'DDS from University of California, San Francisco; Endodontic Residency at Harvard School of Dental Medicine; Board Certified by the American Board of Endodontics',
      experience: 'Over 15 years of specialized endodontic practice with thousands of successful root canal procedures and endodontic surgeries',
      service1: 'Root Canal Therapy',
      service2: 'Endodontic Retreatment',
      service3: 'Apicoectomy (Root-End Surgery)',
      service4: 'Traumatic Dental Injuries',
      service5: 'Cracked Tooth Treatment',
      officeHours: 'Monday-Thursday: 8:00 AM - 5:00 PM\nFriday: 8:00 AM - 3:00 PM\nEmergency appointments available',
      address: '123 Dental Plaza, Suite 200\nHealthcare District\nCity, State 12345',
      contactInfo: 'Phone: (555) 123-ENDO\nFax: (555) 123-4568\nEmail: info@advancedendocare.com\nEmergency: (555) 999-HELP',
      insuranceInfo: 'We accept most major dental insurance plans including Delta Dental, MetLife, and Cigna. Pre-authorization may be required for some procedures.',
      paymentOptions: 'We accept cash, check, and all major credit cards. Financing options available through CareCredit.',
      patientPortalInfo: 'Access pre-treatment instructions, post-operative care guidelines, and appointment scheduling through our secure patient portal.',
      appointmentInfo: 'Schedule consultations through referral from your general dentist or by calling our office directly. Most urgent cases can be seen within 24 hours.',
      emergencyInfo: 'For dental emergencies involving severe pain or trauma, call our emergency line available 24/7 for immediate assistance.',
      supportServices: 'Nitrous oxide sedation, noise-canceling headphones, warm blankets, and comprehensive post-treatment support.',
      testimonial1: 'Dr. Johnson saved my tooth with a painless root canal. I was terrified, but her gentle approach and clear explanations made all the difference.',
      testimonial2: 'The entire staff was professional and caring. My root canal was completed efficiently with minimal discomfort. Highly recommend!',
      case1Description: 'A patient presented with severe pain in a previously treated tooth. Through careful evaluation and retreatment, we successfully saved the tooth and eliminated the infection.',
      case2Description: 'Complex case involving a cracked molar with pulp exposure. Using advanced microscopy and surgical techniques, we preserved the tooth with apicoectomy surgery.'
    });
    toast.success('Example content loaded!');
  };

  const clearAllData = () => {
    setBookletData(defaultBookletData);
    toast.success('All content cleared');
  };

  const handleDownloadPDF = () => {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(previewHTML);
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 gap-0">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-xl font-semibold">Welcome Booklet</h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 w-8 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <ResizablePanelGroup direction="horizontal" className="flex-1">
          <ResizablePanel defaultSize={60} minSize={40}>
            <BookletPreview
              htmlContent={previewHTML}
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              onDownloadPDF={handleDownloadPDF}
              className="h-full"
            />
          </ResizablePanel>
          
          <ResizableHandle withHandle />
          
          <ResizablePanel defaultSize={40} minSize={30}>
            <BookletEditor
              data={bookletData}
              onChange={setBookletData}
              onGenerateWithAI={handleGenerateWithAI}
              onFillExample={fillExampleData}
              onClearAll={clearAllData}
              isGenerating={isGenerating}
              className="h-full"
            />
          </ResizablePanel>
        </ResizablePanelGroup>
      </DialogContent>
    </Dialog>
  );
}