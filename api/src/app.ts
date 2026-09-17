/**
 * app.js — Pure Express application (no server.listen here)
 *
 * Separation of concerns:
 *  - app.js  → Express app, middleware, routes (testable in isolation)
 *  - server.js → HTTP server bootstrap, process event handlers
 */

import 'express-async-errors';

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import compression from 'compression';
import connectDB from './config/db';
import logger from './config/logger';
import requestLogger from './middleware/request-logger';
import errorHandler from './middleware/error-handler';
// Route Imports
import authRoutes from './routes/auth.routes';
import userRoutes from './routes/user.routes';
import resumeRoutes from './routes/resume.routes';
import interviewRoutes from './routes/interview.routes';
import sessionRoutes from './routes/session.routes';
import jobsRoutes from './routes/jobs.routes';
import adminRoutes from './routes/admin.routes';
const app = express();

// ─── Database ──────────────────────────────────────────────────────
connectDB();

// ─── Security Headers ─────────────────────────────────────────────
app.use(helmet());

// ─── Gzip Compression ─────────────────────────────────────────────
// Compresses all JSON/text responses above the threshold.
// Skips already-encoded content (images, pre-gzipped assets).
app.use(compression({
  // Only compress responses larger than this (bytes). Default 1KB.
  threshold: parseInt(process.env.COMPRESSION_THRESHOLD_BYTES, 10) || 1024,
  // zlib compression level: 1 (fast) – 9 (best). 6 = balanced default.
  level: parseInt(process.env.COMPRESSION_LEVEL, 10) || 6,
  filter(req, res) {
    // Honour the caller's opt-out header
    if (req.headers['x-no-compression']) return false;
    return compression.filter(req, res);
  },
}));

// ─── CORS ─────────────────────────────────────────────────────────
app.use(cors({
  origin: (origin, callback) => {
    const allowed = process.env.CLIENT_URL || 'http://localhost:5173';
    // Let local dev and exact matches through instantly
    if (!origin || origin === allowed) return callback(null, true);
    
    // Normalize both for comparison (remove trailing slashes)
    const normalizedOrigin  = origin.replace(/\/$/, '');
    const normalizedAllowed = allowed.replace(/\/$/, '');

    if (normalizedOrigin === normalizedAllowed) {
      callback(null, true);
    } else {
      console.warn(`[CORS] Rejected origin: ${origin} (Expected: ${allowed})`);
      callback(null, false); // Don't throw error, just deny CORS
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Origin', 'Accept'],
}));


// ─── Rate Limiting ─────────────────────────────────────────────────
app.use('/api/', rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max:      parseInt(process.env.RATE_LIMIT_MAX)        || 100,
  standardHeaders: true,
  legacyHeaders:   false,
  message: { success: false, message: 'Too many requests. Please try again later.' },
}));

// ─── Body Parsers ──────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ─── HTTP Request Logging ──────────────────────────────────────────
// Two layers:
//  1. requestLogger — structured Winston logs (console + files) for
//     EVERY request: method, path, status, duration, caller IP and
//     authenticated user id when present. Levels scale with status.
//  2. Morgan — human-friendly dev output; in production its output is
//     streamed into Winston so nothing bypasses the log files.
app.use(requestLogger);

if (process.env.NODE_ENV !== 'test') {
  const morganFormat = process.env.NODE_ENV === 'production' ? 'combined' : 'dev';
  if (process.env.NODE_ENV === 'production') {
    app.use(morgan(morganFormat, {
      stream: { write: (msg: string) => logger.http?.(msg.trim()) ?? logger.info(msg.trim()) },
    }));
  } else {
    app.use(morgan(morganFormat));
  }
}

// ─── Health Check ──────────────────────────────────────────────────
app.get('/api/health', (_req, res) =>
  res.status(200).json({ success: true, message: 'OK', timestamp: new Date().toISOString() })
);

// ─── API Routes ────────────────────────────────────────────────────
app.use('/api/auth',       authRoutes);
app.use('/api/users',      userRoutes);
app.use('/api/resumes',    resumeRoutes);
app.use('/api/interviews', interviewRoutes);
app.use('/api/sessions',   sessionRoutes);
app.use('/api/jobs',       jobsRoutes);
app.use('/api/admin',      adminRoutes);

// ─── 404 Catch-all ────────────────────────────────────────────────
app.use('*', (req, res) =>
  res.status(404).json({ success: false, message: `Cannot ${req.method} ${req.originalUrl}` })
);

// ─── Global Error Handler (must be last) ──────────────────────────
app.use(errorHandler);

export default app;