import 'dotenv/config';
import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { Prisma } from '@prisma/client';
import prisma from '../config/prisma';

/** One-time bootstrap for a pre-existing, enabled, email-verified Firebase account. */
async function main() {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const uid = process.env.ADMIN_BOOTSTRAP_FIREBASE_UID?.trim();
  const email = process.env.ADMIN_BOOTSTRAP_EMAIL?.trim().toLowerCase();
  if (!process.env.DATABASE_URL || !projectId || !uid || !email) {
    throw new Error('DATABASE_URL, FIREBASE_PROJECT_ID, ADMIN_BOOTSTRAP_FIREBASE_UID and ADMIN_BOOTSTRAP_EMAIL are required');
  }
  if (process.env.NODE_ENV === 'production' && process.env.FIREBASE_AUTH_EMULATOR_HOST) {
    throw new Error('Firebase Auth Emulator cannot bootstrap production');
  }
  if (!getApps().length) initializeApp(process.env.FIREBASE_AUTH_EMULATOR_HOST
    ? { projectId } : { projectId, credential: applicationDefault() });
  const identity = await getAuth().getUser(uid);
  if (identity.disabled || !identity.emailVerified || identity.email?.toLowerCase() !== email) {
    throw new Error('Firebase account must be enabled, email verified, and match ADMIN_BOOTSTRAP_EMAIL');
  }
  await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(420027)::text`;
    if (await tx.user.count({ where: { role: { in: ['support', 'content_manager', 'admin', 'super_admin'] } } })) {
      throw new Error('An administrative account already exists; bootstrap is closed');
    }
    if (await tx.user.findFirst({ where: { OR: [{ firebaseUid: uid }, { email }] } })) {
      throw new Error('Bootstrap identity already has an application account; refusing promotion');
    }
    await tx.user.create({ data: {
      firebaseUid: uid, email, displayName: identity.displayName?.trim() || 'Platform Administrator',
      role: 'super_admin', status: 'active',
    } });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  console.log('Super admin account created for the verified Firebase UID. Remove bootstrap environment variables.');
}

main().catch((error: Error) => { console.error(error.message); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
