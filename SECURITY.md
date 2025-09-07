# Security Implementation

This document outlines the security measures implemented to protect against XSS attacks and ensure data integrity.

## Input Sanitization

All user inputs are sanitized using DOMPurify before being processed or stored. The following utility functions are available in `src/lib/sanitize.ts`:

### Core Functions

- `sanitizeText(input: string)` - Strips all HTML tags and dangerous content
- `sanitizeHTML(input: string)` - Allows only safe HTML tags (b, i, em, strong, p, br)
- `sanitizeFormData(data: object)` - Sanitizes all string values in an object
- `sanitizeEmail(email: string)` - Validates and sanitizes email addresses
- `sanitizeURL(url: string)` - Validates URLs and removes dangerous protocols
- `sanitizePhone(phone: string)` - Sanitizes phone number inputs
- `sanitizeNumber(input: string|number, min?, max?)` - Validates numeric inputs
- `escapeHTML(input: string)` - Escapes HTML entities for safe display

## Protected Forms

The following forms have been secured with input sanitization:

### Authentication Forms
- **AuthForm** - Email, password, first name, last name inputs
- Email validation and sanitization before submission
- Name fields sanitized to prevent script injection

### Office Management Forms
- **AddSourceDialog** - Office name, address, phone, email, website, notes
- **ImportDiscoveredOfficeDialog** - All office data fields
- **CreateCampaignDialog** - Campaign name and notes
- URL validation for website fields
- Phone number sanitization

### Settings Forms
- **Settings Page** - Clinic settings (name, address, Google Place ID)
- **PatientLoadHistoryEditor** - Patient count data and notes
- **SecurityAuditLog** - Search inputs

## Safe Content Display

The `SafeText` component in `src/components/SafeText.tsx` provides secure display of user-generated content:

```jsx
import { SafeText } from '@/components/SafeText';

// Safe display of user content
<SafeText>{userGeneratedContent}</SafeText>

// With custom styling
<SafeText className="font-bold" as="h2">{title}</SafeText>
```

### Usage Examples

Updated components using SafeText:
- **OfficeCard** - Office names, addresses, and notes are safely displayed
- All user-generated content in listings and cards

## Implementation Guidelines

### For New Forms
1. Import sanitization functions: `import { sanitizeText, sanitizeEmail } from '@/lib/sanitize'`
2. Sanitize inputs before validation and submission
3. Validate sanitized data before proceeding
4. Show appropriate error messages for invalid input

### For Content Display
1. Use `SafeText` component for any user-generated content
2. Use `escapeHTML()` function for content in attributes or other contexts
3. Never use `dangerouslySetInnerHTML` without proper sanitization

### Best Practices
- Always sanitize at input boundaries (form submissions)
- Validate after sanitization to ensure data integrity
- Use type-specific sanitization functions (email, URL, phone)
- Display appropriate error messages for rejected inputs
- Log security events for monitoring

## Security Monitoring

The application includes security audit logging that tracks:
- Form submission attempts with invalid data
- Authentication events
- Data access patterns
- Security policy violations

## Dependencies

- **DOMPurify** - Client-side HTML sanitization library
- Configured to strip all dangerous content by default
- Used for both input sanitization and safe content display