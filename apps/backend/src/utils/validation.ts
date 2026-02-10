/**
 * Input validation utilities for request parameters.
 * Provides sanitization and validation for common input types.
 */

import { ApiError, ErrorCodes } from '../models/ErrorResponse';

/**
 * UUID v4 regex pattern.
 */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Email regex pattern (simplified but effective).
 */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Date format regex (YYYY-MM-DD).
 */
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Validates a UUID v4 format.
 *
 * @param value - The value to validate
 * @param fieldName - Name of the field for error messages
 * @returns The validated UUID
 * @throws ApiError if validation fails
 */
export function validateUuid(value: string | null | undefined, fieldName: string): string {
  if (!value) {
    throw new ApiError(
      ErrorCodes.ValidationError,
      `${fieldName} is required`,
      400
    );
  }

  const trimmed = value.trim();
  if (!UUID_REGEX.test(trimmed)) {
    throw new ApiError(
      ErrorCodes.ValidationError,
      `${fieldName} must be a valid UUID`,
      400
    );
  }

  return trimmed.toLowerCase();
}

/**
 * Validates an email address format.
 *
 * @param value - The value to validate
 * @param fieldName - Name of the field for error messages
 * @returns The validated email (lowercase)
 * @throws ApiError if validation fails
 */
export function validateEmail(value: string | null | undefined, fieldName: string): string {
  if (!value) {
    throw new ApiError(
      ErrorCodes.ValidationError,
      `${fieldName} is required`,
      400
    );
  }

  const trimmed = value.trim();
  if (trimmed.length > 254) {
    throw new ApiError(
      ErrorCodes.ValidationError,
      `${fieldName} is too long (max 254 characters)`,
      400
    );
  }

  if (!EMAIL_REGEX.test(trimmed)) {
    throw new ApiError(
      ErrorCodes.ValidationError,
      `${fieldName} must be a valid email address`,
      400
    );
  }

  return trimmed.toLowerCase();
}

/**
 * Validates a date in YYYY-MM-DD format.
 *
 * @param value - The value to validate
 * @param fieldName - Name of the field for error messages
 * @returns The validated date string
 * @throws ApiError if validation fails
 */
export function validateDateFormat(value: string | null | undefined, fieldName: string): string {
  if (!value) {
    throw new ApiError(
      ErrorCodes.ValidationError,
      `${fieldName} is required`,
      400
    );
  }

  const trimmed = value.trim();
  if (!DATE_REGEX.test(trimmed)) {
    throw new ApiError(
      ErrorCodes.ValidationError,
      `${fieldName} must be in YYYY-MM-DD format`,
      400
    );
  }

  // Validate it's actually a valid date
  const date = new Date(trimmed + 'T00:00:00Z');
  if (isNaN(date.getTime())) {
    throw new ApiError(
      ErrorCodes.ValidationError,
      `${fieldName} is not a valid date`,
      400
    );
  }

  // Ensure the parsed date matches the input (catches things like 2024-02-30)
  const [year, month, day] = trimmed.split('-').map(Number);
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() + 1 !== month ||
    date.getUTCDate() !== day
  ) {
    throw new ApiError(
      ErrorCodes.ValidationError,
      `${fieldName} is not a valid date`,
      400
    );
  }

  return trimmed;
}

/**
 * Validates pagination limit parameter.
 *
 * @param value - The value to validate (string or number)
 * @param defaultValue - Default value if not provided
 * @param maxValue - Maximum allowed value
 * @returns The validated limit
 */
export function validateLimit(
  value: string | number | null | undefined,
  defaultValue: number = 50,
  maxValue: number = 100
): number {
  if (value === null || value === undefined || value === '') {
    return defaultValue;
  }

  const num = typeof value === 'string' ? parseInt(value, 10) : value;

  if (isNaN(num) || num < 0) {
    return defaultValue;
  }

  return Math.min(num, maxValue);
}

/**
 * Validates pagination offset parameter.
 *
 * @param value - The value to validate (string or number)
 * @param defaultValue - Default value if not provided
 * @returns The validated offset (non-negative)
 */
export function validateOffset(
  value: string | number | null | undefined,
  defaultValue: number = 0
): number {
  if (value === null || value === undefined || value === '') {
    return defaultValue;
  }

  const num = typeof value === 'string' ? parseInt(value, 10) : value;

  if (isNaN(num) || num < 0) {
    return defaultValue;
  }

  return num;
}

/**
 * Validates a string against allowed values.
 *
 * @param value - The value to validate
 * @param allowedValues - Array of allowed values
 * @param fieldName - Name of the field for error messages
 * @param defaultValue - Optional default if value is not provided
 * @returns The validated value
 * @throws ApiError if validation fails and no default is provided
 */
export function validateEnum<T extends string>(
  value: string | null | undefined,
  allowedValues: readonly T[],
  fieldName: string,
  defaultValue?: T
): T {
  if (!value) {
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    throw new ApiError(
      ErrorCodes.ValidationError,
      `${fieldName} is required`,
      400
    );
  }

  const trimmed = value.trim().toLowerCase() as T;
  if (!allowedValues.includes(trimmed)) {
    throw new ApiError(
      ErrorCodes.ValidationError,
      `${fieldName} must be one of: ${allowedValues.join(', ')}`,
      400
    );
  }

  return trimmed;
}

/**
 * Validates a string length.
 *
 * @param value - The value to validate
 * @param fieldName - Name of the field for error messages
 * @param maxLength - Maximum allowed length
 * @param required - Whether the field is required
 * @returns The validated string or null
 * @throws ApiError if validation fails
 */
export function validateString(
  value: string | null | undefined,
  fieldName: string,
  maxLength: number = 1000,
  required: boolean = false
): string | null {
  if (!value || value.trim() === '') {
    if (required) {
      throw new ApiError(
        ErrorCodes.ValidationError,
        `${fieldName} is required`,
        400
      );
    }
    return null;
  }

  const trimmed = value.trim();
  if (trimmed.length > maxLength) {
    throw new ApiError(
      ErrorCodes.ValidationError,
      `${fieldName} is too long (max ${maxLength} characters)`,
      400
    );
  }

  return trimmed;
}

/**
 * Sanitizes a string by removing potentially dangerous characters.
 * Use for logging or display, not for SQL (use parameterized queries instead).
 *
 * @param value - The value to sanitize
 * @returns Sanitized string
 */
export function sanitizeForLogging(value: string | null | undefined): string {
  if (!value) {
    return '';
  }

  // Remove control characters and limit length for logging
  return value
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x1F\x7F]/g, '')
    .substring(0, 500);
}

/**
 * Leave types allowed for time-off requests.
 */
export const LEAVE_TYPES = ['vacation', 'sick', 'personal', 'other'] as const;
export type LeaveType = typeof LEAVE_TYPES[number];

/**
 * Request statuses.
 */
export const REQUEST_STATUSES = ['pending', 'approved', 'rejected', 'all'] as const;
export type RequestStatus = typeof REQUEST_STATUSES[number];

/**
 * Request roles for filtering.
 */
export const REQUEST_ROLES = ['requester', 'supervisor'] as const;
export type RequestRole = typeof REQUEST_ROLES[number];
