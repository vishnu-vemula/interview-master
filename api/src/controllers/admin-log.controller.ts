import type { Request, Response, NextFunction } from 'express';
/**
 * controllers/adminLog.controller.js
 *
 * Implements Platform Logging and Audit Controllers:
 *  - Serves paginated logs for Auth, Admin settings changes, AI Groq executions, stripe webhooks, scraper status and email dispatchers.
 *  - Auto-seeds descriptive logs if the audit sheets are empty.
 */

import AuditLog from '../models/audit-log.model';
import User from '../models/user.model';
import AppError from '../utils/app-error';
// ─── GET /api/admin/logs ───────────────────────────────────────────
export const getAllLogs = async (req: Request, res: Response) => {

  const page  = parseInt(String(req.query.page))  || 1;
  const limit = parseInt(String(req.query.limit)) || 12;
  const skip  = (page - 1) * limit;
  const search   = req.query.search || '';
  const category = req.query.category;
  const status   = req.query.status;

  const filter = {};

  if (category && category !== 'all') {
    // @ts-expect-error TODO(ts-migration): type this site
    filter.category = category;
  }
  if (status && status !== 'all') {
    // @ts-expect-error TODO(ts-migration): type this site
    filter.status = status;
  }

  if (search) {
    // @ts-expect-error TODO(ts-migration): type this site
    filter.$or = [
      { action:  { $regex: search, $options: 'i' } },
      { details: { $regex: search, $options: 'i' } }
    ];
  }

  const [logs, total] = await Promise.all([
    AuditLog.find(filter)
      .sort('-createdAt')
      .skip(skip)
      .limit(limit)
      .populate({ path: 'userId', select: 'name email' }),
    AuditLog.countDocuments(filter),
  ]);

  res.status(200).json({
    success: true,
    data: { logs, total, page, pages: Math.ceil(total / limit) },
  });
};
