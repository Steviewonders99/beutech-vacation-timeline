/**
 * Tests for ErrorResponse model.
 */

import { ApiError, ErrorCodes, createErrorResponse } from '../src/models/ErrorResponse';

describe('ErrorCodes', () => {
  it('should have all expected error codes', () => {
    expect(ErrorCodes.Unauthorized).toBe('Unauthorized');
    expect(ErrorCodes.Forbidden).toBe('Forbidden');
    expect(ErrorCodes.BadRequest).toBe('BadRequest');
    expect(ErrorCodes.NotFound).toBe('NotFound');
    expect(ErrorCodes.InternalError).toBe('InternalError');
    expect(ErrorCodes.ValidationError).toBe('ValidationError');
    expect(ErrorCodes.ConfigurationError).toBe('ConfigurationError');
    expect(ErrorCodes.GraphError).toBe('GraphError');
  });
});

describe('createErrorResponse', () => {
  it('should create properly structured error response', () => {
    const response = createErrorResponse(ErrorCodes.BadRequest, 'Something went wrong');

    expect(response).toEqual({
      error: {
        code: 'BadRequest',
        message: 'Something went wrong',
      },
    });
  });

  it('should handle various error codes', () => {
    const unauthorized = createErrorResponse(ErrorCodes.Unauthorized, 'Not authorized');
    const notFound = createErrorResponse(ErrorCodes.NotFound, 'Resource not found');

    expect(unauthorized.error.code).toBe('Unauthorized');
    expect(notFound.error.code).toBe('NotFound');
  });
});

describe('ApiError', () => {
  it('should create error with default status code', () => {
    const error = new ApiError(ErrorCodes.InternalError, 'Server error');

    expect(error.code).toBe('InternalError');
    expect(error.message).toBe('Server error');
    expect(error.statusCode).toBe(500); // Default
    expect(error.name).toBe('ApiError');
  });

  it('should create error with custom status code', () => {
    const error = new ApiError(ErrorCodes.ValidationError, 'Invalid input', 400);

    expect(error.code).toBe('ValidationError');
    expect(error.message).toBe('Invalid input');
    expect(error.statusCode).toBe(400);
  });

  it('should extend Error', () => {
    const error = new ApiError(ErrorCodes.BadRequest, 'Bad request', 400);

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(ApiError);
  });

  it('should convert to response format', () => {
    const error = new ApiError(ErrorCodes.Unauthorized, 'Invalid token', 401);
    const response = error.toResponse();

    expect(response).toEqual({
      error: {
        code: 'Unauthorized',
        message: 'Invalid token',
      },
    });
  });

  describe('common error scenarios', () => {
    it('should handle 400 Bad Request', () => {
      const error = new ApiError(ErrorCodes.BadRequest, 'Missing required field', 400);

      expect(error.statusCode).toBe(400);
      expect(error.code).toBe('BadRequest');
    });

    it('should handle 401 Unauthorized', () => {
      const error = new ApiError(ErrorCodes.Unauthorized, 'Missing API key', 401);

      expect(error.statusCode).toBe(401);
      expect(error.code).toBe('Unauthorized');
    });

    it('should handle 403 Forbidden', () => {
      const error = new ApiError(ErrorCodes.Forbidden, 'Access denied', 403);

      expect(error.statusCode).toBe(403);
      expect(error.code).toBe('Forbidden');
    });

    it('should handle 404 Not Found', () => {
      const error = new ApiError(ErrorCodes.NotFound, 'User not found', 404);

      expect(error.statusCode).toBe(404);
      expect(error.code).toBe('NotFound');
    });

    it('should handle 500 Internal Error', () => {
      const error = new ApiError(ErrorCodes.InternalError, 'Unexpected error', 500);

      expect(error.statusCode).toBe(500);
      expect(error.code).toBe('InternalError');
    });
  });
});
