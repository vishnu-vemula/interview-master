import type { Request, Response, NextFunction } from 'express';
import { Prisma, type InterviewTemplate } from '@prisma/client';
import prisma from '../config/prisma';
import AppError from '../utils/app-error';

const include = { postedBy: { select: { id: true, displayName: true, email: true } } } as const;
const present = (row: InterviewTemplate & { postedBy?: { id: string; displayName: string; email: string } | null }) => ({
  ...row, _id: row.id, postedBy: row.postedBy ? { _id: row.postedBy.id,
    name: row.postedBy.displayName, email: row.postedBy.email } : null,
});
const editable = ['name', 'difficulty', 'duration', 'questionCount', 'systemPrompt', 'evaluationPrompt',
  'feedbackPrompt', 'voiceId', 'voiceSpeed', 'voicePitch', 'language'] as const;

export const createTemplate = async (req: Request, res: Response, next: NextFunction) => {
  const { name, systemPrompt, evaluationPrompt, feedbackPrompt } = req.body;
  if (![name, systemPrompt, evaluationPrompt, feedbackPrompt].every(value => typeof value === 'string' && value.trim())) {
    return next(new AppError('Template name and all prompts are required.', 400));
  }
  const row = await prisma.interviewTemplate.create({ data: {
    name: name.trim(), systemPrompt, evaluationPrompt, feedbackPrompt,
    difficulty: String(req.body.difficulty || 'medium'), duration: Number(req.body.duration || 30),
    questionCount: Number(req.body.questionCount || 5), voiceId: String(req.body.voiceId || 'alloy'),
    voiceSpeed: Number(req.body.voiceSpeed || 1), voicePitch: Number(req.body.voicePitch || 1),
    language: String(req.body.language || 'en'), postedById: String(req.admin?.id || req.admin?._id),
  }, include });
  res.status(201).json({ success: true, template: present(row) });
};

export const getAllTemplates = async (req: Request, res: Response) => {
  const page = Math.max(1, Number.parseInt(String(req.query.page), 10) || 1);
  const limit = Math.max(1, Math.min(100, Number.parseInt(String(req.query.limit), 10) || 12));
  const where: Prisma.InterviewTemplateWhereInput = {};
  if (req.query.search) where.name = { contains: String(req.query.search).slice(0, 100), mode: 'insensitive' };
  if (req.query.difficulty && req.query.difficulty !== 'all') where.difficulty = String(req.query.difficulty);
  const [rows, total] = await Promise.all([
    prisma.interviewTemplate.findMany({ where, include, orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit, take: limit }),
    prisma.interviewTemplate.count({ where }),
  ]);
  res.json({ success: true, data: { templates: rows.map(present), total, page, pages: Math.ceil(total / limit) } });
};

export const getTemplateById = async (req: Request, res: Response, next: NextFunction) => {
  const row = await prisma.interviewTemplate.findUnique({ where: { id: String(req.params.id) }, include });
  if (!row) return next(new AppError('Template not found.', 404));
  res.json({ success: true, template: present(row) });
};

export const updateTemplate = async (req: Request, res: Response, next: NextFunction) => {
  const id = String(req.params.id);
  if (!await prisma.interviewTemplate.findUnique({ where: { id } })) return next(new AppError('Template not found.', 404));
  const data: Prisma.InterviewTemplateUpdateInput = {};
  for (const field of editable) if (req.body[field] !== undefined) (data as any)[field] = req.body[field];
  if (typeof data.name === 'string') data.name = data.name.trim();
  if (typeof data.language === 'string') data.language = data.language.trim();
  const row = await prisma.interviewTemplate.update({ where: { id }, data, include });
  res.json({ success: true, template: present(row) });
};

export const deleteTemplate = async (req: Request, res: Response, next: NextFunction) => {
  const id = String(req.params.id);
  if (!await prisma.interviewTemplate.findUnique({ where: { id } })) return next(new AppError('Template not found.', 404));
  await prisma.interviewTemplate.delete({ where: { id } });
  res.json({ success: true, message: 'Interview template deleted.' });
};
