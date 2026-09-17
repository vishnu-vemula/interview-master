import type { Request, Response, NextFunction } from 'express';
import logger from '../config/logger';
// eslint-disable-next-line no-unused-vars
const errorHandler = (err: Error, req: Request, res: Response, next: NextFunction) => {
    // @ts-expect-error TODO(ts-migration): type this site
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';

  // Mongoose Duplicate Key
    // @ts-expect-error TODO(ts-migration): type this site
  if (err.code === 11000) {
    // @ts-expect-error TODO(ts-migration): type this site
    const field = Object.keys(err.keyValue)[0];
    message = `${field.charAt(0).toUpperCase() + field.slice(1)} already exists.`;
    statusCode = 409;
  }

  // Mongoose Validation Error
  if (err.name === 'ValidationError') {
    // @ts-expect-error TODO(ts-migration): type this site
    const errors = Object.values(err.errors).map((e) => e.message);
    message = errors.join('. ');
    statusCode = 400;
  }

  // Mongoose Cast Error
  if (err.name === 'CastError') {
    // @ts-expect-error TODO(ts-migration): type this site
    message = `Invalid ${err.path}: ${err.value}`;
    statusCode = 400;
  }

  // JWT Errors
  if (err.name === 'JsonWebTokenError') {
    message = 'Invalid token. Please log in again.';
    statusCode = 401;
  }

  if (process.env.NODE_ENV === 'development') {
    logger.error(err.stack);
  } else {
    logger.error(`${statusCode} - ${message} - ${req.originalUrl}`);
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

export default errorHandler;