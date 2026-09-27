import test from 'node:test';
import assert from 'node:assert/strict';

test('OAuth callback requires the nonce cookie from the initiating browser', async () => {
  process.env.AUTH_PROVIDER = 'legacy';
  process.env.JWT_SECRET = 'oauth-state-test-access-secret-32-characters';
  process.env.GOOGLE_CLIENT_ID = 'test-google-client';
  process.env.GOOGLE_CLIENT_SECRET = 'test-google-secret';
  process.env.API_PUBLIC_URL = 'http://localhost:5000';
  process.env.CLIENT_URL = 'http://localhost:5173';
  const { default: app } = await import('../app.js') as any;
  const server = app.listen(0);
  try {
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Test server did not bind');
    const base = `http://127.0.0.1:${address.port}`;
    const start = await fetch(`${base}/api/auth/oauth/google/start?next=%2Fdashboard`, { redirect: 'manual' });
    assert.equal(start.status, 302);
    const cookie = start.headers.get('set-cookie') || '';
    assert.match(cookie, /rehearsly_oauth_nonce=[0-9a-f]{32}/);
    assert.match(cookie, /HttpOnly/i);
    assert.match(cookie, /SameSite=Lax/i);
    const state = new URL(start.headers.get('location') || '').searchParams.get('state');
    assert.ok(state);

    const callbackUrl = `${base}/api/auth/oauth/google/callback?state=${encodeURIComponent(state)}&code=fake-code`;
    const missingCookie = await fetch(callbackUrl, { redirect: 'manual' });
    assert.equal(missingCookie.status, 303);
    assert.match(missingCookie.headers.get('location') || '', /oauthError=invalid_state/);

    const wrongCookie = await fetch(callbackUrl, { redirect: 'manual',
      headers: { Cookie: 'rehearsly_oauth_nonce=00000000000000000000000000000000' } });
    assert.equal(wrongCookie.status, 303);
    assert.match(wrongCookie.headers.get('location') || '', /oauthError=invalid_state/);

    const largeCallback = await fetch(`${base}/api/billing/payu/webhook`, {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `hash=${'x'.repeat(34_000)}`,
    });
    assert.equal(largeCallback.status, 413);
  } finally {
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});
