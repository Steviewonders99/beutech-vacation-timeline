/*!
 * Copyright 2024, Staffbase GmbH and contributors.
 * Tests for dateUtils.
 */

import {
  formatDateShort,
  formatDateRange,
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  addDays,
  addWeeks,
  addMonths,
  isSameDay,
  isToday,
  getDateRange,
  calculateViewRange,
  getPositionInRange,
  getDayName,
  getMonthName,
  getDaysBetween,
  navigateDate,
  parseISODate,
} from '../dateUtils';

describe('formatDateShort', () => {
  it('should format date as "Mon D"', () => {
    const date = new Date(2025, 4, 5); // May 5, 2025
    expect(formatDateShort(date)).toBe('May 5');
  });

  it('should handle single digit days', () => {
    const date = new Date(2025, 0, 1); // Jan 1, 2025
    expect(formatDateShort(date)).toBe('Jan 1');
  });

  it('should handle all months', () => {
    expect(formatDateShort(new Date(2025, 0, 15))).toBe('Jan 15');
    expect(formatDateShort(new Date(2025, 5, 15))).toBe('Jun 15');
    expect(formatDateShort(new Date(2025, 11, 15))).toBe('Dec 15');
  });
});

describe('formatDateRange', () => {
  it('should format same month range', () => {
    const start = new Date(2025, 4, 5); // May 5
    const end = new Date(2025, 4, 11); // May 11
    expect(formatDateRange(start, end)).toBe('May 5-11, 2025');
  });

  it('should format different month range', () => {
    const start = new Date(2025, 3, 28); // Apr 28
    const end = new Date(2025, 4, 4); // May 4
    expect(formatDateRange(start, end)).toBe('Apr 28 - May 4, 2025');
  });

  it('should format different year range', () => {
    const start = new Date(2024, 11, 28); // Dec 28, 2024
    const end = new Date(2025, 0, 3); // Jan 3, 2025
    expect(formatDateRange(start, end)).toBe('Dec 28, 2024 - Jan 3, 2025');
  });
});

describe('startOfDay', () => {
  it('should set time to midnight', () => {
    const date = new Date(2025, 4, 5, 14, 30, 45);
    const result = startOfDay(date);

    expect(result.getHours()).toBe(0);
    expect(result.getMinutes()).toBe(0);
    expect(result.getSeconds()).toBe(0);
    expect(result.getMilliseconds()).toBe(0);
  });

  it('should preserve the date', () => {
    const date = new Date(2025, 4, 5, 14, 30);
    const result = startOfDay(date);

    expect(result.getFullYear()).toBe(2025);
    expect(result.getMonth()).toBe(4);
    expect(result.getDate()).toBe(5);
  });

  it('should not mutate original date', () => {
    const date = new Date(2025, 4, 5, 14, 30);
    startOfDay(date);

    expect(date.getHours()).toBe(14);
  });
});

describe('endOfDay', () => {
  it('should set time to end of day', () => {
    const date = new Date(2025, 4, 5, 10, 0);
    const result = endOfDay(date);

    expect(result.getHours()).toBe(23);
    expect(result.getMinutes()).toBe(59);
    expect(result.getSeconds()).toBe(59);
    expect(result.getMilliseconds()).toBe(999);
  });
});

describe('startOfWeek', () => {
  it('should return Monday for a Wednesday', () => {
    const wednesday = new Date(2025, 4, 7); // May 7, 2025 is Wednesday
    const result = startOfWeek(wednesday);

    expect(result.getDay()).toBe(1); // Monday
    expect(result.getDate()).toBe(5);
  });

  it('should return same day for Monday', () => {
    const monday = new Date(2025, 4, 5); // May 5, 2025 is Monday
    const result = startOfWeek(monday);

    expect(result.getDate()).toBe(5);
  });

  it('should handle Sunday (returns previous Monday)', () => {
    const sunday = new Date(2025, 4, 11); // May 11, 2025 is Sunday
    const result = startOfWeek(sunday);

    expect(result.getDay()).toBe(1); // Monday
    expect(result.getDate()).toBe(5);
  });
});

describe('endOfWeek', () => {
  it('should return Sunday for a Wednesday', () => {
    const wednesday = new Date(2025, 4, 7);
    const result = endOfWeek(wednesday);

    expect(result.getDay()).toBe(0); // Sunday
    expect(result.getDate()).toBe(11);
  });
});

describe('startOfMonth', () => {
  it('should return first day of month', () => {
    const date = new Date(2025, 4, 15);
    const result = startOfMonth(date);

    expect(result.getDate()).toBe(1);
    expect(result.getMonth()).toBe(4);
  });
});

