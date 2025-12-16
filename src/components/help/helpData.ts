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

// Help Categories with Complete Articles
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
        content: `Welcome to Nexora! This guide walks you through setting up your account and getting started with managing your referral network.

**Step 1: Complete Your Clinic Profile**

After signing in, set up your clinic information in Settings > Clinic Profile:
- **Clinic Name**: Your practice's official name
- **Address**: Full street address (essential for distance calculations)
- **Phone & Email**: Contact information for your practice
- **Website**: Optional but helpful for branding

**Step 2: Configure Your Location**

For accurate distance calculations and map features:
1. Go to Settings > Clinic Profile
2. Enter your complete address or click "Set Location on Map"
3. Verify the pin is correctly positioned
4. Save your changes

**Step 3: Add Your First Partner Offices**

You have three options:
- **Manual Entry**: Click "+ Add Office" and enter details
- **Import**: Upload a CSV or Excel file with existing contacts
- **Discovery**: Use AI-powered discovery to find nearby offices

We recommend starting with your top 5-10 referring offices.

**Step 4: Log Your First Patients**

Navigate to Daily Patients and start logging:
1. Select a date on the calendar
2. Choose the referring office
3. Enter the patient count
4. Add optional notes

**Next Steps**
- Explore the Dashboard for an overview
- Set up Tags to organize offices
- Try the AI Assistant for insights`,
        readTime: 5,
        tags: ['setup', 'onboarding', 'clinic']
      },
      {
        id: 'first-office',
        title: 'Adding Your First Partner Office',
        description: 'Learn how to add and manage referral partners',
        content: `Adding partner offices is the foundation of your referral network. Here's everything you need to know.

**Method 1: Manual Entry**

The quickest way to add a single office:
1. Navigate to Offices from the sidebar
2. Click the "+ Add Office" button
3. Fill in required fields (Office Name)
4. Add recommended details: Address, Phone, Email
5. Click Save

**Pro Tip**: After adding manually, use the "Fill Details" button to auto-populate information from Google Places.

**Method 2: Import from Spreadsheet**

Best for adding many offices at once:
1. Go to Offices > Import
2. Download our template or use your existing file
3. Required column: Office Name
4. Recommended: Address, Phone, Email
5. Upload and map your columns
6. Review and confirm

**Method 3: Discovery**

Find new potential partners:
1. Navigate to Discover
2. Set your search radius (1-25 miles)
3. Filter by office type if desired
4. Browse results with ratings and contact info
5. Click "Import" on offices you want

**What Happens After Adding**

Once an office is added:
- Starts in the Dormant tier (no history)
- Distance from your clinic is calculated
- Appears on your Map View
- Ready for patient logging

**Required vs Optional Fields**

| Field | Required | Why It Matters |
|-------|----------|----------------|
| Name | Yes | Identification |
| Address | No* | Maps, labels, distance |
| Phone | No | Quick contact |
| Email | No | Email campaigns |

*Address is highly recommended for full functionality.`,
        readTime: 4,
        tags: ['offices', 'partners', 'import']
      },
      {
        id: 'understanding-tiers',
        title: 'Understanding Office Tiers',
        description: 'VIP, Warm, Cold, and Dormant explained',
        content: `The tier system automatically categorizes your partner offices based on referral activity. Understanding tiers helps you prioritize outreach effectively.

**How Tiers Are Calculated**

Tiers are based on MSLR (Monthly Source-Level Referrals) — the average patients referred per month over the last 3 months:

MSLR = Total patients (last 3 months) ÷ 3

Tiers update automatically as you log patients.

**The Four Tiers**

🌟 **VIP Tier (MSLR ≥ 3)**
Your top-performing partners. Strategy: Prioritize relationship maintenance with personal thank-you calls, premium gifts, and regular check-ins.

🔥 **Warm Tier (MSLR 1-2)**
Engaged partners with consistent referrals. Strategy: Nurture to VIP status with regular appreciation and quarterly campaigns.

❄️ **Cold Tier (MSLR < 1, has history)**
Partners who have referred but activity has slowed. Strategy: Re-engagement focus with "we miss you" campaigns and personal visits.

💤 **Dormant Tier (No recent activity)**
New offices or those with no referrals in 6+ months. Strategy: Activation campaigns with introduction materials and relationship building.

**Using Tiers Effectively**

In the Offices View:
- Filter by tier using the dropdown
- Sort to see all VIPs first
- Bulk select by tier for campaigns

In Campaigns:
- Target specific tiers with appropriate messaging
- VIP: Thank you focus
- Cold/Dormant: Re-engagement focus

**Tips for Improving Tier Distribution**
1. Log patients consistently
2. Focus on Cold offices (easiest wins)
3. Protect your VIPs
4. Set tier goals per quarter`,
        readTime: 5,
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
        content: `Nexora's bulk actions let you work with multiple offices at once, saving time on repetitive tasks.

**Selecting Offices**

Individual Selection: Click the checkbox next to any office.

Select All: Click the checkbox in the header row to select all visible offices (respects your filters).

Smart Selection Tips:
- Apply tier filters first, then select all
- Use tags to group offices
- Search to narrow results before selecting

**The Selection Action Bar**

When offices are selected, a floating action bar appears:

📧 **Email Campaign**: Create an email campaign targeting selected offices.

🏷️ **Assign Tags**: Add or remove tags from all selected offices at once.

📋 **Export**: Download selected offices as CSV or Excel.

🗑️ **Delete**: Remove selected offices permanently (requires confirmation).

**Workflow Examples**

Tier-Based Campaign:
1. Filter offices by "Cold" tier
2. Select all
3. Click "Email Campaign"
4. Create re-engagement campaign

Regional Tagging:
1. Search for offices in a city
2. Select all results
3. Click "Assign Tags"
4. Add regional tag

**Keyboard Shortcuts**

| Shortcut | Action |
|----------|--------|
| Shift + Click | Select range |
| Ctrl/Cmd + A | Select all visible |
| Escape | Clear selection |

**Best Practices**
- Filter first, then select
- Double-check counts before actions
- Export backups before bulk changes`,
        readTime: 4,
        tags: ['bulk', 'selection', 'actions']
      },
      {
        id: 'custom-tags',
        title: 'Using Custom Tags',
        description: 'Organize offices with color-coded labels',
        content: `Tags are a flexible way to organize offices beyond the automatic tier system. Create custom categories that match your workflow.

**Creating Tags**

1. Navigate to Offices
2. Click the Tags button in the toolbar
3. Click "+ New Tag"
4. Enter a tag name
5. Choose a color
6. Click Save

**Assigning Tags**

Single Office:
1. Click on an office to open details
2. Find the Tags section
3. Click "Add Tag"
4. Select from existing tags

Multiple Offices:
1. Select offices using checkboxes
2. Click "Assign Tags" in action bar
3. Check tags to add, uncheck to remove
4. Click Apply

**Filtering by Tag**

1. Click the Filter dropdown
2. Select "By Tag"
3. Choose one or more tags
4. Results show offices matching selected tags

Combine with tier filters for powerful segmentation.

**Popular Tag Use Cases**

Geographic: "North Side", "Downtown", "Austin Metro"

Specialty: "Dental", "Chiropractic", "Family Practice"

Status: "New Contact", "Needs Visit", "Key Account"

Campaign: "Holiday 2024", "Q1 Outreach", "Gift Sent"

**Pro Tips**
1. Keep tags broad (avoid too many)
2. Use colors meaningfully
3. Clean up unused tags quarterly
4. Combine with tiers for targeting`,
        readTime: 3,
        tags: ['tags', 'organization', 'labels']
      },
      {
        id: 'office-contacts',
        title: 'Managing Office Contacts',
        description: 'Track key people at each partner office',
        content: `Each partner office can have multiple contacts — the people you actually interact with. Managing contacts helps you personalize outreach.

**Adding Contacts**

1. Open an office's detail view
2. Scroll to the Contacts section
3. Click "+ Add Contact"
4. Fill in contact information:
   - Name (required)
   - Role (e.g., Office Manager, Doctor)
   - Email (for campaigns)
   - Phone (for calls)
   - Birthday (for special outreach)
5. Click Save

**Contact Fields Explained**

**Name**: Full name with proper capitalization.

**Role**: Position at the office — Office Manager, Front Desk, Doctor, Practice Owner.

**Email**: Primary email for campaigns. Verify accuracy.

**Phone**: Direct line or mobile for quick contact.

**Birthday**: Enables automatic reminders and personalized campaigns.

**Primary Contact**

Mark one contact as "Primary" per office:
- Appears first in lists
- Used as default for campaigns
- Shows in office cards

**Important Dates Calendar**

Birthdays appear in Daily Patients > Important Dates:
- View upcoming birthdays
- Plan birthday campaigns
- Never miss relationship opportunities

**Using Contacts in Campaigns**

When creating email campaigns:
- Default: Primary contact
- Option to select specific contacts
- Personalization tokens available

**Best Practices**
1. Verify contact info during visits
2. Note communication preferences
3. Track staff turnover
4. Add 2-3 contacts per office
5. Birthday outreach builds loyalty`,
        readTime: 4,
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
        content: `Email campaigns help you stay connected with your referral network at scale. Here's how to create effective campaigns.

**Starting a New Campaign**

1. Navigate to Campaigns
2. Click "+ New Campaign"
3. Select "Email Campaign"
4. Name your campaign descriptively

**Selecting Recipients**

By Tier: Target specific performance levels
- VIP: Thank you and appreciation
- Warm: Encouragement and updates
- Cold: Re-engagement
- Dormant: Introduction/activation

By Tag: Select offices with specific tags.

Manual: Hand-pick specific offices.

**Crafting Your Email**

Subject Line:
- Keep under 50 characters
- Personalize with {office_name}
- Create urgency or curiosity

Email Body:
- Start with a personal touch
- State your purpose clearly
- Include a clear call-to-action
- Keep it concise (under 200 words)

**Personalization Tokens**

| Token | Replaces With |
|-------|--------------|
| {office_name} | Partner office name |
| {contact_name} | Primary contact name |
| {clinic_name} | Your clinic name |

**Scheduling Options**

Send Immediately: Sends after clicking "Launch"

Schedule for Later: Pick date and time
- Tuesday-Thursday: Highest open rates
- 10am or 2pm: Peak engagement
- Avoid Mondays and Fridays

**Tracking & Analytics**

After sending, monitor:
- Delivery rate
- Open rate
- Click rate
- Bounces

**Best Practices**
1. Segment by tier
2. Test before sending
3. Follow up on non-openers
4. Clean bounced emails`,
        readTime: 5,
        tags: ['email', 'campaigns', 'outreach']
      },
      {
        id: 'gift-campaigns',
        title: 'Physical Gift Campaigns',
        description: 'Send appreciation gifts to top partners',
        content: `Physical gift campaigns create memorable touchpoints with your referral partners. Here's how to plan and execute them effectively.

**When to Use Gift Campaigns**

- Holiday seasons
- VIP appreciation
- Milestone celebrations
- Re-engagement efforts
- Thank you after significant referrals

**Creating a Gift Campaign**

1. Navigate to Campaigns
2. Click "+ New Campaign"
3. Select "Physical/Gift Campaign"
4. Name your campaign

**Selecting Gift Bundles**

Sample Bundles:
- Coffee Break: Mug, coffee, snacks
- Office Treats: Cookie box, thank-you card
- Premium: Gift basket, branded items
- Seasonal: Holiday-themed items

Custom Bundle: Create your own combination.

**Setting Delivery Details**

Planned Delivery Date: Consider lead time and holiday timing.

Delivery Method:
- Hand Delivery: Personal touch, best for VIPs
- Shipping: Efficient for many recipients
- Local Courier: Balance of personal and efficient

Assign Representatives: For hand-delivered campaigns.

**Materials Checklist**

Track preparation:
- [ ] Gift items ordered
- [ ] Cards written
- [ ] Packaging prepared
- [ ] Schedule confirmed

**Tracking Deliveries**

Status options:
- Pending: Not yet delivered
- Out for Delivery: In progress
- Delivered: Complete with optional photo
- Issue: Problem requiring attention

**ROI Tracking**

Measure effectiveness:
- Cost per gift
- Referral lift (before/after)
- Response rate
- Tier movement

**Pro Tips**
1. Handwritten notes outperform printed
2. Arrive before holidays, not during
3. Take delivery photos
4. Follow up to ensure receipt`,
        readTime: 5,
        tags: ['gifts', 'appreciation', 'physical']
      },
      {
        id: 'mailing-labels',
        title: 'Generating Mailing Labels',
        description: 'Print professional labels for mailings',
        content: `Nexora's mailing label feature makes it easy to send physical mail. Generate professional labels compatible with standard Avery templates.

**Accessing Mailing Labels**

1. Navigate to Mailing Labels in sidebar
2. Or from Offices, select offices and click "Generate Labels"

**Selecting Offices**

From Mailing Labels Page:
1. Click "Select Offices"
2. Choose by tier, tag, or individual
3. Review the count
4. Click "Generate"

From Offices Page:
1. Select offices using checkboxes
2. Click "More Actions"
3. Select "Generate Labels"

**Choosing a Template**

| Template | Size | Labels/Sheet | Best For |
|----------|------|--------------|----------|
| Avery 5160 | 1" x 2.625" | 30 | Standard letters |
| Avery 5161 | 1" x 4" | 20 | Larger addresses |
| Avery 5163 | 2" x 4" | 10 | Packages |
| Avery 5167 | 0.5" x 1.75" | 80 | Small items |

**Customizing Labels**

Include Fields:
- Office name (required)
- Contact name (optional)
- Full address
- Custom line

Formatting: Font size, bold options, address format.

**Address Correction (Recommended)**

Before generating:
1. Click "Verify Addresses"
2. Review suggested corrections
3. Accept or modify
4. Re-generate labels

**Export Formats**

PDF: Ready to print, aligned to template.

Excel: Editable, use with mail merge.

**Printing Tips**
1. Test on plain paper first
2. Hold test against label sheet
3. Use Avery or compatible labels
4. Print at actual size, no scaling`,
        readTime: 4,
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
        content: `Daily patient logging is the heartbeat of Nexora. Accurate, consistent logging powers your tier calculations, analytics, and insights.

**Why Daily Logging Matters**

- Accurate tiers: MSLR depends on logged data
- Trend visibility: See patterns over time
- Attribution: Know which partners drive referrals
- ROI tracking: Measure campaign effectiveness

**The Daily Patients Interface**

Calendar View: Current month with patient counts per day.

Quick Entry Bar: Today's date pre-selected for fast logging.

**Adding Patients**

Method 1 - Calendar Click:
1. Click on a date
2. Select the referring source
3. Enter patient count
4. Add optional notes
5. Click Save

Method 2 - Quick Entry:
1. Use the quick entry bar
2. Select date (defaults to today)
3. Choose source
4. Enter count
5. Click Add

Batch Entry: For catching up on multiple days at once.

**Selecting Sources**

Sources include:
- Partner offices
- Other sources (walk-ins, online, ads)

If a source isn't listed, add it via Sources page.

**Editing Past Entries**

1. Click the date with the entry
2. Find the entry to edit
3. Click edit icon
4. Modify count or source
5. Save changes

**Catching Up on Missed Days**

1. Click "Missed Days" alert
2. See highlighted days without entries
3. Add entries for each
4. Or use batch entry

**Best Practices**
1. Log daily — set a reminder
2. Same time each day
3. Verify sources with patients
4. Don't guess — note estimates
5. Weekly review for missed days`,
        readTime: 4,
        tags: ['daily', 'patients', 'logging']
      },
      {
        id: 'analytics-dashboard',
        title: 'Analytics Dashboard',
        description: 'Deep dive into your referral performance',
        content: `The Analytics dashboard gives you a comprehensive view of your referral network's performance. Understand trends and make data-driven decisions.

**Accessing Analytics**

Navigate to Analytics in the sidebar.

**Key Metrics**

Total Patients: Cumulative count for selected period with trend arrow.

Active Sources: Offices that referred at least one patient.

Top Performer: Source with highest referrals.

Average Monthly: Patients per month baseline.

**Time Period Selectors**

| Period | Best For |
|--------|----------|
| 3 Months | Recent trends |
| 6 Months | Medium-term patterns |
| 12 Months | Year-over-year |
| All Time | Complete history |

**Chart Types**

Bar Chart: Compare sources side-by-side.

Line Chart: See trends over time.

Pie Chart: Source distribution.

**Interpreting the Data**

Trend Indicators:
- 📈 Green: Growth vs previous period
- 📉 Red: Decline vs previous period
- ➡️ Gray: Stable

Warning Signs:
- Single source > 40% of referrals
- Declining trend over 3+ months
- VIP count dropping

Positive Signals:
- Growing source diversity
- Cold offices becoming Warm
- Consistent month-over-month growth

**Exporting Analytics**

1. Click "Export" button
2. Choose format (PDF or Excel)
3. Select date range
4. Download

**Using Analytics for Decisions**

Campaign Planning: Target underperforming tiers.

Resource Allocation: Focus on high-potential offices.

Goal Setting: Use baselines for realistic targets.`,
        readTime: 5,
        tags: ['analytics', 'reports', 'metrics']
      },
      {
        id: 'source-attribution',
        title: 'Source Attribution',
        description: 'Track where your patients come from',
        content: `Source attribution helps you understand where your patients come from. Accurate attribution is essential for measuring ROI.

**What is Source Attribution?**

Attribution means tracking which source referred each patient. This powers:
- Tier calculations
- Performance analytics
- Campaign ROI
- Resource allocation

**Types of Sources**

Office Sources: Your referral partners — dentists, chiropractors, family doctors.

Other Sources: Non-office channels — Walk-in, Online, Advertising, Internal referrals, Events.

**Setting Up Sources**

Office Sources: Automatically available when you add offices.

Other Sources:
1. Navigate to Sources
2. Click "+ Add Source"
3. Choose source type
4. Enter name and details
5. Save

**The Source Breakdown**

In Analytics and Daily Patients:

Pie Chart: Visual distribution with percentages.

Table View: Detailed counts with trends.

**Analyzing Performance**

Key Questions:
- Which sources drive the most patients?
- Which sources are growing vs declining?
- What's my office-to-other ratio?
- Am I over-reliant on any single source?

Healthy Benchmarks:
- Top source < 30% of total
- At least 5 active office sources
- Office sources > 50% of total
- Growing source diversity

**Attribution Best Practices**

Ask Consistently: Train staff to ask every patient "How did you hear about us?"

Log Accurately: Don't guess — use "Unknown" if unsure.

Update Regularly: Remove closed offices, add new partners.

**Using Data for ROI**

Campaign ROI = (Patient Value × New Patients) ÷ Campaign Cost

Track by source to measure what works.`,
        readTime: 4,
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
        content: `The Discovery feature helps you find potential referral partners near your clinic.

**Before You Start**

Ensure your clinic's location is set:
1. Go to Settings > Clinic Profile
2. Verify your address is complete
3. Confirm coordinates are accurate

**The Discovery Wizard**

1. Navigate to Discover
2. Set Search Distance:
   - 5 miles: Dense urban areas
   - 10 miles: Suburban areas
   - 15 miles: Mixed areas
   - 25 miles: Rural areas
3. Filter by Office Type (optional)
4. Click Search

**Understanding Results**

Each result shows:
- Office name
- Address and distance
- Phone number
- Google rating
- Website link

Already imported offices are marked.

**Importing Offices**

1. Click the office card
2. Review details
3. Click "Add to Partners"
4. Office appears in your list

Bulk Import: Select multiple and import together.

**Weekly Limits**

Discovery searches are limited weekly to ensure quality:
- Limits reset every Monday
- Plan searches strategically

**Best Practices**

Quality Over Quantity:
- Focus on relevant specialties
- Good ratings (3.5+ stars)
- Reasonable distance
- Active online presence

Geographic Strategy:
- Cover all directions from clinic
- Identify underserved areas
- Note competitor locations

**Follow-Up Plan**

After discovering:
1. Import promising offices
2. Research specialty fit
3. Plan introduction outreach
4. Schedule marketing visits`,
        readTime: 4,
        tags: ['discover', 'google', 'nearby']
      },
      {
        id: 'map-view',
        title: 'Using the Map View',
        description: 'Visualize your partner network geographically',
        content: `The Map View provides a visual representation of your referral network. See distribution, plan routes, and identify opportunities.

**Accessing the Map**

Navigate to Map in the sidebar or click the map icon in Offices.

**Understanding the Map**

Your Clinic: Marked with distinctive icon at center.

Partner Offices: Colored markers by tier:
- 🟣 Purple: VIP
- 🟠 Orange: Warm
- 🔵 Blue: Cold
- ⚫ Gray: Dormant

**Interacting with Markers**

Click a Marker:
- Office name
- Current tier
- Recent referrals
- Distance from clinic

Open Full Details: Click "View Details" for complete info.

**Map Controls**

Zoom: Scroll wheel or +/- buttons.

Pan: Click and drag.

Reset: Click "Reset" to center on clinic.

**Filtering the Map**

Use the filter panel to show/hide:
- Specific tiers
- Tagged offices
- Active vs inactive
- Search results

**Planning Visit Routes**

Visual Clustering:
- Identify offices near each other
- Plan multi-office visit days
- Reduce travel time

**Identifying Opportunities**

Geographic Gaps: Areas with few markers indicate untapped territories.

Concentration Risks: Too many offices in one area? Consider diversification.

**Map vs List View**

| Feature | Map | List |
|---------|-----|------|
| Geographic context | ✅ | ❌ |
| Bulk actions | ❌ | ✅ |
| Quick scanning | ❌ | ✅ |
| Route planning | ✅ | ❌ |

Use both views for complete understanding.`,
        readTime: 3,
        tags: ['map', 'geography', 'visualization']
      },
      {
        id: 'marketing-visits',
        title: 'Planning Marketing Visits',
        description: 'Schedule and track in-person visits',
        content: `In-person marketing visits build relationships that email and phone can't match. Nexora helps you plan, execute, and track visits.

**Why Marketing Visits Matter**

- Face-to-face builds trust
- Show appreciation personally
- Gather feedback directly
- Deliver materials/gifts
- Strengthen partnerships

**Creating a Visit**

1. Navigate to Marketing Visits
2. Click "+ Schedule Visit"
3. Select the office
4. Fill in details:
   - Date and time
   - Rep name
   - Visit type
   - Objectives

**Visit Types**

Introduction: First meeting with new partner.

Follow-Up: Maintain existing relationships.

Gift Delivery: Combine with gift campaigns.

Problem Resolution: Address issues directly.

**Before the Visit**

Preparation:
- [ ] Review office's referral history
- [ ] Check last visit notes
- [ ] Prepare materials
- [ ] Confirm appointment
- [ ] Know contact names

Materials:
- Business cards
- Referral pads
- Practice brochures
- Small gifts/treats

**During the Visit**

- Arrive on time
- Ask for key contact
- Listen more than talk
- Be respectful of time
- Take mental notes

**After the Visit**

1. Return to Marketing Visits
2. Find your visit
3. Click "Complete Visit"
4. Add notes and outcomes
5. Rate interaction (optional)
6. Upload photo (optional)

Follow-Up Actions:
- Send thank-you email
- Fulfill promises
- Schedule next touch
- Update office notes

**Visit Calendar**

View your schedule:
- Monthly calendar view
- Upcoming visits list
- Overdue alerts
- History per office`,
        readTime: 5,
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
        content: `The AI Assistant is your intelligent partner for analyzing your referral network and getting recommendations.

**Accessing the AI Assistant**

Navigate to AI Assistant. You'll see three tabs:

Analysis Tab: AI-powered insights
- Performance summaries
- Trend analysis
- Opportunity identification
- Risk alerts

Chat Tab: Natural language conversation
- Ask questions about your data
- Get specific recommendations
- Explore scenarios
- Receive actionable advice

Settings Tab: Configure AI behavior.

**Types of Insights**

Network Health:
- Overall performance score
- Tier distribution analysis
- Trend direction
- Concentration risks

Opportunities:
- Offices ready for tier upgrade
- Re-engagement candidates
- Untapped potential

Recommendations:
- Who to visit next
- Campaign suggestions
- Timing advice

**Asking Good Questions**

Effective:
- "Which cold offices have the best potential?"
- "Why did referrals drop last month?"
- "What should I focus on this week?"

Less Effective:
- "Tell me everything" (too broad)
- "Why isn't this working?" (too vague)

**Using AI for Campaigns**

1. Go to Chat tab
2. Ask: "Help me write a re-engagement email"
3. Review the suggestion
4. Copy and customize
5. Use in your campaign

**AI Limitations**

- Insights depend on logging accuracy
- More data = better insights
- Recent data weighted more heavily
- External factors not considered

**Getting Better Results**
1. Log consistently
2. Be specific in questions
3. Provide context
4. Iterate on insights
5. Take action on recommendations`,
        readTime: 5,
        tags: ['ai', 'assistant', 'insights']
      },
      {
        id: 'review-magic',
        title: 'Review Magic',
        description: 'Manage and respond to Google reviews',
        content: `Review Magic helps you manage your online reputation by centralizing Google reviews and providing AI-powered response suggestions.

**Connecting Google Business**

1. Navigate to Reviews or Review Magic
2. Click "Connect Google Business"
3. Sign in with your Google account
4. Authorize Nexora
5. Select your business location

**Syncing Reviews**

1. Click "Sync Reviews"
2. Recent reviews are imported
3. Reviews appear in your dashboard

Automatic sync runs periodically.

**The Reviews Dashboard**

Filters:
- By rating (1-5 stars)
- By status (replied/unreplied)
- By date range
- Needs attention flag

Each review shows:
- Star rating
- Author name
- Review text
- Date posted
- Reply status

**AI Response Suggestions**

1. Click on a review
2. Click "Generate Response"
3. Review the suggestion
4. Edit as needed
5. Post or save draft

Response Types:

Positive Reviews (4-5 stars):
- Thank the reviewer
- Reinforce positive points
- Invite them back

Critical Reviews (1-3 stars):
- Acknowledge concerns
- Apologize appropriately
- Offer resolution
- Take offline if needed

**Posting Replies**

1. Click "Post Reply"
2. Response posts to Google
3. Status updates in Nexora

**Response Best Practices**

Do:
- Respond within 24-48 hours
- Be professional and courteous
- Thank all reviewers
- Address specific concerns

Don't:
- Get defensive
- Share private information
- Use generic copy-paste
- Ignore negative reviews`,
        readTime: 4,
        tags: ['reviews', 'google', 'reputation']
      },
      {
        id: 'data-import-export',
        title: 'Data Import & Export',
        description: 'Bulk data management capabilities',
        content: `Nexora supports importing existing data and exporting for backups or external analysis.

**Importing Data**

Supported Formats:
- CSV (Comma-Separated Values)
- Excel (.xlsx, .xls)

**Preparing Your File**

Required Columns: Name

Recommended: Address, Phone, Email, Website

Optional: Notes, Tags, Contact Name

**Import Process**

1. Navigate to Offices > Import
2. Download our template (recommended)
3. Prepare your data file
4. Click "Upload File"
5. Map your columns to Nexora fields
6. Preview the import
7. Confirm and import

**Handling Errors**

During import you might see:
- Duplicate warnings
- Format errors
- Missing required fields

Fix in your file and re-upload, or skip problematic rows.

**Exporting Data**

What You Can Export:

Offices: All data including metrics, tiers, contacts, tags.

Analytics: Summary reports, trends, breakdowns.

Patient Logs: Daily entries, attribution, date ranges.

**Export Formats**

Excel (.xlsx): Full formatting, charts included.

CSV: Universal compatibility.

PDF (Reports): Print-ready with charts.

**How to Export**

1. Navigate to relevant page
2. Apply desired filters
3. Click "Export" button
4. Choose format
5. Download file

**Backup Recommendations**

- Export offices monthly
- Keep historical copies
- Store securely
- Backup before bulk operations

**Data Portability**

Your data belongs to you:
- Export anytime
- Standard formats
- No lock-in
- Complete records`,
        readTime: 4,
        tags: ['import', 'export', 'data']
      }
    ]
  }
];

