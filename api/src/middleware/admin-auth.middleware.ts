import type { Request, Response, NextFunction } from 'express';
/**
 * middleware/adminAuth.middleware.js
 *
 * Admin-specific authentication middleware.
 * Separated from auth.middleware.js so admin routes have their own
 * protection layer, independent of regular user auth.
 *
 * Roles hierarchy:
 *   super_admin > admin > candidate
 *
 * Middleware:
 *   protectAdmin     — verifies JWT, ensures role is admin or super_admin
 *   requireSuperAdmin — further restricts to super_admin only
 */

import jwt from 'jsonwebtoken';
import User from '../models/user.model';
import AppError from '../utils/app-error';
const ADMIN_ROLES = ['admin', 'super_admin'];

// ─── protectAdmin ─────────────────────────────────────────────────
// Verifies the Bearer token and confirms the user holds an admin role.
// Attaches the full user document to req.admin (not req.user, to avoid
// collision with regular user middleware on shared routes).
export const protectAdmin = async (req: Request, res: Response, next: NextFunction) => {
  let token;

  if (req.headers.authorization?.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return next(new AppError('Admin access requires authentication. Please log in.', 401));
  }

  try {
    const decoded: any = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.id).select('+passwordChangedAt');
    if (!user) {
      return next(new AppError('The admin account no longer exists.', 401));
    }

    // Must hold an admin-level role
    if (!ADMIN_ROLES.includes(user.role)) {
      return next(new AppError('Access denied. Admin privileges required.', 403));
    }

    if (!user.isActive) {
      return next(new AppError('This admin account has been deactivated.', 403));
    }

    if (user.isBanned) {
      return next(new AppError('This admin account has been banned.', 403));
    }

    // @ts-expect-error TODO(ts-migration): type this site
    if (user.changedPasswordAfter(decoded.iat)) {
      return next(new AppError('Password recently changed. Please log in again.', 401));
    }

    // Attach as req.admin AND req.user for compatibility with shared controllers
    // @ts-expect-error TODO(ts-migration): type this site
    req.admin = user;
    // @ts-expect-error TODO(ts-migration): type this site
    req.user  = user;
    next();

  } catch (err) {
    // @ts-expect-error TODO(ts-migration): type this site
    if (err.name === 'JsonWebTokenError')  return next(new AppError('Invalid admin token.', 401));
    // @ts-expect-error TODO(ts-migration): type this site
    if (err.name === 'TokenExpiredError') return next(new AppError('Admin token expired. Please log in again.', 401));
    return next(err);
  }
};

// ─── requireSuperAdmin ────────────────────────────────────────────
// Must be used AFTER protectAdmin.
// Restricts the route to super_admin only.
export const requireSuperAdmin = (req, res, next) => {
  if (req.admin?.role !== 'super_admin') {
    return next(new AppError('This action requires Super Admin privileges.', 403));
  }
  next();
};

// ─── isAdminRole helper (utility, not middleware) ─────────────────
export const isAdminRole = (role) => ADMIN_ROLES.includes(role);
