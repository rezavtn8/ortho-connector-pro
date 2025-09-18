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
      {/* Header with Filters */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Important Dates</h2>
          <p className="text-muted-foreground">
            Seasonal events and dental awareness days with AI-generated campaign suggestions
          </p>
        </div>
        
        <div className="flex gap-2">
          <Button
            variant={selectedType === 'all' ? 'default' : 'outline'}
            onClick={() => setSelectedType('all')}
            size="sm"
          >
            All Dates
          </Button>
          <Button
            variant={selectedType === 'seasonal' ? 'default' : 'outline'}
            onClick={() => setSelectedType('seasonal')}
            size="sm"
          >
            Seasonal
          </Button>
          <Button
            variant={selectedType === 'dental' ? 'default' : 'outline'}
            onClick={() => setSelectedType('dental')}
            size="sm"
          >
            Dental Awareness
          </Button>
          <Button
            variant={selectedType === 'business' ? 'default' : 'outline'}
            onClick={() => setSelectedType('business')}
            size="sm"
          >
            Business Events
          </Button>
        </div>
      </div>

      {/* Important Dates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {upcomingDates.map((importantDate) => (
          <Card 
            key={importantDate.id}
            className="cursor-pointer hover:shadow-md hover-scale transition-all duration-300"
            onClick={() => onDateSelected(importantDate)}
          >
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  {importantDate.icon}
                  <CardTitle className="text-sm font-medium leading-tight">
                    {importantDate.title}
                  </CardTitle>
                </div>
                <Badge 
                  variant="secondary" 
                  className={typeColors[importantDate.type]}
                >
                  {importantDate.type}
                </Badge>
              </div>
            </CardHeader>
            
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="w-4 h-4" />
                  <span>{format(importantDate.date, 'MMM dd')}</span>
                </div>
                <Badge variant="outline" className="text-xs">
                  {getDaysUntil(importantDate.date)}
                </Badge>
              </div>
              
              <div className="text-xs text-muted-foreground">
                {importantDate.category}
              </div>
              
              <p className="text-sm text-muted-foreground line-clamp-2">
                {importantDate.description}
              </p>
              
              <div className="pt-2">
                <p className="text-xs font-medium text-muted-foreground mb-1">
                  Campaign Ideas:
                </p>
                <div className="flex flex-wrap gap-1">
                  {importantDate.campaignSuggestions.slice(0, 2).map((suggestion, index) => (
                    <Badge key={index} variant="secondary" className="text-xs">
                      {suggestion}
                    </Badge>
                  ))}
                  {importantDate.campaignSuggestions.length > 2 && (
                    <Badge variant="secondary" className="text-xs">
                      +{importantDate.campaignSuggestions.length - 2}
                    </Badge>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      
      {upcomingDates.length === 0 && (
        <Card className="text-center py-12">
          <CardContent>
            <Calendar className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">No upcoming dates</h3>
            <p className="text-muted-foreground">
              No important dates found for the selected filter.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}