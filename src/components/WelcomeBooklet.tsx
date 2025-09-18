import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Wand2, Download, X, Loader2, FileText, Sparkles, Send, RefreshCw } from 'lucide-react';
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

const generateBookletHTML = (data: BookletData) => {
  const template = `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${data.practiceName} - Welcome Booklet</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Playfair+Display:wght@400;600;700&display=swap" rel="stylesheet">
  </head>
  <body>
    <div class="booklet-container">
      
      <!-- Cover Page -->
      <div class="booklet-page cover-page">
        <div class="cover-content">
          <div class="practice-logo">
            <div class="logo-circle">
              <span class="logo-text">${data.practiceName.charAt(0)}</span>
            </div>
          </div>
          <h1 class="practice-title">${data.practiceName}</h1>
          <p class="tagline">${data.tagline}</p>
          <div class="welcome-card">
            <h2 class="welcome-title">Welcome to Our Practice</h2>
            <p class="welcome-message">${data.welcomeMessage}</p>
            <div class="specialty-badge">
              <span>${data.specialty}</span>
            </div>
          </div>
          <div class="contact-preview">
            <p>${data.address}</p>
            <p>${data.contactInfo}</p>
          </div>
        </div>
      </div>

      <!-- Page 2: About the Practice -->
      <div class="booklet-page">
        <div class="page-header">
          <h2 class="page-title">About ${data.practiceName}</h2>
          <div class="title-underline"></div>
        </div>
        <div class="content-grid">
          <div class="content-card">
            <div class="card-icon">🏥</div>
            <h3>Our Practice</h3>
            <p>${data.practiceDescription}</p>
          </div>
          <div class="content-card">
            <div class="card-icon">🎯</div>
            <h3>Our Mission</h3>
            <p>${data.missionStatement}</p>
          </div>
        </div>
      </div>

      <!-- Page 3: Meet the Doctor -->
      <div class="booklet-page">
        <div class="page-header">
          <h2 class="page-title">Meet ${data.doctorName}</h2>
          <div class="title-underline"></div>
        </div>
        <div class="doctor-profile">
          <div class="doctor-intro">
            <div class="content-card main-message">
              <div class="card-icon">👨‍⚕️</div>
              <h3>A Personal Message</h3>
              <p class="doctor-quote">"${data.doctorMessageParagraph}"</p>
            </div>
          </div>
          <div class="credentials-grid">
            <div class="credential-card">
              <div class="credential-icon">🎓</div>
              <h4>Education & Training</h4>
              <p>${data.education}</p>
            </div>
            <div class="credential-card">
              <div class="credential-icon">⭐</div>
              <h4>Experience</h4>
              <p>${data.experience}</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Page 4: Our Services -->
      <div class="booklet-page">
        <div class="page-header">
          <h2 class="page-title">Our Services</h2>
          <div class="title-underline"></div>
        </div>
        <div class="services-showcase">
          <div class="service-card featured">
            <div class="service-icon">🦷</div>
            <h4>${data.service1}</h4>
            <div class="service-highlight"></div>
          </div>
          <div class="services-grid">
            <div class="service-card">
              <div class="service-icon">🔄</div>
              <h4>${data.service2}</h4>
            </div>
            <div class="service-card">
              <div class="service-icon">🔬</div>
              <h4>${data.service3}</h4>
            </div>
            <div class="service-card">
              <div class="service-icon">⚡</div>
              <h4>${data.service4}</h4>
            </div>
            <div class="service-card">
              <div class="service-icon">🩹</div>
              <h4>${data.service5}</h4>
            </div>
          </div>
        </div>
      </div>

      <!-- Page 5: Office Information -->
      <div class="booklet-page">
        <div class="page-header">
          <h2 class="page-title">Office Information</h2>
          <div class="title-underline"></div>
        </div>
        <div class="office-info-grid">
          <div class="info-card schedule">
            <div class="card-icon">🕒</div>
            <h3>Office Hours</h3>
            <div class="schedule-content">
              <pre>${data.officeHours}</pre>
            </div>
          </div>
          <div class="info-card location">
            <div class="card-icon">📍</div>
            <h3>Location</h3>
            <div class="address-content">
              <pre>${data.address}</pre>
            </div>
          </div>
          <div class="info-card contact">
            <div class="card-icon">📞</div>
            <h3>Contact Information</h3>
            <div class="contact-content">
              <pre>${data.contactInfo}</pre>
            </div>
          </div>
        </div>
      </div>

      <!-- Page 6: Insurance & Billing -->
      <div class="booklet-page">
        <div class="page-header">
          <h2 class="page-title">Insurance & Billing</h2>
          <div class="title-underline"></div>
        </div>
        <div class="billing-section">
          <div class="content-card insurance">
            <div class="card-icon">🏛️</div>
            <h3>Insurance Plans Accepted</h3>
            <p>${data.insuranceInfo}</p>
          </div>
          <div class="content-card payment">
            <div class="card-icon">💳</div>
            <h3>Payment Options</h3>
            <p>${data.paymentOptions}</p>
          </div>
        </div>
      </div>

      <!-- Page 7: Patient Resources -->
      <div class="booklet-page">
        <div class="page-header">
          <h2 class="page-title">Patient Resources</h2>
          <div class="title-underline"></div>
        </div>
        <div class="resources-grid">
          <div class="content-card portal">
            <div class="card-icon">💻</div>
            <h3>Patient Portal</h3>
            <p>${data.patientPortalInfo}</p>
          </div>
          <div class="content-card appointments">
            <div class="card-icon">📅</div>
            <h3>Scheduling Appointments</h3>
            <p>${data.appointmentInfo}</p>
          </div>
        </div>
      </div>

      <!-- Page 8: Emergency & Support -->
      <div class="booklet-page">
        <div class="page-header">
          <h2 class="page-title">Emergency & Support</h2>
          <div class="title-underline"></div>
        </div>
        <div class="emergency-section">
          <div class="content-card emergency">
            <div class="card-icon emergency-icon">🚨</div>
            <h3>Emergency Procedures</h3>
            <p>${data.emergencyInfo}</p>
          </div>
          <div class="content-card support">
            <div class="card-icon">🤝</div>
            <h3>Support Services</h3>
            <p>${data.supportServices}</p>
          </div>
        </div>
      </div>

      <!-- Page 9: Testimonials & Success Stories -->
      <div class="booklet-page">
        <div class="page-header">
          <h2 class="page-title">What Our Patients Say</h2>
          <div class="title-underline"></div>
        </div>
        <div class="testimonials-section">
          <div class="testimonial-card">
            <div class="quote-icon">💬</div>
            <p class="testimonial-text">"${data.testimonial1}"</p>
            <div class="testimonial-author">
              <div class="stars">⭐⭐⭐⭐⭐</div>
              <span class="patient-initial">- Patient</span>
            </div>
          </div>
          <div class="testimonial-card">
            <div class="quote-icon">💬</div>
            <p class="testimonial-text">"${data.testimonial2}"</p>
            <div class="testimonial-author">
              <div class="stars">⭐⭐⭐⭐⭐</div>
              <span class="patient-initial">- Patient</span>
            </div>
          </div>
          <div class="success-stories">
            <h3 class="stories-title">Success Stories</h3>
            <div class="case-study-card">
              <div class="case-icon">✅</div>
              <p>${data.case1Description}</p>
            </div>
            <div class="case-study-card">
              <div class="case-icon">✅</div>
              <p>${data.case2Description}</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Thank You Page -->
      <div class="booklet-page thank-you-page">
        <div class="thank-you-content">
          <div class="gratitude-message">
            <h2 class="thank-you-title">Thank You for Choosing ${data.practiceName}</h2>
            <p class="thank-you-subtitle">We look forward to serving you and your family</p>
          </div>
          <div class="final-contact-card">
            <div class="contact-header">
              <h3>We're Here to Help</h3>
              <div class="contact-decoration"></div>
            </div>
            <div class="contact-details">
              <div class="contact-item">
                <div class="contact-icon">📞</div>
                <pre>${data.contactInfo}</pre>
              </div>
              <div class="contact-item">
                <div class="contact-icon">📍</div>
                <pre>${data.address}</pre>
              </div>
            </div>
            <div class="visit-cta">
              <p class="cta-text">Schedule your appointment today!</p>
            </div>
          </div>
        </div>
      </div>

    </div>
  </body>

  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      line-height: 1.6;
      color: hsl(185 20% 20%);
      background: white;
      -webkit-font-smoothing: antialiased;
    }

    .booklet-container {
      max-width: 8.5in;
      margin: 0 auto;
      background: white;
    }

    .booklet-page {
      width: 100%;
      min-height: 11in;
      padding: 1in;
      margin-bottom: 20px;
      background: white;
      box-shadow: 0 10px 30px -10px hsl(185 75% 35% / 0.2);
      border: 1px solid hsl(185 15% 85%);
      page-break-after: always;
      page-break-inside: avoid;
      position: relative;
    }

    /* Cover Page Styles */
    .cover-page {
      background: linear-gradient(135deg, hsl(185 15% 99%), hsl(185 15% 95%));
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .cover-content {
      text-align: center;
      max-width: 600px;
    }

    .practice-logo {
      margin-bottom: 2rem;
    }

    .logo-circle {
      width: 100px;
      height: 100px;
      border-radius: 50%;
      background: linear-gradient(135deg, hsl(185 75% 35%), hsl(185 75% 45%));
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 1rem;
      box-shadow: 0 0 20px hsl(185 75% 35% / 0.3);
    }

    .logo-text {
      font-size: 2.5rem;
      font-weight: 700;
      color: white;
      font-family: 'Playfair Display', serif;
    }

    .practice-title {
      font-family: 'Playfair Display', serif;
      font-size: 3.5rem;
      font-weight: 700;
      color: hsl(185 75% 35%);
      margin-bottom: 0.5rem;
      line-height: 1.1;
    }

    .tagline {
      font-size: 1.3rem;
      color: hsl(185 10% 45%);
      margin-bottom: 2.5rem;
      font-style: italic;
      font-weight: 500;
    }

    .welcome-card {
      background: white;
      border: 2px solid hsl(185 75% 35%);
      padding: 2.5rem;
      border-radius: 16px;
      margin-bottom: 2rem;
      box-shadow: 0 0 20px hsl(185 75% 35% / 0.1);
    }

    .welcome-title {
      font-size: 1.8rem;
      color: hsl(185 75% 35%);
      margin-bottom: 1rem;
      font-weight: 600;
    }

    .welcome-message {
      font-size: 1.1rem;
      line-height: 1.7;
      color: hsl(185 20% 30%);
      margin-bottom: 1.5rem;
    }

    .specialty-badge {
      display: inline-block;
      background: linear-gradient(135deg, hsl(185 75% 35%), hsl(185 75% 45%));
      color: white;
      padding: 0.5rem 1.5rem;
      border-radius: 25px;
      font-weight: 600;
      font-size: 0.9rem;
      letter-spacing: 0.5px;
    }

    .contact-preview {
      font-size: 0.95rem;
      color: hsl(185 10% 50%);
      line-height: 1.4;
    }

    /* Page Headers */
    .page-header {
      margin-bottom: 2.5rem;
      text-align: center;
    }

    .page-title {
      font-family: 'Playfair Display', serif;
      font-size: 2.2rem;
      font-weight: 600;
      color: hsl(185 75% 35%);
      margin-bottom: 0.5rem;
    }

    .title-underline {
      width: 80px;
      height: 3px;
      background: linear-gradient(90deg, hsl(185 75% 35%), hsl(185 75% 45%));
      margin: 0 auto;
      border-radius: 2px;
    }

    /* Content Cards */
    .content-card {
      background: linear-gradient(145deg, hsl(185 10% 99%), hsl(185 15% 96%));
      padding: 1.8rem;
      border-radius: 12px;
      border-left: 4px solid hsl(185 75% 35%);
      box-shadow: 0 4px 20px -4px hsl(185 20% 20% / 0.08);
      margin-bottom: 1.5rem;
    }

    .content-card h3 {
      font-size: 1.3rem;
      color: hsl(185 75% 35%);
      margin-bottom: 1rem;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .card-icon {
      font-size: 1.5rem;
      margin-right: 0.5rem;
    }

    /* Grids */
    .content-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 2rem;
    }

    .office-info-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 1.5rem;
    }

    .resources-grid, .emergency-section, .billing-section {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 2rem;
    }

    /* Services Showcase */
    .services-showcase {
      text-align: center;
    }

    .service-card.featured {
      background: linear-gradient(135deg, hsl(185 75% 35%), hsl(185 75% 45%));
      color: white;
      padding: 2rem;
      border-radius: 16px;
      margin-bottom: 2rem;
      box-shadow: 0 0 20px hsl(185 75% 35% / 0.3);
    }

    .service-card.featured h4 {
      color: white;
      font-size: 1.4rem;
      margin-top: 0.5rem;
    }

    .services-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 1.5rem;
    }

    .service-card {
      background: hsl(185 10% 98%);
      padding: 1.5rem;
      border-radius: 12px;
      border: 2px solid hsl(185 15% 90%);
      text-align: center;
      transition: all 0.3s ease;
    }

    .service-icon {
      font-size: 2rem;
      margin-bottom: 0.5rem;
    }

    .service-card h4 {
      font-size: 1.1rem;
      color: hsl(185 75% 35%);
      font-weight: 600;
    }

    /* Doctor Profile */
    .doctor-profile .main-message {
      margin-bottom: 2rem;
    }

    .doctor-quote {
      font-style: italic;
      font-size: 1.1rem;
      color: hsl(185 20% 25%);
      line-height: 1.7;
    }

    .credentials-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 2rem;
    }

    .credential-card {
      background: hsl(185 5% 98%);
      padding: 1.5rem;
      border-radius: 12px;
      border: 2px solid hsl(185 15% 90%);
    }

    .credential-icon {
      font-size: 2rem;
      margin-bottom: 0.5rem;
    }

    .credential-card h4 {
      color: hsl(185 75% 35%);
      font-weight: 600;
      margin-bottom: 0.8rem;
    }

    /* Testimonials */
    .testimonials-section {
      space-y: 2rem;
    }

    .testimonial-card {
      background: hsl(185 5% 98%);
      padding: 2rem;
      border-radius: 12px;
      border-left: 4px solid hsl(150 75% 35%);
      margin-bottom: 1.5rem;
      box-shadow: 0 4px 20px -4px hsl(150 75% 35% / 0.1);
    }

    .quote-icon {
      font-size: 1.5rem;
      color: hsl(150 75% 35%);
      margin-bottom: 1rem;
    }

    .testimonial-text {
      font-style: italic;
      font-size: 1.1rem;
      line-height: 1.7;
      color: hsl(185 20% 25%);
      margin-bottom: 1rem;
    }

    .testimonial-author {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .stars {
      color: hsl(45 85% 55%);
    }

    .patient-initial {
      font-weight: 500;
      color: hsl(185 10% 50%);
    }

    .success-stories {
      margin-top: 2rem;
    }

    .stories-title {
      font-size: 1.4rem;
      color: hsl(185 75% 35%);
      margin-bottom: 1.5rem;
      text-align: center;
      font-weight: 600;
    }

    .case-study-card {
      background: linear-gradient(145deg, hsl(150 20% 98%), hsl(150 15% 96%));
      padding: 1.5rem;
      border-radius: 12px;
      border-left: 4px solid hsl(150 75% 35%);
      margin-bottom: 1rem;
      display: flex;
      align-items: flex-start;
      gap: 1rem;
    }

    .case-icon {
      font-size: 1.2rem;
      color: hsl(150 75% 35%);
      margin-top: 0.2rem;
    }

    /* Thank You Page */
    .thank-you-page {
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, hsl(185 15% 99%), hsl(185 10% 96%));
    }

    .thank-you-content {
      text-align: center;
      max-width: 600px;
    }

    .gratitude-message {
      margin-bottom: 3rem;
    }

    .thank-you-title {
      font-family: 'Playfair Display', serif;
      font-size: 2.5rem;
      font-weight: 700;
      color: hsl(185 75% 35%);
      margin-bottom: 1rem;
      line-height: 1.2;
    }

    .thank-you-subtitle {
      font-size: 1.2rem;
      color: hsl(185 10% 45%);
      font-style: italic;
    }

    .final-contact-card {
      background: white;
      border: 2px solid hsl(185 75% 35%);
      padding: 2.5rem;
      border-radius: 16px;
      box-shadow: 0 0 20px hsl(185 75% 35% / 0.1);
    }

    .contact-header h3 {
      font-size: 1.5rem;
      color: hsl(185 75% 35%);
      margin-bottom: 1rem;
      font-weight: 600;
    }

    .contact-decoration {
      width: 50px;
      height: 3px;
      background: linear-gradient(90deg, hsl(185 75% 35%), hsl(185 75% 45%));
      margin: 0 auto 1.5rem;
      border-radius: 2px;
    }

    .contact-details {
      margin-bottom: 2rem;
    }

    .contact-item {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 1rem;
      margin-bottom: 1rem;
      font-size: 1.05rem;
    }

    .contact-icon {
      font-size: 1.2rem;
      color: hsl(185 75% 35%);
    }

    .visit-cta {
      background: linear-gradient(135deg, hsl(185 75% 35%), hsl(185 75% 45%));
      color: white;
      padding: 1rem 2rem;
      border-radius: 25px;
      display: inline-block;
    }

    .cta-text {
      font-weight: 600;
      font-size: 1.1rem;
    }

    /* Emergency Styles */
    .emergency-icon {
      color: hsl(0 84% 60%) !important;
    }

    .content-card.emergency {
      border-left-color: hsl(0 84% 60%);
      background: linear-gradient(145deg, hsl(0 20% 99%), hsl(0 15% 96%));
    }

    /* Pre formatting for addresses and contact info */
    pre {
      font-family: inherit;
      white-space: pre-line;
      word-wrap: break-word;
    }

    /* Print Styles */
    @media print {
      body {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }

      .booklet-page {
        margin-bottom: 0;
        box-shadow: none;
        border: none;
        page-break-after: always;
        page-break-inside: avoid;
        width: 8.5in;
        height: 11in;
        padding: 0.75in;
      }
      
      .booklet-container {
        font-size: 11pt;
        line-height: 1.4;
      }
      
      .practice-title {
        font-size: 28pt;
      }
      
      .page-title {
        font-size: 20pt;
      }
      
      h3 {
        font-size: 14pt;
      }

      .content-grid, .resources-grid, .emergency-section, .billing-section {
        grid-template-columns: 1fr;
        gap: 1rem;
      }

      .services-grid {
        grid-template-columns: repeat(2, 1fr);
        gap: 1rem;
      }

      .credentials-grid {
        grid-template-columns: 1fr;
      }
    }

    @media screen and (max-width: 768px) {
      .content-grid, .resources-grid, .emergency-section, .billing-section, .credentials-grid {
        grid-template-columns: 1fr;
      }
      
      .services-grid {
        grid-template-columns: 1fr;
      }
    }
  </style>
  `;

  return template;
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
      practiceName: 'Advanced Endodontic Care',
      doctorName: 'Dr. Sarah Johnson, DDS',
      tagline: 'Preserving Your Natural Teeth with Expert Endodontic Care',
      specialty: 'Endodontics',
      practiceDescription: 'At Advanced Endodontic Care, we specialize in saving natural teeth through advanced root canal therapy and endodontic treatments. Our state-of-the-art facility utilizes the latest technology and techniques to ensure comfortable, successful outcomes for our patients.',
      missionStatement: 'To preserve natural teeth through expert endodontic care, utilizing advanced technology and compassionate treatment to eliminate pain and restore oral health.',
      welcomeMessage: 'Welcome to our endodontic practice! We understand that visiting an endodontist can be stressful, which is why we prioritize your comfort and provide gentle, expert care to preserve your natural teeth.',
      doctorMessageParagraph: 'As a board-certified endodontist, I am committed to providing you with the highest quality endodontic care in a comfortable, caring environment. My goal is to help you maintain your natural teeth for a lifetime.',
      education: 'DDS from University of California San Francisco, Endodontic Residency at Harvard School of Dental Medicine, Board Certified by the American Board of Endodontics',
      experience: '15+ years of specialized endodontic practice with over 8,000 successful root canal procedures and advanced surgical endodontic treatments',
      service1: 'Root Canal Therapy',
      service2: 'Endodontic Retreatment',
      service3: 'Apicoectomy Surgery',
      service4: 'Traumatic Dental Injuries',
      service5: 'Cracked Tooth Treatment',
      officeHours: 'Monday - Thursday: 8:00 AM - 5:00 PM\nFriday: 8:00 AM - 2:00 PM\nSaturday & Sunday: Emergency Only\nEmergency Line: Available 24/7',
      address: '123 Dental Plaza, Suite 200\nHealthcare District\nCity, State 12345',
      contactInfo: 'Phone: (555) 123-ENDO\nFax: (555) 123-4568\nEmail: info@advancedendocare.com\nEmergency: (555) 999-HELP',
      insuranceInfo: 'We accept most major dental insurance plans including Delta Dental, MetLife, Cigna, Aetna, and Guardian. We provide detailed treatment estimates and help with pre-authorizations to maximize your benefits.',
      paymentOptions: 'We accept cash, checks, credit cards, CareCredit financing, and HSA/FSA accounts. Payment plans available for extensive treatments.',
      patientPortalInfo: 'Access your secure patient portal to view treatment plans, post-operative instructions, appointment scheduling, and communicate with our team. Pre-operative instructions and educational materials available online.',
      appointmentInfo: 'Most appointments can be scheduled within 24-48 hours. Emergency appointments available same day. Referrals welcome from general dentists. Initial consultation includes digital imaging and comprehensive evaluation.',
      emergencyInfo: 'For after-hours dental emergencies involving severe pain, swelling, or trauma, call our emergency line at (555) 999-HELP. Dr. Johnson or our on-call associate will respond promptly to urgent situations.',
      supportServices: 'Nitrous oxide sedation available, digital X-rays with reduced radiation, same-day emergency treatment, post-operative care instructions, and 24/7 emergency support for all patients.',
      testimonial1: 'Dr. Johnson saved my tooth when I thought it would need to be extracted. The root canal was completely painless and I felt comfortable throughout the entire procedure. I highly recommend this practice!',
      testimonial2: 'The staff was incredibly professional and caring. They explained every step of the treatment and made sure I was comfortable. My emergency appointment was handled quickly and efficiently.',
      case1Description: 'Successfully treated a complex case involving a fractured molar with calcified canals using advanced microscopy and ultrasonic techniques, preserving the patient\'s natural tooth.',
      case2Description: 'Performed apicoectomy surgery on a previously treated tooth with persistent infection, resulting in complete healing and symptom resolution within 6 months.'
    });
    toast.success('Example data loaded successfully!');
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
      <DialogContent className="max-w-screen-xl h-screen max-h-screen p-0 gap-0 bg-gradient-subtle">
        <div className="flex h-full bg-gradient-subtle">
          {/* Left Side - Preview */}
          <div className="flex-1 p-6">
            <Card className="h-full shadow-elegant border-border/50 bg-gradient-card">
              <div className="h-16 bg-gradient-connection border-b border-border/30 flex items-center px-6 rounded-t-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <FileText className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <span className="font-semibold text-foreground text-lg">Live Preview</span>
                    <p className="text-xs text-muted-foreground">Real-time booklet preview</p>
                  </div>
                </div>
                <div className="ml-auto flex items-center gap-4">
                  <Button onClick={handleDownloadPDF} variant="outline" size="sm" className="border-primary/20 hover:bg-primary/5">
                    <Download className="w-4 h-4 mr-2" />
                    Download PDF
                  </Button>
                  <div className="flex gap-2">
                    <div className="w-3 h-3 rounded-full bg-status-moderate/60"></div>
                    <div className="w-3 h-3 rounded-full bg-status-strong/60"></div>
                    <div className="w-3 h-3 rounded-full bg-destructive/60"></div>
                  </div>
                </div>
              </div>
              <ScrollArea className="flex-1">
                <div className="p-6">
                  <div 
                    dangerouslySetInnerHTML={{ __html: previewHTML }}
                    className="booklet-preview"
                  />
                </div>
              </ScrollArea>
            </Card>
          </div>

          {/* Right Side - Editor */}
          <div className="w-[420px] flex flex-col">
            <Card className="flex-1 shadow-elegant border-border/50 bg-gradient-card">
              <div className="h-16 bg-gradient-connection border-b border-border/30 flex items-center px-6 justify-between rounded-t-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Wand2 className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <span className="font-semibold text-foreground text-lg">Content Editor</span>
                    <p className="text-xs text-muted-foreground">Edit booklet content</p>
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={onClose} className="hover:bg-destructive/10">
                  <X className="w-4 h-4" />
                </Button>
              </div>
              
              <ScrollArea className="flex-1">
                <div className="p-6 space-y-6">
                  {/* AI Generation Section */}
                  <div className="space-y-4">
                    <Button
                      onClick={handleGenerateWithAI}
                      disabled={isGenerating}
                      className="w-full bg-gradient-primary hover:opacity-90 text-white shadow-glow border-0 h-12 font-semibold"
                      size="lg"
                    >
                      {isGenerating ? (
                        <>
                          <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                          Generating Content...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-5 h-5 mr-2" />
                          Generate with AI
                        </>
                      )}
                    </Button>
                    
                    <div className="flex gap-2">
                      <Button
                        onClick={fillExampleData}
                        variant="outline"
                        size="sm"
                        className="flex-1 border-border/30 hover:bg-muted/50 text-xs"
                      >
                        <FileText className="w-3 h-3 mr-1" />
                        Example Data
                      </Button>
                      <Button
                        onClick={() => setBookletData(defaultBookletData)}
                        variant="outline"
                        size="sm"
                        className="flex-1 border-border/30 hover:bg-muted/50 text-xs"
                      >
                        <RefreshCw className="w-3 h-3 mr-1" />
                        Clear All
                      </Button>
                    </div>
                    
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground">
                        Auto-generate professional endodontic content for all 12 pages
                      </p>
                    </div>
                  </div>

                  <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent"></div>

                  {/* Form Fields - Organized by Page */}
                  <Accordion type="multiple" defaultValue={["basic-info"]} className="space-y-2">

                    <AccordionItem value="basic-info" className="border border-border/50 rounded-lg bg-card/50 overflow-hidden">
                      <AccordionTrigger className="px-4 py-3 hover:bg-muted/30 font-medium text-sm">
                        📄 Pages 1-2: Basic Information
                      </AccordionTrigger>
                      <AccordionContent className="px-4 pb-4 space-y-3">
                        <div>
                          <Label htmlFor="practiceName" className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1 block">Practice Name</Label>
                          <Input
                            id="practiceName"
                            value={bookletData.practiceName}
                            onChange={(e) => updateField('practiceName', e.target.value)}
                            placeholder="Your practice name"
                            className="border-border/30 focus:border-primary/50"
                          />
                        </div>
                        <div>
                          <Label htmlFor="doctorName" className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1 block">Doctor Name</Label>
                          <Input
                            id="doctorName"
                            value={bookletData.doctorName}
                            onChange={(e) => updateField('doctorName', e.target.value)}
                            placeholder="Dr. John Smith"
                            className="border-border/30 focus:border-primary/50"
                          />
                        </div>
                        <div>
                          <Label htmlFor="tagline" className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1 block">Tagline</Label>
                          <Input
                            id="tagline"
                            value={bookletData.tagline}
                            onChange={(e) => updateField('tagline', e.target.value)}
                            placeholder="Your practice tagline"
                            className="border-border/30 focus:border-primary/50"
                          />
                        </div>
                        <div>
                          <Label htmlFor="specialty" className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1 block">Specialty</Label>
                          <Input
                            id="specialty"
                            value={bookletData.specialty}
                            onChange={(e) => updateField('specialty', e.target.value)}
                            placeholder="Medical specialty"
                            className="border-border/30 focus:border-primary/50"
                          />
                        </div>
                      </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="about-practice" className="border border-border/50 rounded-lg bg-card/50 overflow-hidden">
                      <AccordionTrigger className="px-4 py-3 hover:bg-muted/30 font-medium text-sm">
                        🏥 Page 3: About Practice
                      </AccordionTrigger>
                      <AccordionContent className="px-4 pb-4 space-y-3">
                        <div>
                          <Label htmlFor="practiceDescription" className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1 block">Practice Description</Label>
                          <Textarea
                            id="practiceDescription"
                            value={bookletData.practiceDescription}
                            onChange={(e) => updateField('practiceDescription', e.target.value)}
                            placeholder="Describe your practice and services"
                            rows={3}
                            className="border-border/30 focus:border-primary/50 resize-none"
                          />
                        </div>
                        <div>
                          <Label htmlFor="missionStatement" className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1 block">Mission Statement</Label>
                          <Textarea
                            id="missionStatement"
                            value={bookletData.missionStatement}
                            onChange={(e) => updateField('missionStatement', e.target.value)}
                            placeholder="Your practice mission statement"
                            rows={2}
                            className="border-border/30 focus:border-primary/50 resize-none"
                          />
                        </div>
                      </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="doctor-profile" className="border border-border/50 rounded-lg bg-card/50 overflow-hidden">
                      <AccordionTrigger className="px-4 py-3 hover:bg-muted/30 font-medium text-sm">
                        👨‍⚕️ Page 4: Doctor Profile
                      </AccordionTrigger>
                      <AccordionContent className="px-4 pb-4 space-y-3">
                        <div>
                          <Label htmlFor="welcomeMessage" className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1 block">Welcome Message</Label>
                          <Textarea
                            id="welcomeMessage"
                            value={bookletData.welcomeMessage}
                            onChange={(e) => updateField('welcomeMessage', e.target.value)}
                            placeholder="Personal welcome message"
                            rows={3}
                            className="border-border/30 focus:border-primary/50 resize-none"
                          />
                        </div>
                        <div>
                          <Label htmlFor="doctorMessageParagraph" className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1 block">Doctor Message</Label>
                          <Textarea
                            id="doctorMessageParagraph"
                            value={bookletData.doctorMessageParagraph}
                            onChange={(e) => updateField('doctorMessageParagraph', e.target.value)}
                            placeholder="Personal message from the doctor"
                            rows={2}
                            className="border-border/30 focus:border-primary/50 resize-none"
                          />
                        </div>
                        <div>
                          <Label htmlFor="education" className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1 block">Education & Training</Label>
                          <Textarea
                            id="education"
                            value={bookletData.education}
                            onChange={(e) => updateField('education', e.target.value)}
                            placeholder="Doctor's education and training"
                            rows={2}
                            className="border-border/30 focus:border-primary/50 resize-none"
                          />
                        </div>
                        <div>
                          <Label htmlFor="experience" className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1 block">Experience</Label>
                          <Textarea
                            id="experience"
                            value={bookletData.experience}
                            onChange={(e) => updateField('experience', e.target.value)}
                            placeholder="Professional experience"
                            rows={2}
                            className="border-border/30 focus:border-primary/50 resize-none"
                          />
                        </div>
                      </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="services" className="border border-border/50 rounded-lg bg-card/50 overflow-hidden">
                      <AccordionTrigger className="px-4 py-3 hover:bg-muted/30 font-medium text-sm">
                        🦷 Page 5: Services
                      </AccordionTrigger>
                      <AccordionContent className="px-4 pb-4 space-y-3">
                        {[1, 2, 3, 4, 5].map(num => (
                          <div key={num}>
                            <Label htmlFor={`service${num}`} className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1 block">Service {num}</Label>
                            <Input
                              id={`service${num}`}
                              value={bookletData[`service${num}` as keyof BookletData] as string}
                              onChange={(e) => updateField(`service${num}` as keyof BookletData, e.target.value)}
                              placeholder={`Service ${num}`}
                              className="border-border/30 focus:border-primary/50"
                            />
                          </div>
                        ))}
                      </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="contact-operations" className="border border-border/50 rounded-lg bg-card/50 overflow-hidden">
                      <AccordionTrigger className="px-4 py-3 hover:bg-muted/30 font-medium text-sm">
                        📞 Pages 6-7: Contact & Operations
                      </AccordionTrigger>
                      <AccordionContent className="px-4 pb-4 space-y-3">
                        <div>
                          <Label htmlFor="officeHours" className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1 block">Office Hours</Label>
                          <Textarea
                            id="officeHours"
                            value={bookletData.officeHours}
                            onChange={(e) => updateField('officeHours', e.target.value)}
                            placeholder="Office hours schedule"
                            rows={3}
                            className="border-border/30 focus:border-primary/50 resize-none"
                          />
                        </div>
                        <div>
                          <Label htmlFor="address" className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1 block">Address</Label>
                          <Textarea
                            id="address"
                            value={bookletData.address}
                            onChange={(e) => updateField('address', e.target.value)}
                            placeholder="Practice address"
                            rows={2}
                            className="border-border/30 focus:border-primary/50 resize-none"
                          />
                        </div>
                        <div>
                          <Label htmlFor="contactInfo" className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1 block">Contact Information</Label>
                          <Textarea
                            id="contactInfo"
                            value={bookletData.contactInfo}
                            onChange={(e) => updateField('contactInfo', e.target.value)}
                            placeholder="Phone, email, etc."
                            rows={3}
                            className="border-border/30 focus:border-primary/50 resize-none"
                          />
                        </div>
                      </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="insurance-billing" className="border border-border/50 rounded-lg bg-card/50 overflow-hidden">
                      <AccordionTrigger className="px-4 py-3 hover:bg-muted/30 font-medium text-sm">
                        💳 Page 8: Insurance & Billing
                      </AccordionTrigger>
                      <AccordionContent className="px-4 pb-4 space-y-3">
                        <div>
                          <Label htmlFor="insuranceInfo" className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1 block">Insurance Information</Label>
                          <Textarea
                            id="insuranceInfo"
                            value={bookletData.insuranceInfo}
                            onChange={(e) => updateField('insuranceInfo', e.target.value)}
                            placeholder="Insurance plans accepted"
                            rows={3}
                            className="border-border/30 focus:border-primary/50 resize-none"
                          />
                        </div>
                        <div>
                          <Label htmlFor="paymentOptions" className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1 block">Payment Options</Label>
                          <Textarea
                            id="paymentOptions"
                            value={bookletData.paymentOptions}
                            onChange={(e) => updateField('paymentOptions', e.target.value)}
                            placeholder="Payment methods and policies"
                            rows={3}
                            className="border-border/30 focus:border-primary/50 resize-none"
                          />
                        </div>
                      </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="patient-resources" className="border border-border/50 rounded-lg bg-card/50 overflow-hidden">
                      <AccordionTrigger className="px-4 py-3 hover:bg-muted/30 font-medium text-sm">
                        💻 Pages 9-10: Patient Resources
                      </AccordionTrigger>
                      <AccordionContent className="px-4 pb-4 space-y-3">
                        <div>
                          <Label htmlFor="patientPortalInfo" className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1 block">Patient Portal Information</Label>
                          <Textarea
                            id="patientPortalInfo"
                            value={bookletData.patientPortalInfo}
                            onChange={(e) => updateField('patientPortalInfo', e.target.value)}
                            placeholder="Patient portal features and access"
                            rows={3}
                            className="border-border/30 focus:border-primary/50 resize-none"
                          />
                        </div>
                        <div>
                          <Label htmlFor="appointmentInfo" className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1 block">Appointment Information</Label>
                          <Textarea
                            id="appointmentInfo"
                            value={bookletData.appointmentInfo}
                            onChange={(e) => updateField('appointmentInfo', e.target.value)}
                            placeholder="How to schedule appointments"
                            rows={3}
                            className="border-border/30 focus:border-primary/50 resize-none"
                          />
                        </div>
                      </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="emergency-support" className="border border-border/50 rounded-lg bg-card/50 overflow-hidden">
                      <AccordionTrigger className="px-4 py-3 hover:bg-muted/30 font-medium text-sm">
                        🚨 Page 11: Emergency & Support
                      </AccordionTrigger>
                      <AccordionContent className="px-4 pb-4 space-y-3">
                        <div>
                          <Label htmlFor="emergencyInfo" className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1 block">Emergency Information</Label>
                          <Textarea
                            id="emergencyInfo"
                            value={bookletData.emergencyInfo}
                            onChange={(e) => updateField('emergencyInfo', e.target.value)}
                            placeholder="After-hours and emergency procedures"
                            rows={3}
                            className="border-border/30 focus:border-primary/50 resize-none"
                          />
                        </div>
                        <div>
                          <Label htmlFor="supportServices" className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1 block">Support Services</Label>
                          <Textarea
                            id="supportServices"
                            value={bookletData.supportServices}
                            onChange={(e) => updateField('supportServices', e.target.value)}
                            placeholder="Additional support services offered"
                            rows={3}
                            className="border-border/30 focus:border-primary/50 resize-none"
                          />
                        </div>
                      </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="testimonials" className="border border-border/50 rounded-lg bg-card/50 overflow-hidden">
                      <AccordionTrigger className="px-4 py-3 hover:bg-muted/30 font-medium text-sm">
                        ⭐ Page 12: Testimonials & Cases
                      </AccordionTrigger>
                      <AccordionContent className="px-4 pb-4 space-y-3">
                        <div>
                          <Label htmlFor="testimonial1" className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1 block">Testimonial 1</Label>
                          <Textarea
                            id="testimonial1"
                            value={bookletData.testimonial1}
                            onChange={(e) => updateField('testimonial1', e.target.value)}
                            placeholder="Patient testimonial"
                            rows={2}
                            className="border-border/30 focus:border-primary/50 resize-none"
                          />
                        </div>
                        <div>
                          <Label htmlFor="testimonial2" className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1 block">Testimonial 2</Label>
                          <Textarea
                            id="testimonial2"
                            value={bookletData.testimonial2}
                            onChange={(e) => updateField('testimonial2', e.target.value)}
                            placeholder="Patient testimonial"
                            rows={2}
                            className="border-border/30 focus:border-primary/50 resize-none"
                          />
                        </div>
                        <div>
                          <Label htmlFor="case1Description" className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1 block">Case Study 1</Label>
                          <Textarea
                            id="case1Description"
                            value={bookletData.case1Description}
                            onChange={(e) => updateField('case1Description', e.target.value)}
                            placeholder="Success story or case study"
                            rows={2}
                            className="border-border/30 focus:border-primary/50 resize-none"
                          />
                        </div>
                        <div>
                          <Label htmlFor="case2Description" className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1 block">Case Study 2</Label>
                          <Textarea
                            id="case2Description"
                            value={bookletData.case2Description}
                            onChange={(e) => updateField('case2Description', e.target.value)}
                            placeholder="Success story or case study"
                            rows={2}
                            className="border-border/30 focus:border-primary/50 resize-none"
                          />
                        </div>
                      </AccordionContent>
                    </AccordionItem>

                  </Accordion>
                </div>
              </ScrollArea>
            </Card>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}