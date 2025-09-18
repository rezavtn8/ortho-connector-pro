import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Search, 
  Filter, 
  Star, 
  Eye, 
  Download, 
  Share2, 
  Heart,
  FileText,
  Image,
  Mail,
  Smartphone,
  Globe,
  Calendar,
  Users,
  Gift,
  Stethoscope,
  Briefcase,
  GraduationCap,
  Plus,
  Sparkles,
  Clock
} from 'lucide-react';

interface ContentLibraryProps {
  onTemplateSelect?: (template: any) => void;
}

export function ContentLibrary({ onTemplateSelect }: ContentLibraryProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedType, setSelectedType] = useState('all');

  const contentCategories = [
    { id: 'all', name: 'All Content', icon: FileText, count: 47 },
    { id: 'patient-care', name: 'Patient Care', icon: Heart, count: 12 },
    { id: 'marketing', name: 'Marketing', icon: Share2, count: 15 },
    { id: 'education', name: 'Patient Education', icon: GraduationCap, count: 8 },
    { id: 'seasonal', name: 'Seasonal', icon: Calendar, count: 7 },
    { id: 'referral', name: 'Referral Program', icon: Users, count: 5 }
  ];

  const contentTypes = [
    { id: 'all', name: 'All Types', icon: FileText },
    { id: 'brochure', name: 'Brochures', icon: FileText },
    { id: 'card', name: 'Cards', icon: Heart },
    { id: 'email', name: 'Email Templates', icon: Mail },
    { id: 'social', name: 'Social Media', icon: Smartphone },
    { id: 'flyer', name: 'Flyers', icon: Image },
    { id: 'newsletter', name: 'Newsletters', icon: Globe }
  ];

  const professionalTemplates = [
    {
      id: 'welcome-premium',
      title: 'Premium Welcome Package',
      description: 'Complete new patient onboarding with welcome card, practice guide, and insurance information',
      category: 'patient-care',
      type: 'card',
      thumbnail: '👋',
      difficulty: 'Easy',
      time: '5 min',
      rating: 4.9,
      downloads: 1250,
      premium: true,
      compliance: ['HIPAA', 'ADA'],
      tags: ['New Patients', 'Onboarding', 'Professional']
    },
    {
      id: 'valentine-special',
      title: 'Valentine\'s Whitening Campaign',
      description: 'Complete Valentine\'s Day marketing suite with social posts, email templates, and promotional materials',
      category: 'seasonal',
      type: 'email',
      thumbnail: '💝',
      difficulty: 'Medium',
      time: '10 min',
      rating: 4.8,
      downloads: 987,
      premium: true,
      compliance: ['FDA Guidelines'],
      tags: ['Valentine\'s', 'Whitening', 'Promotion', 'Social Media']
    },
    {
      id: 'referral-thank-you',
      title: 'Referral Thank You Suite',
      description: 'Professional thank you materials for referring doctors and patients',
      category: 'referral',
      type: 'card',
      thumbnail: '🤝',
      difficulty: 'Easy',
      time: '3 min',
      rating: 4.7,
      downloads: 654,
      premium: false,
      compliance: ['Professional Standards'],
      tags: ['Referrals', 'Thank You', 'Professional']
    },
    {
      id: 'dental-health-education',
      title: 'Preventive Care Education Pack',
      description: 'Patient education materials covering oral hygiene, preventive care, and treatment options',
      category: 'education',
      type: 'brochure',
      thumbnail: '📚',
      difficulty: 'Easy',
      time: '7 min',
      rating: 4.9,
      downloads: 1456,
      premium: false,
      compliance: ['ADA Guidelines', 'Medical Standards'],
      tags: ['Education', 'Prevention', 'Patient Care']
    },
    {
      id: 'emergency-protocol',
      title: 'After-Hours Emergency Guide',
      description: 'Professional emergency contact card and protocol information for patients',
      category: 'patient-care',
      type: 'card',
      thumbnail: '🚨',
      difficulty: 'Easy',
      time: '2 min',
      rating: 4.6,
      downloads: 432,
      premium: false,
      compliance: ['Emergency Standards'],
      tags: ['Emergency', 'Contact Info', 'Patient Safety']
    },
    {
      id: 'new-year-campaign',
      title: 'New Year Smile Goals',
      description: 'Complete New Year marketing campaign focusing on smile improvement and oral health resolutions',
      category: 'seasonal',
      type: 'email',
      thumbnail: '🎊',
      difficulty: 'Medium',
      time: '12 min',
      rating: 4.8,
      downloads: 789,
      premium: true,
      compliance: ['Marketing Standards'],
      tags: ['New Year', 'Resolutions', 'Smile Goals', 'Campaign']
    }
  ];

  const filteredTemplates = professionalTemplates.filter(template => {
    const matchesSearch = template.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         template.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         template.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesCategory = selectedCategory === 'all' || template.category === selectedCategory;
    const matchesType = selectedType === 'all' || template.type === selectedType;
    
    return matchesSearch && matchesCategory && matchesType;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Professional Content Library</h2>
          <p className="text-muted-foreground">HIPAA-compliant, industry-standard marketing materials</p>
        </div>
        <Button className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Request Custom Template
        </Button>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search templates, tags, or content types..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2 w-full lg:w-auto">
          <Button variant="outline" size="sm" className="flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filters
          </Button>
          <Button variant="outline" size="sm" className="flex items-center gap-2">
            <Star className="h-4 w-4" />
            Favorites
          </Button>
        </div>
      </div>

      {/* Category Tabs */}
      <Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
        <TabsList className="grid w-full grid-cols-3 lg:grid-cols-6">
          {contentCategories.map((category) => {
            const IconComponent = category.icon;
            return (
              <TabsTrigger key={category.id} value={category.id} className="flex items-center gap-1">
                <IconComponent className="h-3 w-3" />
                <span className="hidden sm:inline">{category.name}</span>
                <Badge variant="secondary" className="text-xs ml-1">
                  {category.count}
                </Badge>
              </TabsTrigger>
            );
          })}
        </TabsList>

        {/* Content Type Filter */}
        <div className="flex gap-2 mt-4 flex-wrap">
          {contentTypes.map((type) => {
            const IconComponent = type.icon;
            return (
              <Button
                key={type.id}
                variant={selectedType === type.id ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedType(type.id)}
                className="flex items-center gap-1"
              >
                <IconComponent className="h-3 w-3" />
                {type.name}
              </Button>
            );
          })}
        </div>

        {/* Template Grid */}
        <TabsContent value={selectedCategory}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
            {filteredTemplates.map((template) => (
              <Card
                key={template.id}
                className="group hover:shadow-lg transition-all duration-300 border-border/50 hover:border-primary/30 bg-gradient-to-br from-card to-accent/5"
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="text-3xl">{template.thumbnail}</div>
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-sm font-medium truncate">
                          {template.title}
                          {template.premium && (
                            <Badge className="ml-2 text-xs bg-gradient-to-r from-primary to-primary/80">
                              Pro
                            </Badge>
                          )}
                        </CardTitle>
                        <div className="flex items-center gap-2 mt-1">
                          <div className="flex items-center gap-1">
                            <Star className="h-3 w-3 text-warning fill-current" />
                            <span className="text-xs text-muted-foreground">{template.rating}</span>
                          </div>
                          <div className="text-xs text-muted-foreground">•</div>
                          <div className="text-xs text-muted-foreground">{template.downloads} uses</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent className="pt-0">
                  <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{template.description}</p>
                  
                  {/* Tags */}
                  <div className="flex flex-wrap gap-1 mb-3">
                    {template.tags.slice(0, 3).map((tag, index) => (
                      <Badge key={index} variant="outline" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                    {template.tags.length > 3 && (
                      <Badge variant="outline" className="text-xs">
                        +{template.tags.length - 3}
                      </Badge>
                    )}
                  </div>

                  {/* Compliance Badges */}
                  <div className="flex flex-wrap gap-1 mb-4">
                    {template.compliance.map((comp, index) => (
                      <Badge key={index} variant="secondary" className="text-xs bg-success/10 text-success border-success/20">
                        ✓ {comp}
                      </Badge>
                    ))}
                  </div>

                  {/* Stats */}
                  <div className="flex items-center justify-between text-xs text-muted-foreground mb-4">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {template.time}
                    </span>
                    <span>{template.difficulty}</span>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => onTemplateSelect?.(template)}
                      className="flex-1 flex items-center gap-1"
                    >
                      <Sparkles className="h-3 w-3" />
                      Customize
                    </Button>
                    <Button variant="outline" size="sm" className="flex items-center gap-1">
                      <Eye className="h-3 w-3" />
                    </Button>
                    <Button variant="outline" size="sm" className="flex items-center gap-1">
                      <Download className="h-3 w-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* No Results */}
          {filteredTemplates.length === 0 && (
            <Card className="p-8 text-center">
              <div className="text-muted-foreground mb-4">
                <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-medium mb-2">No templates found</h3>
                <p className="text-sm">Try adjusting your search or filter criteria</p>
              </div>
              <Button variant="outline" onClick={() => { setSearchTerm(''); setSelectedCategory('all'); setSelectedType('all'); }}>
                Clear Filters
              </Button>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}