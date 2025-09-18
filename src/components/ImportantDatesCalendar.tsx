import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, Heart, Candy, Gift, GraduationCap, Baby, Smile, Stethoscope } from 'lucide-react';
import { format, addDays, isAfter, isBefore, startOfDay } from 'date-fns';

interface ImportantDate {
  id: string;
  title: string;
  date: Date;
  type: 'seasonal' | 'dental' | 'business';
  category: string;
  description: string;
  icon: React.ReactNode;
  campaignSuggestions: string[];
}

interface ImportantDatesCalendarProps {
  onDateSelected: (date: ImportantDate) => void;
}

const IMPORTANT_DATES: ImportantDate[] = [
  // Seasonal Events
  {
    id: 'valentines-day',
    title: "Valentine's Day",
    date: new Date(2024, 1, 14), // Feb 14
    type: 'seasonal',
    category: 'Romance & Beauty',
    description: 'Perfect timing for smile makeovers and couples dental packages',
    icon: <Heart className="w-4 h-4" />,
    campaignSuggestions: ['Couples Smile Makeover', 'Valentine\'s Whitening Special', 'Love Your Smile Package']
  },
  {
    id: 'mothers-day',
    title: "Mother's Day",
    date: new Date(2024, 4, 12), // May 12 (2nd Sunday)
    type: 'seasonal',
    category: 'Family Appreciation',
    description: 'Celebrate moms with special dental care packages',
    icon: <Heart className="w-4 h-4" />,
    campaignSuggestions: ['Mom\'s Smile Makeover', 'Mother\'s Day Cleaning Special', 'Family Dental Package']
  },
  {
    id: 'fathers-day',
    title: "Father's Day",
    date: new Date(2024, 5, 16), // June 16 (3rd Sunday)
    type: 'seasonal',
    category: 'Family Appreciation',
    description: 'Encourage dads to prioritize their oral health',
    icon: <GraduationCap className="w-4 h-4" />,
    campaignSuggestions: ['Dad\'s Dental Check-up', 'Father\'s Day Cleaning', 'Men\'s Oral Health Package']
  },
  {
    id: 'halloween',
    title: 'Halloween',
    date: new Date(2024, 9, 31), // Oct 31
    type: 'seasonal',
    category: 'Health Awareness',
    description: 'Perfect opportunity for cavity prevention and candy safety education',
    icon: <Candy className="w-4 h-4" />,
    campaignSuggestions: ['Candy Safety Tips', 'Post-Halloween Cleaning', 'Cavity Prevention Program']
  },
  {
    id: 'thanksgiving',
    title: 'Thanksgiving',
    date: new Date(2024, 10, 28), // Nov 28 (4th Thursday)
    type: 'seasonal',
    category: 'Gratitude & Wellness',
    description: 'Express gratitude to referral partners and promote dental health',
    icon: <Gift className="w-4 h-4" />,
    campaignSuggestions: ['Thanksgiving Appreciation', 'Grateful for Referrals', 'Holiday Prep Cleaning']
  },
  {
    id: 'christmas',
    title: 'Christmas',
    date: new Date(2024, 11, 25), // Dec 25
    type: 'seasonal',
    category: 'Holiday Celebration',
    description: 'Holiday greetings and year-end dental care reminders',
    icon: <Gift className="w-4 h-4" />,
    campaignSuggestions: ['Holiday Smile Special', 'Christmas Appreciation', 'New Year Dental Goals']
  },
  
  // Dental Awareness Days
  {
    id: 'childrens-dental-month',
    title: "Children's Dental Health Month",
    date: new Date(2024, 1, 1), // February
    type: 'dental',
    category: 'Pediatric Focus',
    description: 'National month dedicated to children\'s oral health awareness',
    icon: <Baby className="w-4 h-4" />,
    campaignSuggestions: ['Kids Dental Education', 'Pediatric Referral Program', 'Family Dental Awareness']
  },
  {
    id: 'world-oral-health-day',
    title: 'World Oral Health Day',
    date: new Date(2024, 2, 20), // March 20
    type: 'dental',
    category: 'Global Awareness',
    description: 'International day promoting oral health worldwide',
    icon: <Smile className="w-4 h-4" />,
    campaignSuggestions: ['Global Oral Health', 'Dental Health Education', 'Community Outreach Program']
  },
  {
    id: 'root-canal-awareness',
    title: 'Root Canal Awareness Week',
    date: new Date(2024, 4, 6), // 2nd week of May
    type: 'dental',
    category: 'Procedure Education',
    description: 'Educational week about root canal treatments and their benefits',
    icon: <Stethoscope className="w-4 h-4" />,
    campaignSuggestions: ['Root Canal Education', 'Endodontic Awareness', 'Pain Relief Solutions']
  },
  {
    id: 'national-smile-month',
    title: 'National Smile Month',
    date: new Date(2024, 4, 1), // May
    type: 'dental',
    category: 'Smile Promotion',
    description: 'Month-long celebration of smiles and oral health',
    icon: <Smile className="w-4 h-4" />,
    campaignSuggestions: ['Smile Makeover Campaign', 'Cosmetic Dental Promotion', 'Confidence Through Smiles']
  },
  {
    id: 'dental-hygienist-week',
    title: 'Dental Hygienist Recognition Week',
    date: new Date(2024, 3, 1), // April 1-7
    type: 'dental',
    category: 'Professional Recognition',
    description: 'Week dedicated to recognizing dental hygienists',
    icon: <Stethoscope className="w-4 h-4" />,
    campaignSuggestions: ['Hygienist Appreciation', 'Preventive Care Focus', 'Professional Recognition']
  },
  {
    id: 'dental-hygiene-month',
    title: 'National Dental Hygiene Month',
    date: new Date(2024, 9, 1), // October
    type: 'dental',
    category: 'Preventive Care',
    description: 'Month focusing on the importance of dental hygiene',
    icon: <Smile className="w-4 h-4" />,
    campaignSuggestions: ['Hygiene Education', 'Prevention First Campaign', 'Clean Teeth Initiative']
  },
  
  // Business Events
  {
    id: 'back-to-school',
    title: 'Back to School',
    date: new Date(2024, 7, 26), // Late August
    type: 'business',
    category: 'Educational Timing',
    description: 'Perfect timing for children\'s dental check-ups before school starts',
    icon: <GraduationCap className="w-4 h-4" />,
    campaignSuggestions: ['Back-to-School Check-ups', 'Student Dental Health', 'Academic Year Prep']
  },
  {
    id: 'wedding-season',
    title: 'Wedding Season',
    date: new Date(2024, 4, 1), // May-September peak
    type: 'business',
    category: 'Cosmetic Focus',
    description: 'Peak wedding season - ideal for cosmetic dental procedures',
    icon: <Heart className="w-4 h-4" />,
    campaignSuggestions: ['Bridal Smile Package', 'Wedding Whitening', 'Perfect Wedding Smile']
  }
];

