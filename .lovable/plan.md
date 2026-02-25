

# Personalized Letter Campaign System

## Overview

A new "Letter" campaign type in the Campaigns page that generates tier-based template letters with personalized per-office merge fields (doctor name, office name), a rich letter preview with customizable branding (logo, fonts, colors, heading), and PDF export for printing.

## How It Works

The key insight from your request: **one AI call per tier** (not per office). The AI generates a template letter body per tier (VIP, Warm, Cold, Dormant, New), then each office gets personalized with its doctor name, office name, and address via simple merge-field substitution. This is efficient and keeps tone consistent within tiers.

```text
User creates Letter Campaign
  --> Selects offices (same existing flow)
  --> Clicks "Generate Letters"
      --> Groups offices by tier
      --> One AI call generates template text for each tier
      --> Merge fields {{doctor_name}}, {{office_name}}, {{clinic_name}} substituted per office
  --> Preview: styled letter with logo, fonts, heading
  --> Edit individual letters if needed
  --> Export all as multi-page PDF for printing
```

## Technical Implementation

### 1. New Edge Function: `supabase/functions/generate-campaign-letters/index.ts`

- Receives: list of unique tiers, campaign context (clinic name, sender name/title/degrees, campaign type)
- Fetches user profile, clinic info, AI business profile (same pattern as `generate-campaign-emails`)
- Makes **one AI call** with tool calling that returns structured output: a `letters` array where each entry has `tier` and `body` (the template text with merge placeholders `{{doctor_name}}`, `{{office_name}}`, `{{sender_name}}`, `{{clinic_name}}`)
- Returns the tier templates; the frontend handles per-office merging
- Uses existing `OPENAI_API_KEY` secret

### 2. New Campaign Creator: `src/components/campaign/LetterCampaignCreator.tsx`

- Same wizard pattern as `EmailCampaignCreator` (3 steps: type, office selection, review)
- Sets `delivery_method: 'letter'` on the campaign record
- Campaign types: Referral Appreciation, New Office Introduction, Re-engagement, Holiday/Seasonal

### 3. New Letter Execution Dialog: `src/components/campaign/LetterExecutionDialog.tsx`

The main feature component. When opened:
- Fetches deliveries with office data and contacts (primary contact name for "Dear Dr. XXX")
- "Generate Letters" button → calls `generate-campaign-letters` edge function
- Receives tier templates → merges per office using `office_contacts.name` (primary) or parsed doctor name from office name
- Stores generated letter in `campaign_deliveries.email_body` (reuses existing column)

**Letter Preview Panel** (the rich part):
- Renders each letter as a styled document with:
  - **Header**: Clinic logo (from `clinic_brand_settings.logo_url`) + clinic name
  - **Date line**: Current date formatted
  - **Recipient block**: Doctor name, office name, address
  - **Salutation**: "Dear Dr. {{last_name}},"
  - **Body**: The tier-appropriate AI-generated text
  - **Closing/Signature**: Sender name, degrees, title, clinic name
- **Customization sidebar** (collapsible):
  - Font family selector (serif options like Georgia, Times New Roman, Garamond + sans options)
  - Font size (body text)
  - Heading color picker
  - Logo toggle (on/off)
  - Margin size (compact/standard/generous)
- Navigate between letters with prev/next buttons
- Edit individual letter text inline

**PDF Export**:
- "Export All as PDF" button generates a multi-page PDF using `jspdf` (already installed)
- One letter per page, US Letter size (8.5" × 11")
- Applies the same styling (font, logo, colors) to the PDF
- Downloads as `{campaign_name}_letters_{date}.pdf`

### 4. Modified Files

- **`src/pages/Campaigns.tsx`**: 
  - Add "Letter" button next to Email/Gift in toolbar
  - Add `letter` filter tab alongside All/Email/Gift
  - Filter `letterCampaigns` where `delivery_method === 'letter'`
  - Import and render `LetterCampaignCreator` and `LetterExecutionDialog`
  - Letter campaign cards show FileText icon instead of Mail/Gift

- **`supabase/config.toml`**: Register `generate-campaign-letters` function

### 5. Data Model (No Migration Needed)

Reuses existing tables:
- `campaigns` table: `delivery_method = 'letter'`, `campaign_mode = 'ai_powered'`
- `campaign_deliveries` table: `email_body` stores the merged letter text, `email_status` tracks generation state, `action_mode = 'letter_only'`
- `clinic_brand_settings`: pulls logo and branding
- `office_contacts`: pulls primary contact name for personalization

### Component Structure

```text
LetterExecutionDialog
├── Customization Controls (font, size, color, logo, margins)
├── Letter Navigation (prev/next, page X of Y)
├── Letter Preview (styled HTML rendering)
│   ├── Logo + Clinic Header
│   ├── Date
│   ├── Recipient Address Block
│   ├── "Dear Dr. LastName,"
│   ├── Tier-based AI body text
│   └── Sender Signature Block
├── Edit Mode (inline text editing)
└── Export PDF Button (jspdf multi-page)
```

### AI Prompt Strategy

The edge function sends one prompt with all tiers needed. Example tool-calling schema:

```json
{
  "name": "generate_letters",
  "parameters": {
    "letters": [
      {
        "tier": "VIP",
        "body": "We are deeply grateful for the trust you place in {{clinic_name}}..."
      },
      {
        "tier": "Cold", 
        "body": "I'm writing to introduce {{clinic_name}} and share how we can support..."
      }
    ]
  }
}
```

The prompt instructs the AI to:
- Write 2-3 paragraphs per tier
- Use warm, appreciative language for VIP/Warm
- Use professional introductory language for Cold/New
- Use re-engagement language for Dormant
- Include `{{doctor_name}}`, `{{office_name}}`, `{{clinic_name}}`, `{{sender_name}}` placeholders
- Match the practice's communication style from AI business profile

