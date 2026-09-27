import type { Request, Response, NextFunction } from 'express';
import { Prisma, type SystemPrompt } from '@prisma/client';
import prisma from '../config/prisma';
import AppError from '../utils/app-error';

const defaults = [
  { category: 'interview', name: 'Interview Conversation Follow-Up',
    description: 'Virtual interviewer follow-up and speech formatting.',
    content: 'Act as an AI interviewer. Provide a brief, conversational 1-3 sentence follow-up based only on the candidate answer. Do not return JSON.' },
  { category: 'resume_parser', name: 'Structured Resume & JD Extractor',
    description: 'Parses candidate files and job descriptions into structured data.',
    content: 'Extract name, skills, experience, projects and education from the resume; role, required and preferred skills, and responsibilities from the job description. Return strict JSON. Do not hallucinate.' },
  { category: 'ats_scorer', name: 'Candidate Alignment Match Scorer',
    description: 'Scores alignment between a candidate and a job.',
    content: 'Evaluate the resume against the job description. Return strict JSON with score out of 100, matchingSkills, missingSkills and suggestion.' },
  { category: 'career_coach', name: 'Interactive Career Coach Advice',
    description: 'Career guidance based on candidate progress.',
    content: 'Analyze the candidate resume and interview performance and provide specific career guidance without inventing experience.' },
  { category: 'job_recommendation', name: 'Platform Job Recommendations',
    description: 'Explains matching job openings.',
    content: 'Match candidate skills to available listings and return grounded reasons for each recommendation in JSON.' },
  { category: 'feedback_report', name: 'Interview Session Final Report Evaluator',
    description: 'Summarizes interview scores and actionable feedback.',
    content: 'Evaluate answers for technical depth and communication. Return structured JSON with scores, strongPoints, weakPoints and detailedFeedback.' },
];
const include = { lastUpdatedBy: { select: { id: true, displayName: true, email: true } } } as const;
type Loaded = SystemPrompt & { lastUpdatedBy?: { id: string; displayName: string; email: string } | null };
const present = (row: Loaded) => ({ ...row, _id: row.id,
  lastUpdatedBy: row.lastUpdatedBy ? { _id: row.lastUpdatedBy.id,
    name: row.lastUpdatedBy.displayName, email: row.lastUpdatedBy.email } : null,
});
const historyOf = (row: SystemPrompt) => Array.isArray(row.history) ? row.history as Array<Record<string, any>> : [];

async function seedDefaults() {
  for (const item of defaults) await prisma.systemPrompt.upsert({ where: { category: item.category },
    update: {}, create: { ...item, version: 1, history: [{ version: 1, content: item.content,
      changeReason: 'Seed Default Preset' }] } });
}

export const getAllPrompts = async (_req: Request, res: Response) => {
  await seedDefaults();
  const rows = await prisma.systemPrompt.findMany({ include, orderBy: { name: 'asc' } });
  res.json({ success: true, data: rows.map(present) });
};

export const getPromptById = async (req: Request, res: Response, next: NextFunction) => {
  const row = await prisma.systemPrompt.findUnique({ where: { id: String(req.params.id) }, include });
  if (!row) return next(new AppError('Prompt category not found.', 404));
  res.json({ success: true, prompt: present(row) });
};

export const updatePrompt = async (req: Request, res: Response, next: NextFunction) => {
  const content = req.body.content;
  if (typeof content !== 'string' || !content.trim() || content.length > 20000) {
    return next(new AppError('Prompt content cannot be empty.', 400));
  }
  const id = String(req.params.id);
  const updated = await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "SystemPrompt" WHERE id = ${id}::uuid FOR UPDATE`;
    const row = await tx.systemPrompt.findUnique({ where: { id } });
    if (!row) return null;
    const history = [...historyOf(row), { version: row.version, content: row.content,
      changeReason: String(req.body.changeReason || 'Modified via Prompt Editor').slice(0, 200),
      updatedBy: String(req.admin?.id || req.admin?._id), updatedAt: new Date().toISOString() }];
    return tx.systemPrompt.update({ where: { id }, data: { content: content.trim(), version: { increment: 1 },
      lastUpdatedById: String(req.admin?.id || req.admin?._id), history: history as Prisma.InputJsonValue }, include });
  });
  if (!updated) return next(new AppError('Prompt category not found.', 404));
  res.json({ success: true, prompt: present(updated) });
};

export const restorePromptVersion = async (req: Request, res: Response, next: NextFunction) => {
  const targetVersion = Number(req.body.targetVersion);
  if (!Number.isSafeInteger(targetVersion) || targetVersion < 1) return next(new AppError('Target version number is required.', 400));
  const id = String(req.params.id);
  const result = await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "SystemPrompt" WHERE id = ${id}::uuid FOR UPDATE`;
    const row = await tx.systemPrompt.findUnique({ where: { id } });
    if (!row) return { error: new AppError('Prompt category not found.', 404) };
    if (row.version === targetVersion) return { error: new AppError('Target version is already the active version.', 400) };
    const history = historyOf(row);
    const target = history.find(item => Number(item.version) === targetVersion);
    if (!target || typeof target.content !== 'string') return { error: new AppError('Specified version not found in history logs.', 404) };
    history.push({ version: row.version, content: row.content,
      changeReason: `Reverted active prompt back to version v${targetVersion}`,
      updatedBy: String(req.admin?.id || req.admin?._id), updatedAt: new Date().toISOString() });
    return { row: await tx.systemPrompt.update({ where: { id }, data: {
      content: target.content, version: { increment: 1 }, history: history as Prisma.InputJsonValue,
      lastUpdatedById: String(req.admin?.id || req.admin?._id),
    }, include }) };
  });
  if ('error' in result) return next(result.error);
  res.json({ success: true,
    message: `Successfully restored prompt to version v${targetVersion}. Current active version is now v${result.row.version}`,
    prompt: present(result.row) });
};
