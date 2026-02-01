/*!
 * Copyright 2024, Staffbase GmbH and contributors.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *     http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * Date utilities for the vacation timeline widget.
 * All functions work with ISO 8601 date strings and JavaScript Date objects.
 */

import type { VacationView, ViewRange } from '../types/vacation';

/** Short month names */
const MONTHS_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
] as const;

/** Full month names */
const MONTHS_FULL = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
] as const;

/** Days of the week */
const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

/**
 * Formats a date as a short string (e.g., "May 5").
 */
export function formatDateShort(date: Date): string {
  return `${MONTHS_SHORT[date.getMonth()]} ${date.getDate()}`;
}

/**
 * Formats a date range as a readable string.
 * Examples:
 *   - "May 5-11, 2025" (same month)
 *   - "Apr 28 - May 4, 2025" (different months)
 *   - "Dec 28, 2024 - Jan 3, 2025" (different years)
 */
export function formatDateRange(start: Date, end: Date): string {
  const startMonth = MONTHS_SHORT[start.getMonth()];
  const endMonth = MONTHS_SHORT[end.getMonth()];
  const startYear = start.getFullYear();
  const endYear = end.getFullYear();

  if (startYear !== endYear) {
    return `${startMonth} ${start.getDate()}, ${startYear} - ${endMonth} ${end.getDate()}, ${endYear}`;
  }

  if (start.getMonth() !== end.getMonth()) {
    return `${startMonth} ${start.getDate()} - ${endMonth} ${end.getDate()}, ${endYear}`;
  }

  return `${startMonth} ${start.getDate()}-${end.getDate()}, ${endYear}`;
}

/**
 * Gets the start of the day (midnight) for a given date.
 */
export function startOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

/**
 * Gets the end of the day (23:59:59.999) for a given date.
 */
export function endOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(23, 59, 59, 999);
  return result;
}

/**
 * Gets the start of the week (Monday) for a given date.
 * Follows ISO week standard where Monday is the first day.
 */
export function startOfWeek(date: Date): Date {
  const result = new Date(date);
  const day = result.getDay();
  // Adjust so Monday = 0
  const diff = day === 0 ? -6 : 1 - day;
  result.setDate(result.getDate() + diff);
  return startOfDay(result);
}

/**
 * Gets the end of the week (Sunday) for a given date.
 */
export function endOfWeek(date: Date): Date {
  const start = startOfWeek(date);
  const result = new Date(start);
  result.setDate(result.getDate() + 6);
  return endOfDay(result);
}

/**
 * Gets the start of the month for a given date.
 */
export function startOfMonth(date: Date): Date {
  const result = new Date(date);
  result.setDate(1);
  return startOfDay(result);
}

/**
 * Gets the end of the month for a given date.
 */
export function endOfMonth(date: Date): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() + 1, 0);
  return endOfDay(result);
}

/**
 * Adds a number of days to a date.
 */
export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Adds a number of weeks to a date.
 */
export function addWeeks(date: Date, weeks: number): Date {
  return addDays(date, weeks * 7);
}

/**
 * Adds a number of months to a date.
 */
export function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

/**
 * Checks if two dates are the same day.
 */
export function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

/**
 * Checks if a date is today.
 */
export function isToday(date: Date): boolean {
  return isSameDay(date, new Date());
}

/**
 * Gets an array of dates between start and end (inclusive).
 */
export function getDateRange(start: Date, end: Date): Date[] {
  const dates: Date[] = [];
  let current = startOfDay(new Date(start));
  const endDate = startOfDay(new Date(end));

  while (current <= endDate) {
    dates.push(new Date(current));
    current = addDays(current, 1);
  }

  return dates;
}

/**
 * Calculates the view range (start and end) based on the current view and anchor date.
 */
export function calculateViewRange(view: VacationView, anchorDate: Date): ViewRange {
  let start: Date;
  let end: Date;

  switch (view) {
    case 'day':
      start = startOfDay(anchorDate);
      end = endOfDay(anchorDate);
      break;

    case 'week':
      start = startOfWeek(anchorDate);
      end = endOfWeek(anchorDate);
      break;

    case 'month':
      start = startOfMonth(anchorDate);
      end = endOfMonth(anchorDate);
      break;

    case 'timeline':
      // Timeline shows 2 weeks centered on current week
      start = startOfWeek(anchorDate);
      end = endOfWeek(addWeeks(anchorDate, 1));
      break;

    default:
      throw new Error(`Unknown view: ${view}`);
  }

  const label = formatDateRange(start, end);

  return { start, end, label };
}

/**
 * Calculates the position percentage of a date within a range.
 * Used for positioning vacation bars on the timeline.
 *
 * @returns A value between 0 and 1 (clamped)
 */
export function getPositionInRange(
  date: Date,
  rangeStart: Date,
  rangeEnd: Date
): number {
  const totalMs = rangeEnd.getTime() - rangeStart.getTime();
  if (totalMs === 0) return 0;

  const positionMs = date.getTime() - rangeStart.getTime();
  const ratio = positionMs / totalMs;

  // Clamp to [0, 1]
  return Math.max(0, Math.min(1, ratio));
}

/**
 * Gets the day name (e.g., "Mon") for a date.
 */
export function getDayName(date: Date): string {
  return DAYS_SHORT[date.getDay()];
}

/**
 * Gets the full month name for a date.
 */
export function getMonthName(date: Date): string {
  return MONTHS_FULL[date.getMonth()];
}

/**
 * Formats a date for API requests (ISO 8601).
 */
export function toISODateString(date: Date): string {
  return date.toISOString();
}

/**
 * Parses an ISO date string to a Date object.
 */
export function parseISODate(isoString: string): Date {
  return new Date(isoString);
}

/**
 * Gets the number of days between two dates.
 */
export function getDaysBetween(start: Date, end: Date): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((end.getTime() - start.getTime()) / msPerDay);
}

/**
 * Navigates to the next/previous period based on view type.
 */
export function navigateDate(date: Date, view: VacationView, direction: 1 | -1): Date {
  switch (view) {
    case 'day':
      return addDays(date, direction);
    case 'week':
      return addWeeks(date, direction);
    case 'month':
      return addMonths(date, direction);
    case 'timeline':
      return addWeeks(date, direction * 2);
    default:
      return date;
  }
}