// Keyboard Shortcuts
export const keyboardShortcuts: KeyboardShortcut[] = [
  { keys: ['⌘', 'K'], description: 'Open quick search', category: 'Global' },
  { keys: ['?'], description: 'Show keyboard shortcuts', category: 'Global' },
  { keys: ['Esc'], description: 'Close dialogs & dropdowns', category: 'Global' },
  { keys: ['G', 'D'], description: 'Go to Dashboard', category: 'Navigation' },
  { keys: ['G', 'O'], description: 'Go to Offices', category: 'Navigation' },
  { keys: ['G', 'C'], description: 'Go to Campaigns', category: 'Navigation' },
  { keys: ['G', 'P'], description: 'Go to Daily Patients', category: 'Navigation' },
  { keys: ['G', 'A'], description: 'Go to Analytics', category: 'Navigation' },
  { keys: ['G', 'S'], description: 'Go to Settings', category: 'Navigation' },
  { keys: ['G', 'M'], description: 'Go to Map View', category: 'Navigation' },
  { keys: ['N'], description: 'New item (context-aware)', category: 'Actions' },
  { keys: ['⌘', 'A'], description: 'Select all items', category: 'Actions' },
  { keys: ['⌘', 'E'], description: 'Export selection', category: 'Actions' },
  { keys: ['Delete'], description: 'Delete selected items', category: 'Actions' },
];

