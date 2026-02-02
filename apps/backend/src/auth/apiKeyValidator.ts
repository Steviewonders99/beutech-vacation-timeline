/**
 * API key validation middleware for Azure Functions.
 */

import { HttpRequest } from '@azure/functions';
import { getConfig } from '../utils/env';
import { HttpHeaders } from '../config/constants';
import { ApiError, ErrorCodes } from '../models/ErrorResponse';
import { Logger } from '../utils/logger';
import { logDiagnostic, DiagnosticCode } from '../utils/diagnostics';

/**
 * Validates the API key from the request headers.
 *
 * @param request - The HTTP request
 * @param logger - Optional logger instance
 * @throws ApiError if the API key is missing or invalid
 */
export function validateApiKey(request: HttpRequest, logger?: Logger): void {
  const config = getConfig();
  const providedKey = request.headers.get(HttpHeaders.API_KEY);

  if (!providedKey) {
    logDiagnostic(logger, DiagnosticCode.API_KEY_MISMATCH, {
      reason: 'API key header missing from request',
      headerName: HttpHeaders.API_KEY,
      url: request.url,
      method: request.method,
    });
    throw new ApiError(
      ErrorCodes.Unauthorized,
      'Missing API key. Include x-api-key header.',
      401
    );
  }

  // Constant-time comparison to prevent timing attacks
  if (!secureCompare(providedKey, config.apiKey)) {
    logDiagnostic(logger, DiagnosticCode.API_KEY_MISMATCH, {
      reason: 'API key does not match configured value',
      providedKeyLength: providedKey.length,
      expectedKeyLength: config.apiKey.length,
      providedKeyPrefix: providedKey.substring(0, 4) + '...',
      url: request.url,
      hint: 'Check that widget apiKey exactly matches backend API_KEY (case-sensitive)',
    });
    throw new ApiError(
      ErrorCodes.Unauthorized,
      'Invalid API key.',
      401
    );
  }

  logger?.debug('API key validated successfully');
}

/**
 * Performs a constant-time string comparison to prevent timing attacks.
 */
function secureCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return result === 0;
}

/**
 * Validates CORS origin.
 * Returns the allowed origin header value or null if not allowed.
 */
export function validateOrigin(request: HttpRequest, logger?: Logger): string | null {
  const config = getConfig();
  const origin = request.headers.get('Origin');

  if (!origin) {
    // No origin header (e.g., direct API call, not from browser)
    return null;
  }

  // Check if origin is allowed
  const isAllowed = config.allowedOrigins.some((allowed) => {
    if (allowed === '*') return true;
    return origin.toLowerCase() === allowed.toLowerCase();
  });

  if (isAllowed) {
    logger?.debug('Origin validated', { origin });
    return origin;
  }

  // Log detailed CORS diagnostic
  logDiagnostic(logger, DiagnosticCode.CORS_ORIGIN_MISMATCH, {
    requestOrigin: origin,
    allowedOrigins: config.allowedOrigins,
    hint: 'Add the exact origin (including https://) to ALLOWED_ORIGINS environment variable',
    checkProtocol: origin.startsWith('http://') ? 'WARNING: Request uses http://, but most Staffbase domains use https://' : undefined,
  });
  return null;
}

/**
 * Gets CORS headers for the response.
 */
export function getCorsHeaders(request: HttpRequest, logger?: Logger): Record<string, string> {
  const config = getConfig();
  const origin = validateOrigin(request, logger);

  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-api-key',
    'Access-Control-Max-Age': '86400',
  };

  if (origin) {
    headers['Access-Control-Allow-Origin'] = origin;
  } else if (config.allowedOrigins.includes('*')) {
    headers['Access-Control-Allow-Origin'] = '*';
  }

  return headers;
}
