/**
 * Date range parsing and validation utilities.
 */

import { ApiError, ErrorCodes } from '../models/ErrorResponse';

/**
 * Parsed and validated date range.
 */
export interface DateRange {
  start: Date;
  end: Date;
  startISO: string;
  endISO: string;
}

/**
 * Parses and validates a date range from query parameters.
 *
 * @param start - Start date string (ISO 8601)
 * @param end - End date string (ISO 8601)
 * @param maxDays - Maximum allowed range in days
 * @returns Validated DateRange
 * @throws ApiError if validation fails
 */
export function parseDateRange(
  start: string | undefined,
  end: string | undefined,
  maxDays: number
): DateRange {
  // Validate required parameters
  if (!start || !end) {
    throw new ApiError(
      ErrorCodes.ValidationError,
      'Both start and end date parameters are required.',
      400
    );
  }

  // Parse dates
  const startDate = new Date(start);
  const endDate = new Date(end);

  // Validate date formats
  if (isNaN(startDate.getTime())) {
    throw new ApiError(
      ErrorCodes.ValidationError,
      `Invalid start date format: ${start}. Use ISO 8601 format.`,
      400
    );
  }

  if (isNaN(endDate.getTime())) {
    throw new ApiError(
      ErrorCodes.ValidationError,
      `Invalid end date format: ${end}. Use ISO 8601 format.`,
      400
    );
  }

  // Validate date order
  if (startDate > endDate) {
    throw new ApiError(
      ErrorCodes.ValidationError,
      'Start date must be before or equal to end date.',
      400
    );
  }

  // Validate range size
  const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  if (daysDiff > maxDays) {
    throw new ApiError(
      ErrorCodes.ValidationError,
      `Date range exceeds maximum of ${maxDays} days. Requested: ${daysDiff} days.`,
      400
    );
  }

  return {
    start: startDate,
    end: endDate,
    startISO: startDate.toISOString(),
    endISO: endDate.toISOString(),
  };
}

/**
 * Validates a view type parameter.
 */
export function parseViewType(view: string | undefined): 'day' | 'week' | 'month' | 'timeline' {
  const validViews = ['day', 'week', 'month', 'timeline'];

  if (!view) {
    return 'week'; // Default
  }

  if (!validViews.includes(view)) {
    throw new ApiError(
      ErrorCodes.ValidationError,
      `Invalid view type: ${view}. Valid values: ${validViews.join(', ')}`,
      400
    );
  }

  return view as 'day' | 'week' | 'month' | 'timeline';
}

/**
 * Parses a comma-separated list of user IDs.
 */
export function parseUserList(users: string | undefined): string[] {
  if (!users) {
    return [];
  }

  return users
    .split(',')
    .map((u) => u.trim())
    .filter(Boolean);
}
