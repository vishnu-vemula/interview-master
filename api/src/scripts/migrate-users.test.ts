import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import mongoose from 'mongoose';
import { PrismaClient } from '@prisma/client';
import { getAuth } from 'firebase-admin/auth';
import User from '../models/user.model';
import { migrateUsers, stableUuid } from './migrate-users';

const mongoUri = process.env.TEST_MIGRATION_MONGO_URI;
const postgresUrl = process.env.TEST_DATABASE_URL;
const runnable = Boolean(mongoUri?.endsWith('/interviewmaster_migration_test') &&
  postgresUrl && new URL(postgresUrl).pathname === '/interviewmaster_test' &&
  process.env.FIREBASE_AUTH_EMULATOR_HOST && process.env.FIREBASE_PROJECT_ID);

test('bcrypt user import is repeatable across Firebase, PostgreSQL and the Mongo bridge',
  { skip: !runnable && 'Set disposable Mongo/PostgreSQL and Firebase emulator test settings' },
  async () => {
    process.env.MONGO_URI = mongoUri;
    process.env.DATABASE_URL = postgresUrl;
    const email = `migration-${randomUUID()}@example.com`;
    const password = 'StrongPassword123!';
    await mongoose.connect(mongoUri!);
    const source: any = await User.create({ name: 'Migrated Candidate', email, password });
    const uid = `im_${source._id}`;
    const id = stableUuid('user', String(source._id));
    await mongoose.disconnect();
    const db = new PrismaClient();
    try {
      const dry = await migrateUsers(false);
      assert.equal(dry.inspected, 1);
      assert.equal(dry.imported, 0);
      const first = await migrateUsers(true);
      assert.equal(first.imported, 1);
      assert.equal(first.failed.length, 0);
      const second = await migrateUsers(true);
      assert.equal(second.imported, 0);
      assert.equal(second.alreadyPresent, 1);
      assert.equal((await db.user.findUnique({ where: { id } }))?.firebaseUid, uid);
      const login = await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake-api-key', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, returnSecureToken: true }),
      });
      // The Auth emulator stores imported bcrypt hashes but only checks its
      // own simple test hash on password sign-in. Real Firebase must be smoke
      // tested after import; this emulator cannot validate bcrypt login.
      assert.equal(login.status, 400);
      await getAuth().updateUser(uid, { password });
      const emulatorLogin = await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake-api-key', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, returnSecureToken: true }),
      });
      assert.equal(emulatorLogin.status, 200);
      await mongoose.connect(mongoUri!);
      assert.equal((await User.findById(source._id).select('+firebaseUid'))?.firebaseUid, uid);
    } finally {
      await Promise.allSettled([getAuth().deleteUser(uid), db.user.delete({ where: { id } })]);
      if (mongoose.connection.readyState !== 1) await mongoose.connect(mongoUri!);
      await mongoose.connection.dropDatabase();
      await mongoose.disconnect();
      await db.$disconnect();
    }
  });
