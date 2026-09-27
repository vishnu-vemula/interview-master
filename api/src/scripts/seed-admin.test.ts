import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { PrismaClient } from '@prisma/client';

const url = process.env.TEST_BOOTSTRAP_DATABASE_URL;
test('bootstrap requires a verified Firebase UID and runs only once',
  { skip: !url?.endsWith('/interviewmaster_clean_test') || !process.env.FIREBASE_AUTH_EMULATOR_HOST }, async () => {
    if (!getApps().length) initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID || 'demo-interviewmaster' });
    const auth = getAuth();
    const db = new PrismaClient({ datasources: { db: { url } } });
    const email = `bootstrap-${randomUUID()}@example.com`;
    const identity = await auth.createUser({ email, password: 'StrongPassword123!', emailVerified: true });
    try {
      assert.equal(await db.user.count(), 0, 'The disposable bootstrap database must be empty');
      const run = () => spawnSync(process.execPath, ['--import', 'tsx', 'src/scripts/seed-admin.ts'], {
        cwd: process.cwd(), encoding: 'utf8', timeout: 30_000,
        env: { ...process.env, DATABASE_URL: url, FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID || 'demo-interviewmaster',
          ADMIN_BOOTSTRAP_FIREBASE_UID: identity.uid, ADMIN_BOOTSTRAP_EMAIL: email },
      });
      const first = run();
      assert.equal(first.status, 0, first.stderr);
      const user = await db.user.findUnique({ where: { firebaseUid: identity.uid } });
      assert.equal(user?.role, 'super_admin');
      const second = run();
      assert.notEqual(second.status, 0);
      assert.match(second.stderr, /bootstrap is closed/);
    } finally {
      await db.user.deleteMany({ where: { firebaseUid: identity.uid } });
      await auth.deleteUser(identity.uid);
      await db.$disconnect();
    }
  });
