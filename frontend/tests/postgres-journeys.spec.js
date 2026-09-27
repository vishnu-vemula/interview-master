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
test.describe.configure({ mode: 'serial' });

const marker = randomUUID();
const password = 'StrongPassword123!';
let db, firebase, candidate, admin, plan, source, listing;
const credentials = async (role) => {
  const email = `${role}-${marker}@example.com`;
  const identity = await firebase.createUser({ email, password, emailVerified: true });
  const row = await db.user.create({ data: { firebaseUid: identity.uid, email,
    displayName: role === 'candidate' ? 'Browser Journey' : 'Browser Admin', role } });
  return { email, uid: identity.uid, id: row.id };
};
test.beforeAll(async () => {
  process.env.DATABASE_URL = databaseUrl;
  process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
  if (!getApps().length) initializeApp({ projectId: 'demo-interviewmaster' });
  firebase = getAuth(); db = new PrismaClient();
  candidate = await credentials('candidate');
  admin = await credentials('super_admin');
  plan = await db.plan.create({ data: { code: `browser-${marker}`, name: `Browser Pass ${marker.slice(0, 8)}`,
    description: 'Local browser checkout test', amountMinor: 9900, currency: 'INR',
    durationDays: 30, credits: 5, isPublished: true, entitlements: { credits: 5 } } });
  source = await db.jobSource.create({ data: { name: `Browser-${marker}` } });
  listing = await db.jobListing.create({ data: { sourceId: source.id, externalId: marker,
    title: 'Browser Platform Engineer', company: 'Browser Fixture', location: 'Remote',
    description: 'Design reliable backend systems', applyUrl: 'https://example.com/apply' } });
});
test.afterAll(async () => {
  if (!db) return;
  if (candidate) {
    await db.paymentOrder.deleteMany({ where: { userId: candidate.id } });
    await db.answer.deleteMany({ where: { session: { userId: candidate.id } } });
    await db.session.deleteMany({ where: { userId: candidate.id } });
    await db.question.deleteMany({ where: { interview: { userId: candidate.id } } });
    await db.interview.deleteMany({ where: { userId: candidate.id } });
    await db.resume.deleteMany({ where: { userId: candidate.id } });
  }
  if (source) { await db.jobListing.deleteMany({ where: { sourceId: source.id } });
    await db.jobSource.delete({ where: { id: source.id } }); }
  if (plan) await db.plan.delete({ where: { id: plan.id } });
  await db.user.deleteMany({ where: { id: { in: [candidate?.id, admin?.id].filter(Boolean) } } });
  await Promise.allSettled([candidate, admin].filter(Boolean).map(item => firebase.deleteUser(item.uid)));
  await db.$disconnect();
});

test('candidate uses resume, jobs, interview session and PayU handoff', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill(candidate.email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  // The storage and AI provider boundaries are mocked; the rest of these
  // browser calls exercise the live Firebase/PostgreSQL API.
  await page.route('**/api/resumes/upload', async route => {
    const row = await db.resume.create({ data: { userId: candidate.id,
      storageKey: `browser/${marker}`, originalName: 'browser-resume.pdf', fileName: 'browser-resume.pdf',
      contentType: 'application/pdf', sizeBytes: 1024, parseStatus: 'parsed', isParsed: true,
      extractedText: 'Platform engineer with reliable API and PostgreSQL experience',
      parsedData: { skills: ['PostgreSQL', 'Node.js'] }, isDefault: true } });
    await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({
      success: true, resume: { ...row, _id: row.id, publicId: row.storageKey,
        fileSize: row.sizeBytes, mimeType: row.contentType } }) });
  });
  await page.goto('/resumes');
  await page.getByLabel('Upload resume PDF').setInputFiles({ name: 'browser-resume.pdf',
    mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\nlocal fixture') });
  await expect(page.getByText('browser-resume.pdf').first()).toBeVisible();

  await page.goto('/jobs');
  await expect(page.getByText(listing.title).first()).toBeVisible();
  await page.goto('/interviews/new');
  await page.getByLabel('Job title').fill('Platform Engineer');
  await page.getByLabel('Job description').fill('Design reliable PostgreSQL backed APIs with good transaction safety, automated testing, and clear error handling.');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByLabel('Number of questions').fill('3');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.route('**/api/interviews/*/generate', async route => {
    const id = route.request().url().match(/\/interviews\/([^/]+)\/generate$/)?.[1];
    const count = (await db.interview.findUniqueOrThrow({ where: { id } })).questionCount;
    await db.question.createMany({ data: Array.from({ length: count }, (_, index) => ({
      interviewId: id, ordinal: index, category: 'technical', difficulty: 'medium',
      prompt: `Describe a reliable API decision ${index + 1}`, expectedKeywords: ['reliability'],
      generationVersion: 'browser-mock',
    })) });
    await db.interview.update({ where: { id }, data: { status: 'ready', generationStatus: 'generated' } });
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
  });
  await page.getByRole('button', { name: 'Generate interview' }).click();
  await expect(page).toHaveURL(/\/interviews\/[0-9a-f-]+\/session$/);
  await page.getByLabel('Your answer').fill('I would use transactions, retries and tests for reliable behavior.');
  await page.getByRole('button', { name: 'Save & next' }).click();
  await expect.poll(() => db.answer.count({ where: { session: { userId: candidate.id } } })).toBe(1);

  await page.route('https://test.payu.in/**', route => route.fulfill({ status: 200,
    contentType: 'text/html', body: '<h1>PayU test handoff</h1>' }));
  await page.goto('/pricing');
  await page.getByText(plan.name, { exact: true }).first().locator('xpath=ancestor::div[contains(@class,"rounded-r24")][1]')
    .getByRole('button', { name: 'Continue to PayU' }).click();
  await page.getByLabel('Mobile number').fill('9876543210');
  await page.getByRole('button', { name: /Pay ₹99 with PayU/ }).click();
  await expect(page.getByRole('heading', { name: 'PayU test handoff' })).toBeVisible();
  const checkoutOrders = await db.paymentOrder.findMany({ where: { userId: candidate.id },
    select: { planId: true, transactionId: true } });
  expect(checkoutOrders.filter(order => order.planId === plan.id)).toHaveLength(1);
});

test('admin signs in with Firebase and reads PostgreSQL console', async ({ page }) => {
  await page.goto('/admin/login');
  await page.getByLabel('Admin email').fill(admin.email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in to console' }).click();
  await expect(page).toHaveURL(/\/admin(?:\/dashboard)?$/);
  await page.goto('/admin/jobs');
  await expect(page.getByText(listing.title).first()).toBeVisible();
  await page.goto('/admin/payments');
  await expect(page.getByText('Payments').first()).toBeVisible();
});
