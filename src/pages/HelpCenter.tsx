import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  BookOpen, Play, ChevronRight, CheckCircle2, 
  Building2, MapPin, Mail, BarChart3, Calendar, Printer,
  ArrowRight, ArrowLeft, Sparkles, Search, Rocket, FileText, Clock
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { 
  HelpSearch, 
  KeyboardShortcuts, 
  WhatsNew, 
  ContactSupport,
  HelpCategoryCard,
  QuickTipsGrid,
  FAQSection,
  helpCategories,
  type HelpCategory
} from '@/components/help';

// Walkthrough steps for the interactive tour
interface WalkthroughStep {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  route: string;
  tips: string[];
}

const walkthroughSteps: WalkthroughStep[] = [
  {
    id: 'dashboard',
    title: 'Dashboard Overview',
    description: 'Your command center for tracking referrals and performance at a glance.',
    icon: BarChart3,
    route: '/dashboard',
    tips: ['View total referrals and trends', 'See top performing partners', 'Track monthly patient counts']
  },
  {
    id: 'offices',
    title: 'Partner Offices',
    description: 'Manage your referral partner network with powerful filtering.',
    icon: Building2,
    route: '/offices',
    tips: ['Filter by tier: VIP, Warm, Cold, Dormant', 'Use bulk actions for efficiency', 'Assign custom tags']
  },
  {
    id: 'discover',
    title: 'Discover Offices',
    description: 'Find new potential referral partners nearby.',
    icon: MapPin,
    route: '/discover',
    tips: ['Search by distance', 'Filter by office type', 'Import as partners']
  },
  {
    id: 'campaigns',
    title: 'Campaigns',
    description: 'Create email and gift campaigns to engage partners.',
    icon: Mail,
    route: '/campaigns',
    tips: ['Choose email or gift campaigns', 'Track delivery status', 'Save templates']
  },
  {
    id: 'daily-patients',
    title: 'Daily Patients',
    description: 'Track referrals day-by-day with source attribution.',
    icon: Calendar,
    route: '/daily-patients',
    tips: ['Log patients by source', 'View trends with charts', 'Catch up on missed days']
  },
  {
    id: 'mailing-labels',
    title: 'Mailing Labels',
    description: 'Generate professional labels for physical campaigns.',
    icon: Printer,
    route: '/mailing-labels',
    tips: ['Export to Excel or PDF', 'Supports Avery templates', 'Auto-correct addresses']
  },
  {
    id: 'analytics',
    title: 'Analytics',
    description: 'Deep dive into referral performance.',
    icon: BarChart3,
    route: '/analytics',
    tips: ['Compare time periods', 'Identify top performers', 'Track marketing ROI']
  }
];

// Local storage key for progress
const PROGRESS_KEY = 'nexora_help_progress';

