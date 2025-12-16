import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  BookOpen, Play, HelpCircle, ChevronRight, CheckCircle2, 
  Circle, Building2, Users, Mail, Gift, MapPin, BarChart3,
  Printer, Tag, Calendar, Star, Sparkles, Lightbulb, Target,
  ArrowRight, ExternalLink, Zap, Shield, Clock
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface WalkthroughStep {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  route: string;
  tips: string[];
  completed?: boolean;
}

const walkthroughSteps: WalkthroughStep[] = [
  {
    id: 'dashboard',
    title: 'Dashboard Overview',
    description: 'Your command center for tracking referrals and performance at a glance.',
    icon: BarChart3,
    route: '/dashboard',
    tips: [
      'View total referrals and trends over time',
      'See your top performing partner offices',
      'Track monthly patient counts by source'
    ]
  },
  {
    id: 'offices',
    title: 'Partner Offices',
    description: 'Manage your referral partner network with powerful filtering and bulk actions.',
    icon: Building2,
    route: '/offices',
    tips: [
      'Filter by tier: VIP, Warm, Cold, or Dormant',
      'Use bulk selection for campaigns and labels',
      'Assign custom tags to organize offices',
      'Quick actions available per tier'
    ]
  },
  {
    id: 'discover',
    title: 'Discover Offices',
    description: 'Find new potential referral partners in your area using Google Maps.',
    icon: MapPin,
    route: '/discover',
    tips: [
      'Search by distance from your clinic',
      'Filter by office type (dental, medical, etc.)',
      'Import discovered offices as partners'
    ]
  },
  {
    id: 'campaigns',
    title: 'Campaigns',
    description: 'Create and manage email and gift campaigns to engage your partners.',
    icon: Mail,
    route: '/campaigns',
    tips: [
      'Choose between email or physical gift campaigns',
      'Track delivery status and engagement',
      'Save templates for recurring campaigns'
    ]
  },
  {
    id: 'daily-patients',
    title: 'Daily Patients',
    description: 'Track patient referrals day-by-day with source attribution.',
    icon: Calendar,
    route: '/daily-patients',
    tips: [
      'Log patients by referral source',
      'View trends over time with charts',
      'Catch up on missed days quickly'
    ]
  },
  {
    id: 'mailing-labels',
    title: 'Mailing Labels',
    description: 'Generate professional mailing labels for physical campaigns.',
    icon: Printer,
    route: '/mailing-labels',
    tips: [
      'Export to Excel or generate PDF labels',
      'Supports Avery label templates',
      'Auto-corrects addresses with Google Maps'
    ]
  },
  {
    id: 'analytics',
    title: 'Analytics',
    description: 'Deep dive into your referral performance with detailed charts.',
    icon: BarChart3,
    route: '/analytics',
    tips: [
      'Compare performance across time periods',
      'Identify your highest-value partners',
      'Track ROI on your marketing efforts'
    ]
  }
];

const quickTips = [
  {
    icon: Zap,
    title: 'Bulk Selection',
    description: 'Select multiple offices using checkboxes, then use the action bar for bulk operations like emailing, tagging, or printing labels.'
  },
  {
    icon: Tag,
    title: 'Custom Tags',
    description: 'Create color-coded tags to organize offices beyond tiers. Great for tracking campaigns, regions, or specialties.'
  },
  {
    icon: Target,
    title: 'Tier Quick Actions',
    description: 'Click the dropdown next to tier filters for quick actions like "Email All VIP" or "Print Warm Labels".'
  },
  {
    icon: Shield,
    title: 'Address Correction',
    description: 'Use the Address Correction Tool in Mailing Labels to validate and standardize addresses with Google Maps.'
  },
  {
    icon: Clock,
    title: 'Daily Tracking',
    description: 'Log patients daily for accurate MSLR (Monthly Source-Level Referrals) calculations and tier assignments.'
  },
  {
    icon: Sparkles,
    title: 'AI Assistant',
    description: 'Use the AI Assistant to get insights about your referral network and generate campaign content.'
  }
];

const faqs = [
  {
    question: 'How are office tiers calculated?',
    answer: 'Tiers are based on MSLR (Monthly Source-Level Referrals). VIP = 3+ referrals/month, Warm = 1-2 referrals/month, Cold = Some history but not recent, Dormant = No recent activity.'
  },
  {
    question: 'Can I import offices from a spreadsheet?',
    answer: 'Yes! Go to Partner Offices and click the Import button. You can upload a CSV or Excel file with office details including name, address, phone, and email.'
  },
  {
    question: 'How do I track which campaigns were successful?',
    answer: 'Each campaign tracks delivery status and you can log referrals received. Over time, the analytics page will show ROI by comparing campaign costs to referral value.'
  },
  {
    question: 'What label templates are supported?',
    answer: 'We support popular Avery templates including 5160 (30 per sheet), 5161 (20 per sheet), 5163 (10 per sheet), and 5167 (80 per sheet).'
  },
  {
    question: 'How do I connect my Google Business account?',
    answer: 'Go to Settings and look for the Google Business integration. This allows you to sync reviews and respond to them directly from the app.'
  },
  {
    question: 'Can multiple team members use the app?',
    answer: 'Yes! Invite team members from Settings. You can assign different roles and permissions to control access.'
  }
];

