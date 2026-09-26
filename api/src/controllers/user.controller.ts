import type { Request, Response, NextFunction } from 'express';
import User from '../models/user.model';
import Session from '../models/session.model';
import AppError from '../utils/app-error';
import { validationResult } from 'express-validator';
import { retireCandidateAccount } from '../services/account-deletion.service';
import { firebaseMode } from '../services/firebase-identity.service';
// ─── GET /api/users/profile ───────────────────────────────────────
export const getProfile = async (req: Request, res: Response) => {
  const user = await User.findById(req.user._id)
    .populate({ path: 'resumes', select: 'fileName originalName isDefault parseStatus createdAt' });

  res.status(200).json({ success: true, user });
};

// ─── PUT /api/users/profile ───────────────────────────────────────
export const updateProfile = async (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return next(new AppError('Invalid profile details.', 400));
  const { name, avatar } = req.body;

  const allowedFields = {};
    // @ts-expect-error TODO(ts-migration): type this site
  if (name) allowedFields.name = name;
    // @ts-expect-error TODO(ts-migration): type this site
  if (avatar !== undefined) allowedFields.avatar = avatar;

  const user = await User.findByIdAndUpdate(req.user._id, allowedFields, {
    new: true,
    runValidators: true,
  });

  res.status(200).json({ success: true, user });
};

// ─── PUT /api/users/change-password ───────────────────────────────
export const changePassword = async (req: Request, res: Response, next: NextFunction) => {
  if (firebaseMode()) return next(new AppError('Change your password through Firebase Authentication.', 410));
  const errors = validationResult(req);
  if (!errors.isEmpty()) return next(new AppError('Invalid password details.', 400));
  const { currentPassword, newPassword } = req.body;

  const user = await User.findById(req.user._id).select('+password');
    // @ts-expect-error TODO(ts-migration): type this site
  if (!(await user.comparePassword(currentPassword))) {
    return next(new AppError('Current password is incorrect.', 401));
  }

  user.password = newPassword;
  user.passwordChangedAt = new Date();
  await user.save();

  res.status(200).json({ success: true, message: 'Password updated successfully.' });
};

// ─── GET /api/users/dashboard ─────────────────────────────────────
export const getDashboard = async (req: Request, res: Response) => {
  const userId = req.user._id;

  const [totalSessions, completedSessions, recentSessions] = await Promise.all([
    Session.countDocuments({ userId }),
    Session.countDocuments({ userId, status: 'completed' }),
    Session.find({ userId, status: 'completed' })
      .sort('-createdAt')
      .limit(5)
      .populate({ path: 'interviewId', select: 'jobTitle company experienceLevel' }),
  ]);

  const scoreAgg = await Session.aggregate([
    { $match: { userId, status: 'completed', overallScore: { $ne: null } } },
    { $group: { _id: null, avgScore: { $avg: '$overallScore' }, maxScore: { $max: '$overallScore' } } },
  ]);

  res.status(200).json({
    success: true,
    data: {
      totalSessions,
      completedSessions,
      averageScore: scoreAgg[0]?.avgScore?.toFixed(1) ?? 0,
      bestScore: scoreAgg[0]?.maxScore ?? 0,
      recentSessions,
    },
  });
};

export const deleteMyAccount = async (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return next(new AppError('Current password is required.', 400));
  const user: any = await User.findById(req.user._id).select('+password');
  if (!user || !(await user.comparePassword(req.body.currentPassword))) {
    return next(new AppError('Current password is incorrect.', 401));
  }
  await retireCandidateAccount(String(user._id));
  res.status(200).json({ success: true, message: 'Account deleted. Financial records are retained without contact details for reconciliation.' });
};
