-- Migration to update the source column constraint in referring_offices table
-- This allows more source options beyond just Manual, Google, and Yelp

-- First, drop the existing constraint
ALTER TABLE public.referring_offices 
DROP CONSTRAINT IF EXISTS referring_offices_source_check;

-- Add the updated constraint with more options
ALTER TABLE public.referring_offices 
ADD CONSTRAINT referring_offices_source_check 
CHECK (source IN (
  'Manual', 
  'Google', 
  'Yelp', 
  'Referral', 
  'Marketing Research', 
  'Directory', 
  'Medical Directory',
  'Social Media',
  'Website',
  'Other'
));

-- Update any existing null values to 'Manual' as default
UPDATE public.referring_offices 
SET source = 'Manual' 
WHERE source IS NULL;