// Changelog
export const changelog: ChangelogEntry[] = [
  {
    version: '2.5.0',
    date: '2024-12-15',
    title: 'AI Assistant Enhancements',
    description: 'Improved AI analysis with deeper network insights, better recommendations, and conversational chat.',
    type: 'feature',
    isNew: true
  },
  {
    version: '2.4.0',
    date: '2024-12-10',
    title: 'Review Magic Launch',
    description: 'Manage Google reviews directly with AI-powered response suggestions and reputation analytics.',
    type: 'feature',
    isNew: true
  },
  {
    version: '2.3.2',
    date: '2024-12-01',
    title: 'Map View Performance',
    description: 'Faster map loading, smoother interactions, and improved marker clustering.',
    type: 'improvement',
    isNew: false
  },
  {
    version: '2.3.0',
    date: '2024-11-20',
    title: 'Marketing Visits Tracking',
    description: 'Plan, schedule, and track in-person visits with photo uploads and outcome logging.',
    type: 'feature',
    isNew: false
  },
  {
    version: '2.2.1',
    date: '2024-11-10',
    title: 'Address Correction Fix',
    description: 'Fixed an issue where some addresses were not being verified correctly.',
    type: 'fix',
    isNew: false
  },
  {
    version: '2.2.0',
    date: '2024-10-25',
    title: 'Bulk Actions Expansion',
    description: 'Added bulk tagging, bulk export, and improved selection tools.',
    type: 'feature',
    isNew: false
  },
  {
    version: '2.1.0',
    date: '2024-10-10',
    title: 'Enhanced Analytics',
    description: 'New chart types, period comparisons, and exportable reports.',
    type: 'improvement',
    isNew: false
  },
  {
    version: '2.0.0',
    date: '2024-09-15',
    title: 'Nexora 2.0 Release',
    description: 'Major update with redesigned interface and new tier calculation system.',
    type: 'feature',
    isNew: false
  }
];

