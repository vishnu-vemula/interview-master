import type { Request, Response, NextFunction } from 'express';
import Interview from '../models/interview.model';
import Resume from '../models/resume.model';
import Session from '../models/session.model';
import AppError from '../utils/app-error';
import { generateInterviewQuestions } from '../services/ai.service';
import { reserveGeneration, commitGeneration, releaseGeneration } from '../services/billing/entitlements';

// ─── POST /api/interviews ─────────────────────────────────────────
export const createInterview = async (req: Request, res: Response, next: NextFunction) => {
  const {
    jobTitle,
    jobDescription,
    company,
    experienceLevel,
    questionTypes,
    numberOfQuestions,
    resumeId,
  } = req.body;

  if (resumeId && !await Resume.exists({ _id: resumeId, userId: req.user._id })) {
    return next(new AppError('Resume not found.', 404));
  }
  const interview = await Interview.create({
    userId: req.user._id,
    jobTitle,
    jobDescription,
    company,
    experienceLevel,
    questionTypes,
    numberOfQuestions,
    resumeId: resumeId || null,
    status: 'draft',
    generationStatus: 'pending',
  });

  res.status(201).json({ success: true, interview });
};

// ─── POST /api/interviews/:id/generate ────────────────────────────
export const generateQuestions = async (req: Request, res: Response, next: NextFunction) => {
  const interview = await Interview.findOne({ _id: req.params.id, userId: req.user._id });
  if (!interview) return next(new AppError('Interview not found.', 404));

  if (interview.generationStatus === 'generated' && interview.questions.length > 0) {
    return res.status(200).json({ success: true, interview, message: 'Questions already generated.' });
  }

  if (interview.generationStatus === 'generating') {
    return next(new AppError('Questions are already being generated.', 400));
  }

  // Fetch resume text if linked
  let resumeText = null;
  if (interview.resumeId) {
    const resume = await Resume.findById(interview.resumeId).select('extractedText');
    resumeText = resume?.extractedText ?? null;
  }

  const claimed = await Interview.findOneAndUpdate({ _id: interview._id, userId: req.user._id,
    generationStatus: { $in: ['pending', 'failed'] } },
    { $set: { generationStatus: 'generating' } }, { new: true });
  if (!claimed) return next(new AppError('Questions are already being generated.', 409));

  try {
    await reserveGeneration(String(req.user._id), String(interview._id));
    const questions = await generateInterviewQuestions({
      jobTitle: interview.jobTitle,
      jobDescription: interview.jobDescription,
      experienceLevel: interview.experienceLevel,
      numberOfQuestions: interview.numberOfQuestions,
      resumeText,
    });

    // @ts-expect-error TODO(ts-migration): type this site
    interview.questions = questions;
    interview.generationStatus = 'generated';
    interview.status = 'ready';
    await interview.save();
    await commitGeneration(String(interview._id));

    res.status(200).json({
      success: true,
      message: `${questions.length} questions generated successfully.`,
      interview,
    });
  } catch (err: any) {
    await releaseGeneration(String(interview._id));
    interview.generationStatus = 'failed';
    interview.generationError = 'generation_failed';
    await interview.save();
    return next(new AppError(err.message === 'Interview allowance exhausted. Choose a plan to continue.' ? err.message : 'Question generation failed. Please retry.',
      err.message === 'Interview allowance exhausted. Choose a plan to continue.' ? 402 : 503));
  }
};

// ─── GET /api/interviews ──────────────────────────────────────────
export const getMyInterviews = async (req: Request, res: Response) => {
  const page = Math.max(1, Math.min(100000, parseInt(String(req.query.page), 10) || 1));
  const limit = Math.max(1, Math.min(100, parseInt(String(req.query.limit), 10) || 10));
  const skip = (page - 1) * limit;

  const [interviews, total] = await Promise.all([
    Interview.find({ userId: req.user._id })
      .sort('-createdAt')
      .skip(skip)
      .limit(limit)
      .select('-questions'),
    Interview.countDocuments({ userId: req.user._id }),
  ]);

  res.status(200).json({
    success: true,
    count: interviews.length,
    total,
    page,
    totalPages: Math.ceil(total / limit),
    interviews,
  });
};

// ─── GET /api/interviews/:id ──────────────────────────────────────
export const getInterviewById = async (req: Request, res: Response, next: NextFunction) => {
  const interview = await Interview.findOne({ _id: req.params.id, userId: req.user._id })
    .populate({ path: 'resumeId', select: 'originalName' });

  if (!interview) return next(new AppError('Interview not found.', 404));
  res.status(200).json({ success: true, interview });
};

// ─── DELETE /api/interviews/:id ───────────────────────────────────
export const deleteInterview = async (req: Request, res: Response, next: NextFunction) => {
  const interview = await Interview.findOne({ _id: req.params.id, userId: req.user._id });
  if (!interview) return next(new AppError('Interview not found.', 404));
  if (await Session.exists({ interviewId: interview._id, userId: req.user._id })) {
    return next(new AppError('This interview has session history and cannot be deleted.', 409));
  }
  await interview.deleteOne();
  res.status(200).json({ success: true, message: 'Interview deleted.' });
};
