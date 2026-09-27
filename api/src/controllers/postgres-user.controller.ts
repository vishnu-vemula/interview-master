import type { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import prisma from '../config/prisma';
import AppError from '../utils/app-error';
import { presentUser } from '../services/postgres-identity.service';
import { retirePostgresCandidate } from '../services/postgres-account-deletion';
import { verifyFirebaseToken } from '../services/firebase-identity.service';

const ownerId = (req: Request) => String(req.user?.id || req.user?._id || '');

export const getProfile = async (req: Request, res: Response) => {
  const row = await prisma.user.findUniqueOrThrow({ where: { id: ownerId(req) }, include: {
    resumes: { where: { deletedAt: null }, select: { id: true, fileName: true,
      originalName: true, isDefault: true, parseStatus: true, createdAt: true } },
  } });
  res.json({ success: true, user: { ...presentUser(row), resumes: row.resumes.map(item => ({ ...item, _id: item.id })) } });
};

export const updateProfile = async (req: Request, res: Response, next: NextFunction) => {
  if (!validationResult(req).isEmpty()) return next(new AppError('Invalid profile details.', 400));
  const data: { displayName?: string; avatar?: string | null } = {};
  if (req.body.name !== undefined) data.displayName = String(req.body.name).trim();
  if (req.body.avatar !== undefined) data.avatar = req.body.avatar;
  const row = await prisma.user.update({ where: { id: ownerId(req) }, data });
  res.json({ success: true, user: presentUser(row) });
};

export const changePassword = (_req: Request, _res: Response, next: NextFunction) =>
  next(new AppError('Change your password through Firebase Authentication.', 410));

export const getDashboard = async (req: Request, res: Response) => {
  const userId = ownerId(req);
  const [totalSessions, completedSessions, score, recent] = await Promise.all([
    prisma.session.count({ where: { userId } }),
    prisma.session.count({ where: { userId, status: 'completed' } }),
    prisma.session.aggregate({ where: { userId, status: 'completed', overallScore: { not: null } },
      _avg: { overallScore: true }, _max: { overallScore: true } }),
    prisma.session.findMany({ where: { userId, status: 'completed' }, orderBy: { createdAt: 'desc' },
      take: 5, include: { interview: { select: { id: true, jobTitle: true, company: true, experienceLevel: true } } } }),
  ]);
  res.json({ success: true, data: { totalSessions, completedSessions,
    averageScore: score._avg.overallScore?.toFixed(1) ?? 0, bestScore: score._max.overallScore ?? 0,
    recentSessions: recent.map(item => ({ ...item, _id: item.id,
      interviewId: { ...item.interview, _id: item.interview.id } })) } });
};

export const deleteMyAccount = async (req: Request, res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.match(/^Bearer (\S+)$/)?.[1];
  if (!token) return next(new AppError('Identity token required.', 401));
  const decoded = await verifyFirebaseToken(token);
  if (!decoded.auth_time || Date.now() / 1000 - decoded.auth_time > 300) {
    return next(new AppError('Sign in again before deleting your account.', 401));
  }
  await retirePostgresCandidate(ownerId(req), decoded.uid);
  res.json({ success: true, message: 'Account deleted.' });
};
