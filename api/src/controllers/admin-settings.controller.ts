import type { Request, Response, NextFunction } from 'express';
/**
 * controllers/adminSettings.controller.js
 *
 * Implements Platform Global Settings Configurations.
 * Saves and updates AI model configs, Storage providers, JWT expiries and Module Feature Flags.
 */

import SystemSetting from '../models/system-setting.model';
import AppError from '../utils/app-error';
// Fetch settings (with auto-seed fallback)
const getOrCreateSettings = async () => {
  let settings = await SystemSetting.findOne();
  if (!settings) {
    settings = await SystemSetting.create({
      general: {
        appName: 'Rehearsly',
        logo: '',
        theme: 'dark',
        maintenanceMode: false,
        supportEmail: 'support@interviewmaster.com',
        supportPhone: '+1 (555) 019-2834',
        socialLinks: { github: '', twitter: '', linkedin: '' },
      },
      security: {
        jwtExpiry: '7d',
        apiKeys: { groq: '', stripe: '', adzunaId: '', adzunaKey: '' },
        rateLimits: { windowMs: 15 * 60 * 1000, maxRequests: 100 },
      },
      ai: {
        model: 'llama-3.3-70b-versatile',
        temperature: 0.5,
        maxTokens: 1024,
      },
      storage: {
        provider: 'cloudinary',
        cloudinary: { cloudName: '', apiKey: '', apiSecret: '' },
        aws: { bucket: '', region: '', accessKey: '', secretKey: '' },
      },
      featureFlags: {
        enableJobs: true,
        enableScraper: true,
        enableATS: true,
        enableCoach: true,
      },
    });
  }
  return settings;
};

const safeSettings = (settings: any) => {
  const value = settings.toObject();
  value.security.apiKeys = { groq: '', stripe: '', adzunaId: '', adzunaKey: '' };
  value.storage.cloudinary.apiKey = '';
  value.storage.cloudinary.apiSecret = '';
  value.storage.aws.accessKey = '';
  value.storage.aws.secretKey = '';
  return value;
};

// ─── GET /api/admin/settings ───────────────────────────────────────
export const getSettings = async (req: Request, res: Response) => {
  const settings = await getOrCreateSettings();
  res.status(200).json({ success: true, settings: safeSettings(settings) });
};

// ─── PATCH /api/admin/settings ─────────────────────────────────────
export const saveSettings = async (req: Request, res: Response) => {
  const settings = await getOrCreateSettings();

  const { general, security, ai, featureFlags } = req.body;

  // Merge general settings
  if (general) {
    if (general.appName !== undefined)         settings.general.appName         = general.appName;
    if (general.logo !== undefined)            settings.general.logo            = general.logo;
    if (general.theme !== undefined)           settings.general.theme           = general.theme;
    if (general.maintenanceMode !== undefined)  settings.general.maintenanceMode  = general.maintenanceMode;
    if (general.supportEmail !== undefined)    settings.general.supportEmail    = general.supportEmail;
    if (general.supportPhone !== undefined)    settings.general.supportPhone    = general.supportPhone;
    if (general.socialLinks) {
      if (general.socialLinks.github !== undefined)   settings.general.socialLinks.github   = general.socialLinks.github;
      if (general.socialLinks.twitter !== undefined)   settings.general.socialLinks.twitter   = general.socialLinks.twitter;
      if (general.socialLinks.linkedin !== undefined)  settings.general.socialLinks.linkedin  = general.socialLinks.linkedin;
    }
  }

  // Merge security configs
  if (security) {
    if (security.jwtExpiry !== undefined) settings.security.jwtExpiry = security.jwtExpiry;
    if (security.rateLimits) {
      if (security.rateLimits.windowMs !== undefined)    settings.security.rateLimits.windowMs    = security.rateLimits.windowMs;
      if (security.rateLimits.maxRequests !== undefined) settings.security.rateLimits.maxRequests = security.rateLimits.maxRequests;
    }
  }

  // Merge AI parameters
  if (ai) {
    if (ai.model !== undefined)       settings.ai.model       = ai.model;
    if (ai.temperature !== undefined) settings.ai.temperature = parseFloat(ai.temperature) || 0.5;
    if (ai.maxTokens !== undefined)   settings.ai.maxTokens   = parseInt(ai.maxTokens) || 1024;
  }

  // Merge Feature Flags
  if (featureFlags) {
    if (featureFlags.enableJobs !== undefined)    settings.featureFlags.enableJobs    = featureFlags.enableJobs;
    if (featureFlags.enableScraper !== undefined) settings.featureFlags.enableScraper = featureFlags.enableScraper;
    if (featureFlags.enableATS !== undefined)     settings.featureFlags.enableATS     = featureFlags.enableATS;
    if (featureFlags.enableCoach !== undefined)   settings.featureFlags.enableCoach   = featureFlags.enableCoach;
  }

  await settings.save();

  res.status(200).json({ success: true, settings: safeSettings(settings) });
};
