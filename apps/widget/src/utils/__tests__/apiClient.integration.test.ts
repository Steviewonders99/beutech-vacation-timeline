/**
 * Integration tests for the API client.
 * These tests verify the frontend API client works correctly with the backend API contract.
 */

import { createApiClient, ApiError } from '../apiClient';

// Mock fetch for controlled testing
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('API Client Integration', () => {
  const apiConfig = {
    baseUrl: 'https://api.example.com',
    apiKey: 'test-api-key-12345',
  };

  beforeEach(() => {
    mockFetch.mockClear();
  });

  describe('fetchVacations', () => {
    it('should send correct request format to backend', async () => {
      const client = createApiClient(apiConfig);

      // Mock successful response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          events: [],
          meta: {
            start: '2025-01-01',
            end: '2025-01-31',
            generatedAt: '2025-01-15T10:00:00Z',
          },
        }),
      });

      await client.fetchVacations({
        start: '2025-01-01',
        end: '2025-01-31',
        view: 'month',
        users: ['user1@test.com', 'user2@test.com'],
        timezone: 'America/New_York',
      });

      // Verify the request was made correctly
      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, options] = mockFetch.mock.calls[0];

      // Check URL and query parameters
      expect(url).toContain('https://api.example.com/api/vacations');
      expect(url).toContain('start=2025-01-01');
      expect(url).toContain('end=2025-01-31');
      expect(url).toContain('view=month');
      expect(url).toContain('users=user1%40test.com%2Cuser2%40test.com');
      expect(url).toContain('timezone=America%2FNew_York');

      // API key is sent as query parameter (not header) to avoid CORS preflight
      expect(url).toContain('code=test-api-key-12345');
      // No custom headers - keeps request as CORS "simple request"
      expect(options.headers['x-api-key']).toBeUndefined();
      expect(options.headers['Content-Type']).toBeUndefined();
      // GET is the default method for fetch, so it may not be explicitly set
      expect(options.method || 'GET').toBe('GET');
    });

    it('should parse backend response correctly', async () => {
      const client = createApiClient(apiConfig);

      const mockEvents = [
        {
          id: 'event-123',
          userId: 'user1@test.com',
          userDisplayName: 'Test User',
          userColorKey: 'user1@test.com',
          title: 'Time Off',
          start: '2025-01-10T00:00:00Z',
          end: '2025-01-15T00:00:00Z',
        },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          events: mockEvents,
          meta: {
            start: '2025-01-01',
            end: '2025-01-31',
            generatedAt: '2025-01-15T10:00:00Z',
          },
        }),
      });

      const result = await client.fetchVacations({
        start: '2025-01-01',
        end: '2025-01-31',
        view: 'month',
      });

      expect(result.events).toHaveLength(1);
      expect(result.events[0]).toEqual(mockEvents[0]);
      expect(result.meta.start).toBe('2025-01-01');
      expect(result.meta.end).toBe('2025-01-31');
    });

    it('should handle 401 unauthorized error', async () => {
      const client = createApiClient(apiConfig);

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: async () => ({
          error: {
            code: 'Unauthorized',
            message: 'Missing or invalid API key.',
          },
        }),
      });

      try {
        await client.fetchVacations({
          start: '2025-01-01',
          end: '2025-01-31',
          view: 'month',
        });
        // Should not reach here
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).code).toBe('Unauthorized');
        expect((error as ApiError).statusCode).toBe(401);
        expect((error as ApiError).message).toBe('Missing or invalid API key.');
      }
    });

    it('should handle 403 CORS/forbidden error', async () => {
      const client = createApiClient(apiConfig);

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => ({
          error: {
            code: 'Forbidden',
            message: 'Origin not allowed.',
          },
        }),
      });

      await expect(
        client.fetchVacations({
          start: '2025-01-01',
          end: '2025-01-31',
          view: 'month',
        })
      ).rejects.toThrow(ApiError);
    });
  });

  describe('createTimeOffRequest', () => {
    it('should send correct POST request to backend', async () => {
      const client = createApiClient(apiConfig);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'request-123',
          status: 'pending',
          requesterEmail: 'user@test.com',
          requesterName: 'Test User',
          supervisorEmail: 'manager@test.com',
          supervisorName: 'Test Manager',
          startDate: '2025-02-01',
          endDate: '2025-02-05',
          leaveType: 'vacation',
          reason: 'Family trip',
          createdAt: '2025-01-15T10:00:00Z',
        }),
      });

      await client.createTimeOffRequest({
        requesterEmail: 'user@test.com',
        requesterName: 'Test User',
        startDate: '2025-02-01',
        endDate: '2025-02-05',
        leaveType: 'vacation',
        reason: 'Family trip',
      });

      const [url, options] = mockFetch.mock.calls[0];

      // URL includes API key as query param
      expect(url).toContain('https://api.example.com/api/requests');
      expect(url).toContain('code=test-api-key-12345');
      expect(options.method).toBe('POST');
      // POST uses text/plain to avoid CORS preflight
      expect(options.headers['Content-Type']).toBe('text/plain');

      const body = JSON.parse(options.body);
      expect(body.requesterEmail).toBe('user@test.com');
      expect(body.startDate).toBe('2025-02-01');
      expect(body.leaveType).toBe('vacation');
    });
  });

  describe('listTimeOffRequests', () => {
    it('should send correct query parameters for requester role', async () => {
      const client = createApiClient(apiConfig);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          requests: [],
          pagination: { total: 0, limit: 50, offset: 0 },
        }),
      });

      await client.listTimeOffRequests({
        email: 'user@test.com',
        role: 'requester',
        status: 'pending',
      });

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain('email=user%40test.com');
      expect(url).toContain('role=requester');
      expect(url).toContain('status=pending');
    });

    it('should send correct query parameters for supervisor role', async () => {
      const client = createApiClient(apiConfig);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          requests: [],
          pagination: { total: 0, limit: 50, offset: 0 },
        }),
      });

      await client.listTimeOffRequests({
        email: 'manager@test.com',
        role: 'supervisor',
      });

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain('email=manager%40test.com');
      expect(url).toContain('role=supervisor');
    });
  });

  describe('approveTimeOffRequest', () => {
    it('should send correct POST request to approve endpoint', async () => {
      const client = createApiClient(apiConfig);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          request: {
            id: 'request-123',
            status: 'approved',
          },
          calendarEventId: 'event-456',
        }),
      });

      const result = await client.approveTimeOffRequest(
        'request-123',
        'manager@test.com'
      );

      const [url, options] = mockFetch.mock.calls[0];

      expect(url).toContain('https://api.example.com/api/requests/request-123/approve');
      expect(url).toContain('code=test-api-key-12345');
      expect(options.method).toBe('POST');

      const body = JSON.parse(options.body);
      expect(body.supervisorEmail).toBe('manager@test.com');

      expect(result.request.status).toBe('approved');
      expect(result.calendarEventId).toBe('event-456');
    });
  });

  describe('rejectTimeOffRequest', () => {
    it('should send correct POST request to reject endpoint with reason', async () => {
      const client = createApiClient(apiConfig);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'request-123',
          status: 'rejected',
          rejectionReason: 'Staffing issues',
        }),
      });

      await client.rejectTimeOffRequest(
        'request-123',
        'manager@test.com',
        'Staffing issues'
      );

      const [url, options] = mockFetch.mock.calls[0];

      expect(url).toContain('https://api.example.com/api/requests/request-123/reject');
      expect(url).toContain('code=test-api-key-12345');
      expect(options.method).toBe('POST');

      const body = JSON.parse(options.body);
      expect(body.supervisorEmail).toBe('manager@test.com');
      expect(body.reason).toBe('Staffing issues');
    });
  });

  describe('error handling', () => {
    it('should handle network errors', async () => {
      const client = createApiClient(apiConfig);

      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(
        client.fetchVacations({
          start: '2025-01-01',
          end: '2025-01-31',
          view: 'month',
        })
      ).rejects.toThrow();
    });

    it('should handle malformed JSON response', async () => {
      const client = createApiClient(apiConfig);

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => {
          throw new Error('Invalid JSON');
        },
      });

      await expect(
        client.fetchVacations({
          start: '2025-01-01',
          end: '2025-01-31',
          view: 'month',
        })
      ).rejects.toThrow();
    });
  });

  describe('API contract verification', () => {
    it('should send API key as query parameter to avoid CORS preflight', async () => {
      const client = createApiClient(apiConfig);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ events: [], meta: {} }),
      });

      await client.fetchVacations({
        start: '2025-01-01',
        end: '2025-01-31',
        view: 'month',
      });

      const [url, options] = mockFetch.mock.calls[0];

      // API key is in query string, not headers
      expect(url).toContain('code=test-api-key-12345');
      // No custom headers that would trigger CORS preflight
      expect(options.headers['x-api-key']).toBeUndefined();
      expect(options.headers['Content-Type']).toBeUndefined();
    });

    it('should properly encode special characters in query parameters', async () => {
      const client = createApiClient(apiConfig);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ events: [], meta: {} }),
      });

      await client.fetchVacations({
        start: '2025-01-01',
        end: '2025-01-31',
        view: 'month',
        users: ['user+tag@test.com'],
      });

      const [url] = mockFetch.mock.calls[0];

      // Special characters should be URL encoded
      expect(url).toContain('user%2Btag%40test.com');
    });
  });
});