// Quick Tips
export const quickTips: QuickTip[] = [
  {
    icon: Clock,
    title: 'Log patients daily',
    description: 'Consistent daily logging ensures accurate tier calculations and reliable analytics.',
    category: 'Data Entry'
  },
  {
    icon: Tag,
    title: 'Use tags for organization',
    description: 'Create tags for regions, specialties, or campaigns to quickly filter and target offices.',
    category: 'Organization'
  },
  {
    icon: Mail,
    title: 'Personalize your outreach',
    description: 'Use tokens like {office_name} and {contact_name} for better engagement.',
    category: 'Campaigns'
  },
  {
    icon: BarChart3,
    title: 'Review analytics weekly',
    description: 'A weekly check helps you spot trends and opportunities early.',
    category: 'Analytics'
  },
  {
    icon: MapPin,
    title: 'Use map for route planning',
    description: 'The map view helps plan efficient visit routes and identify geographic gaps.',
    category: 'Strategy'
  },
  {
    icon: Sparkles,
    title: 'Ask AI specific questions',
    description: 'The more specific your questions, the more actionable the insights.',
    category: 'AI'
  },
  {
    icon: Calendar,
    title: 'Send emails mid-week',
    description: 'Tuesday through Thursday sees highest email open and response rates.',
    category: 'Campaigns'
  },
  {
    icon: Gift,
    title: 'Add contact birthdays',
    description: 'Birthday outreach builds strong relationships with minimal effort.',
    category: 'Relationships'
  },
  {
    icon: Shield,
    title: 'Verify addresses first',
    description: 'Run Address Correction before printing labels to prevent delivery issues.',
    category: 'Data Quality'
  },
  {
    icon: Star,
    title: 'Respond to reviews quickly',
    description: 'Aim to respond to Google reviews within 24 hours for best reputation management.',
    category: 'Reviews'
  },
  {
    icon: Search,
    title: 'Discover weekly',
    description: 'Run discovery searches weekly to grow your potential partner pipeline.',
    category: 'Growth'
  },
  {
    icon: Users,
    title: 'Visit VIPs quarterly',
    description: 'Schedule regular in-person visits with top-tier partners to maintain relationships.',
    category: 'Relationships'
  }
];

