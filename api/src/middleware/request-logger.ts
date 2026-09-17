/**
 * middleware/requestLogger.ts
 *
 * Structured request/response logger backed by Winston.
 *
 * Runs on EVERY incoming request (installed in app.ts before all
 * routes). It records:
 *   - HTTP method and path
 *   - response status code
 *   - total handling duration in milliseconds
 *   - caller IP
 *   - authenticated user id (when the auth middleware ran first)
 *
 * Severity maps to the response class so 5xx responses surface as
 * errors and 4xx as warnings in the log files / alerting.
 */

import type { Request, Response, NextFunction } from 'express';
import logger from '../config/logger';

const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  const start = Date.now();

  res.on('finish', () => {
    const durationMs = Date.now() - start;
    const userId = req.user?.id ?? 'anonymous';

    const level =
      res.statusCode >= 500 ? 'error'
      : res.statusCode >= 400 ? 'warn'
      : 'info';

    logger[level](
      `${req.method} ${req.originalUrl} ${res.statusCode} ${durationMs}ms ip=${req.ip ?? 'unknown'} user=${userId}`
    );
  });

  next();
};

export default requestLogger;
