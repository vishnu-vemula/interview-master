import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import type { PrismaClient } from '@prisma/client';

const databaseUrl = process.env.TEST_DATABASE_URL;
const enabled = Boolean(databaseUrl?.endsWith('/interviewmaster_test') &&
  process.env.FIREBASE_AUTH_EMULATOR_HOST && process.env.FIREBASE_PROJECT_ID);

test('PostgreSQL identity reconciliation enforces verified Firebase UID and current database role/status',
  { skip: !enabled && 'Set disposable PostgreSQL and Firebase Auth emulator' }, async () => {
    process.env.DATABASE_URL = databaseUrl;
    if (!getApps().length) initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID });
    const firebase = getAuth();
    const db = (await import('../config/prisma.js')).default as unknown as PrismaClient;
    const { resolvePostgresUser } = await import('./postgres-identity.service.js');
    const email = `pg-auth-${randomUUID()}@example.com`;
    const password = 'StrongPassword123!';
    const created = await firebase.createUser({ email, password, emailVerified: false, displayName: 'PG Candidate' });
    const getToken = async () => {
      const response = await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake-api-key', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, returnSecureToken: true }),
      });
      assert.equal(response.status, 200);
      return (await response.json()).idToken as string;
    };
    try {
      let token = await getToken();
      await assert.rejects(resolvePostgresUser(token, true), /Verify your email/);
      await firebase.updateUser(created.uid, { emailVerified: true });
      token = await getToken();
      const first = await resolvePostgresUser(token, true);
      const second = await resolvePostgresUser(token, true);
      assert.equal(first.user.id, second.user.id);
      assert.equal(first.user.firebaseUid, created.uid);
      assert.equal(await db.user.count({ where: { firebaseUid: created.uid } }), 1);
      await db.user.update({ where: { id: first.user.id }, data: { role: 'admin' } });
      assert.equal((await resolvePostgresUser(token)).user.role, 'admin');
      await db.user.update({ where: { id: first.user.id }, data: { status: 'banned' } });
      await assert.rejects(resolvePostgresUser(token), /Account unavailable/);
      await db.user.update({ where: { id: first.user.id }, data: { status: 'disabled' } });
      await assert.rejects(resolvePostgresUser(token), /Account unavailable/);
      await db.user.update({ where: { id: first.user.id }, data: { status: 'active' } });
      await firebase.updateUser(created.uid, { disabled: true });
      await assert.rejects(resolvePostgresUser(token));
      await firebase.updateUser(created.uid, { disabled: false });
      const [header, body, signature] = token.split('.');
      const expiredClaims = { ...JSON.parse(Buffer.from(body, 'base64url').toString()), exp: 1 };
      const expiredToken = `${header}.${Buffer.from(JSON.stringify(expiredClaims)).toString('base64url')}.${signature}`;
      await assert.rejects(resolvePostgresUser(expiredToken), /expired/i);
      await new Promise(resolve => setTimeout(resolve, 1100));
      await firebase.revokeRefreshTokens(created.uid);
      await assert.rejects(resolvePostgresUser(token));
    } finally {
      await db.user.deleteMany({ where: { firebaseUid: created.uid } });
      await db.$disconnect();
      await firebase.deleteUser(created.uid);
    }
  });
