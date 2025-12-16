import { 
  BarChart3, Building2, MapPin, Mail, Calendar, Printer, Star, 
  Sparkles, Zap, Tag, Target, Shield, Clock, Users, Gift, Search,
  FileText, Settings, MessageSquare, TrendingUp, Layers, Database
} from 'lucide-react';

export interface HelpArticle {
  id: string;
  title: string;
  description: string;
  content: string;
  readTime: number;
  tags: string[];
}

export interface HelpCategory {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  color: string;
  articles: HelpArticle[];
}

export interface KeyboardShortcut {
  keys: string[];
  description: string;
  category: 'Navigation' | 'Actions' | 'Global';
}

export interface ChangelogEntry {
  version: string;
  date: string;
  title: string;
  description: string;
  type: 'feature' | 'improvement' | 'fix';
  isNew: boolean;
}

export interface QuickTip {
  icon: React.ElementType;
  title: string;
  description: string;
  category: string;
}

export interface FAQ {
  question: string;
  answer: string;
  category: 'General' | 'Technical' | 'Features';
}

// Help Categories with Articles
export const helpCategories: HelpCategory[] = [
  {
    id: 'getting-started',
    title: 'Getting Started',
    description: 'Set up your clinic and start tracking referrals',
    icon: Sparkles,
    color: 'from-emerald-500 to-teal-500',
    articles: [
      {
        id: 'initial-setup',
        title: 'Initial Setup Guide',
        description: 'Complete the onboarding wizard and configure your clinic',
        content: 'Walk through setting up your clinic profile, adding your address, and configuring basic settings.',
        readTime: 5,
        tags: ['setup', 'onboarding', 'clinic']
      },
      {
        id: 'first-office',
        title: 'Adding Your First Partner Office',
        description: 'Learn how to add and manage referral partners',
        content: 'Add offices manually or import from a spreadsheet. Learn about office tiers and how they work.',
        readTime: 3,
        tags: ['offices', 'partners', 'import']
      },
      {
        id: 'understanding-tiers',
        title: 'Understanding Office Tiers',
        description: 'VIP, Warm, Cold, and Dormant explained',
        content: 'Tiers are calculated based on MSLR (Monthly Source-Level Referrals). Learn the thresholds and strategies for each tier.',
        readTime: 4,
        tags: ['tiers', 'mslr', 'scoring']
      }
    ]
  },
  {
    id: 'managing-partners',
    title: 'Managing Partners',
    description: 'Organize and track your referral network',
    icon: Building2,
    color: 'from-blue-500 to-indigo-500',
    articles: [
      {
        id: 'bulk-actions',
        title: 'Bulk Actions & Selection',
        description: 'Select multiple offices for batch operations',
        content: 'Use checkboxes to select offices, then access bulk actions like email, tag, or print labels.',
        readTime: 3,
        tags: ['bulk', 'selection', 'actions']
      },
      {
        id: 'custom-tags',
        title: 'Using Custom Tags',
        description: 'Organize offices with color-coded labels',
        content: 'Create tags for campaigns, regions, specialties, or any custom grouping you need.',
        readTime: 2,
        tags: ['tags', 'organization', 'labels']
      },
      {
        id: 'office-contacts',
        title: 'Managing Office Contacts',
        description: 'Track key people at each partner office',
        content: 'Add contacts with birthdays, roles, and notes. Never miss an important date.',
        readTime: 3,
        tags: ['contacts', 'people', 'relationships']
      }
    ]
  },
  {
    id: 'campaigns-outreach',
    title: 'Campaigns & Outreach',
    description: 'Engage partners with email and gift campaigns',
    icon: Mail,
    color: 'from-violet-500 to-purple-500',
    articles: [
      {
        id: 'email-campaigns',
        title: 'Creating Email Campaigns',
        description: 'Send personalized emails to partner offices',
        content: 'Design email campaigns with templates, track opens and clicks, and measure engagement.',
        readTime: 5,
        tags: ['email', 'campaigns', 'outreach']
      },
      {
        id: 'gift-campaigns',
        title: 'Physical Gift Campaigns',
        description: 'Send appreciation gifts to top partners',
        content: 'Plan and track gift deliveries, including photos and delivery notes.',
        readTime: 4,
        tags: ['gifts', 'appreciation', 'physical']
      },
      {
        id: 'mailing-labels',
        title: 'Generating Mailing Labels',
        description: 'Print professional labels for mailings',
        content: 'Export to Avery templates or generate PDF labels. Includes address correction.',
        readTime: 3,
        tags: ['labels', 'mail', 'print']
      }
    ]
  },
  {
    id: 'tracking-analytics',
    title: 'Tracking & Analytics',
    description: 'Monitor performance and gain insights',
    icon: BarChart3,
    color: 'from-amber-500 to-orange-500',
    articles: [
      {
        id: 'daily-logging',
        title: 'Daily Patient Logging',
        description: 'Track referrals day-by-day with source attribution',
        content: 'Log patients by source, view trends, and catch up on missed days.',
        readTime: 3,
        tags: ['daily', 'patients', 'logging']
      },
      {
        id: 'analytics-dashboard',
        title: 'Analytics Dashboard',
        description: 'Deep dive into your referral performance',
        content: 'Compare periods, identify top performers, and track ROI on marketing.',
        readTime: 4,
        tags: ['analytics', 'reports', 'metrics']
      },
      {
        id: 'source-attribution',
        title: 'Source Attribution',
        description: 'Track where your patients come from',
        content: 'Understand which offices send the most referrals and their trends over time.',
        readTime: 3,
        tags: ['attribution', 'sources', 'tracking']
      }
    ]
  },
  {
    id: 'discovery-growth',
    title: 'Discovery & Growth',
    description: 'Find new partners and expand your network',
    icon: Search,
    color: 'from-cyan-500 to-teal-500',
    articles: [
      {
        id: 'discover-offices',
        title: 'Discovering Nearby Offices',
        description: 'Find potential partners using Google Maps',
        content: 'Search by distance and office type, then import promising offices.',
        readTime: 3,
        tags: ['discover', 'google', 'nearby']
      },
      {
        id: 'map-view',
        title: 'Using the Map View',
        description: 'Visualize your partner network geographically',
        content: 'See all offices on an interactive map with tier indicators.',
        readTime: 2,
        tags: ['map', 'geography', 'visualization']
      },
      {
        id: 'marketing-visits',
        title: 'Planning Marketing Visits',
        description: 'Schedule and track in-person visits',
        content: 'Log visits, attach photos, and follow up systematically.',
        readTime: 4,
        tags: ['visits', 'marketing', 'in-person']
      }
    ]
  },
  {
    id: 'advanced-features',
    title: 'Advanced Features',
    description: 'Power user tools and AI capabilities',
    icon: Zap,
    color: 'from-rose-500 to-pink-500',
    articles: [
      {
        id: 'ai-assistant',
        title: 'AI Assistant',
        description: 'Get intelligent insights and content suggestions',
        content: 'Use AI to analyze your network, generate campaign content, and get recommendations.',
        readTime: 4,
        tags: ['ai', 'assistant', 'insights']
      },
      {
        id: 'review-magic',
        title: 'Review Magic',
        description: 'Manage and respond to Google reviews',
        content: 'Sync reviews, generate AI responses, and track reputation.',
        readTime: 3,
        tags: ['reviews', 'google', 'reputation']
      },
      {
        id: 'data-import-export',
        title: 'Data Import & Export',
        description: 'Bulk data management capabilities',
        content: 'Import offices from CSV/Excel, export data for reports.',
        readTime: 3,
        tags: ['import', 'export', 'data']
      }
    ]
  }
];

