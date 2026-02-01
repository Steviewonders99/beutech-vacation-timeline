/**
 * Tests for input validation utilities.
 */

import {
  validateUuid,
  validateEmail,
  validateDateFormat,
  validateLimit,
  validateOffset,
  validateEnum,
  validateString,
  sanitizeForLogging,
  LEAVE_TYPES,
} from '../../src/utils/validation';
import { ApiError } from '../../src/models/ErrorResponse';

describe('validateUuid', () => {
  it('should accept valid UUID v4', () => {
    const uuid = '123e4567-e89b-42d3-a456-426614174000';
    expect(validateUuid(uuid, 'id')).toBe(uuid.toLowerCase());
  });

  it('should lowercase the UUID', () => {
    const uuid = '123E4567-E89B-42D3-A456-426614174000';
    expect(validateUuid(uuid, 'id')).toBe(uuid.toLowerCase());
  });

  it('should trim whitespace', () => {
    const uuid = '  123e4567-e89b-42d3-a456-426614174000  ';
    expect(validateUuid(uuid, 'id')).toBe('123e4567-e89b-42d3-a456-426614174000');
  });

  it('should throw for null/undefined', () => {
    expect(() => validateUuid(null, 'id')).toThrow(ApiError);
    expect(() => validateUuid(undefined, 'id')).toThrow(ApiError);
  });

  it('should throw for invalid format', () => {
    expect(() => validateUuid('not-a-uuid', 'id')).toThrow(ApiError);
    expect(() => validateUuid('12345', 'id')).toThrow(ApiError);
    expect(() => validateUuid('', 'id')).toThrow(ApiError);
  });

  it('should throw with descriptive error message', () => {
    try {
      validateUuid('invalid', 'Request ID');
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).message).toContain('Request ID');
      expect((error as ApiError).message).toContain('valid UUID');
      expect((error as ApiError).statusCode).toBe(400);
    }
  });
});

describe('validateEmail', () => {
  it('should accept valid email', () => {
    expect(validateEmail('user@example.com', 'email')).toBe('user@example.com');
  });

  it('should lowercase the email', () => {
    expect(validateEmail('User@EXAMPLE.COM', 'email')).toBe('user@example.com');
  });

  it('should trim whitespace', () => {
    expect(validateEmail('  user@example.com  ', 'email')).toBe('user@example.com');
  });

  it('should accept complex valid emails', () => {
    expect(validateEmail('user.name+tag@sub.example.com', 'email')).toBe('user.name+tag@sub.example.com');
  });

  it('should throw for null/undefined', () => {
    expect(() => validateEmail(null, 'email')).toThrow(ApiError);
    expect(() => validateEmail(undefined, 'email')).toThrow(ApiError);
  });

  it('should throw for invalid format', () => {
    expect(() => validateEmail('not-an-email', 'email')).toThrow(ApiError);
    expect(() => validateEmail('@example.com', 'email')).toThrow(ApiError);
    expect(() => validateEmail('user@', 'email')).toThrow(ApiError);
    expect(() => validateEmail('user@.com', 'email')).toThrow(ApiError);
  });

  it('should throw for emails that are too long', () => {
    const longEmail = 'a'.repeat(250) + '@example.com';
    expect(() => validateEmail(longEmail, 'email')).toThrow(ApiError);
  });
});

describe('validateDateFormat', () => {
  it('should accept valid date', () => {
    expect(validateDateFormat('2025-01-15', 'date')).toBe('2025-01-15');
  });

  it('should trim whitespace', () => {
    expect(validateDateFormat('  2025-01-15  ', 'date')).toBe('2025-01-15');
  });

  it('should throw for null/undefined', () => {
    expect(() => validateDateFormat(null, 'date')).toThrow(ApiError);
    expect(() => validateDateFormat(undefined, 'date')).toThrow(ApiError);
  });

  it('should throw for invalid format', () => {
    expect(() => validateDateFormat('01-15-2025', 'date')).toThrow(ApiError);
    expect(() => validateDateFormat('2025/01/15', 'date')).toThrow(ApiError);
    expect(() => validateDateFormat('January 15, 2025', 'date')).toThrow(ApiError);
  });

  it('should throw for invalid calendar dates', () => {
    expect(() => validateDateFormat('2025-02-30', 'date')).toThrow(ApiError);
    expect(() => validateDateFormat('2025-13-01', 'date')).toThrow(ApiError);
    expect(() => validateDateFormat('2025-00-15', 'date')).toThrow(ApiError);
  });

  it('should accept leap year dates', () => {
    expect(validateDateFormat('2024-02-29', 'date')).toBe('2024-02-29');
  });

  it('should reject invalid leap year dates', () => {
    expect(() => validateDateFormat('2025-02-29', 'date')).toThrow(ApiError);
  });
});

