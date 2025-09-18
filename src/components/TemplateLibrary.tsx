import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Search, Eye, Download, Heart, Star, Filter } from 'lucide-react';

interface TemplateLibraryProps {
  businessProfile?: any;
}

interface Template {
  id: string;
  title: string;
  description: string;
  category: string;
  thumbnail: string;
  rating: number;
  likes: number;
  featured: boolean;
  preview?: string;
}

export function TemplateLibrary({ businessProfile }: TemplateLibraryProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const categories = [
    { id: 'all', name: 'All Templates', count: 24 },
    { id: 'brochures', name: 'Brochures', count: 8 },
    { id: 'cards', name: 'Cards', count: 6 },
    { id: 'flyers', name: 'Flyers', count: 4 },
    { id: 'social', name: 'Social Media', count: 6 },
  ];

  const templates: Template[] = [
    {
      id: '1',
      title: 'Modern Welcome Brochure',
      description: 'Clean, professional design for new patient welcome materials',
      category: 'brochures',
      thumbnail: '🎨',
      rating: 4.8,
      likes: 124,
      featured: true,
      preview: 'Welcome to our practice! We are dedicated to providing exceptional care...',
    },
    {
      id: '2',
      title: 'Holiday Thank You Card',
      description: 'Warm, festive design for expressing gratitude during holidays',
      category: 'cards',
      thumbnail: '💝',
      rating: 4.9,
      likes: 89,
      featured: false,
      preview: 'Thank you for being a valued patient. Wishing you joy this holiday season...',
    },
    {
      id: '3',
      title: 'Service Announcement Flyer',
      description: 'Eye-catching design for promoting new services or treatments',
      category: 'flyers',
      thumbnail: '📢',
      rating: 4.7,
      likes: 156,
      featured: true,
      preview: 'Exciting News! We are pleased to announce our new treatment options...',
    },
    {
      id: '4',
      title: 'Instagram Post Template',
      description: 'Square format template optimized for social media engagement',
      category: 'social',
      thumbnail: '📱',
      rating: 4.6,
      likes: 203,
      featured: false,
      preview: 'Transform your smile with our expert care. Book your consultation today!',
    },
    {
      id: '5',
      title: 'Patient Education Booklet',
      description: 'Comprehensive template for patient education materials',
      category: 'brochures',
      thumbnail: '📚',
      rating: 4.8,
      likes: 78,
      featured: false,
      preview: 'Understanding your treatment: A comprehensive guide to better oral health...',
    },
    {
      id: '6',
      title: 'Appointment Reminder Card',
      description: 'Friendly reminder card design for upcoming appointments',
      category: 'cards',
      thumbnail: '⏰',
      rating: 4.5,
      likes: 92,
      featured: false,
      preview: 'Don\'t forget! Your appointment is scheduled for...',
    },
  ];

  const filteredTemplates = templates.filter((template) => {
    const matchesSearch = template.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         template.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || template.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const featuredTemplates = templates.filter(t => t.featured);

  const handlePreview = (template: Template) => {
    setSelectedTemplate(template);
    setShowPreview(true);
  };

  return (
    <div className="space-y-6">
      {/* Search and Filters */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search templates..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button variant="outline" className="flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Categories */}
      <Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
        <TabsList className="grid grid-cols-5 w-full">
          {categories.map((category) => (
            <TabsTrigger key={category.id} value={category.id} className="text-xs">
              {category.name}
              <Badge variant="secondary" className="ml-2 text-xs">
                {category.count}
              </Badge>
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value={selectedCategory} className="space-y-6">
          {/* Featured Templates (only show on 'all' tab) */}
          {selectedCategory === 'all' && (
            <div>
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Star className="h-5 w-5 text-yellow-500" />
                Featured Templates
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {featuredTemplates.map((template) => (
                  <Card key={template.id} className="hover:shadow-lg transition-shadow">
                    <CardContent className="p-4">
                      <div className="text-center space-y-3">
                        <div className="text-4xl">{template.thumbnail}</div>
                        <div>
                          <h4 className="font-medium">{template.title}</h4>
                          <p className="text-sm text-muted-foreground mt-1">
                            {template.description}
                          </p>
                        </div>
                        <div className="flex items-center justify-center gap-4 text-sm">
                          <div className="flex items-center gap-1">
                            <Star className="h-3 w-3 text-yellow-500 fill-current" />
                            <span>{template.rating}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Heart className="h-3 w-3 text-red-500" />
                            <span>{template.likes}</span>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handlePreview(template)}
                            className="flex-1"
                          >
                            <Eye className="h-3 w-3 mr-1" />
                            Preview
                          </Button>
                          <Button size="sm" className="flex-1">
                            Use Template
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* All Templates */}
          <div>
            <h3 className="text-lg font-semibold mb-4">
              {selectedCategory === 'all' ? 'All Templates' : categories.find(c => c.id === selectedCategory)?.name}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {filteredTemplates.map((template) => (
                <Card key={template.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="text-center space-y-3">
                      <div className="text-3xl">{template.thumbnail}</div>
                      <div>
                        <h4 className="font-medium text-sm">{template.title}</h4>
                        <p className="text-xs text-muted-foreground mt-1">
                          {template.description}
                        </p>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1">
                          <Star className="h-3 w-3 text-yellow-500 fill-current" />
                          <span>{template.rating}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Heart className="h-3 w-3 text-red-500" />
                          <span>{template.likes}</span>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handlePreview(template)}
                          className="flex-1 text-xs"
                        >
                          <Eye className="h-3 w-3" />
                        </Button>
                        <Button size="sm" className="flex-1 text-xs">
                          Use
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedTemplate?.title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-center">
              <div className="text-6xl mb-4">{selectedTemplate?.thumbnail}</div>
              <p className="text-muted-foreground">{selectedTemplate?.description}</p>
            </div>
            <div className="bg-muted p-4 rounded-lg">
              <h4 className="font-medium mb-2">Preview Content:</h4>
              <p className="text-sm">{selectedTemplate?.preview}</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1">
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
              <Button className="flex-1">
                Customize Template
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}