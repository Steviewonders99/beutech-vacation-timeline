/**
 * Tests for API key validation.
 */

import { HttpRequest } from '@azure/functions';
import { ApiError } from '../../src/models/ErrorResponse';

// Define mock config at module level
const mockConfig = {
  tenantId: 'test-tenant',
  clientId: 'test-client',
  clientSecret: 'test-secret',
  apiKey: 'valid-api-key-12345',
  allowedOrigins: ['https://test.staffbase.com', 'https://other.staffbase.com'],
  calendarMode: 'shared',
  vacationCalendarMailbox: 'vacations@test.com',
  vacationCategory: 'Leave Request',
  defaultTimezone: 'UTC',
  maxDateRangeDays: 90,
  logLevel: 'info',
};

// Mock the env module before importing apiKeyValidator
jest.mock('../../src/utils/env', () => ({
  getConfig: () => mockConfig,
  resetConfig: jest.fn(),
}));

import { validateApiKey, validateOrigin, getCorsHeaders } from '../../src/auth/apiKeyValidator';

// Helper to create mock request
function createMockRequest(headers: Record<string, string> = {}): HttpRequest {
  const headersMap = new Map(
    Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v])
  );
  return {
    headers: {
      get: (name: string) => headersMap.get(name.toLowerCase()) || null,
      has: (name: string) => headersMap.has(name.toLowerCase()),
    },
    method: 'GET',
    url: 'https://test.azurewebsites.net/api/vacations',
    query: new URLSearchParams(),
    params: {},
  } as unknown as HttpRequest;
}

describe('validateApiKey', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should pass with valid API key', () => {
    const request = createMockRequest({
      'x-api-key': 'valid-api-key-12345',
    });

    expect(() => validateApiKey(request)).not.toThrow();
  });

  it('should throw ApiError when API key is missing', () => {
    const request = createMockRequest({});

    expect(() => validateApiKey(request)).toThrow(ApiError);
    try {
      validateApiKey(request);
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).statusCode).toBe(401);
      expect((error as ApiError).message).toContain('Missing API key');
    }
  });

  it('should throw ApiError when API key is invalid', () => {
    const request = createMockRequest({
      'x-api-key': 'invalid-key',
    });

    expect(() => validateApiKey(request)).toThrow(ApiError);
    try {
      validateApiKey(request);
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).statusCode).toBe(401);
      expect((error as ApiError).message).toContain('Invalid API key');
    }
  });

  it('should reject API key with different case (case-sensitive)', () => {
    const request = createMockRequest({
      'x-api-key': 'VALID-API-KEY-12345',
    });

    expect(() => validateApiKey(request)).toThrow(ApiError);
  });

  it('should reject API key with extra whitespace', () => {
    const request = createMockRequest({
      'x-api-key': ' valid-api-key-12345 ',
    });

    expect(() => validateApiKey(request)).toThrow(ApiError);
  });
});

describe('validateOrigin', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should allow configured origins', () => {
    const request = createMockRequest({
      origin: 'https://test.staffbase.com',
    });

    const result = validateOrigin(request);
    expect(result).toBe('https://test.staffbase.com');
  });

  it('should allow multiple configured origins', () => {
    const request = createMockRequest({
      origin: 'https://other.staffbase.com',
    });

    const result = validateOrigin(request);
    expect(result).toBe('https://other.staffbase.com');
  });

  it('should return null for unconfigured origins', () => {
    const request = createMockRequest({
      origin: 'https://malicious.com',
    });

    const result = validateOrigin(request);
    expect(result).toBeNull();
  });

  it('should return null when no origin header present', () => {
    const request = createMockRequest({});

    const result = validateOrigin(request);
    expect(result).toBeNull();
  });

  it('should be case-insensitive for origin matching', () => {
    const request = createMockRequest({
      origin: 'HTTPS://TEST.STAFFBASE.COM',
    });

    const result = validateOrigin(request);
    expect(result).toBe('HTTPS://TEST.STAFFBASE.COM');
  });
});

describe('getCorsHeaders', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should include Access-Control-Allow-Origin for valid origin', () => {
    const request = createMockRequest({
      origin: 'https://test.staffbase.com',
    });

    const headers = getCorsHeaders(request);
    expect(headers['Access-Control-Allow-Origin']).toBe('https://test.staffbase.com');
  });

  it('should include standard CORS headers', () => {
    const request = createMockRequest({
      origin: 'https://test.staffbase.com',
    });

    const headers = getCorsHeaders(request);
    expect(headers['Access-Control-Allow-Methods']).toContain('GET');
    expect(headers['Access-Control-Allow-Headers']).toContain('x-api-key');
    expect(headers['Access-Control-Max-Age']).toBeDefined();
  });

  it('should not include Allow-Origin for invalid origin', () => {
    const request = createMockRequest({
      origin: 'https://evil.com',
    });

    const headers = getCorsHeaders(request);
    expect(headers['Access-Control-Allow-Origin']).toBeUndefined();
  });
});