const guides = [
  {
    title: 'Getting Started',
    description: 'Set up your clinic and add your first partner offices',
    icon: Sparkles,
    steps: [
      'Complete the onboarding wizard to set up your clinic profile',
      'Add your clinic address for accurate distance calculations',
      'Import existing partners or discover new ones nearby',
      'Start logging daily patient referrals'
    ]
  },
  {
    title: 'Running Your First Campaign',
    description: 'Create and execute an email or gift campaign',
    icon: Mail,
    steps: [
      'Go to Partner Offices and select target offices',
      'Click "Email" or "Gift" in the action bar',
      'Choose a template or create custom content',
      'Review recipients and launch the campaign',
      'Track delivery and engagement in the Campaigns page'
    ]
  },
  {
    title: 'Maximizing Partner Engagement',
    description: 'Strategies to turn cold offices into VIP partners',
    icon: Star,
    steps: [
      'Identify Cold and Dormant offices in the Partner Offices page',
      'Use tags to segment offices by specialty or region',
      'Create targeted campaigns for each segment',
      'Schedule regular marketing visits',
      'Track progress as offices move up in tiers'
    ]
  },
  {
    title: 'Generating Reports',
    description: 'Create professional reports for stakeholders',
    icon: BarChart3,
    steps: [
      'Visit the Analytics page for performance overview',
      'Use date filters to select reporting period',
      'Export charts and data as needed',
      'Generate mailing labels for physical reports'
    ]
  }
];

