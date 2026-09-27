'use strict';

import cron from 'node-cron';
import prisma from '../config/prisma';
import { clearJobsCache } from '../config/redis';
import logger from '../config/logger';
// Lock to avoid overlapping runs
let isCleaning = false;

/**
 * Scans the database and deactivates job postings older than 30 days.
 * Sets isActive = false (soft deactivation).
 *
 * @returns {Promise<object>} - Cleanup metrics
 */
const runJobCleanup = async () => {
  if (isCleaning) {
    logger.warn('🧹 Job Cleanup Service: Previous cleanup run is still in progress. Skipping...');
    return;
  }

  isCleaning = true;
  logger.info('🧹 Job Cleanup Service: Starting soft deactivation run for old jobs...');

  try {
    // 1. Calculate cutoff threshold (30 days ago)
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 30);

    logger.info(`🧹 Job Cleanup Service: Searching for jobs older than ${cutoffDate.toISOString()}...`);

    // 2. Perform bulk soft update setting isActive = false
    const result = await prisma.jobListing.updateMany({ where: { active: true,
      OR: [{ postedAt: { lt: cutoffDate } }, { postedAt: null, createdAt: { lt: cutoffDate } }],
    }, data: { active: false } });
    if (result.count) await clearJobsCache();

    logger.info(`✅ Job Cleanup Service Completed. Deactivated: ${result.count} jobs.`);
    return {
      success: true,
      deactivatedCount: result.count
    };

  } catch (error) {
    // @ts-expect-error TODO(ts-migration): type this site
    logger.error(`❌ Job Cleanup Service Error: ${error.message}`);
    throw error;
  } finally {
    isCleaning = false;
  }
};

/**
 * Initializes the node-cron daily cleanup task.
 */
const initCleanupScheduler = () => {
  logger.info('⚙️ Initializing Daily Job Cleanup Cron Daemon...');

  // 1. Run once shortly after boot (30 seconds delay)
  setTimeout(() => {
    logger.info('⏰ Triggering initial startup job cleanup run...');
    runJobCleanup();
  }, 30 * 1000);

  // 2. Schedule cron to execute daily at midnight (0 0 * * *)
  cron.schedule('0 0 * * *', () => {
    logger.info('⏰ Cron triggered: Starting daily job cleanup schedule...');
    runJobCleanup();
  });

  logger.info('✅ Daily Job Cleanup Cron Daemon successfully scheduled: [0 0 * * *]');
};

export { runJobCleanup, initCleanupScheduler };
