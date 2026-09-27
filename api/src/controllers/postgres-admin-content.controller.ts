import type { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import prisma from '../config/prisma';
import AppError from '../utils/app-error';
import { deletePostgresResume } from '../services/postgres-resume-deletion';

const paging = (req: Request) => {
  const page = Math.max(1, Number.parseInt(String(req.query.page || 1), 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(String(req.query.limit || 20), 10) || 20));
  return { page, limit, skip: (page - 1) * limit };
};
const person = (u: { id: string; displayName: string; email: string }) => ({ _id: u.id, name: u.displayName, email: u.email });
export const getAllInterviews = async (req: Request, res: Response) => {
  const { page, limit, skip } = paging(req);
  const [rows, total] = await Promise.all([prisma.interview.findMany({ orderBy: { createdAt: 'desc' },
    skip, take: limit, include: { user: { select: { id: true, displayName: true, email: true } } } }),
  prisma.interview.count()]);
  res.json({ success: true, data: { interviews: rows.map(row => ({ ...row, _id: row.id, userId: person(row.user) })),
    total, page, pages: Math.ceil(total / limit) } });
};
export const deleteInterview = async (req: Request, res: Response, next: NextFunction) => {
  const id = String(req.params.id);
  try { await prisma.$transaction(async tx => {
    await tx.usageLedgerEntry.updateMany({ where: { interviewId: id }, data: { interviewId: null } });
    await tx.session.deleteMany({ where: { interviewId: id } });
    await tx.interview.delete({ where: { id } });
  }); res.json({ success: true, message: 'Interview and its sessions deleted.' }); }
  catch (error) { if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025')
    return next(new AppError('Interview not found.', 404)); return next(error); }
};
export const getAllSessions = async (req: Request, res: Response) => {
  const { page, limit, skip } = paging(req);
  const [rows, total] = await Promise.all([prisma.session.findMany({ orderBy: { createdAt: 'desc' },
    skip, take: limit, include: { user: { select: { id: true, displayName: true, email: true } },
      interview: { select: { id: true, jobTitle: true, company: true } } } }), prisma.session.count()]);
  res.json({ success: true, data: { sessions: rows.map(row => ({ ...row, _id: row.id,
    userId: person(row.user), interviewId: { ...row.interview, _id: row.interview.id } })),
    total, page, pages: Math.ceil(total / limit) } });
};
export const deleteSession = async (req: Request, res: Response, next: NextFunction) => {
  try { await prisma.session.delete({ where: { id: String(req.params.id) } });
    res.json({ success: true, message: 'Session deleted.' }); }
  catch (error) { if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025')
    return next(new AppError('Session not found.', 404)); return next(error); }
};
export const getAllResumes = async (req: Request, res: Response) => {
  const { page, limit, skip } = paging(req);
  const [rows, total] = await Promise.all([prisma.resume.findMany({ where: { deletedAt: null },
    orderBy: { createdAt: 'desc' }, skip, take: limit,
    include: { user: { select: { id: true, displayName: true, email: true } } } }),
  prisma.resume.count({ where: { deletedAt: null } })]);
  res.json({ success: true, data: { resumes: rows.map(row => ({ ...row, _id: row.id,
    userId: person(row.user), publicId: row.storageKey, fileSize: row.sizeBytes })),
    total, page, pages: Math.ceil(total / limit) } });
};
export const deleteResume = async (req: Request, res: Response, next: NextFunction) => {
  try { await deletePostgresResume(String(req.params.id)); }
  catch (error) { return next(error); }
  res.json({ success: true, message: 'Resume deleted.' });
};