export function HelpCenter() {
  const navigate = useNavigate();
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());
  const [activeStep, setActiveStep] = useState<string | null>(null);

  const progress = (completedSteps.size / walkthroughSteps.length) * 100;

  const handleStepClick = (step: WalkthroughStep) => {
    setActiveStep(step.id);
  };

  const handleStartStep = (step: WalkthroughStep) => {
    navigate(step.route);
  };

  const handleCompleteStep = (stepId: string) => {
    setCompletedSteps(prev => new Set([...prev, stepId]));
  };

  return (
    <div className="space-y-6">
      {/* Hero Section */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/20 via-primary/10 to-background border">
        <div className="absolute inset-0 bg-grid-white/10 [mask-image:linear-gradient(0deg,transparent,black)]" />
        <div className="relative p-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-primary/20 rounded-xl">
              <BookOpen className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Help Center</h1>
              <p className="text-muted-foreground">Learn how to get the most out of Nexora</p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
            <Card className="bg-background/60 backdrop-blur border-primary/20">
              <CardContent className="p-4 flex items-center gap-3">
                <Play className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-medium">Interactive Tour</p>
                  <p className="text-sm text-muted-foreground">Step-by-step walkthrough</p>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-background/60 backdrop-blur border-primary/20">
              <CardContent className="p-4 flex items-center gap-3">
                <Lightbulb className="h-5 w-5 text-amber-500" />
                <div>
                  <p className="font-medium">Quick Tips</p>
                  <p className="text-sm text-muted-foreground">Power user shortcuts</p>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-background/60 backdrop-blur border-primary/20">
              <CardContent className="p-4 flex items-center gap-3">
                <HelpCircle className="h-5 w-5 text-blue-500" />
                <div>
                  <p className="font-medium">FAQ & Guides</p>
                  <p className="text-sm text-muted-foreground">Detailed documentation</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <Tabs defaultValue="walkthrough" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 h-12">
          <TabsTrigger value="walkthrough" className="gap-2">
            <Play className="h-4 w-4" />
            <span className="hidden sm:inline">Walkthrough</span>
          </TabsTrigger>
          <TabsTrigger value="tips" className="gap-2">
            <Lightbulb className="h-4 w-4" />
            <span className="hidden sm:inline">Tips & FAQ</span>
          </TabsTrigger>
          <TabsTrigger value="guides" className="gap-2">
            <BookOpen className="h-4 w-4" />
            <span className="hidden sm:inline">Guides</span>
          </TabsTrigger>
        </TabsList>

        {/* Interactive Walkthrough */}
        <TabsContent value="walkthrough" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Feature Walkthrough</CardTitle>
                  <CardDescription>Complete each step to master Nexora</CardDescription>
                </div>
                <Badge variant="secondary" className="text-sm">
                  {completedSteps.size}/{walkthroughSteps.length} Complete
                </Badge>
              </div>
              <Progress value={progress} className="h-2 mt-4" />
            </CardHeader>
            <CardContent>
              <div className="grid gap-4">
                {walkthroughSteps.map((step, index) => {
                  const isCompleted = completedSteps.has(step.id);
                  const isActive = activeStep === step.id;
                  const Icon = step.icon;
                  
                  return (
                    <motion.div
                      key={step.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                    >
                      <Card 
                        className={cn(
                          "cursor-pointer transition-all duration-200",
                          isActive && "ring-2 ring-primary",
                          isCompleted && "bg-primary/5 border-primary/20"
                        )}
                        onClick={() => handleStepClick(step)}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start gap-4">
                            <div className={cn(
                              "p-3 rounded-xl transition-colors",
                              isCompleted ? "bg-primary text-primary-foreground" : "bg-muted"
                            )}>
                              {isCompleted ? (
                                <CheckCircle2 className="h-5 w-5" />
                              ) : (
                                <Icon className="h-5 w-5" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className="font-semibold">{step.title}</h3>
                                {isCompleted && (
                                  <Badge variant="default" className="text-xs">Done</Badge>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground">{step.description}</p>
                              
                              <AnimatePresence>
                                {isActive && (
                                  <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    className="overflow-hidden"
                                  >
                                    <div className="mt-4 space-y-3">
                                      <p className="text-sm font-medium">What you'll learn:</p>
                                      <ul className="space-y-2">
                                        {step.tips.map((tip, i) => (
                                          <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                                            <ChevronRight className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                                            {tip}
                                          </li>
                                        ))}
                                      </ul>
                                      <div className="flex gap-2 pt-2">
                                        <Button 
                                          size="sm" 
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleStartStep(step);
                                          }}
                                          className="gap-2"
                                        >
                                          <ArrowRight className="h-4 w-4" />
                                          Go to {step.title}
                                        </Button>
                                        {!isCompleted && (
                                          <Button 
                                            size="sm" 
                                            variant="outline"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleCompleteStep(step.id);
                                            }}
                                          >
                                            Mark Complete
                                          </Button>
                                        )}
                                      </div>
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                            <ChevronRight className={cn(
                              "h-5 w-5 text-muted-foreground transition-transform",
                              isActive && "rotate-90"
                            )} />
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tips & FAQ */}
        <TabsContent value="tips" className="space-y-6">
          {/* Quick Tips */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lightbulb className="h-5 w-5 text-amber-500" />
                Quick Tips
              </CardTitle>
              <CardDescription>Power user features to boost your productivity</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2">
                {quickTips.map((tip, index) => {
                  const Icon = tip.icon;
                  return (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                    >
                      <Card className="h-full hover:shadow-md transition-shadow">
                        <CardContent className="p-4">
                          <div className="flex items-start gap-3">
                            <div className="p-2 bg-primary/10 rounded-lg">
                              <Icon className="h-4 w-4 text-primary" />
                            </div>
                            <div>
                              <h4 className="font-medium mb-1">{tip.title}</h4>
                              <p className="text-sm text-muted-foreground">{tip.description}</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* FAQ */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <HelpCircle className="h-5 w-5 text-blue-500" />
                Frequently Asked Questions
              </CardTitle>
              <CardDescription>Common questions and answers</CardDescription>
            </CardHeader>
            <CardContent>
              <Accordion type="single" collapsible className="w-full">
                {faqs.map((faq, index) => (
                  <AccordionItem key={index} value={`faq-${index}`}>
                    <AccordionTrigger className="text-left">
                      {faq.question}
                    </AccordionTrigger>
                    <AccordionContent className="text-muted-foreground">
                      {faq.answer}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Guides */}
        <TabsContent value="guides" className="space-y-6">
          <div className="grid gap-6">
            {guides.map((guide, index) => {
              const Icon = guide.icon;
              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Card className="overflow-hidden">
                    <CardHeader className="bg-gradient-to-r from-primary/10 to-transparent">
                      <div className="flex items-center gap-3">
                        <div className="p-3 bg-primary/20 rounded-xl">
                          <Icon className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                          <CardTitle>{guide.title}</CardTitle>
                          <CardDescription>{guide.description}</CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-6">
                      <ol className="space-y-4">
                        {guide.steps.map((step, stepIndex) => (
                          <li key={stepIndex} className="flex gap-4">
                            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary">
                              {stepIndex + 1}
                            </div>
                            <p className="text-sm text-muted-foreground pt-1">{step}</p>
                          </li>
                        ))}
                      </ol>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
