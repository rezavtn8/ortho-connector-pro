/**
 * Secure CORS Configuration Utility
 * 
 * This module provides secure CORS handling with proper origin validation
 * and environment-based configuration for edge functions.
 */

interface CorsConfig {
  allowedOrigins: string[];
  allowedHeaders: string[];
  allowedMethods: string[];
  allowCredentials: boolean;
}

/**
 * Get environment-specific CORS configuration
 */
function getCorsConfig(): CorsConfig {
  // Production domain - replace with your actual production domain
  const PRODUCTION_DOMAIN = 'https://vqkzqwibbcvmdwgqladn.supabase.co';
  
  // Development domains
  const DEVELOPMENT_DOMAINS = [
    'http://localhost:3000',
    'http://localhost:5173',
    'http://localhost:8080',
    'https://localhost:3000',
    'https://localhost:5173',
    'https://localhost:8080'
  ];

  // Lovable domains
  const LOVABLE_STAGING = 'https://lovable.app';
  
  // Also allow all Lovable project domains
  const LOVABLE_PROJECT_PATTERN = '.lovableproject.com';

  // Get current environment
  const isDevelopment = Deno.env.get('DENO_DEPLOYMENT_ID') === undefined;
  
  let allowedOrigins: string[] = [PRODUCTION_DOMAIN];
  
  if (isDevelopment) {
    // In development, allow development domains
    allowedOrigins = [...DEVELOPMENT_DOMAINS, PRODUCTION_DOMAIN, LOVABLE_STAGING];
  } else {
    // In production, allow production domain, Lovable staging, and Lovable project domains
    allowedOrigins = [PRODUCTION_DOMAIN, LOVABLE_STAGING];
  }

  // Add any additional domains from environment variable
  const additionalOrigins = Deno.env.get('ALLOWED_ORIGINS');
  if (additionalOrigins) {
    const origins = additionalOrigins.split(',').map(origin => origin.trim());
    allowedOrigins.push(...origins);
  }

  return {
    allowedOrigins,
    allowedHeaders: [
      'authorization',
      'x-client-info',
      'apikey',
      'content-type',
      'x-requested-with',
      'accept',
      'origin',
      'user-agent'
    ],
    allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowCredentials: false
  };
}

/**
 * Validate if an origin is allowed
 */
export function isOriginAllowed(origin: string | null, config: CorsConfig): boolean {
  if (!origin) {
    return false; // No origin header means not from a browser
  }

  // Check exact matches
  if (config.allowedOrigins.includes(origin)) {
    return true;
  }

  // Check for localhost with different ports in development
  const isDevelopment = Deno.env.get('DENO_DEPLOYMENT_ID') === undefined;
  if (isDevelopment) {
    try {
      const url = new URL(origin);
      if (url.hostname === 'localhost' && ['http:', 'https:'].includes(url.protocol)) {
        return true;
      }
      // Also allow Lovable preview domains in development
      if (url.hostname.endsWith('.lovable.app') || url.hostname.endsWith('.lovableproject.com')) {
        return true;
      }
    } catch {
      // Invalid URL
    }
  }

  return false;
}

/**
 * Create CORS headers for a specific origin
 */
export function createCorsHeaders(origin: string | null, methods?: string[]): Record<string, string> {
  const config = getCorsConfig();
  const isAllowed = isOriginAllowed(origin, config);
  
  const headers: Record<string, string> = {
    'Access-Control-Allow-Headers': config.allowedHeaders.join(', '),
    'Access-Control-Max-Age': '86400', // 24 hours
    'Vary': 'Origin'
  };

  if (isAllowed && origin) {
    headers['Access-Control-Allow-Origin'] = origin;
    
    if (config.allowCredentials) {
      headers['Access-Control-Allow-Credentials'] = 'true';
    }
  } else {
    // For non-browser requests or disallowed origins, don't set CORS headers
    // This will cause browser requests from unauthorized origins to fail
  }

  if (methods) {
    headers['Access-Control-Allow-Methods'] = methods.join(', ');
  } else {
    headers['Access-Control-Allow-Methods'] = config.allowedMethods.join(', ');
  }

  return headers;
}

/**
 * Handle OPTIONS preflight request
 */
export function handleCorsPreflightRequest(req: Request, allowedMethods?: string[]): Response {
  const origin = req.headers.get('Origin');
  const corsHeaders = createCorsHeaders(origin, allowedMethods);
  
  return new Response(null, {
    status: 204,
    headers: corsHeaders
  });
}

/**
 * Create a response with proper CORS headers
 */
export function createCorsResponse(
  body: string | null, 
  options: ResponseInit, 
  req: Request,
  allowedMethods?: string[]
): Response {
  const origin = req.headers.get('Origin');
  const corsHeaders = createCorsHeaders(origin, allowedMethods);
  
  const headers = {
    ...corsHeaders,
    ...(options.headers || {})
  };

  return new Response(body, {
    ...options,
    headers
  });
}

/**
 * Validate request origin and reject if not allowed
 */
export function validateOrigin(req: Request): { isValid: boolean; origin: string | null } {
  const origin = req.headers.get('Origin');
  const config = getCorsConfig();
  
  // For non-browser requests (no Origin header), allow through
  if (!origin) {
    return { isValid: true, origin };
  }

  const isValid = isOriginAllowed(origin, config);
  
  if (!isValid) {
    console.warn(`Blocked request from unauthorized origin: ${origin}`);
  }

  return { isValid, origin };
}

/**
 * Create an error response for unauthorized origins
 */
export function createOriginErrorResponse(origin: string | null): Response {
  return new Response(
    JSON.stringify({
      error: 'Unauthorized origin',
      code: 'CORS_ORIGIN_NOT_ALLOWED'
    }),
    {
      status: 403,
      headers: {
        'Content-Type': 'application/json',
        'Vary': 'Origin'
      }
    }
  );
}