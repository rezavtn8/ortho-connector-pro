export interface GiftBundle {
  id: string;
  name: string;
  description: string;
  items: string[];
  cost: number;
  is_premium: boolean;
  image_url?: string;
}

export const GIFT_BUNDLES: GiftBundle[] = [
  {
    id: 'welcome-starter',
    name: 'Welcome Starter Pack',
    description: 'Perfect introduction package for new referral partnerships',
    items: ['Welcome folder', 'Referral pads', 'Business cards', 'Clinic brochure'],
    cost: 25.00,
    is_premium: false
  },
  {
    id: 'coffee-appreciation',
    name: 'Coffee Appreciation Set',
    description: 'Premium branded mugs with gourmet coffee',
    items: ['Branded ceramic mugs (2)', 'Gourmet coffee pods', 'Thank you notes', 'Business cards'],
    cost: 45.00,
    is_premium: true
  },
  {
    id: 'lunch-catering',
    name: 'Lunch Catering Package',
    description: 'Full lunch service with presentation materials',
    items: ['Catered lunch for office', 'Presentation materials', 'Thank you cards', 'Dessert selection'],
    cost: 120.00,
    is_premium: true
  },
  {
    id: 'holiday-treats',
    name: 'Holiday Treats Bundle',
    description: 'Seasonal gift collection with personalized cards',
    items: ['Holiday cards', 'Seasonal treats', 'Small gift items', 'Branded items'],
    cost: 35.00,
    is_premium: false
  },
  {
    id: 'educational-premium',
    name: 'Educational Premium Pack',
    description: 'Professional educational materials and resources',
    items: ['Educational posters', 'Post-procedure flyers', 'Patient guides', 'Digital resources access'],
    cost: 55.00,
    is_premium: true
  },
  {
    id: 'appreciation-deluxe',
    name: 'Appreciation Deluxe',
    description: 'High-end appreciation package for top referral partners',
    items: ['Premium gift basket', 'Personalized thank you items', 'Certificate of appreciation', 'Exclusive clinic materials'],
    cost: 85.00,
    is_premium: true
  }
];

export const OFFICE_TIER_FILTERS = [
  { value: 'all', label: 'All Offices' },
  { value: 'Strong', label: 'VIP (Strong Referrals)' },
  { value: 'Moderate', label: 'Active (Moderate Referrals)' },
  { value: 'Sporadic', label: 'Occasional (Sporadic Referrals)' },
  { value: 'Cold', label: 'Cold (No Recent Referrals)' }
];