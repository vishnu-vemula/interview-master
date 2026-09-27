import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { PrismaClient } from '@prisma/client';
import cloudinary from '../config/cloudinary';
import { retirePostgresCandidate } from './postgres-account-deletion';

const url = process.env.TEST_DATABASE_URL;
const enabled = Boolean(url?.endsWith('/interviewmaster_test') && process.env.FIREBASE_AUTH_EMULATOR_HOST);
test('candidate deletion removes PostgreSQL content and Firebase identity while redacting retained PayU records',
  { skip: !enabled }, async () => {
    process.env.DATABASE_URL = url;
    process.env.PAYU_ENV = 'test';
    process.env.PAYU_MERCHANT_KEY = 'merchant';
    process.env.PAYU_MERCHANT_SALT = 'salt';
    if (!getApps().length) initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID || 'demo-interviewmaster' });
    const firebase = getAuth();
    const db = new PrismaClient();
    const marker = randomUUID();
    const identity = await firebase.createUser({ email: `delete-${marker}@example.com`,
      password: 'StrongPassword123!', emailVerified: true });
    const user = await db.user.create({ data: { firebaseUid: identity.uid, email: identity.email!, displayName: 'Delete Candidate' } });
    const plan = await db.plan.create({ data: { code: `DEL_${marker}`, name: 'Test Plan', description: 'Fixture',
      amountMinor: 10000, credits: 3, entitlements: { credits: 3 } } });
    const order = await db.paymentOrder.create({ data: { userId: user.id, planId: plan.id,
      transactionId: `delete-${marker}`, idempotencyKey: `delete-key-${marker}`, amountMinor: 10000,
      creditLimit: 3, durationDays: 30, productInfo: 'Test Plan', firstName: 'Delete',
      email: identity.email, phone: '9876543210', status: 'success', payuId: `payu-${marker}` } });
    await db.subscription.create({ data: { userId: user.id, planId: plan.id, orderId: order.id,
      creditLimit: 3, status: 'active', currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 86_400_000) } });
    await db.resume.create({ data: { userId: user.id, storageKey: `private-${marker}`,
      originalName: 'resume.pdf', contentType: 'application/pdf', sizeBytes: 100 } });
    const originalDestroy = cloudinary.uploader.destroy;
    const destroyed: string[] = [];
    (cloudinary.uploader as any).destroy = async (key: string) => { destroyed.push(key); return { result: 'ok' }; };
    try {
      await retirePostgresCandidate(user.id, identity.uid);
      await retirePostgresCandidate(user.id, identity.uid);
      assert.deepEqual(destroyed, [`private-${marker}`]);
      await assert.rejects(firebase.getUser(identity.uid));
      assert.equal((await db.user.findUnique({ where: { id: user.id } }))?.status, 'deleted');
      assert.equal(await db.resume.count({ where: { userId: user.id } }), 0);
      const financial = await db.paymentOrder.findUniqueOrThrow({ where: { id: order.id } });
      assert.notEqual(financial.email, identity.email);
      assert.ok(financial.callbackEmailTag);
      assert.ok(financial.callbackPhoneTag);
      assert.equal((await db.subscription.findUnique({ where: { orderId: order.id } }))?.status, 'canceled');
    } finally {
      (cloudinary.uploader as any).destroy = originalDestroy;
      await db.subscription.deleteMany({ where: { userId: user.id } });
      await db.paymentOrder.deleteMany({ where: { userId: user.id } });
      await db.plan.delete({ where: { id: plan.id } });
      await db.user.delete({ where: { id: user.id } });
      await firebase.deleteUser(identity.uid).catch(() => {});
      await db.$disconnect();
    }
  });
