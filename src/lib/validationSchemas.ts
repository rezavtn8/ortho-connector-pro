import { z } from 'zod';

// Common validation patterns
const emailSchema = z.string()
  .min(1, 'Email is required')
  .email('Please enter a valid email address')
  .max(254, 'Email must be less than 254 characters');

const phoneSchema = z.string()
  .optional()
  .refine((val) => !val || /^[\+]?[\s\-\(\)]*([0-9][\s\-\(\)]*){6,}$/.test(val), {
    message: 'Please enter a valid phone number'
  });

const urlSchema = z.string()
  .optional()
  .refine((val) => !val || /^https?:\/\/.+\..+/.test(val), {
    message: 'Please enter a valid URL starting with http:// or https://'
  });

const ratingSchema = z.string()
  .optional()
  .refine((val) => !val || (!isNaN(parseFloat(val)) && parseFloat(val) >= 0 && parseFloat(val) <= 5), {
    message: 'Rating must be between 0 and 5'
  });

// Password strength validation
const passwordSchema = z.string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(/[^a-zA-Z0-9]/, 'Password must contain at least one special character');

// Auth form schemas
export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
});

export const signUpSchema = z.object({
  firstName: z.string()
    .min(1, 'First name is required')
    .max(50, 'First name must be less than 50 characters')
    .regex(/^[a-zA-Z\s\-']+$/, 'First name can only contain letters, spaces, hyphens, and apostrophes'),
  lastName: z.string()
    .min(1, 'Last name is required')
    .max(50, 'Last name must be less than 50 characters')
    .regex(/^[a-zA-Z\s\-']+$/, 'Last name can only contain letters, spaces, hyphens, and apostrophes'),
  email: emailSchema,
  password: passwordSchema,
  confirmPassword: z.string().min(1, 'Please confirm your password'),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

// Patient source form schema
export const patientSourceSchema = z.object({
  name: z.string()
    .min(1, 'Office name is required')
    .max(255, 'Office name must be less than 255 characters'),
  source: z.enum(['Office', 'Google', 'Yelp', 'Website', 'Social Media', 'Word of Mouth', 'Insurance', 'Other']),
  address: z.string()
    .max(500, 'Address must be less than 500 characters')
    .optional(),
  phone: phoneSchema,
  email: emailSchema.optional().or(z.literal('')),
  website: urlSchema,
  office_hours: z.string()
    .max(255, 'Office hours must be less than 255 characters')
    .optional(),
  google_rating: ratingSchema,
  yelp_rating: ratingSchema,
  distance_from_clinic: z.string()
    .optional()
    .refine((val) => !val || (!isNaN(parseFloat(val)) && parseFloat(val) >= 0), {
      message: 'Distance must be a positive number'
    }),
  patient_load: z.string()
    .optional()
    .refine((val) => !val || (!isNaN(parseInt(val)) && parseInt(val) >= 0), {
      message: 'Patient load must be a positive number'
    }),
  notes: z.string()
    .max(1000, 'Notes must be less than 1000 characters')
    .optional(),
});

// Marketing visit form schema
export const marketingVisitSchema = z.object({
  office_id: z.string().uuid('Please select a valid office'),
  visit_date: z.coerce.date()
    .refine((date) => date instanceof Date && !isNaN(date.getTime()), {
      message: 'Please enter a valid date'
    }),
  visit_type: z.enum(['Cold Call', 'Scheduled Visit', 'Follow-up', 'Event', 'Other']).refine((val) => val, {
    message: 'Please select a visit type',
  }),
  rep_name: z.string()
    .min(1, 'Representative name is required')
    .max(100, 'Representative name must be less than 100 characters'),
  contact_person: z.string()
    .max(100, 'Contact person name must be less than 100 characters')
    .optional(),
  visited: z.boolean().default(false),
  star_rating: z.number()
    .min(1, 'Rating must be at least 1 star')
    .max(5, 'Rating cannot exceed 5 stars')
    .optional(),
  materials_handed_out: z.array(z.string()).optional(),
  follow_up_notes: z.string()
    .max(1000, 'Follow-up notes must be less than 1000 characters')
    .optional(),
  group_tag: z.string()
    .max(50, 'Group tag must be less than 50 characters')
    .optional(),
});

// Campaign form schema
export const campaignSchema = z.object({
  name: z.string()
    .min(1, 'Campaign name is required')
    .max(255, 'Campaign name must be less than 255 characters'),
  campaign_type: z.enum(['Educational', 'Promotional', 'Product Launch', 'Relationship Building', 'Other']).refine((val) => val, {
    message: 'Please select a campaign type',
  }),
  delivery_method: z.enum(['In-Person', 'Mail', 'Email', 'Phone', 'Digital', 'Other']).refine((val) => val, {
    message: 'Please select a delivery method',
  }),
  planned_delivery_date: z.date().optional(),
  assigned_rep_id: z.string().uuid().optional(),
  materials_checklist: z.array(z.string()).optional(),
  notes: z.string()
    .max(1000, 'Notes must be less than 1000 characters')
    .optional(),
});

// User profile form schema
export const userProfileSchema = z.object({
  first_name: z.string()
    .min(1, 'First name is required')
    .max(50, 'First name must be less than 50 characters')
    .regex(/^[a-zA-Z\s\-']+$/, 'First name can only contain letters, spaces, hyphens, and apostrophes'),
  last_name: z.string()
    .min(1, 'Last name is required')
    .max(50, 'Last name must be less than 50 characters')
    .regex(/^[a-zA-Z\s\-']+$/, 'Last name can only contain letters, spaces, hyphens, and apostrophes'),
  email: emailSchema,
  role: z.enum(['Owner', 'Manager', 'Front Desk', 'Marketing Rep']).optional(),
});

// PIN code schema
export const pinCodeSchema = z.object({
  pin_code: z.string()
    .regex(/^[0-9]{4,6}$/, 'PIN must be 4-6 digits')
    .min(4, 'PIN must be at least 4 digits')
    .max(6, 'PIN must be no more than 6 digits'),
  confirm_pin: z.string().min(1, 'Please confirm your PIN'),
}).refine((data) => data.pin_code === data.confirm_pin, {
  message: "PINs don't match",
  path: ["confirm_pin"],
});

// Export type helpers
export type SignInFormData = z.infer<typeof signInSchema>;
export type SignUpFormData = z.infer<typeof signUpSchema>;
export type PatientSourceFormData = z.infer<typeof patientSourceSchema>;
export type MarketingVisitFormData = z.infer<typeof marketingVisitSchema>;
export type CampaignFormData = z.infer<typeof campaignSchema>;
export type UserProfileFormData = z.infer<typeof userProfileSchema>;
export type PinCodeFormData = z.infer<typeof pinCodeSchema>;

// Password strength checker
export const checkPasswordStrength = (password: string): {
  score: number;
  feedback: string[];
  color: 'red' | 'orange' | 'yellow' | 'green';
} => {
  const feedback: string[] = [];
  let score = 0;

  // Length check
  if (password.length >= 8) score++;
  else feedback.push('At least 8 characters');

  if (password.length >= 12) score++;

  // Character type checks
  if (/[a-z]/.test(password)) score++;
  else feedback.push('At least one lowercase letter');

  if (/[A-Z]/.test(password)) score++;
  else feedback.push('At least one uppercase letter');

  if (/[0-9]/.test(password)) score++;
  else feedback.push('At least one number');

  if (/[^a-zA-Z0-9]/.test(password)) score++;
  else feedback.push('At least one special character');

  // Complexity bonus
  if (password.length >= 16) score++;

  const colors: ('red' | 'orange' | 'yellow' | 'green')[] = ['red', 'red', 'orange', 'yellow', 'green', 'green', 'green'];
  
  return {
    score: Math.min(score, 6),
    feedback,
    color: colors[Math.min(score, 6)]
  };
};