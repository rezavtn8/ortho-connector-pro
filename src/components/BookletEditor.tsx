import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { 
  Wand2, 
  Sparkles, 
  FileText, 
  RefreshCw, 
  Search, 
  Copy,
  Trash2,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';

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

interface BookletEditorProps {
  data: BookletData;
  onChange: (data: BookletData) => void;
  onGenerateWithAI: () => void;
  onFillExample: () => void;
  onClearAll: () => void;
  isGenerating: boolean;
  className?: string;
}

interface FieldConfig {
  field: keyof BookletData;
  label: string;
  type?: 'input' | 'textarea';
  placeholder?: string;
  rows?: number;
}

export function BookletEditor({
  data,
  onChange,
  onGenerateWithAI,
  onFillExample,
  onClearAll,
  isGenerating,
  className
}: BookletEditorProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeAccordion, setActiveAccordion] = useState<string[]>(['page1']);

  const updateField = (field: keyof BookletData, value: string) => {
    onChange({ ...data, [field]: value });
  };

  const getFieldValidation = (field: keyof BookletData) => {
    const value = data[field];
    const isEmpty = !value || value.trim().length === 0;
    const isRequired = ['practiceName', 'doctorName', 'specialty'].includes(field);
    
    return {
      isEmpty,
      isRequired,
      isValid: !isRequired || !isEmpty,
      charCount: value?.length || 0
    };
  };

  const getCharacterLimit = (field: keyof BookletData) => {
    const limits: Partial<Record<keyof BookletData, number>> = {
      tagline: 100,
      practiceName: 80,
      doctorName: 60,
      specialty: 40
    };
    return limits[field];
  };

  const renderField = (config: FieldConfig) => {
    const { field, label, type = 'input', placeholder, rows } = config;
    const validation = getFieldValidation(field);
    const charLimit = getCharacterLimit(field);
    const isNearLimit = charLimit && validation.charCount > charLimit * 0.8;

    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor={field} className="text-sm font-medium flex items-center gap-2">
            {label}
            {validation.isRequired && <Badge variant="secondary" className="text-xs">Required</Badge>}
            {validation.isValid && !validation.isEmpty && (
              <CheckCircle className="h-3 w-3 text-green-500" />
            )}
            {validation.isRequired && validation.isEmpty && (
              <AlertCircle className="h-3 w-3 text-red-500" />
            )}
          </Label>
          {charLimit && (
            <span className={cn(
              "text-xs",
              isNearLimit ? "text-orange-500" : "text-muted-foreground",
              validation.charCount > charLimit && "text-red-500"
            )}>
              {validation.charCount}/{charLimit}
            </span>
          )}
        </div>
        
        {type === 'textarea' ? (
          <Textarea
            id={field}
            value={data[field]}
            onChange={(e) => updateField(field, e.target.value)}
            placeholder={placeholder}
            rows={rows || 3}
            className={cn(
              "resize-none",
              validation.isRequired && validation.isEmpty && "border-red-300",
              charLimit && validation.charCount > charLimit && "border-red-300"
            )}
          />
        ) : (
          <Input
            id={field}
            value={data[field]}
            onChange={(e) => updateField(field, e.target.value)}
            placeholder={placeholder}
            className={cn(
              validation.isRequired && validation.isEmpty && "border-red-300",
              charLimit && validation.charCount > charLimit && "border-red-300"
            )}
          />
        )}
      </div>
    );
  };

  const accordionSections = [
    {
      id: 'page1',
      title: 'Pages 1-2: Basic Information',
      icon: FileText,
      fields: [
        { field: 'practiceName' as keyof BookletData, label: 'Practice Name', placeholder: 'Enter your practice name' },
        { field: 'doctorName' as keyof BookletData, label: 'Doctor Name', placeholder: 'Dr. John Smith, DDS' },
        { field: 'tagline' as keyof BookletData, label: 'Practice Tagline', placeholder: 'Your professional tagline' },
        { field: 'specialty' as keyof BookletData, label: 'Specialty', placeholder: 'Endodontics' }
      ]
    },
    {
      id: 'page3',
      title: 'Page 3: About Practice',
      icon: FileText,
      fields: [
        { field: 'practiceDescription' as keyof BookletData, label: 'Practice Description', type: 'textarea' as const, rows: 4, placeholder: 'Describe your practice' },
        { field: 'missionStatement' as keyof BookletData, label: 'Mission Statement', type: 'textarea' as const, rows: 3, placeholder: 'Your mission statement' }
      ]
    },
    {
      id: 'page4',
      title: 'Page 4: Doctor Profile',
      icon: FileText,
      fields: [
        { field: 'welcomeMessage' as keyof BookletData, label: 'Welcome Message', type: 'textarea' as const, rows: 4, placeholder: 'Welcome message to patients' },
        { field: 'doctorMessageParagraph' as keyof BookletData, label: 'Doctor Message', type: 'textarea' as const, rows: 3, placeholder: 'Personal message from doctor' },
        { field: 'education' as keyof BookletData, label: 'Education & Credentials', type: 'textarea' as const, rows: 3, placeholder: 'Educational background' },
        { field: 'experience' as keyof BookletData, label: 'Experience', type: 'textarea' as const, rows: 3, placeholder: 'Professional experience' }
      ]
    },
    {
      id: 'page5',
      title: 'Page 5: Services',
      icon: FileText,
      fields: [
        { field: 'service1' as keyof BookletData, label: 'Service 1', placeholder: 'First service offered' },
        { field: 'service2' as keyof BookletData, label: 'Service 2', placeholder: 'Second service offered' },
        { field: 'service3' as keyof BookletData, label: 'Service 3', placeholder: 'Third service offered' },
        { field: 'service4' as keyof BookletData, label: 'Service 4', placeholder: 'Fourth service offered' },
        { field: 'service5' as keyof BookletData, label: 'Service 5', placeholder: 'Fifth service offered' }
      ]
    },
    {
      id: 'pages67',
      title: 'Pages 6-7: Contact & Operations',
      icon: FileText,
      fields: [
        { field: 'officeHours' as keyof BookletData, label: 'Office Hours', type: 'textarea' as const, rows: 3, placeholder: 'Office hours schedule' },
        { field: 'address' as keyof BookletData, label: 'Address', type: 'textarea' as const, rows: 2, placeholder: 'Practice address' },
        { field: 'contactInfo' as keyof BookletData, label: 'Contact Information', type: 'textarea' as const, rows: 3, placeholder: 'Phone, email, etc.' }
      ]
    },
    {
      id: 'page8',
      title: 'Page 8: Insurance & Billing',
      icon: FileText,
      fields: [
        { field: 'insuranceInfo' as keyof BookletData, label: 'Insurance Information', type: 'textarea' as const, rows: 4, placeholder: 'Insurance plans accepted' },
        { field: 'paymentOptions' as keyof BookletData, label: 'Payment Options', type: 'textarea' as const, rows: 3, placeholder: 'Payment methods available' }
      ]
    },
    {
      id: 'page9',
      title: 'Page 9: Patient Resources',
      icon: FileText,
      fields: [
        { field: 'patientPortalInfo' as keyof BookletData, label: 'Patient Portal Info', type: 'textarea' as const, rows: 3, placeholder: 'Patient portal features' },
        { field: 'appointmentInfo' as keyof BookletData, label: 'Appointment Information', type: 'textarea' as const, rows: 3, placeholder: 'How to schedule' },
        { field: 'emergencyInfo' as keyof BookletData, label: 'Emergency Information', type: 'textarea' as const, rows: 3, placeholder: 'Emergency procedures' },
        { field: 'supportServices' as keyof BookletData, label: 'Support Services', type: 'textarea' as const, rows: 3, placeholder: 'Additional services' }
      ]
    },
    {
      id: 'pages1011',
      title: 'Pages 10-11: Testimonials & Cases',
      icon: FileText,
      fields: [
        { field: 'testimonial1' as keyof BookletData, label: 'Patient Testimonial 1', type: 'textarea' as const, rows: 3, placeholder: 'First patient testimonial' },
        { field: 'testimonial2' as keyof BookletData, label: 'Patient Testimonial 2', type: 'textarea' as const, rows: 3, placeholder: 'Second patient testimonial' },
        { field: 'case1Description' as keyof BookletData, label: 'Success Story 1', type: 'textarea' as const, rows: 4, placeholder: 'First case study' },
        { field: 'case2Description' as keyof BookletData, label: 'Success Story 2', type: 'textarea' as const, rows: 4, placeholder: 'Second case study' }
      ]
    }
  ];

  const filteredSections = accordionSections.map(section => ({
    ...section,
    fields: section.fields.filter(field => 
      !searchTerm || 
      field.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
      data[field.field].toLowerCase().includes(searchTerm.toLowerCase())
    )
  })).filter(section => section.fields.length > 0);

  const completedSections = accordionSections.filter(section => 
    section.fields.every(field => data[field.field] && data[field.field].trim().length > 0)
  ).length;

  return (
    <Card className={cn("h-full flex flex-col", className)}>
      {/* Editor Header */}
      <CardHeader className="pb-3 border-b">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">Booklet Editor</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {completedSections}/{accordionSections.length} sections completed
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onFillExample}
              className="text-xs"
            >
              <Copy className="h-3 w-3 mr-1" />
              Example
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onClearAll}
              className="text-xs"
            >
              <Trash2 className="h-3 w-3 mr-1" />
              Clear All
            </Button>
          </div>
        </div>

        {/* AI Generation Button */}
        <div className="flex items-center gap-2 pt-3">
          <Button
            onClick={onGenerateWithAI}
            disabled={isGenerating}
            className="flex-1"
            size="sm"
          >
            {isGenerating ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Wand2 className="h-4 w-4 mr-2" />
            )}
            {isGenerating ? 'Generating...' : 'Generate with AI'}
            <Sparkles className="h-3 w-3 ml-2" />
          </Button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search fields..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 text-sm"
          />
        </div>
      </CardHeader>

      {/* Editor Content */}
      <CardContent className="flex-1 p-0">
        <ScrollArea className="h-full">
          <div className="p-4">
            <Accordion 
              type="multiple" 
              value={activeAccordion}
              onValueChange={setActiveAccordion}
              className="space-y-2"
            >
              {filteredSections.map((section) => {
                const Icon = section.icon;
                const sectionCompleted = section.fields.every(field => 
                  data[field.field] && data[field.field].trim().length > 0
                );

                return (
                  <AccordionItem 
                    key={section.id} 
                    value={section.id}
                    className="border rounded-lg px-4"
                  >
                    <AccordionTrigger className="hover:no-underline py-3">
                      <div className="flex items-center gap-3">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{section.title}</span>
                        {sectionCompleted && (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        )}
                        <Badge variant="secondary" className="text-xs">
                          {section.fields.filter(f => data[f.field]?.trim()).length}/{section.fields.length}
                        </Badge>
                      </div>
                    </AccordionTrigger>
                    
                    <AccordionContent className="pb-4">
                      <div className="space-y-4 pt-2">
                        {section.fields.map((field) => (
                          <div key={field.field}>
                            {renderField(field)}
                          </div>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}