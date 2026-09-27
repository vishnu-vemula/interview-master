import { test, expect } from '@playwright/test';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';

const apiRequire = createRequire(new URL('../../api/package.json', import.meta.url));
const { PrismaClient } = apiRequire('@prisma/client');
const { initializeApp, getApps } = apiRequire('firebase-admin/app');
const { getAuth } = apiRequire('firebase-admin/auth');
const databaseUrl = process.env.TEST_DATABASE_URL;
const enabled = (() => { try { const url = new URL(databaseUrl);
  return ['127.0.0.1', 'localhost'].includes(url.hostname) && url.pathname === '/interviewmaster_test';
} catch { return false; } })();
test.skip(!enabled, 'Set TEST_DATABASE_URL to the disposable PostgreSQL test database');
test.use({ baseURL: 'http://localhost:5175' });

test('Firebase session survives reload and supports refresh, password change, sign-out and reset', async ({ page, request }) => {
  process.env.DATABASE_URL = databaseUrl;
  process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
  if (!getApps().length) initializeApp({ projectId: 'demo-interviewmaster' });
  const firebase = getAuth();
  const db = new PrismaClient();
  const email = `session-${randomUUID()}@example.com`;
  const oldPassword = 'StrongPassword123!';
  const changedPassword = 'ChangedPassword123!';
  const resetPassword = 'ResetPassword123!';
  const identity = await firebase.createUser({ email, password: oldPassword, emailVerified: true });
  try {
    await page.goto('/login');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password', { exact: true }).fill(oldPassword);
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.reload();
    await expect(page).toHaveURL(/\/dashboard$/);
    const token = await page.evaluate(async () => {
      const { auth } = await import('/src/lib/firebase.js');
      return auth.currentUser.getIdToken(true);
    });
    const me = await request.get('http://127.0.0.1:5100/api/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(me.ok()).toBeTruthy();
    expect((await me.json()).user.email).toBe(email);
    await page.goto('/profile');
    await page.getByLabel('Current password').fill(oldPassword);
    await page.getByLabel('New password', { exact: true }).fill(changedPassword);
    await page.getByLabel('Confirm new password', { exact: true }).fill(changedPassword);
    await page.getByRole('button', { name: 'Update password' }).click();
    await expect(page.getByText('Password changed')).toBeVisible();
    await page.getByRole('button', { name: 'Log out' }).click();
    await expect(page).toHaveURL(/\/login(?:\?|$)/);
    await page.reload();
    await expect(page).toHaveURL(/\/login(?:\?|$)/);
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password', { exact: true }).fill(changedPassword);
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.getByRole('button', { name: 'Log out' }).click();
    await expect(page).toHaveURL(/\/login(?:\?|$)/);
    await page.goto('/forgot-password');
    await page.getByLabel('Email').fill(email);
    await page.getByRole('button', { name: 'Send reset link' }).click();
    await expect(page.getByText('Check your inbox')).toBeVisible();
    const codesResponse = await request.get('http://127.0.0.1:9099/emulator/v1/projects/demo-interviewmaster/oobCodes');
    expect(codesResponse.ok()).toBeTruthy();
    const codes = (await codesResponse.json()).oobCodes;
    const reset = [...codes].reverse().find(entry => entry.email === email && entry.requestType === 'PASSWORD_RESET');
    expect(reset).toBeTruthy();
    await page.goto(`/reset-password?oobCode=${encodeURIComponent(reset.oobCode)}`);
    await page.getByLabel('New password', { exact: true }).fill(resetPassword);
    await page.getByLabel('Confirm new password', { exact: true }).fill(resetPassword);
    await page.getByRole('button', { name: 'Update password' }).click();
    await expect(page).toHaveURL(/\/login$/);
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password', { exact: true }).fill(resetPassword);
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
  } finally {
    await db.user.deleteMany({ where: { firebaseUid: identity.uid } });
    await firebase.deleteUser(identity.uid).catch(() => {});
    await db.$disconnect();
  }
});
