import type { Request, Response, NextFunction } from 'express';
/**
 * controllers/adminTemplate.controller.js
 *
 * CRUD actions for interview templates.
 * Allows managing prompt triggers, languages, and voice settings.
 */

import InterviewTemplate from '../models/interview-template.model';
import AppError from '../utils/app-error';
// ─── POST /api/admin/templates ─────────────────────────────────────
export const createTemplate = async (req: Request, res: Response, next: NextFunction) => {
  const {
    name, difficulty, duration, questionCount, systemPrompt,
    evaluationPrompt, feedbackPrompt, voiceId, voiceSpeed, voicePitch, language
  } = req.body;

  if (!name || !systemPrompt || !evaluationPrompt || !feedbackPrompt) {
    return next(new AppError('Template name and all prompts are required.', 400));
  }

  const template = await InterviewTemplate.create({
    name: name.trim(),
    difficulty: difficulty || 'medium',
    duration: duration || 30,
    questionCount: questionCount || 5,
    systemPrompt,
    evaluationPrompt,
    feedbackPrompt,
    voiceId: voiceId || 'alloy',
    voiceSpeed: voiceSpeed || 1.0,
    voicePitch: voicePitch || 1.0,
    language: language || 'en',
    postedBy: req.admin._id,
  });

  res.status(201).json({ success: true, template });
};

// ─── GET /api/admin/templates ──────────────────────────────────────
export const getAllTemplates = async (req: Request, res: Response) => {
  const page  = parseInt(String(req.query.page))  || 1;
  const limit = parseInt(String(req.query.limit)) || 12;
  const skip  = (page - 1) * limit;
  const search     = req.query.search || '';
  const difficulty = req.query.difficulty;

  const filter = {};
  if (search) {
    // @ts-expect-error TODO(ts-migration): type this site
    filter.name = { $regex: search, $options: 'i' };
  }
  if (difficulty && difficulty !== 'all') {
    // @ts-expect-error TODO(ts-migration): type this site
    filter.difficulty = difficulty;
  }

  const [templates, total] = await Promise.all([
    InterviewTemplate.find(filter)
      .sort('-createdAt')
      .skip(skip)
      .limit(limit)
      .populate({ path: 'postedBy', select: 'name email' }),
    InterviewTemplate.countDocuments(filter),
  ]);

  res.status(200).json({
    success: true,
    data: { templates, total, page, pages: Math.ceil(total / limit) },
  });
};

// ─── GET /api/admin/templates/:id ──────────────────────────────────
export const getTemplateById = async (req: Request, res: Response, next: NextFunction) => {
  const template = await InterviewTemplate.findById(req.params.id)
    .populate({ path: 'postedBy', select: 'name email' });
  if (!template) return next(new AppError('Template not found.', 404));
  res.status(200).json({ success: true, template });
};

// ─── PATCH /api/admin/templates/:id ────────────────────────────────
export const updateTemplate = async (req: Request, res: Response, next: NextFunction) => {
  const {
    name, difficulty, duration, questionCount, systemPrompt,
    evaluationPrompt, feedbackPrompt, voiceId, voiceSpeed, voicePitch, language
  } = req.body;

  const template = await InterviewTemplate.findById(req.params.id);
  if (!template) return next(new AppError('Template not found.', 404));

  const allowedFields = {};
    // @ts-expect-error TODO(ts-migration): type this site
  if (name !== undefined)             allowedFields.name             = name.trim();
    // @ts-expect-error TODO(ts-migration): type this site
  if (difficulty !== undefined)       allowedFields.difficulty       = difficulty;
    // @ts-expect-error TODO(ts-migration): type this site
  if (duration !== undefined)         allowedFields.duration         = duration;
    // @ts-expect-error TODO(ts-migration): type this site
  if (questionCount !== undefined)    allowedFields.questionCount    = questionCount;
    // @ts-expect-error TODO(ts-migration): type this site
  if (systemPrompt !== undefined)     allowedFields.systemPrompt     = systemPrompt;
    // @ts-expect-error TODO(ts-migration): type this site
  if (evaluationPrompt !== undefined) allowedFields.evaluationPrompt = evaluationPrompt;
    // @ts-expect-error TODO(ts-migration): type this site
  if (feedbackPrompt !== undefined)   allowedFields.feedbackPrompt   = feedbackPrompt;
    // @ts-expect-error TODO(ts-migration): type this site
  if (voiceId !== undefined)          allowedFields.voiceId          = voiceId;
    // @ts-expect-error TODO(ts-migration): type this site
  if (voiceSpeed !== undefined)       allowedFields.voiceSpeed       = voiceSpeed;
    // @ts-expect-error TODO(ts-migration): type this site
  if (voicePitch !== undefined)       allowedFields.voicePitch       = voicePitch;
    // @ts-expect-error TODO(ts-migration): type this site
  if (language !== undefined)         allowedFields.language         = language.trim();

  const updated = await InterviewTemplate.findByIdAndUpdate(req.params.id, allowedFields, {
    new: true, runValidators: true,
  });

  res.status(200).json({ success: true, template: updated });
};

// ─── DELETE /api/admin/templates/:id ───────────────────────────────
export const deleteTemplate = async (req: Request, res: Response, next: NextFunction) => {
  const template = await InterviewTemplate.findByIdAndDelete(req.params.id);
  if (!template) return next(new AppError('Template not found.', 404));
  res.status(200).json({ success: true, message: 'Interview template deleted.' });
};
