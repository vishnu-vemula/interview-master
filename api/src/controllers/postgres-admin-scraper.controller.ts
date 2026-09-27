import type { Request, Response, NextFunction } from 'express';
import prisma from '../config/prisma';
import { syncJobs } from '../services/job-sync-service';
import AppError from '../utils/app-error';

let timer: ReturnType<typeof setInterval> | undefined;
const getConfig = () => prisma.scraperConfig.upsert({ where: { singletonKey: 'scraper' },
  update: {}, create: { singletonKey: 'scraper' } });
const run = async () => {
  const config = await getConfig();
  if (config.status === 'running') return;
  const claimed = await prisma.scraperConfig.updateMany({ where: { id: config.id, status: { not: 'running' } },
    data: { status: 'running' } });
  if (!claimed.count) return;
  const log = await prisma.scraperLog.create({ data: { status: 'running' } });
  let imported = 0, updated = 0;
  try {
    for (const keyword of config.keywords.length ? config.keywords : ['developer']) {
      const result = await syncJobs(keyword, config.remoteOnly ? 'remote' : '', 1);
      imported += result.upsertedCount; updated += result.modifiedCount;
    }
    await prisma.scraperLog.update({ where: { id: log.id }, data: {
      status: 'success', endTime: new Date(), jobsImported: imported, jobsUpdated: updated } });
    await prisma.scraperConfig.update({ where: { id: config.id }, data: { status: 'idle', lastRun: new Date() } });
  } catch (error) {
    await prisma.scraperLog.update({ where: { id: log.id }, data: {
      status: 'failed', endTime: new Date(), jobsImported: imported, jobsUpdated: updated,
      error: error instanceof Error ? error.message.slice(0, 500) : 'Unknown error' } });
    await prisma.scraperConfig.update({ where: { id: config.id }, data: { status: 'idle' } });
  }
};
export const initScraperScheduler = async () => {
  if (timer) clearInterval(timer);
  const config = await getConfig();
  if (config.isActiveScheduler) timer = setInterval(() => { run().catch(() => {}); },
    Math.max(5, config.scrapeInterval) * 60000);
  return () => { if (timer) clearInterval(timer); timer = undefined; };
};
export const getScraperStatus = async (_req: Request, res: Response) => {
  const config = await getConfig(); res.json({ success: true, data: { config: { ...config, _id: config.id },
    schedulerRunning: Boolean(timer) } });
};
export const updateScraperSettings = async (req: Request, res: Response, next: NextFunction) => {
  const body = req.body || {};
  const data: Record<string, unknown> = {};
  if (body.scrapeInterval !== undefined) { const n = Number(body.scrapeInterval);
    if (!Number.isInteger(n) || n < 5 || n > 10080) return next(new AppError('Invalid scrape interval.', 400));
    data.scrapeInterval = n; }
  if (body.maxJobs !== undefined) { const n = Number(body.maxJobs);
    if (!Number.isInteger(n) || n < 1 || n > 100) return next(new AppError('Invalid maximum jobs.', 400));
    data.maxJobs = n; }
  if (body.keywords !== undefined) { if (!Array.isArray(body.keywords) || body.keywords.length > 20 ||
    body.keywords.some((x: unknown) => typeof x !== 'string' || x.length > 80))
    return next(new AppError('Invalid keywords.', 400)); data.keywords = body.keywords; }
  if (body.country !== undefined) { if (typeof body.country !== 'string' || !/^[a-z]{2}$/.test(body.country))
    return next(new AppError('Invalid country.', 400)); data.country = body.country; }
  if (body.remoteOnly !== undefined) data.remoteOnly = Boolean(body.remoteOnly);
  if (body.enabledSources !== undefined) { if (!Array.isArray(body.enabledSources) ||
    body.enabledSources.some((x: unknown) => typeof x !== 'string' || x.length > 80))
    return next(new AppError('Invalid sources.', 400)); data.enabledSources = body.enabledSources; }
  const existing = await getConfig();
  const config = await prisma.scraperConfig.update({ where: { id: existing.id }, data });
  await initScraperScheduler(); res.json({ success: true, config: { ...config, _id: config.id } });
};
export const triggerManualScrape = async (_req: Request, res: Response, next: NextFunction) => {
  const config = await getConfig();
  if (config.status === 'running') return next(new AppError('Scraper task is already running.', 400));
  setImmediate(() => { run().catch(() => {}); });
  res.status(202).json({ success: true, message: 'Manual scraping task triggered successfully in the background.' });
};
export const pauseScraperScheduler = async (_req: Request, res: Response) => {
  const config = await prisma.scraperConfig.update({ where: { singletonKey: 'scraper' },
    data: { isActiveScheduler: false } });
  if (timer) clearInterval(timer); timer = undefined;
  res.json({ success: true, message: 'Scraper scheduler paused successfully.', config });
};
export const resumeScraperScheduler = async (_req: Request, res: Response) => {
  const config = await prisma.scraperConfig.update({ where: { singletonKey: 'scraper' },
    data: { isActiveScheduler: true } }); await initScraperScheduler();
  res.json({ success: true, message: 'Scraper scheduler resumed successfully.', config });
};
export const getScraperLogs = async (req: Request, res: Response) => {
  const page = Math.max(1, Number(req.query.page) || 1), limit = Math.min(100, Math.max(1, Number(req.query.limit) || 10));
  const [rows, total] = await Promise.all([prisma.scraperLog.findMany({ orderBy: { startTime: 'desc' },
    skip: (page - 1) * limit, take: limit }), prisma.scraperLog.count()]);
  res.json({ success: true, data: { logs: rows.map(row => ({ ...row, _id: row.id })),
    total, page, pages: Math.ceil(total / limit) } });
};
