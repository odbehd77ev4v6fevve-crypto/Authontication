import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { env } from '../config/env.ts';

interface HttpError extends Error {
  status?: number;
  statusCode?: number;
  type?: string;
  code?: string | number;
  keyPattern?: Record<string, number>;
  errors?: Record<string, { message?: string }>;
}

const DB_ERROR_NAMES = new Set([
  'MongoServerSelectionError',
  'MongoNetworkError',
  'MongoNetworkTimeoutError',
  'MongoNotConnectedError',
  'MongooseServerSelectionError',
]);

export function errorHandler(
  err: HttpError,
  _req: Request,
  res: Response,
  next: NextFunction
): void {
  if (res.headersSent) {
    next(err);
    return;
  }

  res.type('application/json');

  if (err instanceof ZodError) {
    res.status(400).json({
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      message: err.issues.map((i) => `${i.path.join('.') || 'field'}: ${i.message}`).join('; '),
      issues: err.issues,
    });
    return;
  }

  if (err.type === 'entity.parse.failed') {
    res.status(400).json({
      error: 'Invalid JSON payload',
      code: 'INVALID_JSON',
      message: 'The request body contains malformed JSON.',
    });
    return;
  }

  if (err.type === 'entity.too.large') {
    res.status(413).json({
      error: 'Payload too large',
      code: 'PAYLOAD_TOO_LARGE',
      message: 'The request payload exceeds the maximum allowed size.',
    });
    return;
  }

  if (err.name === 'MulterError') {
    const isTooLarge = err.code === 'LIMIT_FILE_SIZE';
    res.status(isTooLarge ? 413 : 400).json({
      error: isTooLarge ? 'Uploaded file is too large.' : 'File upload error',
      code: typeof err.code === 'string' ? err.code : 'UPLOAD_ERROR',
      message: isTooLarge
        ? 'The selected file exceeds the maximum allowed upload size.'
        : err.message,
    });
    return;
  }

  if (err.name === 'ValidationError' && err.errors) {
    const messages = Object.values(err.errors)
      .map((item) => item?.message)
      .filter(Boolean);
    res.status(400).json({
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      message: messages.join('; ') || 'Invalid input data.',
    });
    return;
  }

  // Mongoose duplicate key error (e.g., SKU or slug uniqueness)
  if (err.code === 11000) {
    const duplicateFields = err.keyPattern ? Object.keys(err.keyPattern).join(', ') : 'unique field';
    res.status(409).json({
      error: 'Duplicate conflict',
      code: 'DUPLICATE_KEY',
      message: `A record with the same ${duplicateFields} already exists.`,
    });
    return;
  }

  if (err.name === 'CastError') {
    res.status(400).json({
      error: 'Invalid identifier format',
      code: 'INVALID_ID',
      message: 'Invalid identifier format.',
    });
    return;
  }

  if (
    DB_ERROR_NAMES.has(err.name) ||
    (err.name === 'MongooseError' && /buffering timed out/i.test(err.message || ''))
  ) {
    console.error('[API Database Error]', err.name, err.message);
    res.status(503).json({
      error: 'Database unavailable',
      code: 'DB_UNAVAILABLE',
      message: 'Database service is temporarily unavailable. Please try again shortly.',
    });
    return;
  }

  const rawStatus = err.statusCode ?? err.status;
  const statusCode = rawStatus && rawStatus >= 400 && rawStatus < 600 ? rawStatus : 500;
  if (statusCode >= 500) {
    console.error('[API Error]', err.message, env.isProd ? '' : err.stack);
  }

  res.status(statusCode).json({
    error: statusCode >= 500 ? 'Internal server error' : err.message,
    code: typeof err.code === 'string' ? err.code : 'REQUEST_ERROR',
    message: statusCode >= 500 && env.isProd ? 'Something went wrong. Please try again.' : err.message,
  });
}

export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void> | void
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
