/**
 * Error response model for consistent API error formatting.
 */

/**
 * Standard error response structure.
 */
export interface ErrorResponse {
  error: {
    code: string;
    message: string;
  };
}

/**
 * Error codes used in the API.
 */
export const ErrorCodes = {
  Unauthorized: 'Unauthorized',
  Forbidden: 'Forbidden',
  BadRequest: 'BadRequest',
  NotFound: 'NotFound',
  InternalError: 'InternalError',
  ValidationError: 'ValidationError',
  ConfigurationError: 'ConfigurationError',
  GraphError: 'GraphError',
} as const;

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];

/**
 * Creates a standardized error response.
 */
export function createErrorResponse(code: ErrorCode, message: string): ErrorResponse {
  return {
    error: {
      code,
      message,
    },
  };
}

/**
 * Custom error class for API errors.
 */
export class ApiError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;

  constructor(code: ErrorCode, message: string, statusCode: number = 500) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.statusCode = statusCode;
  }

  toResponse(): ErrorResponse {
    return createErrorResponse(this.code, this.message);
  }
}
