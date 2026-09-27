import { Prisma, type User } from '@prisma/client';
import prisma from '../config/prisma';
import AppError from '../utils/app-error';
import { verifyFirebaseToken } from './firebase-identity.service';

export function presentUser(user: User) {
  return {
    _id: user.id, id: user.id,
    name: user.displayName, email: user.email, avatar: user.avatar,
    role: user.role, isActive: user.status === 'active', isBanned: user.status === 'banned',
    status: user.status, credits: user.credits, isPremium: user.isPremium,
    lastLogin: user.lastLogin, totalSessions: user.totalSessions,
    createdAt: user.createdAt, updatedAt: user.updatedAt,
  };
}

/** The Firebase UID is the sole identity lookup key. Email is never an auto-link key. */
export async function resolvePostgresUser(token: string, create = false) {
  const decoded = await verifyFirebaseToken(token);
  let user = await prisma.user.findUnique({ where: { firebaseUid: decoded.uid } });
  if (!user && create) {
    const email = decoded.email!.toLowerCase();
    if (await prisma.user.findUnique({ where: { email } })) {
      throw new AppError('This email has an existing account that requires migration.', 409);
    }
    const candidate = String(decoded.name || email.split('@')[0]).trim().slice(0, 50);
    try {
      user = await prisma.user.create({ data: {
        firebaseUid: decoded.uid, email, displayName: candidate.length >= 2 ? candidate : 'Candidate',
        role: 'candidate', status: 'active', lastLogin: new Date(),
      } });
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') throw error;
      user = await prisma.user.findUnique({ where: { firebaseUid: decoded.uid } });
      if (!user) throw new AppError('Account could not be linked safely.', 409);
    }
  }
  if (!user) throw new AppError('Account not found. Complete sign-in first.', 401);
  if (user.status !== 'active' || user.deletedAt) throw new AppError('Account unavailable.', 403);
  return { user, decoded };
}
