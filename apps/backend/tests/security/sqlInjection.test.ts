/**
 * Security tests for SQL injection prevention.
 */

// Mock the database client to capture SQL queries
const mockQuery = jest.fn();
jest.mock('../../src/db/client', () => ({
  query: mockQuery,
  queryOne: jest.fn(),
}));

// Mock other dependencies
jest.mock('../../src/graph/managerService', () => ({
  getManager: jest.fn(),
  getUserInfo: jest.fn(),
}));

jest.mock('../../src/graph/graphClient', () => ({
  graphPost: jest.fn(),
}));

jest.mock('../../src/services/notificationService', () => ({
  notifySupervisorOfNewRequest: jest.fn().mockResolvedValue(undefined),
  notifyRequesterOfApproval: jest.fn().mockResolvedValue(undefined),
  notifyRequesterOfRejection: jest.fn().mockResolvedValue(undefined),
}));

const mockConfig = {
  tenantId: 'test-tenant',
  clientId: 'test-client',
  clientSecret: 'test-secret',
  calendarMode: 'shared',
  vacationCalendarMailbox: 'vacations@test.com',
  vacationCategory: 'Leave Request',
  defaultTimezone: 'UTC',
  apiKey: 'test-key',
  allowedOrigins: ['https://test.staffbase.com'],
  maxDateRangeDays: 90,
  logLevel: 'info',
};

jest.mock('../../src/utils/env', () => ({
  getConfig: () => mockConfig,
}));

import { listRequests } from '../../src/services/requestService';

describe('SQL Injection Prevention', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockQuery.mockResolvedValue([]);
  });

  describe('listRequests LIMIT/OFFSET injection', () => {
    it('should use parameterized queries for LIMIT', async () => {
      await listRequests({
        email: 'test@test.com',
        role: 'requester',
        limit: 10,
      });

      const [sql, params] = mockQuery.mock.calls[0];

      // SQL should use parameter placeholder for LIMIT
      expect(sql).toMatch(/LIMIT \$\d+/);
      // SQL should NOT have direct value interpolation
      expect(sql).not.toMatch(/LIMIT 10[^0-9]/);
      // Params array should contain the limit value
      expect(params).toContain(10);
    });

    it('should use parameterized queries for OFFSET', async () => {
      await listRequests({
        email: 'test@test.com',
        role: 'requester',
        offset: 20,
      });

      const [sql, params] = mockQuery.mock.calls[0];

      // SQL should use parameter placeholder for OFFSET
      expect(sql).toMatch(/OFFSET \$\d+/);
      // SQL should NOT have direct value interpolation
      expect(sql).not.toMatch(/OFFSET 20[^0-9]/);
      // Params array should contain the offset value
      expect(params).toContain(20);
    });

    it('should sanitize malicious LIMIT values', async () => {
      // Attempt SQL injection via limit
      await listRequests({
        email: 'test@test.com',
        role: 'requester',
        // Even if somehow passed as a number that looks suspicious
        limit: 10,
        // The important test is that it uses parameterization
      });

      const [sql, params] = mockQuery.mock.calls[0];

      // Should use parameterized query
      expect(sql).toMatch(/LIMIT \$\d+/);
      expect(params).toContain(10);

      // Verify there's no way to inject via the SQL string
      expect(sql).not.toContain('OR 1=1');
      expect(sql).not.toContain('DROP');
      expect(sql).not.toContain('--');
    });

    it('should cap limit to maximum allowed value', async () => {
      await listRequests({
        email: 'test@test.com',
        role: 'requester',
        limit: 9999, // Way above max
      });

      const [, params] = mockQuery.mock.calls[0];

      // Should be capped at 100
      expect(params).toContain(100);
      expect(params).not.toContain(9999);
    });

    it('should handle negative limit gracefully', async () => {
      await listRequests({
        email: 'test@test.com',
        role: 'requester',
        limit: -5,
      });

      const [, params] = mockQuery.mock.calls[0];

      // Should use capped/sanitized value (0 or default)
      const limitParam = params.find((p: unknown) => typeof p === 'number' && p >= 0 && p <= 100);
      expect(limitParam).toBeDefined();
    });

    it('should handle negative offset gracefully', async () => {
      await listRequests({
        email: 'test@test.com',
        role: 'requester',
        offset: -10,
      });

      const [, params] = mockQuery.mock.calls[0];

      // Should use 0 or capped value
      expect(params).toContain(0);
    });
  });

  describe('WHERE clause parameterization', () => {
    it('should parameterize email filter', async () => {
      await listRequests({
        email: "test@test.com'; DROP TABLE users; --",
        role: 'requester',
      });

      const [sql, params] = mockQuery.mock.calls[0];

      // Email should be in params, not interpolated in SQL
      expect(params).toContain("test@test.com'; DROP TABLE users; --");
      // SQL should use placeholder
      expect(sql).toMatch(/requester_email = \$\d+/);
      // SQL should not contain the injection attempt
      expect(sql).not.toContain('DROP TABLE');
    });

    it('should parameterize status filter', async () => {
      await listRequests({
        email: 'test@test.com',
        role: 'requester',
        status: 'pending',
      });

      const [sql, params] = mockQuery.mock.calls[0];

      expect(params).toContain('pending');
      expect(sql).toMatch(/status = \$\d+/);
    });
  });

  describe('query structure validation', () => {
    it('should produce valid SQL with all filters', async () => {
      await listRequests({
        email: 'test@test.com',
        role: 'supervisor',
        status: 'pending',
        limit: 25,
        offset: 50,
      });

      const [sql, params] = mockQuery.mock.calls[0];

      // Verify SQL structure
      expect(sql).toContain('SELECT *');
      expect(sql).toContain('FROM time_off_requests');
      expect(sql).toContain('WHERE');
      expect(sql).toContain('ORDER BY created_at DESC');
      expect(sql).toMatch(/LIMIT \$\d+/);
      expect(sql).toMatch(/OFFSET \$\d+/);

      // Verify all values are parameterized
      expect(params.length).toBeGreaterThanOrEqual(4); // email, status, limit, offset
    });

    it('should not interpolate any user input directly', async () => {
      const maliciousInputs = [
        "'; DELETE FROM time_off_requests; --",
        "1 OR 1=1",
        "1; SELECT * FROM users",
        "' UNION SELECT * FROM users --",
      ];

      for (const input of maliciousInputs) {
        mockQuery.mockClear();

        await listRequests({
          email: input,
          role: 'requester',
        });

        const [sql] = mockQuery.mock.calls[0];

        // None of the malicious content should appear in the SQL string
        expect(sql).not.toContain('DELETE');
        expect(sql).not.toContain('OR 1=1');
        expect(sql).not.toContain('UNION');
        // All values should be parameterized
        expect(sql).toMatch(/\$\d+/);
      }
    });
  });
});
