/**
 * Tests for vacation service.
 */

// Mock the graph client
jest.mock('../../src/graph/graphClient', () => ({
  graphGetWithParams: jest.fn(),
}));

// Mock config - create mock function that can be changed per test
const mockGetConfig = jest.fn();

jest.mock('../../src/utils/env', () => ({
  getConfig: () => mockGetConfig(),
}));

import { graphGetWithParams } from '../../src/graph/graphClient';
import { getVacations } from '../../src/graph/vacationService';
import { ApiError } from '../../src/models/ErrorResponse';

const mockGraphGet = graphGetWithParams as jest.MockedFunction<typeof graphGetWithParams>;

describe('vacationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getVacations - shared calendar mode', () => {
    const params = {
      startDateTime: '2025-01-01T00:00:00Z',
      endDateTime: '2025-01-31T23:59:59Z',
    };

    beforeEach(() => {
      mockGetConfig.mockReturnValue({
        calendarMode: 'shared',
        vacationCalendarMailbox: 'vacations@test.com',
        vacationCategory: 'Leave Request',
        defaultTimezone: 'UTC',
        tenantId: 'test',
        clientId: 'test',
        clientSecret: 'test',
        apiKey: 'test',
        allowedOrigins: [],
        maxDateRangeDays: 90,
        logLevel: 'info',
      });
    });

    it('should fetch events from shared calendar', async () => {
      mockGraphGet.mockResolvedValue({
        value: [
          {
            id: 'event-1',
            subject: 'John - Time Off',
            start: { dateTime: '2025-01-10T00:00:00', timeZone: 'UTC' },
            end: { dateTime: '2025-01-15T00:00:00', timeZone: 'UTC' },
            isAllDay: true,
            organizer: {
              emailAddress: {
                name: 'John Doe',
                address: 'john@test.com',
              },
            },
            categories: ['Leave Request'],
          },
          {
            id: 'event-2',
            subject: 'Jane - Sick Leave',
            start: { dateTime: '2025-01-20T00:00:00', timeZone: 'UTC' },
            end: { dateTime: '2025-01-21T00:00:00', timeZone: 'UTC' },
            isAllDay: true,
            organizer: {
              emailAddress: {
                name: 'Jane Smith',
                address: 'jane@test.com',
              },
            },
            categories: ['Sick Leave'],
          },
        ],
      });

      const result = await getVacations(params);

      expect(result).toHaveLength(2);
      expect(result[0].userId).toBe('john@test.com');
      expect(result[1].userId).toBe('jane@test.com');
      expect(mockGraphGet).toHaveBeenCalledWith(
        expect.stringContaining('/users/vacations@test.com/calendarView'),
        expect.any(Object),
        undefined
      );
    });

    it('should filter by specific users when provided', async () => {
      mockGraphGet.mockResolvedValue({
        value: [
          {
            id: 'event-1',
            subject: 'John - Time Off',
            start: { dateTime: '2025-01-10T00:00:00', timeZone: 'UTC' },
            end: { dateTime: '2025-01-15T00:00:00', timeZone: 'UTC' },
            isAllDay: true,
            organizer: {
              emailAddress: { name: 'John Doe', address: 'john@test.com' },
            },
            categories: ['Leave Request'],
          },
          {
            id: 'event-2',
            subject: 'Jane - Time Off',
            start: { dateTime: '2025-01-20T00:00:00', timeZone: 'UTC' },
            end: { dateTime: '2025-01-21T00:00:00', timeZone: 'UTC' },
            isAllDay: true,
            organizer: {
              emailAddress: { name: 'Jane Smith', address: 'jane@test.com' },
            },
            categories: ['Leave Request'],
          },
        ],
      });

      const result = await getVacations({
        ...params,
        users: ['john@test.com'],
      });

      expect(result).toHaveLength(1);
      expect(result[0].userId).toBe('john@test.com');
    });

    it('should throw when shared calendar is not configured', async () => {
      mockGetConfig.mockReturnValue({
        calendarMode: 'shared',
        vacationCalendarMailbox: undefined,
        vacationCategory: 'Leave Request',
        defaultTimezone: 'UTC',
        tenantId: 'test',
        clientId: 'test',
        clientSecret: 'test',
        apiKey: 'test',
        allowedOrigins: [],
        maxDateRangeDays: 90,
        logLevel: 'info',
      });

      await expect(getVacations(params)).rejects.toThrow(ApiError);
    });

    it('should handle Graph API errors', async () => {
      mockGraphGet.mockRejectedValue(new Error('Graph API error'));

      await expect(getVacations(params)).rejects.toThrow(ApiError);
    });

    it('should sort events by start date', async () => {
      mockGraphGet.mockResolvedValue({
        value: [
          {
            id: 'event-2',
            subject: 'Later Event',
            start: { dateTime: '2025-01-20T00:00:00', timeZone: 'UTC' },
            end: { dateTime: '2025-01-21T00:00:00', timeZone: 'UTC' },
            isAllDay: true,
            organizer: {
              emailAddress: { name: 'Jane', address: 'jane@test.com' },
            },
            categories: [],
          },
          {
            id: 'event-1',
            subject: 'Earlier Event',
            start: { dateTime: '2025-01-05T00:00:00', timeZone: 'UTC' },
            end: { dateTime: '2025-01-06T00:00:00', timeZone: 'UTC' },
            isAllDay: true,
            organizer: {
              emailAddress: { name: 'John', address: 'john@test.com' },
            },
            categories: [],
          },
        ],
      });

      const result = await getVacations(params);

      expect(result[0].title).toBe('Earlier Event');
      expect(result[1].title).toBe('Later Event');
    });
  });

  describe('getVacations - perUser calendar mode', () => {
    beforeEach(() => {
      mockGetConfig.mockReturnValue({
        calendarMode: 'perUser',
        vacationCategory: 'Leave Request',
        defaultTimezone: 'UTC',
        tenantId: 'test',
        clientId: 'test',
        clientSecret: 'test',
        apiKey: 'test',
        allowedOrigins: [],
        maxDateRangeDays: 90,
        logLevel: 'info',
      });
    });

    it('should fetch events from multiple user calendars', async () => {
      mockGraphGet
        .mockResolvedValueOnce({
          value: [
            {
              id: 'event-1',
              subject: 'John Time Off',
              start: { dateTime: '2025-01-10T00:00:00', timeZone: 'UTC' },
              end: { dateTime: '2025-01-15T00:00:00', timeZone: 'UTC' },
              isAllDay: true,
              categories: ['Leave Request'],
            },
          ],
        })
        .mockResolvedValueOnce({
          value: [
            {
              id: 'event-2',
              subject: 'Jane Time Off',
              start: { dateTime: '2025-01-20T00:00:00', timeZone: 'UTC' },
              end: { dateTime: '2025-01-22T00:00:00', timeZone: 'UTC' },
              isAllDay: true,
              categories: ['Leave Request'],
            },
          ],
        });

      const result = await getVacations({
        startDateTime: '2025-01-01T00:00:00Z',
        endDateTime: '2025-01-31T23:59:59Z',
        users: ['john@test.com', 'jane@test.com'],
      });

      expect(result).toHaveLength(2);
      expect(mockGraphGet).toHaveBeenCalledTimes(2);
    });

    it('should return empty array when no users provided', async () => {
      const result = await getVacations({
        startDateTime: '2025-01-01T00:00:00Z',
        endDateTime: '2025-01-31T23:59:59Z',
        users: [],
      });

      expect(result).toHaveLength(0);
      expect(mockGraphGet).not.toHaveBeenCalled();
    });

    it('should handle individual user fetch failures gracefully', async () => {
      mockGraphGet
        .mockResolvedValueOnce({
          value: [
            {
              id: 'event-1',
              subject: 'John Time Off',
              start: { dateTime: '2025-01-10T00:00:00', timeZone: 'UTC' },
              end: { dateTime: '2025-01-15T00:00:00', timeZone: 'UTC' },
              isAllDay: true,
              categories: ['Leave Request'],
            },
          ],
        })
        .mockRejectedValueOnce(new Error('User not found'));

      const result = await getVacations({
        startDateTime: '2025-01-01T00:00:00Z',
        endDateTime: '2025-01-31T23:59:59Z',
        users: ['john@test.com', 'nonexistent@test.com'],
      });

      // Should return results from successful fetch, ignoring failed one
      expect(result).toHaveLength(1);
      expect(result[0].userId).toBe('john@test.com');
    });
  });
});