const typeColors = {
  seasonal: 'bg-red-100 text-red-800',
  dental: 'bg-blue-100 text-blue-800',
  business: 'bg-green-100 text-green-800'
};

export function ImportantDatesCalendar({ onDateSelected }: ImportantDatesCalendarProps) {
  const [selectedType, setSelectedType] = useState<string>('all');
  const today = startOfDay(new Date());
  
  const upcomingDates = useMemo(() => {
    const currentYear = new Date().getFullYear();
    
    return IMPORTANT_DATES
      .map(date => ({
        ...date,
        // Adjust dates to current year
        date: new Date(currentYear, date.date.getMonth(), date.date.getDate())
      }))
      .filter(date => {
        // Show dates that are upcoming (including today) or within the next 365 days
        const nextYear = new Date(currentYear + 1, date.date.getMonth(), date.date.getDate());
        return !isBefore(date.date, today) || !isBefore(nextYear, addDays(today, 365));
      })
      .map(date => {
        // If the date has passed this year, show next year's date
        if (isBefore(date.date, today)) {
          return {
            ...date,
            date: new Date(currentYear + 1, date.date.getMonth(), date.date.getDate())
          };
        }
        return date;
      })
      .filter(date => selectedType === 'all' || date.type === selectedType)
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .slice(0, 12); // Show next 12 dates
  }, [selectedType, today]);

  const getDaysUntil = (date: Date) => {
    const diff = date.getTime() - today.getTime();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) return 'Today';
    if (days === 1) return 'Tomorrow';
    if (days < 30) return `${days} days`;
    if (days < 365) return `${Math.round(days / 30)} months`;
    return `${Math.round(days / 365)} year`;
  };

  return (
    <div className="space-y-6">
      {/* Improved Header with Filters */}
      <div className="space-y-4">
        <div className="text-center space-y-2">
          <h2 className="text-xl font-semibold text-foreground">Important Dates & Opportunities</h2>
          <p className="text-sm text-muted-foreground max-w-2xl mx-auto">
            Leverage seasonal events and dental awareness days to create timely, relevant campaigns with AI-generated content
          </p>
        </div>
        
        <div className="flex justify-center">
          <div className="inline-flex bg-muted/50 rounded-lg p-1 gap-1">
            <Button
              variant={selectedType === 'all' ? 'default' : 'ghost'}
              onClick={() => setSelectedType('all')}
              size="sm"
              className="h-8 text-xs"
            >
              All Events
            </Button>
            <Button
              variant={selectedType === 'seasonal' ? 'default' : 'ghost'}
              onClick={() => setSelectedType('seasonal')}
              size="sm"
              className="h-8 text-xs"
            >
              🎄 Seasonal
            </Button>
            <Button
              variant={selectedType === 'dental' ? 'default' : 'ghost'}
              onClick={() => setSelectedType('dental')}
              size="sm"
              className="h-8 text-xs"
            >
              🦷 Dental Awareness
            </Button>
            <Button
              variant={selectedType === 'business' ? 'default' : 'ghost'}
              onClick={() => setSelectedType('business')}
              size="sm"
              className="h-8 text-xs"
            >
              💼 Business
            </Button>
          </div>
        </div>
      </div>

      {/* Improved Important Dates Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {upcomingDates.map((importantDate) => (
          <Card 
            key={importantDate.id}
            className="group cursor-pointer border-border/50 hover:border-border hover:shadow-lg transition-all duration-200 overflow-hidden"
            onClick={() => onDateSelected(importantDate)}
          >
            <div className={`h-2 w-full ${
              importantDate.type === 'seasonal' ? 'bg-gradient-to-r from-red-400 to-pink-400' :
              importantDate.type === 'dental' ? 'bg-gradient-to-r from-blue-400 to-cyan-400' :
              'bg-gradient-to-r from-green-400 to-emerald-400'
            }`} />
            
            <CardHeader className="pb-3">
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="shrink-0 p-1.5 rounded-md bg-muted/50">
                      {importantDate.icon}
                    </div>
                    <h3 className="font-medium text-sm leading-tight group-hover:text-primary transition-colors truncate">
                      {importantDate.title}
                    </h3>
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Calendar className="w-3 h-3" />
                    <span className="font-medium">{format(importantDate.date, 'MMM dd')}</span>
                  </div>
                  <Badge 
                    variant="outline" 
                    className={`text-xs h-5 px-2 ${
                      getDaysUntil(importantDate.date) === 'Today' ? 'bg-primary/10 text-primary border-primary/20' :
                      getDaysUntil(importantDate.date) === 'Tomorrow' ? 'bg-orange-50 text-orange-600 border-orange-200' :
                      'bg-muted/50 text-muted-foreground'
                    }`}
                  >
                    {getDaysUntil(importantDate.date)}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            
            <CardContent className="space-y-3 pt-0">
              <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                {importantDate.description}
              </p>
              
              <div className="space-y-2">
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary/40" />
                  <p className="text-xs font-medium text-muted-foreground">Campaign Ideas:</p>
                </div>
                <div className="flex flex-wrap gap-1">
                  {importantDate.campaignSuggestions.slice(0, 2).map((suggestion, index) => (
                    <Badge 
                      key={index} 
                      variant="secondary" 
                      className="text-xs py-0.5 px-2 bg-primary/5 text-primary/80 border-primary/20"
                    >
                      {suggestion}
                    </Badge>
                  ))}
                  {importantDate.campaignSuggestions.length > 2 && (
                    <Badge 
                      variant="outline" 
                      className="text-xs py-0.5 px-2 bg-muted/30"
                    >
                      +{importantDate.campaignSuggestions.length - 2} more
                    </Badge>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      
      {upcomingDates.length === 0 && (
        <div className="text-center py-12">
          <div className="mx-auto w-16 h-16 bg-muted/50 rounded-full flex items-center justify-center mb-4">
            <Calendar className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold mb-2">No upcoming dates</h3>
          <p className="text-sm text-muted-foreground">
            No important dates found for the selected filter.
          </p>
        </div>
      )}
    </div>
  );
}