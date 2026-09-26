import 'dotenv/config';
import { createServer } from 'node:http';
import app from './app';
import logger from './config/logger';
import connectDB from './config/db';
import { connect as connectRedis, disconnect as disconnectRedis } from './config/redis';
import { initSyncScheduler } from './services/job-sync-scheduler';
import { initCleanupScheduler } from './services/job-cleanup-service';
import initSocket from './socket';
import mongoose from 'mongoose';

const required = ['MONGO_URI', 'GROQ_API_KEY',
  'CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET',
  'CLIENT_URL', 'API_PUBLIC_URL', 'PAYU_MERCHANT_KEY', 'PAYU_MERCHANT_SALT', 'PAYU_ENV'];

function validateEnvironment() {
  const authProvider = process.env.AUTH_PROVIDER || 'legacy';
  if (!['legacy', 'firebase'].includes(authProvider)) throw new Error('AUTH_PROVIDER must be legacy or firebase');
  const authRequired = authProvider === 'firebase' ? ['FIREBASE_PROJECT_ID'] : ['JWT_SECRET', 'JWT_REFRESH_SECRET'];
  const missing = [...required, ...authRequired].filter(name => !process.env[name]);
  if (missing.length) throw new Error(`Missing required environment settings: ${missing.join(', ')}`);
  if (authProvider === 'legacy' && (process.env.JWT_SECRET!.length < 32 || process.env.JWT_REFRESH_SECRET!.length < 32)) {
    throw new Error('JWT secrets must each be at least 32 characters');
  }
  if (!['test', 'production'].includes(process.env.PAYU_ENV!)) throw new Error('PAYU_ENV must be test or production');
  if (process.env.NODE_ENV === 'production') {
    if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is required for production RAG');
    const configuredSecrets = [
      ...authRequired, 'GROQ_API_KEY', 'OPENAI_API_KEY', 'CLOUDINARY_CLOUD_NAME',
      'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET', 'PAYU_MERCHANT_KEY', 'PAYU_MERCHANT_SALT',
    ];
    const placeholders = configuredSecrets.filter(name =>
      /^(?:your_|replace_|example|changeme|test_)/i.test(process.env[name] || ''));
    if (placeholders.length) throw new Error(`Placeholder production settings: ${placeholders.join(', ')}`);
    if (authProvider === 'firebase' && process.env.FIREBASE_AUTH_EMULATOR_HOST) {
      throw new Error('Firebase Auth Emulator cannot be used in production');
    }
    for (const name of ['CLIENT_URL', 'API_PUBLIC_URL']) {
      let url: URL;
      try { url = new URL(process.env[name]); }
      catch { throw new Error(`${name} must be a valid HTTPS URL in production`); }
      if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) {
        throw new Error(`${name} must be a valid HTTPS URL in production`);
      }
    }
    if (process.env.PAYU_ENV !== 'production') {
      throw new Error('PAYU_ENV=production is required when NODE_ENV=production');
    }
  }
  if (process.env.NODE_ENV === 'production' && process.env.REDIS_ENABLED === 'false') {
    throw new Error('Redis cannot be disabled in production');
  }
}

const server = createServer(app);
initSocket(server);

async function start() {
  validateEnvironment();
  await connectDB();
  await connectRedis();
  server.listen(Number(process.env.PORT || 5000), () => {
    logger.info(`API listening on port ${process.env.PORT || 5000}`);
    if (process.env.NODE_ENV !== 'test') {
      initSyncScheduler();
      initCleanupScheduler();
    }
  });
}

start().catch((error: Error) => {
  logger.error(`API startup failed: ${error.message}`);
  process.exitCode = 1;
});

const shutdown = async () => {
  server.close();
  await Promise.allSettled([mongoose.disconnect(), disconnectRedis()]);
};
process.on('SIGTERM', () => { shutdown().finally(() => { process.exitCode = 0; }); });
process.on('SIGINT', () => { shutdown().finally(() => { process.exitCode = 0; }); });
process.on('unhandledRejection', (error: Error) => {
  logger.error(`Unhandled rejection: ${error.message}`);
  shutdown().finally(() => { process.exitCode = 1; });
});

export default server;
