import { initializeApp, applicationDefault, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import AppError from '../utils/app-error';

export const firebaseMode = () => process.env.AUTH_PROVIDER === 'firebase';

function authClient() {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  if (!projectId) throw new Error('FIREBASE_PROJECT_ID is required');
  if (!getApps().length) {
    initializeApp(process.env.FIREBASE_AUTH_EMULATOR_HOST
      ? { projectId }
      : { projectId, credential: applicationDefault() });
  }
  return getAuth();
}

export async function verifyFirebaseToken(token: string) {
  const decoded = await authClient().verifyIdToken(token, true);
  if (!decoded.uid || !decoded.email || !decoded.email_verified) {
    throw new AppError('Verify your email before continuing.', 403);
  }
  return decoded;
}

export async function resolveFirebaseUser(token: string, create = false) {
  // The Mongo bridge is loaded only by the isolated legacy regression app.
  const loaded: any = await import('../models/user.model.js');
  const User = loaded.default?.default || loaded.default || loaded;
  const decoded = await verifyFirebaseToken(token);
  let user: any = await User.findOne({ firebaseUid: decoded.uid }).select('+firebaseUid');
  if (!user && create) {
    // Email is never used to attach Firebase identity to an existing account.
    // A collision needs the explicit migration procedure, not an auto-link.
    if (await User.exists({ email: decoded.email!.toLowerCase() })) {
      throw new AppError('This email has an existing account that requires migration.', 409);
    }
    try {
      const displayName = String(decoded.name || decoded.email!.split('@')[0]).trim().slice(0, 50);
      user = await User.create({
        firebaseUid: decoded.uid, email: decoded.email!.toLowerCase(),
        name: displayName.length >= 2 ? displayName : 'Candidate',
        role: 'candidate',
      });
    } catch (error: any) {
      if (error?.code !== 11000) throw error;
      user = await User.findOne({ firebaseUid: decoded.uid }).select('+firebaseUid');
      if (!user) throw new AppError('Account could not be linked safely.', 409);
    }
  }
  if (!user) throw new AppError('Account not found. Complete sign-in first.', 401);
  if (!user.isActive || user.isBanned || user.deletedAt) throw new AppError('Account unavailable.', 403);
  return { user, decoded };
}

export async function deleteFirebaseIdentity(uid: string) {
  try { await authClient().deleteUser(uid); }
  catch (error: any) { if (error?.code !== 'auth/user-not-found') throw error; }
}

let readiness = { checkedAt: 0, ready: false };
export async function firebaseIsReady() {
  if (Date.now() - readiness.checkedAt < 15_000) return readiness.ready;
  try {
    await authClient().listUsers(1);
    readiness = { checkedAt: Date.now(), ready: true };
  } catch {
    readiness = { checkedAt: Date.now(), ready: false };
  }
  return readiness.ready;
}
