import type { Request, Response, NextFunction } from 'express';
import { firebaseMode } from '../services/firebase-identity.service';
/**
 * controllers/adminAuth.controller.js
 *
 * Handles admin-specific authentication:
 *   POST /api/admin/auth/login   — validates admin credentials
 *   POST /api/admin/auth/logout  — clears session (stateless JWT, client clears token)
 *   POST /api/admin/auth/refresh — issues new access token from refresh token
 *   GET  /api/admin/auth/me      — returns current admin profile
 *
 * Only users with role 'admin' or 'super_admin' can authenticate here.
 * Regular candidates receive a clear 403 error.
 */

import jwt from 'jsonwebtoken';
import User from '../models/user.model';
import AppError from '../utils/app-error';
import { generateAccessToken, generateRefreshToken } from '../utils/jwt.utils';
import { getRolePermissions } from '../middleware/rbac';

const ADMIN_ROLES   = ['admin', 'super_admin', 'support', 'content_manager'];

// ─── Shared: build admin token response ───────────────────────────
const sendAdminTokenResponse = (user, statusCode, res) => {
  const accessToken  = generateAccessToken(user._id);
  const refreshToken = generateRefreshToken(user._id);

  res.status(statusCode).json({
    success: true,
    accessToken,
    refreshToken,
    admin: {
      _id:       user._id,
      name:      user.name,
      email:     user.email,
      role:      user.role,           // 'admin' | 'super_admin' | 'support' | 'content_manager'
      permissions: getRolePermissions(user.role),
      avatar:    user.avatar,
      lastLogin: user.lastLogin,
      createdAt: user.createdAt,
    },
  });
};

// ─── POST /api/admin/auth/login ───────────────────────────────────
export const adminLogin = async (req: Request, res: Response, next: NextFunction) => {
  if (firebaseMode()) return next(new AppError('Use Firebase Authentication to sign in.', 410));
  const { email, password } = req.body;

  if (!email || !password) {
    return next(new AppError('Email and password are required.', 400));
  }

  // Find user with password field
  const user = await User.findOne({ email: email.toLowerCase() }).select('+password');

    // @ts-expect-error TODO(ts-migration): type this site
  if (!user || !(await user.comparePassword(password))) {
    return next(new AppError('Invalid email or password.', 401));
  }

  // Enforce admin-only login on this endpoint
  if (!ADMIN_ROLES.includes(user.role)) {
    return next(new AppError('Access denied. This login is for admins only.', 403));
  }

  if (!user.isActive) {
    return next(new AppError('This admin account has been deactivated. Contact support.', 403));
  }

  if (user.isBanned) {
    return next(new AppError('This admin account has been banned.', 403));
  }

  user.lastLogin = new Date();
  await user.save({ validateBeforeSave: false });

  sendAdminTokenResponse(user, 200, res);
};

// ─── POST /api/admin/auth/logout ─────────────────────────────────
// JWT is stateless — client simply discards the token.
// This endpoint exists for audit logging and future token blocklist support.
export const adminLogout = async (req: Request, res: Response) => {
  res.status(200).json({ success: true, message: 'Admin logged out successfully.' });
};

// ─── POST /api/admin/auth/refresh ────────────────────────────────
export const adminRefreshToken = async (req: Request, res: Response, next: NextFunction) => {
  if (firebaseMode()) return next(new AppError('Firebase refreshes identity tokens.', 410));
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return next(new AppError('Refresh token is required.', 400));
  }

  try {
    const decoded: any = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const user: any = await User.findById(decoded.id).select('+passwordChangedAt');

    if (!user) {
      return next(new AppError('Admin account no longer exists.', 401));
    }

    if (!ADMIN_ROLES.includes(user.role)) {
      return next(new AppError('Access denied. Admin privileges required.', 403));
    }

    if (!user.isActive) {
      return next(new AppError('Account has been deactivated.', 403));
    }

    if (user.isBanned) {
      return next(new AppError('Account has been banned.', 403));
    }

    if (user.changedPasswordAfter(decoded.iat)) {
      return next(new AppError('Password recently changed. Please log in again.', 401));
    }

    const newAccessToken = generateAccessToken(user._id);
    res.status(200).json({ success: true, accessToken: newAccessToken });

  } catch (err) {
    return next(new AppError('Invalid or expired refresh token. Please log in again.', 401));
  }
};

// ─── GET /api/admin/auth/me ───────────────────────────────────────
export const getAdminMe = async (req: Request, res: Response) => {
  // req.admin is set by protectAdmin middleware
  const user = await User.findById(req.admin._id);
  res.status(200).json({
    success: true,
    admin: {
      _id:       user._id,
      name:      user.name,
      email:     user.email,
      role:      user.role,
      permissions: getRolePermissions(user.role),
      avatar:    user.avatar,
      lastLogin: user.lastLogin,
      createdAt: user.createdAt,
    }
  });
};