describe('endOfMonth', () => {
  it('should return last day of month', () => {
    const date = new Date(2025, 4, 15); // May
    const result = endOfMonth(date);

    expect(result.getDate()).toBe(31);
    expect(result.getMonth()).toBe(4);
  });

  it('should handle February', () => {
    const date = new Date(2025, 1, 15); // Feb 2025
    const result = endOfMonth(date);

    expect(result.getDate()).toBe(28);
  });

  it('should handle leap year February', () => {
    const date = new Date(2024, 1, 15); // Feb 2024 (leap year)
    const result = endOfMonth(date);

    expect(result.getDate()).toBe(29);
  });
});

describe('addDays', () => {
  it('should add positive days', () => {
    const date = new Date(2025, 4, 5);
    const result = addDays(date, 3);

    expect(result.getDate()).toBe(8);
  });

  it('should subtract negative days', () => {
    const date = new Date(2025, 4, 5);
    const result = addDays(date, -3);

    expect(result.getDate()).toBe(2);
  });

  it('should handle month boundaries', () => {
    const date = new Date(2025, 4, 30);
    const result = addDays(date, 5);

    expect(result.getMonth()).toBe(5); // June
    expect(result.getDate()).toBe(4);
  });
});

describe('addWeeks', () => {
  it('should add weeks', () => {
    const date = new Date(2025, 4, 5);
    const result = addWeeks(date, 2);

    expect(result.getDate()).toBe(19);
  });
});

describe('addMonths', () => {
  it('should add months', () => {
    const date = new Date(2025, 4, 5);
    const result = addMonths(date, 2);

    expect(result.getMonth()).toBe(6); // July
  });

  it('should handle year boundaries', () => {
    const date = new Date(2025, 10, 15); // Nov
    const result = addMonths(date, 3);

    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(1); // Feb
  });
});

describe('isSameDay', () => {
  it('should return true for same day', () => {
    const date1 = new Date(2025, 4, 5, 10, 0);
    const date2 = new Date(2025, 4, 5, 20, 30);

    expect(isSameDay(date1, date2)).toBe(true);
  });

  it('should return false for different days', () => {
    const date1 = new Date(2025, 4, 5);
    const date2 = new Date(2025, 4, 6);

    expect(isSameDay(date1, date2)).toBe(false);
  });

  it('should return false for different months', () => {
    const date1 = new Date(2025, 4, 5);
    const date2 = new Date(2025, 5, 5);

    expect(isSameDay(date1, date2)).toBe(false);
  });
});

describe('isToday', () => {
  it('should return true for today', () => {
    const today = new Date();
    expect(isToday(today)).toBe(true);
  });

  it('should return false for yesterday', () => {
    const yesterday = addDays(new Date(), -1);
    expect(isToday(yesterday)).toBe(false);
  });
});

describe('getDateRange', () => {
  it('should return array of dates inclusive', () => {
    const start = new Date(2025, 4, 5);
    const end = new Date(2025, 4, 7);
    const result = getDateRange(start, end);

    expect(result).toHaveLength(3);
    expect(result[0].getDate()).toBe(5);
    expect(result[1].getDate()).toBe(6);
    expect(result[2].getDate()).toBe(7);
  });

  it('should return single date when start equals end', () => {
    const date = new Date(2025, 4, 5);
    const result = getDateRange(date, date);

    expect(result).toHaveLength(1);
  });
});

describe('calculateViewRange', () => {
  const anchorDate = new Date(2025, 4, 7); // May 7, 2025 (Wednesday)

  it('should calculate day view range', () => {
    const result = calculateViewRange('day', anchorDate);

    expect(isSameDay(result.start, anchorDate)).toBe(true);
    expect(isSameDay(result.end, anchorDate)).toBe(true);
  });

  it('should calculate week view range', () => {
    const result = calculateViewRange('week', anchorDate);

    expect(result.start.getDay()).toBe(1); // Monday
    expect(result.end.getDay()).toBe(0); // Sunday
  });

  it('should calculate month view range', () => {
    const result = calculateViewRange('month', anchorDate);

    expect(result.start.getDate()).toBe(1);
    expect(result.end.getDate()).toBe(31);
  });

  it('should calculate timeline view range (2 weeks)', () => {
    const result = calculateViewRange('timeline', anchorDate);

    const days = getDaysBetween(result.start, result.end);
    expect(days).toBe(14); // 2 weeks = 14 days
  });

  it('should include formatted label', () => {
    const result = calculateViewRange('week', anchorDate);

    expect(result.label).toBeDefined();
    expect(typeof result.label).toBe('string');
  });
});

