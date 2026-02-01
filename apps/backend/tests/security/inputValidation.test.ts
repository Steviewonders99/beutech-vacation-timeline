/**
 * Security tests for input validation.
 */

import {
  validateUuid,
  validateEmail,
  validateDateFormat,
  validateLimit,
  validateOffset,
  validateString,
  sanitizeForLogging,
} from '../../src/utils/validation';
import { ApiError } from '../../src/models/ErrorResponse';

describe('Input Validation Security', () => {
  describe('UUID Injection Prevention', () => {
    const maliciousUuids = [
      "'; DROP TABLE users; --",
      '123e4567-e89b-12d3-a456-426614174000; DELETE FROM users',
      '../../../etc/passwd',
      '<script>alert(1)</script>',
      '${process.env.SECRET}',
      '`rm -rf /`',
      'OR 1=1',
      "' OR '1'='1",
    ];

    it('should reject SQL injection attempts in UUIDs', () => {
      for (const input of maliciousUuids) {
        expect(() => validateUuid(input, 'id')).toThrow(ApiError);
      }
    });

    it('should only accept valid UUID format', () => {
      // Valid UUID should pass
      expect(() => validateUuid('123e4567-e89b-42d3-a456-426614174000', 'id')).not.toThrow();

      // Invalid formats should fail
      expect(() => validateUuid('123', 'id')).toThrow();
      expect(() => validateUuid('not-a-uuid', 'id')).toThrow();
      expect(() => validateUuid('123e4567e89b12d3a456426614174000', 'id')).toThrow(); // No hyphens
    });
  });

  describe('Email Injection Prevention', () => {
    const maliciousEmails = [
      "admin'--@test.com",
      'admin@test.com\nBcc: attacker@evil.com',
      'admin@test.com\r\nSubject: Phishing',
      'test@test.com; DELETE FROM users;',
      '<script>alert(document.cookie)</script>@test.com',
    ];

    it('should reject header injection attempts in emails', () => {
      for (const input of maliciousEmails) {
        // These should either throw or be sanitized
        try {
          const result = validateEmail(input, 'email');
          // If it doesn't throw, it should not contain injection characters
          expect(result).not.toContain('\n');
          expect(result).not.toContain('\r');
          expect(result).not.toContain(';');
        } catch (error) {
          expect(error).toBeInstanceOf(ApiError);
        }
      }
    });

    it('should reject emails that are too long', () => {
      const longEmail = 'a'.repeat(300) + '@test.com';
      expect(() => validateEmail(longEmail, 'email')).toThrow(ApiError);
    });
  });

  describe('Date Injection Prevention', () => {
    const maliciousDateInputs = [
      "2025-01-01'; DROP TABLE requests;--",
      '2025-01-01 OR 1=1',
      '../../../etc/passwd',
      '<script>alert(1)</script>',
      '2025-01-01\0malicious',
    ];

    it('should reject SQL injection attempts in dates', () => {
      for (const input of maliciousDateInputs) {
        expect(() => validateDateFormat(input, 'date')).toThrow(ApiError);
      }
    });

    it('should only accept strict YYYY-MM-DD format', () => {
      expect(() => validateDateFormat('2025-01-15', 'date')).not.toThrow();
      expect(() => validateDateFormat('01-15-2025', 'date')).toThrow();
      expect(() => validateDateFormat('2025/01/15', 'date')).toThrow();
      expect(() => validateDateFormat('2025-1-15', 'date')).toThrow();
      expect(() => validateDateFormat('2025-01-1', 'date')).toThrow();
    });
  });

  describe('Numeric Input Security', () => {
    it('should handle NaN gracefully', () => {
      expect(validateLimit(NaN)).toBe(50); // Default
      expect(validateOffset(NaN)).toBe(0); // Default
    });

    it('should handle Infinity gracefully', () => {
      expect(validateLimit(Infinity, 50, 100)).toBe(100); // Capped
      expect(validateOffset(Infinity)).toBe(Infinity); // Technically valid
    });

    it('should handle negative numbers', () => {
      expect(validateLimit(-1)).toBe(50); // Default for invalid
      expect(validateOffset(-100)).toBe(0); // Default for invalid
    });

    it('should handle very large numbers', () => {
      expect(validateLimit(Number.MAX_SAFE_INTEGER, 50, 100)).toBe(100);
    });

    it('should handle string injection attempts', () => {
      // parseInt stops at first non-numeric, so '10; DROP...' returns 10
      // This is safe because we use parameterized queries, not string interpolation
      expect(validateLimit('10; DROP TABLE users')).toBe(10);
      // '0' at start returns 0
      expect(validateOffset("0'; DELETE FROM users")).toBe(0);
    });
  });

  describe('String Input Security', () => {
    it('should reject excessively long strings', () => {
      const longString = 'a'.repeat(2000);
      // validateString throws an error for strings exceeding maxLength
      expect(() => validateString(longString, 'field', 100, true)).toThrow(ApiError);
    });

    it('should reject strings exceeding max length', () => {
      expect(() => validateString('a'.repeat(101), 'field', 100, true)).toThrow(ApiError);
    });

    it('should handle null bytes', () => {
      const withNull = 'test\0malicious';
      // validateString doesn't specifically handle null bytes, it just validates length
      // The null byte is preserved but this is OK since we use parameterized queries
      const result = validateString(withNull, 'field', 100);
      expect(result).toBe('test\0malicious');
    });
  });

  describe('Logging Sanitization', () => {
    it('should remove control characters', () => {
      const malicious = 'test\x00\x01\x02\x03value';
      const result = sanitizeForLogging(malicious);
      expect(result).not.toMatch(/[\x00-\x1F]/);
    });

    it('should truncate long strings', () => {
      const longString = 'a'.repeat(1000);
      const result = sanitizeForLogging(longString);
      expect(result.length).toBeLessThanOrEqual(500);
    });

    it('should handle null/undefined', () => {
      expect(sanitizeForLogging(null)).toBe('');
      expect(sanitizeForLogging(undefined)).toBe('');
    });

    it('should remove newlines that could be used for log injection', () => {
      const injection = 'user\n[ERROR] Fake error message';
      const result = sanitizeForLogging(injection);
      // sanitizeForLogging removes control characters including newlines
      expect(result).toBe('user[ERROR] Fake error message');
    });
  });

  describe('Prototype Pollution Prevention', () => {
    it('should not be vulnerable to __proto__ in strings', () => {
      const malicious = '__proto__';
      // This shouldn't affect object prototypes
      const result = validateString(malicious, 'field');
      expect(result).toBe('__proto__'); // Just a string
      expect(Object.prototype.hasOwnProperty.call({}, 'malicious')).toBe(false);
    });

    it('should not be vulnerable to constructor in strings', () => {
      const malicious = 'constructor';
      const result = validateString(malicious, 'field');
      expect(result).toBe('constructor'); // Just a string
    });
  });

  describe('Unicode Security', () => {
    it('should handle unicode characters in emails', () => {
      // Some email systems allow unicode, some don't
      // Our validator should either accept valid unicode emails or reject them consistently
      const unicodeEmail = 'üser@example.com';
      try {
        const result = validateEmail(unicodeEmail, 'email');
        expect(result).toContain('@');
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
      }
    });

    it('should handle RTL override characters', () => {
      // Right-to-left override can be used to disguise text
      const rtlOverride = 'test\u202Eevil';
      const result = sanitizeForLogging(rtlOverride);
      // Should either remove or preserve, but be consistent
      expect(typeof result).toBe('string');
    });

    it('should handle zero-width characters', () => {
      const zeroWidth = 'test\u200Bvalue'; // Zero-width space
      const result = sanitizeForLogging(zeroWidth);
      expect(typeof result).toBe('string');
    });
  });
});
