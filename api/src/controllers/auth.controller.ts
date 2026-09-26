import type { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import jwt from 'jsonwebtoken';
import User from '../models/user.model';
import AppError from '../utils/app-error';
import { sendTokenResponse, generateAccessToken } from '../utils/jwt.utils';
import { deleteFirebaseIdentity, firebaseMode, resolveFirebaseUser, verifyFirebaseToken } from '../services/firebase-identity.service';
import { retireCandidateAccount } from '../services/account-deletion.service';


// ─── POST /api/auth/register ───────────────────────────────────────
export const register = async (req: Request, res: Response, next: NextFunction) => {
  if (firebaseMode()) return next(new AppError('Use Firebase Authentication to register.', 410));
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(new AppError(errors.array()[0].msg, 400));
  }

  const { name, email, password } = req.body;

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    return next(new AppError('An account with this email already exists.', 409));
  }

  const user = await User.create({ name, email, password, role: 'candidate' });
  sendTokenResponse(user, 201, res);
};

// ─── POST /api/auth/login ─────────────────────────────────────────
export const login = async (req: Request, res: Response, next: NextFunction) => {
  if (firebaseMode()) return next(new AppError('Use Firebase Authentication to sign in.', 410));
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(new AppError(errors.array()[0].msg, 400));
  }

  const { email, password } = req.body;

  const user = await User.findOne({ email }).select('+password');
    // @ts-expect-error TODO(ts-migration): type this site
  if (!user || !(await user.comparePassword(password))) {
    return next(new AppError('Invalid email or password.', 401));
  }

  if (!user.isActive) {
    return next(new AppError('Your account has been deactivated.', 403));
  }

  if (user.isBanned) {
    return next(new AppError('Your account has been banned due to violation of terms.', 403));
  }

  // Update last login
  user.lastLogin = new Date();
  await user.save({ validateBeforeSave: false });

  sendTokenResponse(user, 200, res);
};

// ─── POST /api/auth/refresh ────────────────────────────────────────
export const refreshToken = async (req: Request, res: Response, next: NextFunction) => {
  if (firebaseMode()) return next(new AppError('Firebase refreshes identity tokens.', 410));
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return next(new AppError('Refresh token is required.', 400));
  }

  try {
    const decoded: any = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const user: any = await User.findById(decoded.id).select('+passwordChangedAt');
    if (!user || !user.isActive || user.isBanned || user.changedPasswordAfter(decoded.iat)) {
      return next(new AppError('Session is no longer valid. Please log in again.', 401));
    }

    const accessToken = generateAccessToken(user._id);

    res.status(200).json({ success: true, accessToken });
  } catch {
    return next(new AppError('Invalid or expired refresh token.', 401));
  }
};

// ─── GET /api/auth/me ─────────────────────────────────────────────
export const getMe = async (req: Request, res: Response) => {
  const user = await User.findById(req.user._id);
  res.status(200).json({ success: true, user });
};

// ─── POST /api/auth/logout ────────────────────────────────────────
export const logout = async (req: Request, res: Response) => {
  res.status(200).json({ success: true, message: 'Logged out successfully.' });
};

export const firebaseSession = async (req: Request, res: Response, next: NextFunction) => {
  if (!firebaseMode()) return next(new AppError('Firebase Authentication is not enabled.', 404));
  const token = req.headers.authorization?.match(/^Bearer (\S+)$/)?.[1];
  if (!token) return next(new AppError('Identity token required.', 401));
  const { user } = await resolveFirebaseUser(token, true);
  res.status(200).json({ success: true, user });
};

export const firebaseDeleteAccount = async (req: Request, res: Response, next: NextFunction) => {
  if (!firebaseMode()) return next(new AppError('Firebase Authentication is not enabled.', 404));
  const token = req.headers.authorization?.match(/^Bearer (\S+)$/)?.[1];
  if (!token) return next(new AppError('Identity token required.', 401));
  const decoded = await verifyFirebaseToken(token);
  if (!decoded.auth_time || Date.now() / 1000 - decoded.auth_time > 300) {
    return next(new AppError('Sign in again before deleting your account.', 401));
  }
  const user: any = await User.findOne({ firebaseUid: decoded.uid }).select('+firebaseUid');
  if (!user) return next(new AppError('Account not found.', 404));
  await retireCandidateAccount(String(user._id));
  await deleteFirebaseIdentity(decoded.uid);
  res.status(200).json({ success: true, message: 'Account deleted.' });
};