describe('getPositionInRange', () => {
  const rangeStart = new Date(2025, 4, 5);
  const rangeEnd = new Date(2025, 4, 11);

  it('should return 0 for start of range', () => {
    const position = getPositionInRange(rangeStart, rangeStart, rangeEnd);
    expect(position).toBe(0);
  });

  it('should return 1 for end of range', () => {
    const position = getPositionInRange(rangeEnd, rangeStart, rangeEnd);
    expect(position).toBe(1);
  });

  it('should return ~0.5 for middle of range', () => {
    const middle = new Date(2025, 4, 8);
    const position = getPositionInRange(middle, rangeStart, rangeEnd);

    expect(position).toBeGreaterThan(0.4);
    expect(position).toBeLessThan(0.6);
  });

  it('should clamp to 0 for date before range', () => {
    const before = new Date(2025, 4, 1);
    const position = getPositionInRange(before, rangeStart, rangeEnd);

    expect(position).toBe(0);
  });

  it('should clamp to 1 for date after range', () => {
    const after = new Date(2025, 4, 20);
    const position = getPositionInRange(after, rangeStart, rangeEnd);

    expect(position).toBe(1);
  });

  it('should return 0 for zero-length range', () => {
    const position = getPositionInRange(rangeStart, rangeStart, rangeStart);
    expect(position).toBe(0);
  });
});

describe('getDayName', () => {
  it('should return correct day names', () => {
    expect(getDayName(new Date(2025, 4, 4))).toBe('Sun');
    expect(getDayName(new Date(2025, 4, 5))).toBe('Mon');
    expect(getDayName(new Date(2025, 4, 6))).toBe('Tue');
    expect(getDayName(new Date(2025, 4, 7))).toBe('Wed');
    expect(getDayName(new Date(2025, 4, 8))).toBe('Thu');
    expect(getDayName(new Date(2025, 4, 9))).toBe('Fri');
    expect(getDayName(new Date(2025, 4, 10))).toBe('Sat');
  });
});

describe('getMonthName', () => {
  it('should return correct month names', () => {
    expect(getMonthName(new Date(2025, 0, 1))).toBe('January');
    expect(getMonthName(new Date(2025, 6, 1))).toBe('July');
    expect(getMonthName(new Date(2025, 11, 1))).toBe('December');
  });
});

describe('getDaysBetween', () => {
  it('should return correct number of days', () => {
    const start = new Date(2025, 4, 5);
    const end = new Date(2025, 4, 10);

    expect(getDaysBetween(start, end)).toBe(5);
  });

  it('should return 0 for same date', () => {
    const date = new Date(2025, 4, 5);
    expect(getDaysBetween(date, date)).toBe(0);
  });

  it('should return negative for end before start', () => {
    const start = new Date(2025, 4, 10);
    const end = new Date(2025, 4, 5);

    expect(getDaysBetween(start, end)).toBe(-5);
  });
});

describe('navigateDate', () => {
  const baseDate = new Date(2025, 4, 7);

  it('should navigate day forward', () => {
    const result = navigateDate(baseDate, 'day', 1);
    expect(result.getDate()).toBe(8);
  });

  it('should navigate day backward', () => {
    const result = navigateDate(baseDate, 'day', -1);
    expect(result.getDate()).toBe(6);
  });

  it('should navigate week forward', () => {
    const result = navigateDate(baseDate, 'week', 1);
    expect(result.getDate()).toBe(14);
  });

  it('should navigate week backward', () => {
    const result = navigateDate(baseDate, 'week', -1);
    expect(result.getDate()).toBe(30); // April 30
  });

  it('should navigate month forward', () => {
    const result = navigateDate(baseDate, 'month', 1);
    expect(result.getMonth()).toBe(5); // June
  });

  it('should navigate timeline (2 weeks) forward', () => {
    const result = navigateDate(baseDate, 'timeline', 1);
    expect(result.getDate()).toBe(21);
  });
});

describe('parseISODate', () => {
  it('should parse ISO date string', () => {
    const result = parseISODate('2025-05-07T10:00:00Z');

    expect(result).toBeInstanceOf(Date);
    expect(result.getFullYear()).toBe(2025);
  });

  it('should parse date-only string', () => {
    const result = parseISODate('2025-05-07');

    expect(result).toBeInstanceOf(Date);
  });
});
