import type { Request, Response, NextFunction } from 'express';
import User from '../../models/user.model';
import Interview from '../../models/interview.model';
import Session from '../../models/session.model';
import Resume from '../../models/resume.model';
import Job from '../../models/job.model';
import Transaction from '../../models/transaction.model';
import AuditLog from '../../models/audit-log.model';
import AppError from '../../utils/app-error';
const ADMIN_EMAIL = 'admin@interviewmaster.com';
const ADMIN_ROLES = ['admin', 'super_admin'];


// ─── GET /api/admin/interviews ─────────────────────────────────────
export const getAllInterviews = async (req: Request, res: Response) => {
  const page  = parseInt(String(req.query.page))  || 1;
  const limit = parseInt(String(req.query.limit)) || 20;
  const skip  = (page - 1) * limit;

  const [interviews, total] = await Promise.all([
    Interview.find()
      .sort('-createdAt')
      .skip(skip)
      .limit(limit)
      .populate({ path: 'userId', select: 'name email' }),
    Interview.countDocuments(),
  ]);

  res.status(200).json({
    success: true,
    data: { interviews, total, page, pages: Math.ceil(total / limit) },
  });
};

// ─── DELETE /api/admin/interviews/:id ──────────────────────────────
export const deleteInterview = async (req: Request, res: Response, next: NextFunction) => {
  const interview = await Interview.findById(req.params.id);
  if (!interview) return next(new AppError('Interview not found.', 404));

  await Promise.all([
    Session.deleteMany({ interviewId: interview._id }),
    interview.deleteOne(),
  ]);

  res.status(200).json({ success: true, message: 'Interview and its sessions deleted.' });
};

// ─── GET /api/admin/sessions ───────────────────────────────────────
export const getAllSessions = async (req: Request, res: Response) => {
  const page  = parseInt(String(req.query.page))  || 1;
  const limit = parseInt(String(req.query.limit)) || 20;
  const skip  = (page - 1) * limit;

  const [sessions, total] = await Promise.all([
    Session.find()
      .sort('-createdAt')
      .skip(skip)
      .limit(limit)
      .populate({ path: 'userId',      select: 'name email' })
      .populate({ path: 'interviewId', select: 'jobTitle company' }),
    Session.countDocuments(),
  ]);

  res.status(200).json({
    success: true,
    data: { sessions, total, page, pages: Math.ceil(total / limit) },
  });
};

// ─── DELETE /api/admin/sessions/:id ───────────────────────────────
export const deleteSession = async (req: Request, res: Response, next: NextFunction) => {
  const session = await Session.findByIdAndDelete(req.params.id);
  if (!session) return next(new AppError('Session not found.', 404));

  res.status(200).json({ success: true, message: 'Session deleted.' });
};

// ─── GET /api/admin/resumes ────────────────────────────────────────
export const getAllResumes = async (req: Request, res: Response) => {
  const page  = parseInt(String(req.query.page))  || 1;
  const limit = parseInt(String(req.query.limit)) || 20;
  const skip  = (page - 1) * limit;

  const [resumes, total] = await Promise.all([
    Resume.find()
      .sort('-createdAt')
      .skip(skip)
      .limit(limit)
      .populate({ path: 'userId', select: 'name email' }),
    Resume.countDocuments(),
  ]);

  res.status(200).json({
    success: true,
    data: { resumes, total, page, pages: Math.ceil(total / limit) },
  });
};

// ─── DELETE /api/admin/resumes/:id ────────────────────────────────
export const deleteResume = async (req: Request, res: Response, next: NextFunction) => {
  const resume = await Resume.findByIdAndDelete(req.params.id);
  if (!resume) return next(new AppError('Resume not found.', 404));

  res.status(200).json({ success: true, message: 'Resume deleted.' });
};

