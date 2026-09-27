import 'dotenv/config';
import { createHash } from 'node:crypto';
import mongoose from 'mongoose';
import { PrismaClient, UserRole, UserStatus } from '@prisma/client';
import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth, type UserRecord } from 'firebase-admin/auth';
import User from '../models/user.model';

// UUID v5 using the standard DNS namespace. Include the entity name so other
// Mongo ObjectIds can be mapped later without sharing a UUID with a User.
const namespace = Buffer.from('6ba7b8109dad11d180b400c04fd430c8', 'hex');
export function stableUuid(entity: string, legacyId: string) {
  const bytes = createHash('sha1').update(namespace).update(`${entity}:${legacyId}`).digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

const roles = new Set(Object.values(UserRole));
const getFirebaseUser = async (kind: 'uid' | 'email', value: string): Promise<UserRecord | null> => {
  try { return kind === 'uid' ? await getAuth().getUser(value) : await getAuth().getUserByEmail(value); }
  catch (error: any) {
    if (error?.code === 'auth/user-not-found') return null;
    throw error;
  }
};

export async function migrateUsers(apply: boolean) {
  if (!process.env.MONGO_URI || !process.env.DATABASE_URL || !process.env.FIREBASE_PROJECT_ID) {
    throw new Error('MONGO_URI, DATABASE_URL and FIREBASE_PROJECT_ID are required');
  }
  if (!apply && process.env.FIREBASE_AUTH_EMULATOR_HOST) {
    // Dry run still checks target collisions; it does not import or update.
  }
  if (!getApps().length) initializeApp(process.env.FIREBASE_AUTH_EMULATOR_HOST
    ? { projectId: process.env.FIREBASE_PROJECT_ID }
    : { projectId: process.env.FIREBASE_PROJECT_ID, credential: applicationDefault() });
  await mongoose.connect(process.env.MONGO_URI);
  const db = new PrismaClient();
  const result = { inspected: 0, imported: 0, alreadyPresent: 0, resetRequired: 0, failed: [] as Array<{ legacyId: string; reason: string }> };
  try {
    for await (const source of User.find().select('+password +firebaseUid').cursor()) {
      const legacyId = String(source._id);
      // Firebase bridge accounts already have an identity. Keep it; never
      // create a second Firebase account for the same application user.
      const uid = String(source.firebaseUid || `im_${legacyId}`);
      const email = String(source.email || '').toLowerCase();
      result.inspected++;
      try {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('invalid_email');
        const existingByUid = await getFirebaseUser('uid', uid);
        const existingByEmail = await getFirebaseUser('email', email);
        if (existingByEmail && existingByEmail.uid !== uid) throw new Error('email_collision_in_firebase');
        if (existingByUid && existingByUid.email?.toLowerCase() !== email) throw new Error('uid_collision_in_firebase');
        const id = stableUuid('user', legacyId);
        const existingRow = await db.user.findUnique({ where: { id } });
        if (existingRow && (existingRow.firebaseUid !== uid || existingRow.email !== email)) {
          throw new Error('postgres_identity_collision');
        }
        const emailRow = await db.user.findUnique({ where: { email } });
        if (emailRow && emailRow.id !== id) throw new Error('email_collision_in_postgres');
        if (!apply) continue;

        let passwordResetRequired = false;
        if (!existingByUid) {
          const hash = String(source.password || '');
          if (/^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(hash)) {
            const imported = await getAuth().importUsers([{
              uid, email, displayName: source.name, emailVerified: false,
              disabled: !source.isActive || source.isBanned,
              passwordHash: Buffer.from(hash, 'utf8'),
            }], { hash: { algorithm: 'BCRYPT' } });
            if (imported.failureCount) throw new Error(`firebase_import_failed:${imported.errors[0]?.error?.code || 'unknown'}`);
          } else {
            await getAuth().createUser({ uid, email, displayName: source.name,
              emailVerified: false, disabled: !source.isActive || source.isBanned });
            passwordResetRequired = true;
          }
        }

        const status: UserStatus = source.isBanned ? 'banned' : source.isActive ? 'active' : 'disabled';
        const role: UserRole = roles.has(source.role as UserRole) ? source.role as UserRole : 'candidate';
        await db.user.upsert({ where: { id }, update: {}, create: {
          id, firebaseUid: uid, email, displayName: source.name, role, status,
          avatar: source.avatar || null, credits: source.credits ?? 10,
          isPremium: Boolean(source.isPremium), lastLogin: source.lastLogin || null,
          totalSessions: source.totalSessions ?? 0,
          createdAt: source.createdAt, updatedAt: source.updatedAt,
          deletedAt: source.deletedAt || null,
        } });
        await User.updateOne({ _id: source._id, $or: [{ firebaseUid: { $exists: false } }, { firebaseUid: uid }] },
          { $set: { firebaseUid: uid } });
        if (passwordResetRequired) result.resetRequired++;
        if (existingByUid) result.alreadyPresent++;
        else result.imported++;
      } catch (error: any) {
        result.failed.push({ legacyId, reason: String(error?.message || 'unknown').slice(0, 120) });
      }
    }
    if (apply) {
      const mapped = await db.user.count();
      console.log(JSON.stringify({ ...result, mappedPostgresUsers: mapped }, null, 2));
    } else console.log(JSON.stringify({ ...result, dryRun: true }, null, 2));
    if (result.failed.length) process.exitCode = 1;
    return result;
  } finally {
    await Promise.allSettled([db.$disconnect(), mongoose.disconnect()]);
  }
}

if (process.argv[1]?.replace(/\\/g, '/').endsWith('/migrate-users.ts')) {
  migrateUsers(process.argv.includes('--apply')).catch((error) => {
    console.error(`User migration failed: ${error.message}`);
    process.exitCode = 1;
  });
}
