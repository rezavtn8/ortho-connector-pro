import { z } from 'zod';

// Common validation patterns
const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
const urlRegex = /^https?:\/\/.+/;

// Auth form validation
export const authFormSchema = z.object({
  email: z.string()
    .email('Please enter a valid email address')
    .min(1, 'Email is required'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Password must contain uppercase, lowercase, and number'),
  firstName: z.string()
    .min(2, 'First name must be at least 2 characters')
    .regex(/^[A-Za-z\s]+$/, 'First name can only contain letters')
    .optional(),
  lastName: z.string()
    .min(2, 'Last name must be at least 2 characters')
    .regex(/^[A-Za-z\s]+$/, 'Last name can only contain letters')
    .optional(),
});

export const signInSchema = authFormSchema.omit({ firstName: true, lastName: true });
export const signUpSchema = authFormSchema.required({ firstName: true, lastName: true });

// Office form validation
export const officeFormSchema = z.object({
  name: z.string()
    .min(2, 'Office name must be at least 2 characters')
    .max(100, 'Office name must be less than 100 characters'),
  address: z.string().optional(),
  phone: z.string()
    .regex(phoneRegex, 'Please enter a valid phone number')
    .optional()
    .or(z.literal('')),
  email: z.string()
    .email('Please enter a valid email address')
    .optional()
    .or(z.literal('')),
  website: z.string()
    .regex(urlRegex, 'Please enter a valid URL (must start with http:// or https://)')
    .optional()
    .or(z.literal('')),
  office_hours: z.string().optional(),
  notes: z.string()
    .max(500, 'Notes must be less than 500 characters')
    .optional(),
  google_rating: z.string()
    .refine((val) => !val || (parseFloat(val) >= 0 && parseFloat(val) <= 5), 'Rating must be between 0 and 5')
    .optional(),
  yelp_rating: z.string()
    .refine((val) => !val || (parseFloat(val) >= 0 && parseFloat(val) <= 5), 'Rating must be between 0 and 5')
    .optional(),
  distance_from_clinic: z.string()
    .refine((val) => !val || parseFloat(val) >= 0, 'Distance must be a positive number')
    .optional(),
  patient_load: z.string()
    .refine((val) => !val || (parseInt(val) >= 0 && parseInt(val) <= 10000), 'Patient load must be between 0 and 10000')
    .optional(),
});

// Campaign form validation
export const campaignFormSchema = z.object({
  name: z.string()
    .min(3, 'Campaign name must be at least 3 characters')
    .max(100, 'Campaign name must be less than 100 characters'),
  campaign_type: z.string().min(1, 'Campaign type is required'),
  delivery_method: z.string().min(1, 'Delivery method is required'),
  assigned_rep_id: z.string().optional(),
  planned_delivery_date: z.date().nullable().optional(),
  notes: z.string()
    .max(1000, 'Notes must be less than 1000 characters')
    .optional(),
  materials: z.array(z.string()).min(1, 'At least one material is required'),
  selectedOffices: z.array(z.string()).min(1, 'At least one office must be selected'),
});

// Password strength checker
export const checkPasswordStrength = (password: string) => {
  const checks = {
    minLength: password.length >= 8,
    hasUpper: /[A-Z]/.test(password),
    hasLower: /[a-z]/.test(password),
    hasNumber: /\d/.test(password),
    hasSpecial: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\?]/.test(password),
  };

  const score = Object.values(checks).filter(Boolean).length;
  
  let strength: 'weak' | 'fair' | 'good' | 'strong';
  let message: string;

  if (score < 2) {
    strength = 'weak';
    message = 'Very weak password';
  } else if (score < 3) {
    strength = 'fair';
    message = 'Weak password';
  } else if (score < 4) {
    strength = 'good';
    message = 'Good password';
  } else {
    strength = 'strong';
    message = 'Strong password';
  }

  return {
    score,
    strength,
    message,
    checks,
  };
};

// General form utilities
export const getFieldError = (errors: any, fieldName: string) => {
  return errors?.[fieldName]?.message || '';
};

export const hasFieldError = (errors: any, fieldName: string) => {
  return !!errors?.[fieldName];
};