/**
 * Secure Google Maps API Key Validation Utility
 * 
 * This module provides secure validation for Google Maps API keys without
 * exposing sensitive information in logs or error responses.
 */

export interface ApiKeyValidationResult {
  isValid: boolean;
  errorCode?: string;
  userMessage?: string;
  shouldRetry?: boolean;
}

/**
 * Validates Google Maps API key format and basic requirements
 * 
 * Google Maps API keys follow this format:
 * - Start with "AIza"
 * - Exactly 39 characters long
 * - Contains only alphanumeric characters and specific symbols
 */
export function validateGoogleApiKey(apiKey: string | undefined, requestId: string): ApiKeyValidationResult {
  // Check if API key exists
  if (!apiKey) {
    console.error(`API key not configured [${requestId}]`);
    return {
      isValid: false,
      errorCode: 'API_KEY_MISSING',
      userMessage: 'Google Maps API service is not configured. Please contact support.',
      shouldRetry: false
    };
  }

  // Validate key format without logging sensitive data
  if (!apiKey.startsWith('AIza')) {
    console.error(`Invalid API key format detected [${requestId}]`);
    return {
      isValid: false,
      errorCode: 'INVALID_API_KEY_FORMAT',
      userMessage: 'Google Maps API configuration error. Please contact support.',
      shouldRetry: false
    };
  }

  // Validate key length (Google Maps API keys are exactly 39 characters)
  if (apiKey.length !== 39) {
    console.error(`Invalid API key length detected [${requestId}]`);
    return {
      isValid: false,
      errorCode: 'INVALID_API_KEY_LENGTH',
      userMessage: 'Google Maps API configuration error. Please contact support.',
      shouldRetry: false
    };
  }

  // Validate character set (Google API keys contain only specific characters)
  const validPattern = /^AIza[A-Za-z0-9_-]+$/;
  if (!validPattern.test(apiKey)) {
    console.error(`Invalid API key character set detected [${requestId}]`);
    return {
      isValid: false,
      errorCode: 'INVALID_API_KEY_CHARACTERS',
      userMessage: 'Google Maps API configuration error. Please contact support.',
      shouldRetry: false
    };
  }

  console.log(`API key validation passed [${requestId}]`);
  return {
    isValid: true
  };
}

/**
 * Tests API key validity by making a minimal request to Google Maps API
 * This should be used sparingly to avoid quota usage
 */
export async function testApiKeyValidity(apiKey: string, requestId: string): Promise<ApiKeyValidationResult> {
  try {
    const testResponse = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=test&key=${apiKey}`,
      { 
        signal: AbortSignal.timeout(5000),
        headers: {
          'User-Agent': 'Nexora-Clinic-App/1.0'
        }
      }
    );

    if (testResponse.status === 403) {
      console.error(`API key validation failed - access forbidden [${requestId}]`);
      return {
        isValid: false,
        errorCode: 'API_KEY_FORBIDDEN',
        userMessage: 'Google Maps API access is restricted. Please contact support.',
        shouldRetry: false
      };
    }

    if (testResponse.status === 429) {
      console.warn(`API key validation hit rate limit [${requestId}]`);
      return {
        isValid: false,
        errorCode: 'API_RATE_LIMIT',
        userMessage: 'Google Maps service is temporarily busy. Please try again in a few moments.',
        shouldRetry: true
      };
    }

    if (!testResponse.ok) {
      console.warn(`API key validation returned ${testResponse.status} [${requestId}]`);
      return {
        isValid: false,
        errorCode: 'API_KEY_TEST_FAILED',
        userMessage: 'Unable to verify Google Maps service availability. Please try again.',
        shouldRetry: true
      };
    }

    console.log(`API key test successful [${requestId}]`);
    return {
      isValid: true
    };

  } catch (error) {
    console.warn(`API key test failed due to network error [${requestId}]: ${(error as Error).message}`);
    return {
      isValid: true, // Assume valid if we can't test due to network issues
    };
  }
}

/**
 * Creates a standardized error response for API key validation failures
 */
export function createApiKeyErrorResponse(
  validation: ApiKeyValidationResult, 
  requestId: string, 
  corsHeaders: Record<string, string>
): Response {
  const status = validation.errorCode === 'API_RATE_LIMIT' ? 429 : 503;
  
  return new Response(
    JSON.stringify({
      success: false,
      error: validation.userMessage,
      code: validation.errorCode,
      request_id: requestId,
      retry_after: validation.shouldRetry ? 60 : undefined
    }),
    {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    }
  );
}

/**
 * Health check utility for API key validation
 */
export function getApiKeyHealthStatus(): { status: string; timestamp: string } {
  const apiKey = Deno.env.get('GOOGLE_MAPS_API_KEY');
  const validation = validateGoogleApiKey(apiKey, 'health-check');
  
  return {
    status: validation.isValid ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString()
  };
}