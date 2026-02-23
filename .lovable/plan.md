

# AI-Powered Referral Forecasting

## Placement Decision

Add a **Forecast** tab to the **AI Assistant** page (alongside Analysis, Chat, Settings). This is the natural home because:
- It's AI-powered content, not raw analytics
- It complements the existing AI Analysis tab (which looks backward) with forward-looking predictions
- Keeps the Analytics page focused on historical data and export

## What the Forecast Tab Will Show

1. **Forecast Summary Cards** -- Predicted next-month patient volume, projected growth rate, confidence level (high/medium/low)
2. **3-Month Projection Chart** -- Area chart showing historical trend + projected future months (dashed line for forecasted data)
3. **Source-Level Predictions** -- Table of top sources with predicted next-month volume, trend direction, and risk flags (e.g., "likely to decline")
4. **AI Strategic Recommendations** -- 3-5 specific actions based on the forecast (e.g., "Re-engage Office X before they go cold", "Double down on Office Y momentum")
5. **Risk Alerts** -- Flagged sources showing early signs of decline that need intervention

## Technical Implementation

### New Edge Function: `supabase/functions/ai-forecast/index.ts`
- Fetches last 12 months of `monthly_patients`, `patient_sources`, `marketing_visits`, and `campaigns` for the authenticated user
- Computes basic trend math server-side (month-over-month deltas, rolling averages) to include in the prompt
- Calls OpenAI `gpt-4o-mini` with tool calling to return structured forecast JSON:
  - `overall_forecast`: next 3 months projected totals, growth phase (expansion/plateau/decline), confidence
  - `source_forecasts`: per-source predictions with risk level
  - `strategic_actions`: 3-5 specific recommended actions
  - `risk_alerts`: sources flagged for intervention
- Caches result in `ai_generated_content` table (content_type = 'forecast') for 12 hours
- Uses existing OPENAI_API_KEY secret (already configured)

### New Component: `src/components/ai/AIForecastTab.tsx`
- Custom hook pattern similar to `useAIAnalysis` but calls the `ai-forecast` edge function
- Renders forecast cards, projection chart (recharts AreaChart with dashed forecast line), source prediction table, and action cards
- "Refresh Forecast" button to regenerate on demand
- Loading skeleton and error states matching existing AI tab patterns

### Modified Files
- **`src/pages/AIAssistant.tsx`** -- Add "Forecast" tab trigger with a crystal ball or target icon, import and render `AIForecastTab`
- **`supabase/config.toml`** -- Add `[functions.ai-forecast]` with `verify_jwt = false` (auth handled in code)

### Data Flow

```text
User clicks Forecast tab
  --> Check ai_generated_content for cached forecast (< 12 hours old)
  --> If cached: display immediately
  --> If stale/missing: call ai-forecast edge function
      --> Edge function fetches user's data from DB
      --> Computes trend metrics server-side
      --> Sends to OpenAI with structured tool calling
      --> Caches result, returns to client
  --> Render: summary cards, projection chart, source table, actions
```

### No Database Changes Required
- Reuses existing `ai_generated_content` table with `content_type = 'forecast'`
- Reuses existing `monthly_patients`, `patient_sources`, `marketing_visits`, `campaigns` tables
- No new migrations needed

