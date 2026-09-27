import type { Request, Response, NextFunction } from 'express';
import AppError from '../utils/app-error';
import { presentUser, resolvePostgresUser } from '../services/postgres-identity.service';

export const protectPostgres = async (req: Request, _res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.match(/^Bearer (\S+)$/)?.[1];
  if (!token) return next(new AppError('Identity token required.', 401));
  try {
    const { user } = await resolvePostgresUser(token);
    req.user = presentUser(user);
    next();
  } catch (error) {
    next(error instanceof AppError ? error : new AppError('Invalid or revoked identity token.', 401));
  }
};

const adminRoles = new Set(['support', 'content_manager', 'admin', 'super_admin']);
export const protectPostgresAdmin = async (req: Request, res: Response, next: NextFunction) => {
  await protectPostgres(req, res, (error?: unknown) => {
    if (error) return next(error);
    if (!adminRoles.has(String(req.user?.role))) return next(new AppError('Admin privileges required.', 403));
    req.admin = req.user;
    next();
  });
};
