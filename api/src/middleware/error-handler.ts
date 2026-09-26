import type { Request, Response, NextFunction } from 'express';
import logger from '../config/logger';
const errorHandler = (err: Error & { statusCode?: number; isOperational?: boolean; code?: number; keyValue?: Record<string, unknown> }, req: Request, res: Response, _next: NextFunction) => {
  let statusCode = err.statusCode && err.statusCode >= 400 && err.statusCode < 600 ? err.statusCode : 500;
  let message = statusCode < 500 || (statusCode === 503 && err.isOperational)
    ? err.message : 'Internal server error.';

  // Mongoose Duplicate Key
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0];
    message = field ? `${field.charAt(0).toUpperCase() + field.slice(1)} already exists.` : 'Record already exists.';
    statusCode = 409;
  }

  // Mongoose Validation Error
  if (err.name === 'ValidationError') {
    message = 'Invalid input.';
    statusCode = 400;
  }

  // Mongoose Cast Error
  if (err.name === 'CastError') {
    message = 'Invalid identifier.';
    statusCode = 400;
  }

  // JWT Errors
  if (err.name === 'JsonWebTokenError') {
    message = 'Invalid token. Please log in again.';
    statusCode = 401;
  }

  if (statusCode >= 500) logger.error(`${req.method} ${req.path} ${err.name}: ${process.env.NODE_ENV === 'development' ? err.stack : 'internal failure'}`);

  res.status(statusCode).json({
    success: false,
    message,
  });
};

export default errorHandler;