// FAQs
export const faqs: FAQ[] = [
  {
    question: 'How are office tiers calculated?',
    answer: 'Tiers are based on MSLR (Monthly Source-Level Referrals) — the average patients referred per month over the last 3 months. VIP: 3+/month, Warm: 1-2/month, Cold: <1 but has history, Dormant: no recent activity.',
    category: 'General'
  },
  {
    question: 'Can multiple team members use the app?',
    answer: 'Yes! Invite team members from Settings. You can assign different roles and permissions to control access levels.',
    category: 'General'
  },
  {
    question: 'What if I miss logging patients for a few days?',
    answer: 'No problem! Use the calendar view in Daily Patients to catch up on missed days. Your MSLR calculations will update automatically.',
    category: 'General'
  },
  {
    question: 'How often should I log patients?',
    answer: 'Daily logging is recommended for accurate tier calculations. Set an end-of-day reminder. Weekly is acceptable but may miss short-term trends.',
    category: 'General'
  },
  {
    question: "What's the difference between Cold and Dormant tiers?",
    answer: 'Cold offices have referred in the past but currently average less than 1 per month. Dormant offices have no activity in 6+ months or are newly added with no history.',
    category: 'General'
  },
  {
    question: 'Can I import offices from a spreadsheet?',
    answer: 'Yes! Go to Offices > Import and upload a CSV or Excel file. We provide a template with correct columns. Map your columns during import.',
    category: 'Technical'
  },
  {
    question: 'What label templates are supported?',
    answer: 'We support Avery templates 5160 (30/sheet), 5161 (20/sheet), 5163 (10/sheet), and 5167 (80/sheet) — the most common address label formats.',
    category: 'Technical'
  },
  {
    question: 'How do I connect my Google Business account?',
    answer: 'Go to Reviews or Review Magic, click "Connect Google Business," sign in with Google, and authorize access. Then select your business location.',
    category: 'Technical'
  },
  {
    question: "Why aren't my offices showing on the map?",
    answer: 'Offices need valid addresses with coordinates. Edit the office and enter a complete address or use "Fill Details" to get coordinates from Google.',
    category: 'Technical'
  },
  {
    question: 'Can I undo a bulk delete?',
    answer: 'No, bulk deletes are permanent. We show a confirmation with count before deleting. Export your data before bulk operations as a backup.',
    category: 'Technical'
  },
  {
    question: 'How do I track campaign ROI?',
    answer: 'Compare referrals from targeted offices before and after campaigns. Analytics shows trends over time. For gifts, track cost per gift against patient value generated.',
    category: 'Features'
  },
  {
    question: 'Can I customize the discovery search?',
    answer: 'Yes! In Discover, filter by distance from your clinic (1-25 miles) and office type (dental, medical, chiropractic, etc.).',
    category: 'Features'
  },
  {
    question: 'How does the AI Assistant work?',
    answer: 'The AI analyzes your referral data, relationships, and campaign history to provide insights and suggestions. It can generate content and identify growth opportunities.',
    category: 'Features'
  },
  {
    question: 'How do I see all offices in a specific area?',
    answer: 'Use Map View to visually explore areas, or create a geographic tag and assign it to offices. Then filter by that tag in Offices view.',
    category: 'Features'
  },
  {
    question: "What's the best way to re-engage dormant offices?",
    answer: 'Start with a personalized email acknowledging the lapse. Follow up with a visit if possible. Consider a small gift. Focus on rebuilding the relationship first.',
    category: 'Features'
  },
  {
    question: 'Is my data secure?',
    answer: 'Yes, we use industry-standard encryption and security practices. Your data is stored securely, not shared with third parties, and you can export or delete it anytime.',
    category: 'General'
  },
  {
    question: 'Can I use Nexora on mobile?',
    answer: 'Nexora is responsive and works on tablets and phones. For best experience, use tablet/desktop for data entry and phone for quick reference and visit logging.',
    category: 'General'
  },
  {
    question: 'How do Discovery limits work?',
    answer: 'Discovery searches have weekly limits for data quality. Limits reset every Monday. Plan searches strategically and import promising offices promptly.',
    category: 'Features'
  }
];

// Search helper
export const getSearchableContent = () => {
  const items: Array<{ type: string; title: string; description: string; id: string; categoryId?: string }> = [];
  
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
  
  faqs.forEach((faq, index) => {
    items.push({
      type: 'faq',
      title: faq.question,
      description: faq.answer.slice(0, 100) + '...',
      id: `faq-${index}`
    });
  });
  
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