// Keyboard Shortcuts
export const keyboardShortcuts: KeyboardShortcut[] = [
  // Global
  { keys: ['⌘', 'K'], description: 'Open quick search', category: 'Global' },
  { keys: ['?'], description: 'Show keyboard shortcuts', category: 'Global' },
  { keys: ['Esc'], description: 'Close dialogs & dropdowns', category: 'Global' },
  
  // Navigation
  { keys: ['G', 'D'], description: 'Go to Dashboard', category: 'Navigation' },
  { keys: ['G', 'O'], description: 'Go to Offices', category: 'Navigation' },
  { keys: ['G', 'C'], description: 'Go to Campaigns', category: 'Navigation' },
  { keys: ['G', 'P'], description: 'Go to Daily Patients', category: 'Navigation' },
  { keys: ['G', 'A'], description: 'Go to Analytics', category: 'Navigation' },
  { keys: ['G', 'S'], description: 'Go to Settings', category: 'Navigation' },
  
  // Actions
  { keys: ['N'], description: 'New item (context-aware)', category: 'Actions' },
  { keys: ['⌘', 'A'], description: 'Select all items', category: 'Actions' },
  { keys: ['⌘', 'E'], description: 'Export selection', category: 'Actions' },
  { keys: ['Delete'], description: 'Delete selected items', category: 'Actions' },
];

// Changelog
export const changelog: ChangelogEntry[] = [
  {
    version: '2.1.0',
    date: '2024-12-15',
    title: 'AI Assistant Improvements',
    description: 'Enhanced AI analysis with better insights and faster response times.',
    type: 'feature',
    isNew: true
  },
  {
    version: '2.0.5',
    date: '2024-12-10',
    title: 'Bulk Actions Upgrade',
    description: 'New bulk email and tagging capabilities for managing multiple offices.',
    type: 'improvement',
    isNew: true
  },
  {
    version: '2.0.4',
    date: '2024-12-05',
    title: 'Map View Performance',
    description: 'Faster loading and smoother interactions on the map view.',
    type: 'improvement',
    isNew: false
  },
  {
    version: '2.0.3',
    date: '2024-11-28',
    title: 'Address Correction Tool',
    description: 'New tool to validate and correct office addresses using Google Maps.',
    type: 'feature',
    isNew: false
  },
  {
    version: '2.0.2',
    date: '2024-11-20',
    title: 'Campaign Templates',
    description: 'Save and reuse campaign templates for faster workflow.',
    type: 'feature',
    isNew: false
  }
];

