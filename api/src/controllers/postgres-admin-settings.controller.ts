import type { Request, Response, NextFunction } from 'express';
import { Prisma, type SystemSetting } from '@prisma/client';
import prisma from '../config/prisma';
import AppError from '../utils/app-error';

const defaults = {
  general: { appName: 'Rehearsly', logo: '', theme: 'dark', maintenanceMode: false,
    supportEmail: 'support@interviewmaster.com', supportPhone: '+1 (555) 019-2834',
    socialLinks: { github: '', twitter: '', linkedin: '' } },
  security: { rateLimits: { windowMs: 900000, maxRequests: 100 } },
  ai: { model: 'llama-3.3-70b-versatile', temperature: 0.5, maxTokens: 1024 },
  storage: { provider: 'cloudinary', cloudinary: { cloudName: '' }, aws: { bucket: '', region: '' } },
  featureFlags: { enableJobs: true, enableScraper: true, enableATS: true, enableCoach: true },
};
const object = (value: unknown): Record<string, any> => value && typeof value === 'object' && !Array.isArray(value)
  ? value as Record<string, any> : {};
const present = (row: SystemSetting) => ({ _id: row.id, id: row.id,
  general: row.general, security: { ...object(row.security), apiKeys: { groq: '', stripe: '', adzunaId: '', adzunaKey: '' } },
  ai: row.ai, storage: { ...object(row.storage),
    cloudinary: { ...object(object(row.storage).cloudinary), apiKey: '', apiSecret: '' },
    aws: { ...object(object(row.storage).aws), accessKey: '', secretKey: '' } },
  featureFlags: row.featureFlags, createdAt: row.createdAt, updatedAt: row.updatedAt,
});
const getOrCreate = () => prisma.systemSetting.upsert({ where: { singletonKey: 'system' }, update: {},
  create: { singletonKey: 'system', general: defaults.general, security: defaults.security,
    ai: defaults.ai, storage: defaults.storage, featureFlags: defaults.featureFlags } });

export const getSettings = async (_req: Request, res: Response) => {
  res.json({ success: true, settings: present(await getOrCreate()) });
};

export const saveSettings = async (req: Request, res: Response, next: NextFunction) => {
  const old = await getOrCreate();
  const general = { ...defaults.general, ...object(old.general) };
  const security = { ...defaults.security, ...object(old.security) };
  const ai = { ...defaults.ai, ...object(old.ai) };
  const storage = { ...defaults.storage, ...object(old.storage) };
  const featureFlags = { ...defaults.featureFlags, ...object(old.featureFlags) };
  const body = object(req.body);
  for (const field of ['appName', 'logo', 'theme', 'maintenanceMode', 'supportEmail', 'supportPhone']) {
    if (object(body.general)[field] !== undefined) general[field] = object(body.general)[field];
  }
  if (body.general?.socialLinks) general.socialLinks = { ...general.socialLinks,
    ...Object.fromEntries(Object.entries(object(body.general.socialLinks)).filter(([key]) =>
      ['github', 'twitter', 'linkedin'].includes(key))) };
  const rates = object(body.security?.rateLimits);
  if (rates.windowMs !== undefined || rates.maxRequests !== undefined) {
    security.rateLimits = { ...object(security.rateLimits),
      ...(rates.windowMs !== undefined && { windowMs: Number(rates.windowMs) }),
      ...(rates.maxRequests !== undefined && { maxRequests: Number(rates.maxRequests) }) };
  }
  for (const field of ['model', 'temperature', 'maxTokens']) if (object(body.ai)[field] !== undefined) ai[field] = object(body.ai)[field];
  for (const field of ['enableJobs', 'enableScraper', 'enableATS', 'enableCoach']) {
    if (object(body.featureFlags)[field] !== undefined) featureFlags[field] = Boolean(object(body.featureFlags)[field]);
  }
  if (!['dark', 'light', 'custom'].includes(general.theme) || !Number.isFinite(Number(ai.temperature)) ||
    Number(ai.temperature) < 0 || Number(ai.temperature) > 2 || !Number.isInteger(Number(ai.maxTokens)) ||
    Number(ai.maxTokens) < 1 || Number(ai.maxTokens) > 8192) {
    return next(new AppError('Invalid settings values.', 400));
  }
  // Secrets are managed through environment variables, not API settings.
  const sanitizedSecurity = { rateLimits: security.rateLimits };
  const sanitizedStorage = { provider: storage.provider,
    cloudinary: { cloudName: object(storage.cloudinary).cloudName || '' },
    aws: { bucket: object(storage.aws).bucket || '', region: object(storage.aws).region || '' } };
  const row = await prisma.systemSetting.update({ where: { id: old.id }, data: {
    general: general as Prisma.InputJsonValue, security: sanitizedSecurity as Prisma.InputJsonValue,
    ai: ai as Prisma.InputJsonValue, storage: sanitizedStorage as Prisma.InputJsonValue,
    featureFlags: featureFlags as Prisma.InputJsonValue,
  } });
  res.json({ success: true, settings: present(row) });
};
