import type { Request, Response, NextFunction } from 'express';
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { validationResult } from 'express-validator';
import User from '../models/user.model';
import AuthToken from '../models/auth-token.model';
import AppError from '../utils/app-error';
import logger from '../config/logger';
import { sendTokenResponse } from '../utils/jwt.utils';
import { sendEmail } from '../services/email.service';
import { firebaseMode } from '../services/firebase-identity.service';

const RESET_TTL_MS = 30 * 60 * 1000;
const OAUTH_CODE_TTL_MS = 2 * 60 * 1000;
const STATE_TTL_MS = 10 * 60 * 1000;

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');
const clientUrl = () => (process.env.CLIENT_URL || 'http://localhost:5173').replace(/\/$/, '');
const apiUrl = () => (process.env.API_PUBLIC_URL || 'http://localhost:5000').replace(/\/$/, '');
const safeNext = (next: unknown) => (typeof next === 'string' && next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard');

async function issueToken(userId: unknown, purpose: 'password_reset' | 'oauth_login', ttlMs: number, meta: unknown = null) {
  const token = randomBytes(32).toString('base64url');
  await AuthToken.create({ userId, purpose, tokenHash: sha256(token), meta, expiresAt: new Date(Date.now() + ttlMs) });
  return token;
}

/** Atomically consume a single-use token; returns the token document or null. */
async function consumeToken(token: unknown, purpose: 'password_reset' | 'oauth_login') {
  if (typeof token !== 'string' || token.length < 20 || token.length > 200) return null;
  return AuthToken.findOneAndUpdate(
    { tokenHash: sha256(token), purpose, usedAt: null, expiresAt: { $gt: new Date() } },
    { $set: { usedAt: new Date() } },
    { new: true },
  );
}

// ─── OAuth provider registry (endpoint overrides are for local testing) ────
type Provider = { name: string; clientId?: string; clientSecret?: string; authUrl: string; tokenUrl: string; userinfoUrl: string; scope: string };
const provider = (key: string): Provider | null => {
  const env = (suffix: string) => process.env[`OAUTH_${key.toUpperCase()}_${suffix}`];
  if (key === 'google') {
    return {
      name: 'Google', clientId: process.env.GOOGLE_CLIENT_ID, clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      authUrl: env('AUTH_URL') || 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenUrl: env('TOKEN_URL') || 'https://oauth2.googleapis.com/token',
      userinfoUrl: env('USERINFO_URL') || 'https://openidconnect.googleapis.com/v1/userinfo',
      scope: 'openid email profile',
    };
  }
  if (key === 'linkedin') {
    return {
      name: 'LinkedIn', clientId: process.env.LINKEDIN_CLIENT_ID, clientSecret: process.env.LINKEDIN_CLIENT_SECRET,
      authUrl: env('AUTH_URL') || 'https://www.linkedin.com/oauth/v2/authorization',
      tokenUrl: env('TOKEN_URL') || 'https://www.linkedin.com/oauth/v2/accessToken',
      userinfoUrl: env('USERINFO_URL') || 'https://api.linkedin.com/v2/userinfo',
      scope: 'openid profile email',
    };
  }
  return null;
};
const configured = (p: Provider | null) => Boolean(p?.clientId && p?.clientSecret);

const signState = (payload: object) => {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = createHmac('sha256', String(process.env.JWT_SECRET)).update(body).digest('base64url');
  return `${body}.${sig}`;
};
const readState = (state: unknown): any => {
  if (typeof state !== 'string' || !state.includes('.')) return null;
  const [body, sig] = state.split('.');
  const expected = createHmac('sha256', String(process.env.JWT_SECRET)).update(body).digest('base64url');
  if (sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try { return JSON.parse(Buffer.from(body, 'base64url').toString('utf8')); } catch { return null; }
};

// ─── GET /api/auth/providers ──────────────────────────────────────
export const authProviders = (_req: Request, res: Response) => {
  res.json({
    success: true,
    mode: firebaseMode() ? 'firebase' : 'jwt',
    google: !firebaseMode() && configured(provider('google')),
    linkedin: !firebaseMode() && configured(provider('linkedin')),
    passwordReset: !firebaseMode(),
  });
};

// ─── POST /api/auth/forgot-password ───────────────────────────────
export const forgotPassword = async (req: Request, res: Response, next: NextFunction) => {
  if (firebaseMode()) return next(new AppError('Password resets are handled by Firebase Authentication.', 410));
  const errors = validationResult(req);
  if (!errors.isEmpty()) return next(new AppError(errors.array()[0].msg, 400));

  const generic = { success: true, message: 'If an account exists for that email, a reset link is on its way.' };
  const user: any = await User.findOne({ email: req.body.email, deletedAt: null });
  if (!user || !user.isActive || user.isBanned) return res.json(generic);

  await AuthToken.deleteMany({ userId: user._id, purpose: 'password_reset' });
  const token = await issueToken(user._id, 'password_reset', RESET_TTL_MS);
  const link = `${clientUrl()}/reset-password?token=${encodeURIComponent(token)}`;
  try {
    await sendEmail({
      to: user.email,
      subject: 'Reset your Rehearsly password',
      text: `Hi ${user.name},\n\nUse this link to choose a new password. It expires in 30 minutes and can be used once:\n${link}\n\nIf you didn't ask for this, you can ignore this email.\n\n— Rehearsly`,
    });
  } catch (error: any) {
    logger.error(`Password reset email failed: ${error.message}`);
  }
  res.json(generic);
};

// ─── POST /api/auth/reset-password ────────────────────────────────
export const resetPassword = async (req: Request, res: Response, next: NextFunction) => {
  if (firebaseMode()) return next(new AppError('Password resets are handled by Firebase Authentication.', 410));
  const errors = validationResult(req);
  if (!errors.isEmpty()) return next(new AppError(errors.array()[0].msg, 400));

  const record: any = await consumeToken(req.body.token, 'password_reset');
  if (!record) return next(new AppError('This reset link is invalid or has expired. Request a new one.', 400));
  const user: any = await User.findById(record.userId).select('+password');
  if (!user || !user.isActive || user.isBanned || user.deletedAt) {
    return next(new AppError('This account can no longer be recovered.', 403));
  }
  user.password = req.body.password;
  // One second in the past so the token issued below is not treated as pre-change.
  user.passwordChangedAt = new Date(Date.now() - 1000);
  user.lastLogin = new Date();
  await user.save();
  await AuthToken.deleteMany({ userId: user._id, purpose: 'password_reset' });
  sendTokenResponse(user, 200, res);
};

// ─── GET /api/auth/oauth/:provider/start ──────────────────────────
export const oauthStart = (req: Request, res: Response) => {
  const key = String(req.params.provider);
  const p = provider(key);
  if (firebaseMode() || !configured(p)) {
    return res.redirect(303, `${clientUrl()}/login?oauthError=not_configured`);
  }
  const state = signState({ p: key, next: safeNext(req.query.next), n: randomBytes(8).toString('hex'), t: Date.now() });
  const url = new URL(p!.authUrl);
  url.search = new URLSearchParams({
    client_id: p!.clientId!, redirect_uri: `${apiUrl()}/api/auth/oauth/${key}/callback`,
    response_type: 'code', scope: p!.scope, state, prompt: 'select_account',
  }).toString();
  res.redirect(302, url.toString());
};

// ─── GET /api/auth/oauth/:provider/callback ───────────────────────
export const oauthCallback = async (req: Request, res: Response) => {
  const key = String(req.params.provider);
  const p = provider(key);
  const fail = (reason: string) => res.redirect(303, `${clientUrl()}/login?oauthError=${encodeURIComponent(reason)}`);
  if (firebaseMode() || !configured(p)) return fail('not_configured');
  if (req.query.error) return fail(req.query.error === 'access_denied' ? 'cancelled' : 'provider_error');

  const state = readState(req.query.state);
  if (!state || state.p !== key || Date.now() - Number(state.t) > STATE_TTL_MS) return fail('invalid_state');
  if (typeof req.query.code !== 'string') return fail('provider_error');

  try {
    const tokenResponse = await fetch(p!.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: new URLSearchParams({
        grant_type: 'authorization_code', code: req.query.code,
        redirect_uri: `${apiUrl()}/api/auth/oauth/${key}/callback`,
        client_id: p!.clientId!, client_secret: p!.clientSecret!,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    const tokens: any = await tokenResponse.json();
    if (!tokenResponse.ok || !tokens.access_token) throw new Error('Token exchange failed');
    const infoResponse = await fetch(p!.userinfoUrl, {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
      signal: AbortSignal.timeout(10_000),
    });
    const info: any = await infoResponse.json();
    const email = String(info?.email || '').trim().toLowerCase();
    if (!infoResponse.ok || !email || !(info.email_verified === true || info.email_verified === 'true')) {
      return fail('email_unverified');
    }

    let user: any = await User.findOne({ email });
    if (user && (user.deletedAt || !user.isActive || user.isBanned)) return fail('account_unavailable');
    if (!user) {
      const name = String(info.name || [info.given_name, info.family_name].filter(Boolean).join(' ') || email.split('@')[0]).slice(0, 50);
      // Random password satisfying the policy; the user can set their own via "Forgot password".
      user = await User.create({ name: name.length >= 2 ? name : 'Rehearsly user', email, password: `${randomBytes(24).toString('base64url')}Aa1`, role: 'candidate' });
    }
    user.lastLogin = new Date();
    await user.save({ validateBeforeSave: false });

    const code = await issueToken(user._id, 'oauth_login', OAUTH_CODE_TTL_MS, { provider: key });
    res.redirect(303, `${clientUrl()}/auth/callback?code=${encodeURIComponent(code)}&next=${encodeURIComponent(safeNext(state.next))}`);
  } catch (error: any) {
    logger.error(`OAuth ${key} callback failed: ${error.message}`);
    fail('provider_error');
  }
};

// ─── POST /api/auth/oauth/exchange ────────────────────────────────
export const oauthExchange = async (req: Request, res: Response, next: NextFunction) => {
  const record: any = await consumeToken(req.body?.code, 'oauth_login');
  if (!record) return next(new AppError('This sign-in link has expired. Please try again.', 400));
  const user: any = await User.findById(record.userId);
  if (!user || !user.isActive || user.isBanned || user.deletedAt) return next(new AppError('Account unavailable.', 403));
  sendTokenResponse(user, 200, res);
};
