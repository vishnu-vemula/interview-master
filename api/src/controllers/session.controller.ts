import type { Request, Response, NextFunction } from 'express';
import Session from '../models/session.model';
import Interview from '../models/interview.model';
import User from '../models/user.model';
import AppError from '../utils/app-error';
import { evaluateAnswer, generateOverallFeedback } from '../services/ai.service';

// ─── POST /api/sessions/start ─────────────────────────────────────
export const startSession = async (req: Request, res: Response, next: NextFunction) => {
  const { interviewId } = req.body;

  const interview = await Interview.findOne({ _id: interviewId, userId: req.user._id });
  if (!interview) return next(new AppError('Interview not found.', 404));

  // Allow start if status is 'ready' OR if questions were generated despite a stale status
  const hasQuestions = interview.questions && interview.questions.length > 0;
  if (!hasQuestions) {
    return next(new AppError('Interview questions have not been generated yet.', 400));
  }

  // Check for existing in-progress session
  const existingSession = await Session.findOne({
    userId: req.user._id,
    interviewId,
    status: { $in: ['started', 'in_progress'] },
  });

  if (existingSession) {
    return res.status(200).json({ success: true, session: existingSession, resumed: true });
  }

  interview.status = 'in_progress';
  await interview.save();

  const session = await Session.create({
    userId: req.user._id,
    interviewId,
    answers: [],
    status: 'started',
    startedAt: new Date(),
  });

  res.status(201).json({ success: true, session, interview });
};

// ─── POST /api/sessions/:id/answer ────────────────────────────────
export const submitAnswer = async (req: Request, res: Response, next: NextFunction) => {
  const { questionId, answerText, timeTaken, skipped } = req.body;

  const session = await Session.findOne({
    _id: req.params.id,
    userId: req.user._id,
    status: { $in: ['started', 'in_progress'] },
  });

  if (!session) return next(new AppError('Active session not found.', 404));

  const interview = await Interview.findById(session.interviewId);
  const question = interview.questions.id(questionId);
  if (!question) return next(new AppError('Question not found in interview.', 404));

  // Check if already answered
  const existing = session.answers.find((a) => a.questionId.toString() === questionId);
  if (existing) {
    existing.answerText = answerText;
    existing.timeTaken = timeTaken;
    existing.skipped = skipped;
  } else {
    session.answers.push({
      questionId,
      questionText: question.questionText,
      answerText: answerText || '',
      timeTaken: timeTaken || 0,
      skipped: skipped || false,
    });
  }

  session.status = 'in_progress';
  await session.save();

  res.status(200).json({ success: true, message: 'Answer saved.', session });
};

// ─── POST /api/sessions/:id/complete ─────────────────────────────
export const completeSession = async (req: Request, res: Response, next: NextFunction) => {
  const session = await Session.findOne({
    _id: req.params.id,
    userId: req.user._id,
    status: { $in: ['started', 'in_progress'] },
  });

  if (!session) return next(new AppError('Active session not found.', 404));

  const interview = await Interview.findById(session.interviewId);

  // ── AI Evaluate each answer ────────────────────────────────────
  const evaluationPromises = session.answers.map(async (answer) => {
    if (answer.skipped || !answer.answerText) {
      answer.aiScore = 0;
      answer.aiFeedback = 'Question was skipped.';
      return;
    }
    try {
      const result = await evaluateAnswer({
        questionText: answer.questionText,
        answerText: answer.answerText,
        expectedKeywords: interview.questions.id(answer.questionId)?.expectedKeywords || [],
        jobTitle: interview.jobTitle,
      });
      answer.aiScore = result.score ?? 0;
      answer.aiFeedback = result.feedback ?? '';
    } catch {
      answer.aiScore = 0;
      answer.aiFeedback = 'Evaluation unavailable.';
    }
  });

  await Promise.all(evaluationPromises);

  // ── Generate overall feedback ──────────────────────────────────
  let overallData = {};
  try {
    overallData = await generateOverallFeedback({
      jobTitle: interview.jobTitle,
      answers: session.answers,
    });
  } catch {
    overallData = {};
  }

  // ── Finalize session ──────────────────────────────────────────
    // @ts-expect-error TODO(ts-migration): type this site
  const overallScore = overallData.overallScore ?? session.calculateOverallScore();
  session.overallScore = overallScore;
    // @ts-expect-error TODO(ts-migration): type this site
  session.overallFeedback = overallData.improvementTips?.join(' ') ?? '';
    // @ts-expect-error TODO(ts-migration): type this site
  session.strengths = overallData.strengths ?? [];
    // @ts-expect-error TODO(ts-migration): type this site
  session.areasForImprovement = overallData.weaknesses ?? [];
    // @ts-expect-error TODO(ts-migration): type this site
  session.recommendedResources = overallData.improvementTips ?? [];
  session.status = 'completed';
  session.completedAt = new Date();
  session.totalTimeTaken = session.answers.reduce((s, a) => s + (a.timeTaken || 0), 0);

  await session.save();

  // Update interview status and user's total sessions
  interview.status = 'completed';
  await interview.save();

  await User.findByIdAndUpdate(req.user._id, { $inc: { totalSessions: 1 } });

  res.status(200).json({ success: true, session });
};

// ─── GET /api/sessions ────────────────────────────────────────────
export const getMySessions = async (req: Request, res: Response) => {
  const page = parseInt(String(req.query.page)) || 1;
  const limit = parseInt(String(req.query.limit)) || 10;
  const skip = (page - 1) * limit;

  const [sessions, total] = await Promise.all([
    Session.find({ userId: req.user._id })
      .sort('-createdAt')
      .skip(skip)
      .limit(limit)
      .populate({ path: 'interviewId', select: 'jobTitle company experienceLevel' })
      .select('-answers'),
    Session.countDocuments({ userId: req.user._id }),
  ]);

  res.status(200).json({
    success: true,
    count: sessions.length,
    total,
    page,
    totalPages: Math.ceil(total / limit),
    sessions,
  });
};

// ─── GET /api/sessions/:id ────────────────────────────────────────
export const getSessionById = async (req: Request, res: Response, next: NextFunction) => {
  const session = await Session.findOne({ _id: req.params.id, userId: req.user._id })
    .populate({ path: 'interviewId', select: 'jobTitle company experienceLevel questions' });

  if (!session) return next(new AppError('Session not found.', 404));
  res.status(200).json({ success: true, session });
};
