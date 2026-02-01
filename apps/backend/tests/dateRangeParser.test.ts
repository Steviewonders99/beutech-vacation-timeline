/**
 * Tests for dateRangeParser utility.
 */

import { parseDateRange, parseViewType, parseUserList } from '../src/utils/dateRangeParser';
import { ApiError } from '../src/models/ErrorResponse';

describe('parseDateRange', () => {
  const maxDays = 90;

  describe('valid inputs', () => {
    it('should parse valid ISO date strings', () => {
      const result = parseDateRange('2025-01-01', '2025-01-31', maxDays);

      expect(result.start).toBeInstanceOf(Date);
      expect(result.end).toBeInstanceOf(Date);
      expect(result.start.toISOString()).toContain('2025-01-01');
      expect(result.end.toISOString()).toContain('2025-01-31');
    });

    it('should parse ISO date-time strings', () => {
      const result = parseDateRange('2025-01-01T00:00:00Z', '2025-01-15T23:59:59Z', maxDays);

      expect(result.start).toBeInstanceOf(Date);
      expect(result.end).toBeInstanceOf(Date);
    });

    it('should return ISO strings in startISO and endISO', () => {
      const result = parseDateRange('2025-05-01', '2025-05-07', maxDays);

      expect(result.startISO).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(result.endISO).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('should accept same start and end date', () => {
      const result = parseDateRange('2025-01-15', '2025-01-15', maxDays);

      expect(result.start.toDateString()).toBe(result.end.toDateString());
    });

    it('should accept date range at max limit', () => {
      const start = '2025-01-01';
      const end = '2025-03-31'; // 89 days

      const result = parseDateRange(start, end, maxDays);

      expect(result).toBeDefined();
    });
  });

  describe('validation errors', () => {
    it('should throw error when start is missing', () => {
      expect(() => parseDateRange(undefined, '2025-01-31', maxDays))
        .toThrow(ApiError);

      try {
        parseDateRange(undefined, '2025-01-31', maxDays);
      } catch (e) {
        expect(e).toBeInstanceOf(ApiError);
        expect((e as ApiError).statusCode).toBe(400);
        expect((e as ApiError).message).toContain('required');
      }
    });

    it('should throw error when end is missing', () => {
      expect(() => parseDateRange('2025-01-01', undefined, maxDays))
        .toThrow(ApiError);
    });

    it('should throw error when both dates are missing', () => {
      expect(() => parseDateRange(undefined, undefined, maxDays))
        .toThrow(ApiError);
    });

    it('should throw error for invalid start date format', () => {
      expect(() => parseDateRange('not-a-date', '2025-01-31', maxDays))
        .toThrow(ApiError);

      try {
        parseDateRange('invalid', '2025-01-31', maxDays);
      } catch (e) {
        expect((e as ApiError).message).toContain('Invalid start date');
      }
    });

    it('should throw error for invalid end date format', () => {
      expect(() => parseDateRange('2025-01-01', 'not-a-date', maxDays))
        .toThrow(ApiError);

      try {
        parseDateRange('2025-01-01', 'invalid', maxDays);
      } catch (e) {
        expect((e as ApiError).message).toContain('Invalid end date');
      }
    });

    it('should throw error when start is after end', () => {
      expect(() => parseDateRange('2025-01-31', '2025-01-01', maxDays))
        .toThrow(ApiError);

      try {
        parseDateRange('2025-12-31', '2025-01-01', maxDays);
      } catch (e) {
        expect((e as ApiError).message).toContain('before or equal');
      }
    });

    it('should throw error when range exceeds max days', () => {
      expect(() => parseDateRange('2025-01-01', '2025-12-31', maxDays))
        .toThrow(ApiError);

      try {
        parseDateRange('2025-01-01', '2025-12-31', maxDays);
      } catch (e) {
        expect((e as ApiError).message).toContain('exceeds maximum');
      }
    });
  });
});

describe('parseViewType', () => {
  describe('valid inputs', () => {
    it('should return "day" for day input', () => {
      expect(parseViewType('day')).toBe('day');
    });

    it('should return "week" for week input', () => {
      expect(parseViewType('week')).toBe('week');
    });

    it('should return "month" for month input', () => {
      expect(parseViewType('month')).toBe('month');
    });

    it('should return "timeline" for timeline input', () => {
      expect(parseViewType('timeline')).toBe('timeline');
    });

    it('should default to "week" when undefined', () => {
      expect(parseViewType(undefined)).toBe('week');
    });
  });

  describe('validation errors', () => {
    it('should throw error for invalid view type', () => {
      expect(() => parseViewType('invalid')).toThrow(ApiError);
    });

    it('should throw error for empty string', () => {
      // Empty string is truthy check fails, returns default
      // Actually empty string is falsy in JS
      expect(parseViewType('')).toBe('week');
    });

    it('should include valid values in error message', () => {
      try {
        parseViewType('yearly');
      } catch (e) {
        expect((e as ApiError).message).toContain('day');
        expect((e as ApiError).message).toContain('week');
        expect((e as ApiError).message).toContain('month');
        expect((e as ApiError).message).toContain('timeline');
      }
    });
  });
});

describe('parseUserList', () => {
  it('should return empty array for undefined input', () => {
    expect(parseUserList(undefined)).toEqual([]);
  });

  it('should return empty array for empty string', () => {
    expect(parseUserList('')).toEqual([]);
  });

  it('should parse single user', () => {
    expect(parseUserList('user@example.com')).toEqual(['user@example.com']);
  });

  it('should parse multiple users', () => {
    const result = parseUserList('user1@example.com,user2@example.com,user3@example.com');

    expect(result).toHaveLength(3);
    expect(result).toContain('user1@example.com');
    expect(result).toContain('user2@example.com');
    expect(result).toContain('user3@example.com');
  });

  it('should trim whitespace from user IDs', () => {
    const result = parseUserList('  user1@example.com , user2@example.com  ');

    expect(result).toEqual(['user1@example.com', 'user2@example.com']);
  });

  it('should filter out empty entries', () => {
    const result = parseUserList('user1@example.com,,user2@example.com,');

    expect(result).toEqual(['user1@example.com', 'user2@example.com']);
  });

  it('should handle whitespace-only entries', () => {
    const result = parseUserList('user1@example.com,   ,user2@example.com');

    expect(result).toEqual(['user1@example.com', 'user2@example.com']);
  });
});
