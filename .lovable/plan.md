

# Fix: Letter Campaign Constraint Violations + Improvements

## Root Cause

The `LetterCampaignCreator` inserts values that violate two database CHECK constraints:

1. **`campaigns_delivery_method_check`**: Only allows `'In-Person', 'USPS', 'Courier', 'email', 'physical'`. The code uses `'letter'` which is not in the list.
2. **`campaigns_campaign_type_check`**: Only allows `'Intro Package', 'Mug Drop', 'Lunch Drop', 'CE Invite Pack', 'Monthly Promo Pack', 'Holiday Card Drop', 'Educational Material Drop', 'referral_outreach', 'new_office', 're_engagement', 'important_date'`. The code uses `'referral_appreciation'` and `'holiday_seasonal'` which are not in the list.

## Fix Strategy

Two-part fix: add `'letter'` to the delivery method constraint, and align the campaign types to use values already in the constraint (or add the new ones).

### Part 1: Database Migration

Add `'letter'` to `campaigns_delivery_method_check` and add `'referral_appreciation'` and `'holiday_seasonal'` to `campaigns_campaign_type_check`:

```sql
ALTER TABLE campaigns DROP CONSTRAINT campaigns_delivery_method_check;
ALTER TABLE campaigns ADD CONSTRAINT campaigns_delivery_method_check 
  CHECK (delivery_method = ANY (ARRAY['In-Person','USPS','Courier','email','physical','letter']));

ALTER TABLE campaigns DROP CONSTRAINT campaigns_campaign_type_check;
ALTER TABLE campaigns ADD CONSTRAINT campaigns_campaign_type_check 
  CHECK (campaign_type = ANY (ARRAY[
    'Intro Package','Mug Drop','Lunch Drop','CE Invite Pack','Monthly Promo Pack',
    'Holiday Card Drop','Educational Material Drop','referral_outreach','new_office',
    're_engagement','important_date','referral_appreciation','holiday_seasonal'
  ]));
```

### Part 2: Frontend — LetterCampaignCreator improvements

**File: `src/components/campaign/LetterCampaignCreator.tsx`**

- Map campaign types to include both letter-specific and existing valid types. Update `CAMPAIGN_TYPES` to use values that align with the updated constraint:
  - `referral_appreciation` — Referral Appreciation
  - `new_office` — New Office Introduction (already valid)
  - `re_engagement` — Re-engagement (already valid)
  - `holiday_seasonal` — Holiday / Seasonal

No other changes needed here — the rest of the wizard is correct.

### Part 3: Frontend — LetterExecutionDialog improvements

**File: `src/components/campaign/LetterExecutionDialog.tsx`**

Several quality improvements:

1. **Progress indicator**: Add a small progress bar showing how many letters have been generated (email_status = 'ready') vs total.
2. **Batch status tracking**: After generation, show a summary badge "X of Y ready".
3. **Keyboard navigation**: Add left/right arrow key support for navigating between letters.
4. **Better empty state**: Show tier distribution of selected offices before generating.
5. **Loading state on individual save**: Show saving indicator when editing a letter.

### Part 4: Campaigns.tsx — Letter tab in empty state

Add a "Letter Campaign" button to the empty state section alongside Email and Gift buttons (currently missing).

### Part 5: Edge function — No changes needed

The `generate-campaign-letters` edge function is well-structured and working correctly. No modifications required.

## Files Modified

- **Database migration**: Add `'letter'` to delivery_method constraint, add `'referral_appreciation'` and `'holiday_seasonal'` to campaign_type constraint
- **`src/components/campaign/LetterCampaignCreator.tsx`**: No code changes needed (types already correct for updated constraint)
- **`src/components/campaign/LetterExecutionDialog.tsx`**: Add progress indicator, keyboard nav, better empty state with tier breakdown, save loading state
- **`src/pages/Campaigns.tsx`**: Add Letter Campaign button to empty state

