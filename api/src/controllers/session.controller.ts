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
    status: { $in: ['started', 'in_progress', 'evaluating', 'evaluation_failed'] },
  });

  if (existingSession) {
    if (existingSession.status === 'evaluating') return next(new AppError('Session evaluation is in progress.', 409));
    return res.status(200).json({ success: true, session: existingSession, resumed: true });
  }

  interview.status = 'in_progress';
  await interview.save();

  let session: any;
  try {
    session = await Session.create({
      userId: req.user._id, interviewId, answers: [], status: 'started', startedAt: new Date(),
    });
  } catch (error: any) {
    if (error?.code !== 11000) throw error;
    session = await Session.findOne({ userId: req.user._id, interviewId,
      status: { $in: ['started', 'in_progress', 'evaluation_failed'] } });
    if (!session) return next(new AppError('Session evaluation is in progress.', 409));
    return res.status(200).json({ success: true, session, resumed: true });
  }

  res.status(201).json({ success: true, session, interview });
};

// ─── POST /api/sessions/:id/answer ────────────────────────────────
export const submitAnswer = async (req: Request, res: Response, next: NextFunction) => {
  const { questionId, answerText, timeTaken, skipped } = req.body;

  const session = await Session.findOne({
    _id: req.params.id,
    userId: req.user._id,
    status: { $in: ['started', 'in_progress', 'evaluation_failed'] },
  });

  if (!session) return next(new AppError('Active session not found.', 404));

  const interview = await Interview.findOne({ _id: session.interviewId, userId: req.user._id });
  const question = interview?.questions.id(questionId);
  if (!question) return next(new AppError('Question not found in interview.', 404));

  const activeFilter = { _id: session._id, userId: req.user._id,
    status: { $in: ['started', 'in_progress', 'evaluation_failed'] } };
  const answerUpdate = { $set: { 'answers.$.answerText': answerText || '',
    'answers.$.timeTaken': timeTaken || 0, 'answers.$.skipped': Boolean(skipped),
    'answers.$.followupUsed': false, status: 'in_progress' } };
  let saved: any = await Session.findOneAndUpdate({ ...activeFilter, 'answers.questionId': questionId },
    answerUpdate, { new: true });
  if (!saved) {
    saved = await Session.findOneAndUpdate({ ...activeFilter, 'answers.questionId': { $ne: questionId } },
      { $push: { answers: { questionId, questionText: question.questionText,
        answerText: answerText || '', timeTaken: timeTaken || 0, skipped: Boolean(skipped) } },
      $set: { status: 'in_progress' } }, { new: true });
  }
  if (!saved) saved = await Session.findOneAndUpdate({ ...activeFilter, 'answers.questionId': questionId },
    answerUpdate, { new: true });
  if (!saved) return next(new AppError('Session is no longer accepting answers.', 409));
  res.status(200).json({ success: true, message: 'Answer saved.', session: saved });
};

// ─── POST /api/sessions/:id/complete ─────────────────────────────
export const completeSession = async (req: Request, res: Response, next: NextFunction) => {
  const completed = await Session.findOne({ _id: req.params.id, userId: req.user._id, status: 'completed' });
  if (completed) {
    await Interview.updateOne({ _id: completed.interviewId, userId: req.user._id }, { $set: { status: 'completed' } });
    const count = await Session.countDocuments({ userId: req.user._id, status: 'completed' });
    await User.updateOne({ _id: req.user._id }, { $set: { totalSessions: count } });
    return res.status(200).json({ success: true, session: completed });
  }
  const staleBefore = new Date(Date.now() - 10 * 60_000);
  const session = await Session.findOneAndUpdate({
    _id: req.params.id,
    userId: req.user._id,
    $or: [{ status: { $in: ['started', 'in_progress', 'evaluation_failed'] } },
      { status: 'evaluating', evaluationStartedAt: { $lt: staleBefore } }],
  }, { $set: { status: 'evaluating', evaluationStartedAt: new Date() } }, { new: true });

  if (!session) return next(new AppError('Session evaluation is already in progress.', 409));

  const interview = await Interview.findById(session.interviewId);
  if (!interview || String(interview.userId) !== String(req.user._id)) {
    session.status = 'evaluation_failed';
    session.evaluationStartedAt = null;
    await session.save();
    return next(new AppError('Interview not found.', 404));
  }

  try {
    await Promise.all(session.answers.map(async (answer) => {
      if (answer.skipped || !answer.answerText) {
        answer.aiScore = 0;
        answer.aiFeedback = 'Question was skipped.';
        return;
      }
      const result = await evaluateAnswer({
        questionText: answer.questionText, answerText: answer.answerText,
        expectedKeywords: interview.questions.id(answer.questionId)?.expectedKeywords || [],
        jobTitle: interview.jobTitle,
      });
      if (!Number.isFinite(result.score) || result.score < 0 || result.score > 10) throw new Error('Invalid evaluation');
      answer.aiScore = result.score;
      answer.aiFeedback = result.feedback || '';
    }));
    const overallData: any = await generateOverallFeedback({ jobTitle: interview.jobTitle, answers: session.answers });
    const scoredAnswers = session.answers.filter((answer) => typeof answer.aiScore === 'number');
    const calculatedScore = scoredAnswers.length
      ? Math.round(scoredAnswers.reduce((sum, answer) => sum + (answer.aiScore ?? 0), 0) / (scoredAnswers.length * 10) * 100)
      : 0;
    session.overallScore = Number.isFinite(overallData.overallScore) && overallData.overallScore >= 0 && overallData.overallScore <= 100
      ? overallData.overallScore : calculatedScore;
    session.overallFeedback = overallData.improvementTips?.join(' ') ?? '';
    session.strengths = overallData.strengths ?? [];
    session.areasForImprovement = overallData.weaknesses ?? [];
    session.recommendedResources = overallData.improvementTips ?? [];
    session.status = 'completed';
    session.evaluationStartedAt = null;
    session.completedAt = new Date();
    session.totalTimeTaken = session.answers.reduce((s, a) => s + (a.timeTaken || 0), 0);
    await session.save();
  } catch {
    session.status = 'evaluation_failed';
    session.evaluationStartedAt = null;
    for (const answer of session.answers) {
      if (!answer.skipped && !Number.isFinite(answer.aiScore)) {
        answer.aiScore = null;
        answer.aiFeedback = 'Evaluation unavailable. Retry completion.';
      }
    }
    await session.save();
    return next(new AppError('Evaluation is temporarily unavailable. Your answers are saved; please retry.', 503));
  }
  await Interview.updateOne({ _id: interview._id, userId: req.user._id }, { $set: { status: 'completed' } });
  const count = await Session.countDocuments({ userId: req.user._id, status: 'completed' });
  await User.updateOne({ _id: req.user._id }, { $set: { totalSessions: count } });
  res.status(200).json({ success: true, session });
};

// ─── GET /api/sessions ────────────────────────────────────────────
export const getMySessions = async (req: Request, res: Response) => {
  const page = Math.max(1, Math.min(100000, parseInt(String(req.query.page), 10) || 1));
  const limit = Math.max(1, Math.min(100, parseInt(String(req.query.limit), 10) || 10));
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
