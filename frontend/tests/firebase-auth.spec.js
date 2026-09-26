import { test, expect } from '@playwright/test';

test.use({ baseURL: 'http://localhost:5175' });

test('candidate registers, verifies email, signs in, and deletes account', async ({ page, request }) => {
  const email = `browser-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
  const password = 'StrongPassword123!';

  await page.goto('/register');
  await page.getByLabel('Full name').fill('Browser Candidate');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL(/\/login$/);

  const codesResponse = await request.get('http://127.0.0.1:9099/emulator/v1/projects/demo-interviewmaster/oobCodes');
  expect(codesResponse.ok()).toBeTruthy();
  const codes = (await codesResponse.json()).oobCodes;
  const verification = [...codes].reverse().find((entry) => entry.email === email && entry.requestType === 'VERIFY_EMAIL');
  expect(verification).toBeTruthy();
  const code = verification.oobCode || new URL(verification.oobLink).searchParams.get('oobCode');
  const verifyResponse = await request.post('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:update?key=fake-api-key', {
    data: { oobCode: code },
  });
  expect(verifyResponse.ok()).toBeTruthy();

  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto('/profile');
  await expect(page.getByText('Browser Candidate').first()).toBeVisible();
  await page.getByRole('button', { name: 'Delete account', exact: true }).click();
  await page.getByLabel('Current password').first().fill(password);
  await page.getByRole('button', { name: 'Delete my account' }).click();
  await expect(page).toHaveURL('http://localhost:5175/');
});
