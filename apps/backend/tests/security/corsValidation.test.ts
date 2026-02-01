/**
 * Security tests for CORS validation.
 */

import { HttpRequest } from '@azure/functions';

// Default mock config
const defaultMockConfig = {
  tenantId: 'test-tenant',
  clientId: 'test-client',
  clientSecret: 'test-secret',
  apiKey: 'test-api-key',
  allowedOrigins: ['https://app.staffbase.com'],
  calendarMode: 'shared',
  vacationCalendarMailbox: 'vacations@test.com',
  vacationCategory: 'Vacation',
  defaultTimezone: 'UTC',
  maxDateRangeDays: 90,
  logLevel: 'info',
};

// Create a mock getConfig that we can modify per test
const mockGetConfig = jest.fn().mockReturnValue(defaultMockConfig);

jest.mock('../../src/utils/env', () => ({
  getConfig: () => mockGetConfig(),
  resetConfig: jest.fn(),
  loadConfig: jest.fn(),
}));

import { validateOrigin, getCorsHeaders } from '../../src/auth/apiKeyValidator';

// Helper to create mock request
function createMockRequest(origin?: string): HttpRequest {
  const headers = new Map<string, string>();
  if (origin) {
    headers.set('origin', origin);
  }

  return {
    headers: {
      get: (name: string) => headers.get(name.toLowerCase()) || null,
      has: (name: string) => headers.has(name.toLowerCase()),
    },
    method: 'GET',
    url: 'https://test.azurewebsites.net/api/vacations',
    query: new URLSearchParams(),
    params: {},
  } as unknown as HttpRequest;
}

describe('CORS Security', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetConfig.mockReturnValue(defaultMockConfig);
  });

  describe('Origin validation', () => {
    it('should reject requests from unlisted origins', () => {
      const request = createMockRequest('https://evil.com');
      const result = validateOrigin(request);

      expect(result).toBeNull();
    });

    it('should accept requests from configured origins', () => {
      const request = createMockRequest('https://app.staffbase.com');
      const result = validateOrigin(request);

      expect(result).toBe('https://app.staffbase.com');
    });

    it('should handle multiple configured origins', () => {
      mockGetConfig.mockReturnValue({
        ...defaultMockConfig,
        allowedOrigins: ['https://first.staffbase.com', 'https://second.staffbase.com'],
      });

      const request1 = createMockRequest('https://first.staffbase.com');
      const request2 = createMockRequest('https://second.staffbase.com');
      const request3 = createMockRequest('https://third.staffbase.com');

      expect(validateOrigin(request1)).toBe('https://first.staffbase.com');
      expect(validateOrigin(request2)).toBe('https://second.staffbase.com');
      expect(validateOrigin(request3)).toBeNull();
    });

    it('should be case-insensitive when matching origins', () => {
      const request = createMockRequest('HTTPS://APP.STAFFBASE.COM');
      const result = validateOrigin(request);

      expect(result).toBe('HTTPS://APP.STAFFBASE.COM');
    });

    it('should handle requests without origin header', () => {
      const request = createMockRequest(); // No origin
      const result = validateOrigin(request);

      expect(result).toBeNull();
    });
  });

  describe('CORS headers', () => {
    it('should set Access-Control-Allow-Origin for valid origins', () => {
      const request = createMockRequest('https://app.staffbase.com');
      const headers = getCorsHeaders(request);

      expect(headers['Access-Control-Allow-Origin']).toBe('https://app.staffbase.com');
    });

    it('should not set Access-Control-Allow-Origin for invalid origins', () => {
      const request = createMockRequest('https://malicious.com');
      const headers = getCorsHeaders(request);

      expect(headers['Access-Control-Allow-Origin']).toBeUndefined();
    });

    it('should include required CORS headers', () => {
      const request = createMockRequest('https://app.staffbase.com');
      const headers = getCorsHeaders(request);

      expect(headers['Access-Control-Allow-Methods']).toContain('GET');
      expect(headers['Access-Control-Allow-Headers']).toContain('x-api-key');
      expect(headers['Access-Control-Max-Age']).toBeDefined();
    });
  });

  describe('Attack prevention', () => {
    it('should not allow subdomain wildcards', () => {
      // Attacker tries a subdomain
      const request = createMockRequest('https://evil.app.staffbase.com');
      const result = validateOrigin(request);

      expect(result).toBeNull();
    });

    it('should not allow origin with different protocol', () => {
      // HTTP instead of HTTPS
      const request = createMockRequest('http://app.staffbase.com');
      const result = validateOrigin(request);

      expect(result).toBeNull();
    });

    it('should not allow origin with port appended', () => {
      // Attacker tries with port
      const request = createMockRequest('https://app.staffbase.com:8080');
      const result = validateOrigin(request);

      expect(result).toBeNull();
    });

    it('should not allow origin with path appended', () => {
      // Origins shouldn't have paths, but verify it's rejected
      const request = createMockRequest('https://app.staffbase.com/evil');
      const result = validateOrigin(request);

      expect(result).toBeNull();
    });

    it('should not be fooled by similar domain names', () => {
      const attacks = [
        'https://appstaffbase.com',
        'https://app-staffbase.com',
        'https://app.staffbase.com.evil.com',
        'https://evil.com/https://app.staffbase.com',
      ];

      for (const origin of attacks) {
        const request = createMockRequest(origin);
        const result = validateOrigin(request);
        expect(result).toBeNull();
      }
    });
  });

  describe('Wildcard handling', () => {
    it('should allow wildcard in non-production', () => {
      mockGetConfig.mockReturnValue({
        ...defaultMockConfig,
        allowedOrigins: ['*'],
      });

      const request = createMockRequest('https://any-origin.com');
      const result = validateOrigin(request);

      expect(result).toBe('https://any-origin.com');
    });
  });
});