// Quick Tips
export const quickTips: QuickTip[] = [
  {
    icon: Zap,
    title: 'Bulk Selection',
    description: 'Select multiple offices using checkboxes, then use the action bar for bulk operations.',
    category: 'Efficiency'
  },
  {
    icon: Tag,
    title: 'Custom Tags',
    description: 'Create color-coded tags to organize offices beyond tiers. Great for campaigns or regions.',
    category: 'Organization'
  },
  {
    icon: Target,
    title: 'Tier Quick Actions',
    description: 'Click the dropdown next to tier filters for quick actions like "Email All VIP".',
    category: 'Efficiency'
  },
  {
    icon: Shield,
    title: 'Address Correction',
    description: 'Use the Address Correction Tool to validate addresses with Google Maps before printing labels.',
    category: 'Quality'
  },
  {
    icon: Clock,
    title: 'Daily Tracking',
    description: 'Log patients daily for accurate MSLR calculations and automatic tier assignments.',
    category: 'Best Practice'
  },
  {
    icon: Sparkles,
    title: 'AI Assistant',
    description: 'Use AI to get insights about your referral network and generate campaign content.',
    category: 'Advanced'
  },
  {
    icon: Calendar,
    title: 'Important Dates',
    description: 'Track contact birthdays and office anniversaries for personalized outreach.',
    category: 'Relationships'
  },
  {
    icon: TrendingUp,
    title: 'Trend Analysis',
    description: 'Compare performance across time periods in Analytics to identify patterns.',
    category: 'Analytics'
  }
];

// FAQs
export const faqs: FAQ[] = [
  // General
  {
    question: 'How are office tiers calculated?',
    answer: 'Tiers are based on MSLR (Monthly Source-Level Referrals). VIP = 3+ referrals/month, Warm = 1-2 referrals/month, Cold = Some history but not recent, Dormant = No recent activity.',
    category: 'General'
  },
  {
    question: 'Can multiple team members use the app?',
    answer: 'Yes! Invite team members from Settings. You can assign different roles and permissions to control access.',
    category: 'General'
  },
  {
    question: 'What happens if I miss logging patients for a few days?',
    answer: 'No problem! Use the calendar view in Daily Patients to catch up on any missed days. Your MSLR calculations will update automatically.',
    category: 'General'
  },
  
  // Technical
  {
    question: 'Can I import offices from a spreadsheet?',
    answer: 'Yes! Go to Partner Offices and click the Import button. You can upload a CSV or Excel file with office details including name, address, phone, and email.',
    category: 'Technical'
  },
  {
    question: 'What label templates are supported?',
    answer: 'We support popular Avery templates including 5160 (30 per sheet), 5161 (20 per sheet), 5163 (10 per sheet), and 5167 (80 per sheet).',
    category: 'Technical'
  },
  {
    question: 'How do I connect my Google Business account?',
    answer: 'Go to Settings and look for the Google Business integration. This allows you to sync reviews and respond to them directly from the app.',
    category: 'Technical'
  },
  
  // Features
  {
    question: 'How do I track which campaigns were successful?',
    answer: 'Each campaign tracks delivery status and you can log referrals received. Over time, the analytics page will show ROI by comparing campaign costs to referral value.',
    category: 'Features'
  },
  {
    question: 'Can I customize the office discovery search?',
    answer: 'Yes! In the Discover page, you can filter by distance from your clinic and office type (dental, medical, chiropractic, etc.).',
    category: 'Features'
  },
  {
    question: 'How does the AI Assistant work?',
    answer: 'The AI analyzes your referral data, office relationships, and campaign history to provide insights and suggestions. It can also help generate email content and identify growth opportunities.',
    category: 'Features'
  }
];

// Search helper - flatten all searchable content
export const getSearchableContent = () => {
  const items: Array<{ type: string; title: string; description: string; id: string; categoryId?: string }> = [];
  
  // Add articles from categories
  helpCategories.forEach(category => {
    category.articles.forEach(article => {
      items.push({
        type: 'article',
        title: article.title,
        description: article.description,
        id: article.id,
        categoryId: category.id
      });
    });
  });
  
  // Add FAQs
  faqs.forEach((faq, index) => {
    items.push({
      type: 'faq',
      title: faq.question,
      description: faq.answer.slice(0, 100) + '...',
      id: `faq-${index}`
    });
  });
  
  // Add tips
  quickTips.forEach((tip, index) => {
    items.push({
      type: 'tip',
      title: tip.title,
      description: tip.description,
      id: `tip-${index}`
    });
  });
  
  return items;
};
