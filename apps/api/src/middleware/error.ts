import type { Context } from 'hono';

import { StorageError } from '../lib/storage-errors.js';

// Use specific status codes that are valid for JSON responses
type ErrorStatusCode = 400 | 401 | 403 | 404 | 409 | 422 | 429 | 500 | 502 | 503;

/**
 * Custom error class for WitnessChain API
 */
export class ApiError extends Error {
  public readonly statusCode: ErrorStatusCode;
  public readonly code: string;
  public readonly userMessage: string;
  public readonly details?: Record<string, unknown>;

  constructor(
    statusCode: ErrorStatusCode,
    code: string,
    userMessage: string,
    technicalMessage: string,
    details?: Record<string, unknown>
  ) {
    super(technicalMessage);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
    this.userMessage = userMessage;
    this.details = details;
  }
}

/**
 * Global error handler middleware
 * Catches all errors and returns a standardized response
 * Never exposes internal error details to clients
 */
export function errorHandler(err: Error, c: Context) {
  // Log the full error for debugging (server-side only)
  console.error('[API Error]', {
    name: err.name,
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  });

  // Handle known API errors
  if (err instanceof ApiError) {
    return c.json(
      {
        error: err.code,
        code: err.code,
        message: err.userMessage,
        ...(process.env.NODE_ENV === 'development' && err.details
          ? { details: err.details }
          : {}),
      },
      err.statusCode
    );
  }

  // Handle Zod validation errors
  if (err.name === 'ZodError') {
    return c.json(
      {
        error: 'VALIDATION_ERROR',
        code: 'VALIDATION_001',
        message: 'Invalid request data. Please check your input.',
      },
      400
    );
  }

  // Handle StorageErrors - translate at API boundary
  if (err instanceof StorageError) {
    return c.json(
      {
        error: err.code,
        code: err.code,
        message: err.userMessage,
      },
      500
    );
  }

  // Generic error - never expose internal details
  return c.json(
    {
      error: 'INTERNAL_ERROR',
      code: 'INTERNAL_001',
      message: 'An unexpected error occurred. Please try again.',
    },
    500
  );
}

/**
 * Pre-defined error factories for common error cases
 */
export const Errors = {
  unauthorized: (message = 'Authentication required.') =>
    new ApiError(401, 'AUTH_001', message, 'Unauthorized request'),

  forbidden: (message = 'You do not have permission to perform this action.') =>
    new ApiError(403, 'AUTH_002', message, 'Forbidden request'),

  notFound: (resource = 'Resource') =>
    new ApiError(404, 'NOT_FOUND', `${resource} not found.`, `${resource} not found`),

  badRequest: (message = 'Invalid request.') =>
    new ApiError(400, 'BAD_REQUEST', message, 'Bad request'),

  conflict: (message = 'Resource already exists.') =>
    new ApiError(409, 'CONFLICT', message, 'Resource conflict'),

  tooManyRequests: (message = 'Too many requests. Please try again later.') =>
    new ApiError(429, 'RATE_LIMIT', message, 'Rate limit exceeded'),

  internalError: () =>
    new ApiError(
      500,
      'INTERNAL_ERROR',
      'An unexpected error occurred. Please try again.',
      'Internal server error'
    ),
} as const;
