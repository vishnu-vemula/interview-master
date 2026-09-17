/**
 * jwt.utils.ts — Token signing and delivery helpers.
 *
 * Single source of truth for how JWTs are minted in this application:
 *  - Access tokens  (short-lived, sent with every API request)
 *  - Refresh tokens (long-lived,  exchanged at /auth/refresh)
 */
import jwt, { Secret } from 'jsonwebtoken';
import type { Response } from 'express';

/** Fallback secrets so signing never receives `undefined` in misconfigured envs */
const ACCESS_SECRET: Secret  = process.env.JWT_SECRET         || 'dev_access_secret_change_me';
const REFRESH_SECRET: Secret = process.env.JWT_REFRESH_SECRET || 'dev_refresh_secret_change_me';

/**
 * Generate a signed access token for a user.
 */
const generateAccessToken = (userId: any): string =>
  jwt.sign({ id: userId }, ACCESS_SECRET, {
    expiresIn: (process.env.JWT_EXPIRE as any) || '7d',
  });

/**
 * Generate a signed refresh token for a user.
 */
const generateRefreshToken = (userId: any): string =>
  jwt.sign({ id: userId }, REFRESH_SECRET, {
    expiresIn: (process.env.JWT_REFRESH_EXPIRE as any) || '30d',
  });

/**
 * Send both tokens plus the safe public projection of the user.
 * Used by register / login / refresh flows.
 */
const sendTokenResponse = (user: any, statusCode: number, res: Response): void => {
  const accessToken  = generateAccessToken(user._id);
  const refreshToken = generateRefreshToken(user._id);

  const userResponse = {
    _id:          user._id,
    name:         user.name,
    email:        user.email,
    role:         user.role,
    avatar:       user.avatar,
    totalSessions: user.totalSessions,
    createdAt:    user.createdAt,
  };

  res.status(statusCode).json({
    success: true,
    accessToken,
    refreshToken,
    user: userResponse,
  });
};

export { generateAccessToken, generateRefreshToken, sendTokenResponse };