export function HelpCenter() {
  const navigate = useNavigate();
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(() => {
    const saved = localStorage.getItem(PROGRESS_KEY);
    return saved ? new Set(JSON.parse(saved)) : new Set();
  });
  const [activeStep, setActiveStep] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<HelpCategory | null>(null);
  const [selectedArticle, setSelectedArticle] = useState<typeof helpCategories[0]['articles'][0] | null>(null);
  const [activeTab, setActiveTab] = useState('overview');

  // Persist progress
  useEffect(() => {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify([...completedSteps]));
  }, [completedSteps]);

  const progress = (completedSteps.size / walkthroughSteps.length) * 100;
  const isComplete = progress === 100;

  const handleCompleteStep = useCallback((stepId: string) => {
    setCompletedSteps(prev => new Set([...prev, stepId]));
  }, []);

  const handleResetProgress = useCallback(() => {
    setCompletedSteps(new Set());
  }, []);

  const handleSearchSelect = useCallback((type: string, id: string, categoryId?: string) => {
    if (type === 'article' && categoryId) {
      const category = helpCategories.find(c => c.id === categoryId);
      if (category) {
        setSelectedCategory(category);
        setActiveTab('browse');
      }
    } else if (type === 'faq') {
      setActiveTab('faq');
    } else if (type === 'tip') {
      setActiveTab('tips');
    }
  }, []);

  return (
    <div className="space-y-8 pb-8">
      {/* Hero Section */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/15 via-primary/5 to-transparent border-2 border-primary/20">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        
        <div className="relative p-8 md:p-10">
          <div className="max-w-3xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-primary rounded-xl shadow-lg shadow-primary/30">
                <BookOpen className="h-7 w-7 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-foreground">Help Center</h1>
                <p className="text-muted-foreground">Everything you need to master Nexora</p>
              </div>
            </div>
            
            {/* Search */}
            <div className="mt-8 mb-6">
              <HelpSearch onSelectResult={handleSearchSelect} />
            </div>
            
            {/* Quick Stats */}
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-background/60 rounded-lg border">
                <FileText className="h-4 w-4 text-primary" />
                <span>{helpCategories.reduce((acc, c) => acc + c.articles.length, 0)} articles</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-background/60 rounded-lg border">
                <Sparkles className="h-4 w-4 text-amber-500" />
                <span>6 categories</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-background/60 rounded-lg border">
                <Clock className="h-4 w-4 text-emerald-500" />
                <span>~5 min reads</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="h-12 p-1 bg-muted/50 border">
          <TabsTrigger value="overview" className="gap-2 px-4">
            <Rocket className="h-4 w-4" />
            <span className="hidden sm:inline">Get Started</span>
          </TabsTrigger>
          <TabsTrigger value="browse" className="gap-2 px-4">
            <Search className="h-4 w-4" />
            <span className="hidden sm:inline">Browse Topics</span>
          </TabsTrigger>
          <TabsTrigger value="tips" className="gap-2 px-4">
            <Sparkles className="h-4 w-4" />
            <span className="hidden sm:inline">Tips</span>
          </TabsTrigger>
          <TabsTrigger value="faq" className="gap-2 px-4">
            <BookOpen className="h-4 w-4" />
            <span className="hidden sm:inline">FAQ</span>
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab - Walkthrough + Sidebar */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Walkthrough */}
            <div className="lg:col-span-2 space-y-6">
              <Card className="border-2">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Play className="h-5 w-5 text-primary" />
                        Interactive Walkthrough
                      </CardTitle>
                      <CardDescription>Complete each step to master Nexora</CardDescription>
                    </div>
                    <div className="flex items-center gap-3">
                      {isComplete && (
                        <Badge className="bg-emerald-500 text-white gap-1">
                          <CheckCircle2 className="h-3 w-3" /> Complete!
                        </Badge>
                      )}
                      <Badge variant="secondary">
                        {completedSteps.size}/{walkthroughSteps.length}
                      </Badge>
                    </div>
                  </div>
                  <div className="pt-2">
                    <Progress value={progress} className="h-2" />
                    {isComplete && (
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="mt-2 text-xs"
                        onClick={handleResetProgress}
                      >
                        Reset progress
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {walkthroughSteps.map((step, index) => {
                    const isCompleted = completedSteps.has(step.id);
                    const isActive = activeStep === step.id;
                    const Icon = step.icon;
                    
                    return (
                      <motion.div
                        key={step.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.03 }}
                      >
                        <div 
                          className={cn(
                            "p-4 rounded-xl border-2 cursor-pointer transition-all duration-200",
                            isActive && "border-primary bg-primary/5",
                            isCompleted && !isActive && "border-emerald-500/30 bg-emerald-500/5",
                            !isActive && !isCompleted && "hover:border-primary/30 hover:bg-muted/50"
                          )}
                          onClick={() => setActiveStep(isActive ? null : step.id)}
                        >
                          <div className="flex items-center gap-4">
                            <div className={cn(
                              "p-2.5 rounded-xl transition-colors",
                              isCompleted ? "bg-emerald-500 text-white" : "bg-muted"
                            )}>
                              {isCompleted ? (
                                <CheckCircle2 className="h-5 w-5" />
                              ) : (
                                <Icon className="h-5 w-5" />
                              )}
                            </div>
                            <div className="flex-1">
                              <h3 className="font-medium">{step.title}</h3>
                              <p className="text-sm text-muted-foreground">{step.description}</p>
                            </div>
                            <ChevronRight className={cn(
                              "h-5 w-5 text-muted-foreground transition-transform",
                              isActive && "rotate-90"
                            )} />
                          </div>
                          
                          <AnimatePresence>
                            {isActive && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="overflow-hidden"
                              >
                                <div className="mt-4 pt-4 border-t space-y-3">
                                  <p className="text-sm font-medium">What you'll learn:</p>
                                  <ul className="space-y-1.5">
                                    {step.tips.map((tip, i) => (
                                      <li key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <ChevronRight className="h-3 w-3 text-primary" />
                                        {tip}
                                      </li>
                                    ))}
                                  </ul>
                                  <div className="flex gap-2 pt-2">
                                    <Button 
                                      size="sm"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        navigate(step.route);
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
                      </motion.div>
                    );
                  })}
                </CardContent>
              </Card>
            </div>
            
            {/* Sidebar */}
            <div className="space-y-6">
              <WhatsNew />
              <KeyboardShortcuts />
              <ContactSupport />
            </div>
          </div>
        </TabsContent>

        {/* Browse Topics Tab */}
        <TabsContent value="browse" className="space-y-6">
          {selectedArticle ? (
            // Article View
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-6"
            >
              <Button 
                variant="ghost" 
                className="gap-2"
                onClick={() => setSelectedArticle(null)}
              >
                <ArrowLeft className="h-4 w-4" />
                Back to articles
              </Button>
              
              <Card className="border-2">
                <CardHeader>
                  <div className="flex items-center gap-3 mb-2">
                    <Badge variant="outline" className="text-xs gap-1">
                      <Clock className="h-3 w-3" />
                      {selectedArticle.readTime} min read
                    </Badge>
                    {selectedArticle.tags.map(tag => (
                      <Badge key={tag} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                  <CardTitle className="text-2xl">{selectedArticle.title}</CardTitle>
                  <CardDescription className="text-base">{selectedArticle.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="prose prose-sm max-w-none dark:prose-invert">
                    {selectedArticle.content.split('\n\n').map((paragraph, idx) => {
                      // Handle headers
                      if (paragraph.startsWith('**') && paragraph.endsWith('**')) {
                        return <h3 key={idx} className="text-lg font-semibold mt-6 mb-3">{paragraph.replace(/\*\*/g, '')}</h3>;
                      }
                      // Handle list items
                      if (paragraph.includes('\n- ')) {
                        const [title, ...items] = paragraph.split('\n- ');
                        return (
                          <div key={idx} className="my-4">
                            {title && <p className="font-medium mb-2">{title}</p>}
                            <ul className="list-disc pl-5 space-y-1">
                              {items.map((item, i) => (
                                <li key={i} className="text-muted-foreground">{item}</li>
                              ))}
                            </ul>
                          </div>
                        );
                      }
                      // Handle tables (simple markdown)
                      if (paragraph.includes('|')) {
                        const rows = paragraph.split('\n').filter(r => r.trim() && !r.includes('---'));
                        return (
                          <div key={idx} className="my-4 overflow-x-auto">
                            <table className="min-w-full text-sm border rounded-lg overflow-hidden">
                              <tbody>
                                {rows.map((row, ri) => (
                                  <tr key={ri} className={ri === 0 ? 'bg-muted font-medium' : 'border-t'}>
                                    {row.split('|').filter(c => c.trim()).map((cell, ci) => (
                                      <td key={ci} className="px-3 py-2">{cell.trim()}</td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        );
                      }
                      // Regular paragraph
                      return (
                        <p key={idx} className="text-muted-foreground leading-relaxed my-3">
                          {paragraph.split('**').map((part, i) => 
                            i % 2 === 1 ? <strong key={i} className="text-foreground">{part}</strong> : part
                          )}
                        </p>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ) : selectedCategory ? (
            // Category Articles List
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-6"
            >
              <Button 
                variant="ghost" 
                className="gap-2"
                onClick={() => setSelectedCategory(null)}
              >
                <ArrowLeft className="h-4 w-4" />
                Back to topics
              </Button>
              
              <Card className="border-2">
                <CardHeader>
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      "p-3 rounded-xl bg-gradient-to-br text-white",
                      selectedCategory.color
                    )}>
                      <selectedCategory.icon className="h-6 w-6" />
                    </div>
                    <div>
                      <CardTitle>{selectedCategory.title}</CardTitle>
                      <CardDescription>{selectedCategory.description}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {selectedCategory.articles.map((article, index) => (
                    <motion.div
                      key={article.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="p-4 rounded-xl border hover:border-primary/30 hover:bg-muted/30 transition-all cursor-pointer"
                      onClick={() => setSelectedArticle(article)}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h4 className="font-medium mb-1">{article.title}</h4>
                          <p className="text-sm text-muted-foreground">{article.description}</p>
                          <div className="flex items-center gap-3 mt-2">
                            <Badge variant="outline" className="text-xs gap-1">
                              <Clock className="h-3 w-3" />
                              {article.readTime} min read
                            </Badge>
                            {article.tags.slice(0, 2).map(tag => (
                              <Badge key={tag} variant="secondary" className="text-xs">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
                      </div>
                    </motion.div>
                  ))}
                </CardContent>
              </Card>
            </motion.div>
          ) : (
            // Categories Grid
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {helpCategories.map((category, index) => (
                <motion.div
                  key={category.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <HelpCategoryCard 
                    category={category} 
                    onClick={() => setSelectedCategory(category)}
                  />
                </motion.div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Tips Tab */}
        <TabsContent value="tips" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <QuickTipsGrid />
            </div>
            <div className="space-y-6">
              <KeyboardShortcuts />
              <ContactSupport />
            </div>
          </div>
        </TabsContent>

        {/* FAQ Tab */}
        <TabsContent value="faq" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <FAQSection />
            </div>
            <div className="space-y-6">
              <WhatsNew />
              <ContactSupport />
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