describe('validateLimit', () => {
  it('should return default for null/undefined', () => {
    expect(validateLimit(null)).toBe(50);
    expect(validateLimit(undefined)).toBe(50);
    expect(validateLimit('')).toBe(50);
  });

  it('should use custom default', () => {
    expect(validateLimit(null, 25)).toBe(25);
  });

  it('should parse string to number', () => {
    expect(validateLimit('10')).toBe(10);
  });

  it('should accept number directly', () => {
    expect(validateLimit(10)).toBe(10);
  });

  it('should cap at max value', () => {
    expect(validateLimit(200, 50, 100)).toBe(100);
  });

  it('should return default for negative values', () => {
    expect(validateLimit(-5)).toBe(50);
  });

  it('should return default for NaN', () => {
    expect(validateLimit('not-a-number')).toBe(50);
  });
});

describe('validateOffset', () => {
  it('should return default for null/undefined', () => {
    expect(validateOffset(null)).toBe(0);
    expect(validateOffset(undefined)).toBe(0);
    expect(validateOffset('')).toBe(0);
  });

  it('should parse string to number', () => {
    expect(validateOffset('10')).toBe(10);
  });

  it('should accept number directly', () => {
    expect(validateOffset(10)).toBe(10);
  });

  it('should return default for negative values', () => {
    expect(validateOffset(-5)).toBe(0);
  });

  it('should return default for NaN', () => {
    expect(validateOffset('not-a-number')).toBe(0);
  });
});

describe('validateEnum', () => {
  it('should accept valid enum value', () => {
    expect(validateEnum('vacation', LEAVE_TYPES, 'leaveType')).toBe('vacation');
    expect(validateEnum('sick', LEAVE_TYPES, 'leaveType')).toBe('sick');
  });

  it('should be case-insensitive', () => {
    expect(validateEnum('VACATION', LEAVE_TYPES, 'leaveType')).toBe('vacation');
  });

  it('should return default for null/undefined', () => {
    expect(validateEnum(null, LEAVE_TYPES, 'leaveType', 'vacation')).toBe('vacation');
    expect(validateEnum(undefined, LEAVE_TYPES, 'leaveType', 'vacation')).toBe('vacation');
  });

  it('should throw if required and not provided', () => {
    expect(() => validateEnum(null, LEAVE_TYPES, 'leaveType')).toThrow(ApiError);
  });

  it('should throw for invalid value', () => {
    expect(() => validateEnum('invalid', LEAVE_TYPES, 'leaveType')).toThrow(ApiError);
    try {
      validateEnum('invalid', LEAVE_TYPES, 'leaveType');
    } catch (error) {
      expect((error as ApiError).message).toContain('leaveType');
      expect((error as ApiError).message).toContain('vacation');
    }
  });
});

describe('validateString', () => {
  it('should accept valid string', () => {
    expect(validateString('hello world', 'field')).toBe('hello world');
  });

  it('should trim whitespace', () => {
    expect(validateString('  hello  ', 'field')).toBe('hello');
  });

  it('should return null for empty when not required', () => {
    expect(validateString('', 'field')).toBeNull();
    expect(validateString(null, 'field')).toBeNull();
    expect(validateString('   ', 'field')).toBeNull();
  });

  it('should throw for empty when required', () => {
    expect(() => validateString('', 'field', 1000, true)).toThrow(ApiError);
    expect(() => validateString(null, 'field', 1000, true)).toThrow(ApiError);
  });

  it('should throw for strings exceeding max length', () => {
    expect(() => validateString('a'.repeat(101), 'field', 100)).toThrow(ApiError);
  });
});

describe('sanitizeForLogging', () => {
  it('should return empty string for null/undefined', () => {
    expect(sanitizeForLogging(null)).toBe('');
    expect(sanitizeForLogging(undefined)).toBe('');
  });

  it('should remove control characters', () => {
    expect(sanitizeForLogging('hello\x00world')).toBe('helloworld');
    expect(sanitizeForLogging('test\x1Fvalue')).toBe('testvalue');
  });

  it('should truncate long strings', () => {
    const longString = 'a'.repeat(600);
    expect(sanitizeForLogging(longString).length).toBe(500);
  });

  it('should preserve normal text', () => {
    expect(sanitizeForLogging('Hello, World!')).toBe('Hello, World!');
  });
});
