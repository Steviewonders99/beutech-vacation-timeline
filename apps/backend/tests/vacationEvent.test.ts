/**
 * Tests for VacationEvent model.
 */

import { toVacationEvent, GraphCalendarEvent, VacationEvent } from '../src/models/VacationEvent';

describe('toVacationEvent', () => {
  const mockGraphEvent: GraphCalendarEvent = {
    id: 'event-123',
    subject: 'Annual Leave',
    start: {
      dateTime: '2025-05-01T00:00:00',
      timeZone: 'UTC',
    },
    end: {
      dateTime: '2025-05-05T00:00:00',
      timeZone: 'UTC',
    },
    isAllDay: true,
    categories: ['Leave Request'],
  };

  it('should transform Graph event to VacationEvent', () => {
    const result = toVacationEvent(mockGraphEvent, 'john@example.com', 'John Doe');

    expect(result).toEqual({
      id: 'event-123',
      userId: 'john@example.com',
      userDisplayName: 'John Doe',
      userColorKey: 'john@example.com',
      title: 'Annual Leave',
      start: '2025-05-01T00:00:00',
      end: '2025-05-04T23:59:59', // All-day: exclusive end (May 5) adjusted to inclusive (May 4)
    });
  });

  it('should use lowercase userId for colorKey', () => {
    const result = toVacationEvent(mockGraphEvent, 'John.Doe@Example.COM', 'John Doe');

    expect(result.userColorKey).toBe('john.doe@example.com');
  });

  it('should default to "Time Off" title when subject is empty', () => {
    const eventWithoutSubject: GraphCalendarEvent = {
      ...mockGraphEvent,
      subject: '',
    };

    const result = toVacationEvent(eventWithoutSubject, 'user@example.com', 'User');

    expect(result.title).toBe('Time Off');
  });

  it('should preserve start and end date times', () => {
    const eventWithTimes: GraphCalendarEvent = {
      ...mockGraphEvent,
      isAllDay: false,
      start: {
        dateTime: '2025-06-15T09:00:00',
        timeZone: 'America/New_York',
      },
      end: {
        dateTime: '2025-06-15T17:00:00',
        timeZone: 'America/New_York',
      },
    };

    const result = toVacationEvent(eventWithTimes, 'user@example.com', 'User');

    expect(result.start).toBe('2025-06-15T09:00:00');
    expect(result.end).toBe('2025-06-15T17:00:00');
  });

  describe('edge cases', () => {
    it('should handle event with all optional fields', () => {
      const fullEvent: GraphCalendarEvent = {
        id: 'full-event-1',
        subject: 'PTO',
        start: { dateTime: '2025-01-01T00:00:00', timeZone: 'UTC' },
        end: { dateTime: '2025-01-02T00:00:00', timeZone: 'UTC' },
        isAllDay: true,
        categories: ['Leave Request', 'Personal'],
        organizer: {
          emailAddress: {
            name: 'Jane Smith',
            address: 'jane@example.com',
          },
        },
        attendees: [
          {
            emailAddress: {
              name: 'Manager',
              address: 'manager@example.com',
            },
            type: 'required',
          },
        ],
      };

      const result = toVacationEvent(fullEvent, 'jane@example.com', 'Jane Smith');

      expect(result.id).toBe('full-event-1');
      expect(result.title).toBe('PTO');
      // All-day: exclusive end (Jan 2) adjusted to inclusive (Jan 1)
      expect(result.end).toBe('2025-01-01T23:59:59');
    });

    it('should handle minimal event', () => {
      const minimalEvent: GraphCalendarEvent = {
        id: 'min-1',
        subject: '',
        start: { dateTime: '2025-03-01T00:00:00', timeZone: 'UTC' },
        end: { dateTime: '2025-03-01T00:00:00', timeZone: 'UTC' },
        isAllDay: false,
      };

      const result = toVacationEvent(minimalEvent, 'user@test.com', 'Test User');

      expect(result).toBeDefined();
      expect(result.id).toBe('min-1');
      expect(result.title).toBe('Time Off');
    });

    it('should handle special characters in subject', () => {
      const eventWithSpecialChars: GraphCalendarEvent = {
        ...mockGraphEvent,
        subject: "John's Leave & Family Time 🏖️",
      };

      const result = toVacationEvent(eventWithSpecialChars, 'john@example.com', 'John');

      expect(result.title).toBe("John's Leave & Family Time 🏖️");
    });

    it('should handle very long display names', () => {
      const longName = 'A'.repeat(200);
      const result = toVacationEvent(mockGraphEvent, 'user@example.com', longName);

      expect(result.userDisplayName).toBe(longName);
    });
  });
});

describe('VacationEvent interface', () => {
  it('should accept valid VacationEvent object', () => {
    const event: VacationEvent = {
      id: 'test-1',
      userId: 'user@test.com',
      userDisplayName: 'Test User',
      userColorKey: 'user@test.com',
      title: 'Time Off',
      start: '2025-01-01T00:00:00Z',
      end: '2025-01-05T00:00:00Z',
    };

    expect(event.id).toBe('test-1');
    expect(event.userId).toBe('user@test.com');
    expect(event.userDisplayName).toBe('Test User');
    expect(event.userColorKey).toBe('user@test.com');
    expect(event.title).toBe('Time Off');
    expect(event.start).toBe('2025-01-01T00:00:00Z');
    expect(event.end).toBe('2025-01-05T00:00:00Z');
  });
});
