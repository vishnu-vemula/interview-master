/**
 * server.js — HTTP server entry point (no Express logic here)
 *
 * Responsibilities:
 *  1. Load environment variables
 *  2. Import the configured Express app
 *  3. Bind to port and start listening
 *  4. Handle OS-level process signals (SIGTERM, unhandledRejection)
 */

import dotenv from 'dotenv';
dotenv.config({ path: require('path').join(__dirname, '../../.env') });
console.log('SERVER APP ID:', process.env.ADZUNA_APP_ID);
console.log('SERVER APP KEY:', process.env.ADZUNA_APP_KEY);

import app from './app';
import logger from './config/logger';
import mongoose from 'mongoose';
const PORT = process.env.PORT || 5000;

// ─── Start HTTP server ─────────────────────────────────────────────
import { initSyncScheduler } from './services/job-sync-scheduler';
import { initCleanupScheduler } from './services/job-cleanup-service';
import { connect as connectRedis } from './config/redis';

const server = app.listen(PORT, async () => {
  logger.info(`🚀 Server running in [${process.env.NODE_ENV}] mode on port ${PORT}`);
  // Connect to Redis on server startup
  await connectRedis();
  // Start the background services
  initSyncScheduler();
  initCleanupScheduler();
});

// Initialize WebSocket for real-time AI interviews
import initSocket from './socket';
const io = initSocket(server);

// ─── Graceful Shutdown: unhandled promise rejections ──────────────
process.on('unhandledRejection', (err) => {
    // @ts-expect-error TODO(ts-migration): type this site
  logger.error(`💥 Unhandled Rejection: ${err.name} — ${err.message}`);
  server.close(() => {
    logger.warn('Server closed after unhandledRejection. Exiting...');
    process.exit(1);
  });
});

// ─── Graceful Shutdown: uncaught sync exceptions ──────────────────
process.on('uncaughtException', (err) => {
  logger.error(`💥 Uncaught Exception: ${err.name} — ${err.message}`);
  process.exit(1);
});

// ─── Graceful Shutdown: SIGTERM (Docker / Heroku / Render) ────────
process.on('SIGTERM', () => {
  logger.info('SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    logger.info('Process terminated.');
    process.exit(0);
  });
});

export default server;