import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Calendar, 
  Plus, 
  Target, 
  Mail, 
  Smartphone, 
  Users,
  ChevronLeft,
  ChevronRight,
  Heart,
  Gift,
  GraduationCap,
  Sun,
  Snowflake,
  Flower,
  Leaf,
  Star,
  Clock,
  CheckCircle
} from 'lucide-react';

interface MarketingCalendarProps {
  businessProfile?: any;
}

export function MarketingCalendar({ businessProfile }: MarketingCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedView, setSelectedView] = useState<'month' | 'year'>('month');

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const seasonalCampaigns = [
    {
      id: 'valentine',
      title: 'Valentine\'s Day Smile Special',
      description: 'Whitening promotions for couples and gift certificates',
      date: '2024-02-14',
      type: 'seasonal',
      icon: Heart,
      color: 'text-pink-600',
      materials: ['Social posts', 'Email campaign', 'Gift certificates', 'Promotional flyers'],
      status: 'scheduled',
      audience: 'All active patients',
      duration: '2 weeks'
    },
    {
      id: 'dental-health',
      title: 'Children\'s Dental Health Month',
      description: 'Educational campaign focused on pediatric oral care',
      date: '2024-02-01',
      type: 'educational',
      icon: GraduationCap,
      color: 'text-blue-600',
      materials: ['Educational brochures', 'School presentations', 'Parent guides', 'Social content'],
      status: 'active',
      audience: 'Families with children',
      duration: '1 month'
    },
    {
      id: 'spring-cleaning',
      title: 'Spring Smile Renewal',
      description: 'Comprehensive dental checkup and cleaning promotion',
      date: '2024-03-20',
      type: 'seasonal',
      icon: Flower,
      color: 'text-green-600',
      materials: ['Appointment reminders', 'Cleaning promotions', 'Insurance verification'],
      status: 'draft',
      audience: 'Overdue patients',
      duration: '6 weeks'
    },
    {
      id: 'graduation',
      title: 'Graduation Smile Ready',
      description: 'Quick cosmetic treatments for graduation photos',
      date: '2024-05-15',
      type: 'seasonal',
      icon: Star,
      color: 'text-purple-600',
      materials: ['Social campaigns', 'Before/after showcases', 'Quick treatment menu'],
      status: 'planned',
      audience: 'Students and families',
      duration: '4 weeks'
    },
    {
      id: 'summer-vacation',
      title: 'Pre-Vacation Dental Care',
      description: 'Emergency prevention and vacation dental tips',
      date: '2024-06-01',
      type: 'seasonal',
      icon: Sun,
      color: 'text-orange-600',
      materials: ['Travel dental kits', 'Emergency protocols', 'Preventive care guides'],
      status: 'planned',
      audience: 'All patients',
      duration: '8 weeks'
    },
    {
      id: 'back-to-school',
      title: 'Back-to-School Checkups',
      description: 'Required dental exams and sports mouthguards',
      date: '2024-08-15',
      type: 'seasonal',
      icon: GraduationCap,
      color: 'text-indigo-600',
      materials: ['School forms', 'Sports dentistry info', 'Schedule coordination'],
      status: 'planned',
      audience: 'Students and athletes',
      duration: '6 weeks'
    },
    {
      id: 'halloween',
      title: 'Healthy Halloween',
      description: 'Sugar awareness and dental health during Halloween',
      date: '2024-10-31',
      type: 'educational',
      icon: Gift,
      color: 'text-orange-500',
      materials: ['Candy alternatives', 'Oral hygiene tips', 'Fun educational content'],
      status: 'planned',
      audience: 'Families',
      duration: '2 weeks'
    },
    {
      id: 'thanksgiving',
      title: 'Gratitude & Oral Health',
      description: 'Patient appreciation and healthy holiday eating',
      date: '2024-11-28',
      type: 'appreciation',
      icon: Heart,
      color: 'text-amber-600',
      materials: ['Thank you cards', 'Holiday eating guides', 'Appreciation events'],
      status: 'planned',
      audience: 'All patients',
      duration: '1 week'
    },
    {
      id: 'new-year',
      title: 'New Year, New Smile',
      description: 'Smile resolutions and cosmetic consultations',
      date: '2024-01-01',
      type: 'seasonal',
      icon: Star,
      color: 'text-gold-600',
      materials: ['Resolution campaigns', 'Cosmetic consultations', 'Payment plans'],
      status: 'completed',
      audience: 'Cosmetic prospects',
      duration: '4 weeks'
    }
  ];

  const automatedSequences = [
    {
      id: 'welcome',
      title: 'New Patient Welcome Series',
      description: '7-touch automated sequence for new patient onboarding',
      type: 'automation',
      frequency: 'Triggered by new patient',
      materials: 5,
      status: 'active'
    },
    {
      id: 'recall',
      title: 'Cleaning Appointment Reminders',
      description: 'Automated 6-month cleaning reminders with appointment booking',
      type: 'automation',
      frequency: 'Every 6 months per patient',
      materials: 3,
      status: 'active'
    },
    {
      id: 'birthday',
      title: 'Patient Birthday Campaign',
      description: 'Personalized birthday wishes with special offers',
      type: 'automation',
      frequency: 'Annual per patient',
      materials: 2,
      status: 'active'
    },
    {
      id: 'treatment-followup',
      title: 'Post-Treatment Care Sequence',
      description: 'Care instructions and satisfaction follow-up after treatments',
      type: 'automation',
      frequency: 'Triggered by treatment completion',
      materials: 4,
      status: 'active'
    }
  ];

  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const renderCalendar = () => {
    const daysInMonth = getDaysInMonth(currentDate);
    const firstDayOfMonth = getFirstDayOfMonth(currentDate);
    const days = [];

    // Empty cells for days before the first day of the month
    for (let i = 0; i < firstDayOfMonth; i++) {
      days.push(<div key={`empty-${i}`} className="p-2 h-20"></div>);
    }

    // Days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
      const dayString = date.toISOString().split('T')[0];
      const campaignsForDay = seasonalCampaigns.filter(campaign => campaign.date === dayString);

      days.push(
        <div key={day} className="p-2 h-20 border border-border/30 hover:bg-muted/50 transition-colors">
          <div className="text-sm font-medium text-foreground mb-1">{day}</div>
          <div className="space-y-1">
            {campaignsForDay.slice(0, 2).map((campaign) => {
              const IconComponent = campaign.icon;
              return (
                <div
                  key={campaign.id}
                  className="text-xs p-1 rounded bg-primary/10 text-primary truncate flex items-center gap-1"
                >
                  <IconComponent className="h-2 w-2 flex-shrink-0" />
                  <span className="truncate">{campaign.title}</span>
                </div>
              );
            })}
            {campaignsForDay.length > 2 && (
              <div className="text-xs text-muted-foreground">+{campaignsForDay.length - 2} more</div>
            )}
          </div>
        </div>
      );
    }

    return days;
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      newDate.setMonth(prev.getMonth() + (direction === 'next' ? 1 : -1));
      return newDate;
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Marketing Calendar</h2>
          <p className="text-muted-foreground">Strategic campaign planning and automation</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Add Campaign
          </Button>
          <Button className="flex items-center gap-2">
            <Target className="h-4 w-4" />
            Campaign Wizard
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Calendar View */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => navigateMonth('prev')}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={() => navigateMonth('next')}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Week days header */}
            <div className="grid grid-cols-7 gap-0 mb-2">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div key={day} className="p-2 text-sm font-medium text-muted-foreground text-center">
                  {day}
                </div>
              ))}
            </div>
            {/* Calendar grid */}
            <div className="grid grid-cols-7 gap-0 border border-border/50 rounded-lg overflow-hidden">
              {renderCalendar()}
            </div>
          </CardContent>
        </Card>

        {/* Upcoming Campaigns */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Target className="h-4 w-4 text-primary" />
              Upcoming
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {seasonalCampaigns
                .filter(campaign => campaign.status !== 'completed')
                .slice(0, 4)
                .map((campaign) => {
                  const IconComponent = campaign.icon;
                  return (
                    <div key={campaign.id} className="p-3 rounded-lg bg-gradient-to-r from-muted/50 to-muted/20 border border-border/50">
                      <div className="flex items-start gap-2">
                        <IconComponent className={`h-4 w-4 mt-0.5 flex-shrink-0 ${campaign.color}`} />
                        <div className="min-w-0 flex-1">
                          <h4 className="font-medium text-sm text-foreground truncate">{campaign.title}</h4>
                          <p className="text-xs text-muted-foreground mb-2">{campaign.description}</p>
                          <div className="flex items-center justify-between">
                            <Badge
                              variant={campaign.status === 'active' ? 'default' : campaign.status === 'scheduled' ? 'secondary' : 'outline'}
                              className="text-xs"
                            >
                              {campaign.status}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {new Date(campaign.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Automated Sequences */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            Marketing Automation
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {automatedSequences.map((sequence) => (
              <div key={sequence.id} className="p-4 rounded-lg bg-gradient-to-br from-card to-accent/5 border border-border/50">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium text-sm text-foreground">{sequence.title}</h4>
                  <div className="flex items-center gap-1">
                    <CheckCircle className="h-3 w-3 text-success" />
                    <span className="text-xs text-success">Active</span>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mb-3">{sequence.description}</p>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Frequency:</span>
                    <span className="text-foreground">{sequence.frequency}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Materials:</span>
                    <span className="text-foreground">{sequence.materials} templates</span>
                  </div>
                </div>
                <Button variant="outline" size="sm" className="w-full mt-3">
                  Manage Sequence
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}