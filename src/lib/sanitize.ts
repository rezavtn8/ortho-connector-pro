import DOMPurify from 'dompurify';

/**
 * Sanitizes text input to prevent XSS attacks
 * Removes all HTML tags and dangerous content
 */
export function sanitizeText(input: string): string {
  if (!input || typeof input !== 'string') {
    return '';
  }
  
  // Strip all HTML tags and return only text content
  return DOMPurify.sanitize(input, { 
    ALLOWED_TAGS: [], 
    ALLOWED_ATTR: [] 
  }).trim();
}

/**
 * Sanitizes HTML content while allowing safe tags
 * Use for content that may need basic formatting
 */
export function sanitizeHTML(input: string): string {
  if (!input || typeof input !== 'string') {
    return '';
  }
  
  // Allow only safe HTML tags for basic formatting
  return DOMPurify.sanitize(input, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'p', 'br'],
    ALLOWED_ATTR: []
  });
}

/**
 * Sanitizes form data object by applying sanitization to all string values
 */
export function sanitizeFormData<T extends Record<string, unknown>>(data: T): T {
  const sanitized = { ...data };
  
  for (const [key, value] of Object.entries(sanitized)) {
    if (typeof value === 'string') {
      sanitized[key as keyof T] = sanitizeText(value) as T[keyof T];
    }
  }
  
  return sanitized;
}

/**
 * Validates and sanitizes email addresses
 */
export function sanitizeEmail(email: string): string {
  const sanitized = sanitizeText(email);
  
  // Basic email validation regex
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  
  if (!emailRegex.test(sanitized)) {
    return '';
  }
  
  return sanitized.toLowerCase();
}

/**
 * Sanitizes URL inputs and ensures they have proper protocol
 */
export function sanitizeURL(url: string): string {
  const sanitized = sanitizeText(url);
  
  if (!sanitized) return '';
  
  // Remove javascript: and other dangerous protocols
  const dangerousProtocols = ['javascript:', 'data:', 'vbscript:', 'file:'];
  const lowerUrl = sanitized.toLowerCase();
  
  for (const protocol of dangerousProtocols) {
    if (lowerUrl.startsWith(protocol)) {
      return '';
    }
  }
  
  // Add https:// if no protocol is specified
  if (!sanitized.match(/^https?:\/\//)) {
    return `https://${sanitized}`;
  }
  
  return sanitized;
}

/**
 * Sanitizes phone numbers by removing all non-digit characters except +, -, (), and spaces
 */
export function sanitizePhone(phone: string): string {
  const sanitized = sanitizeText(phone);
  
  // Allow only digits, +, -, (), and spaces
  return sanitized.replace(/[^0-9+\-() ]/g, '');
}

/**
 * Escapes HTML entities for safe display
 * Use when displaying user content in HTML
 */
export function escapeHTML(input: string): string {
  if (!input || typeof input !== 'string') {
    return '';
  }
  
  const div = document.createElement('div');
  div.textContent = input;
  return div.innerHTML;
}

/**
 * Sanitizes numeric inputs and ensures they are valid numbers
 */
export function sanitizeNumber(input: string | number, min?: number, max?: number): number | null {
  if (typeof input === 'number') {
    if (isNaN(input) || !isFinite(input)) return null;
    
    if (min !== undefined && input < min) return null;
    if (max !== undefined && input > max) return null;
    
    return input;
  }
  
  const sanitized = sanitizeText(String(input));
  const parsed = parseFloat(sanitized);
  
  if (isNaN(parsed) || !isFinite(parsed)) {
    return null;
  }
  
  if (min !== undefined && parsed < min) return null;
  if (max !== undefined && parsed > max) return null;
  
  return parsed;
}