const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { startTestServer, call, uniqueEmail } = require('./util');
const { completeOnboarding } = require('./fixtures');
const pool = require('../src/db/pool');

after(() => pool.end());

test('GET /profile/avatar starts empty, PATCH saves a GLB url without clobbering instructorGender', async (t) => {
  const server = await startTestServer();
  t.after(() => server.close());

  const { body: signup } = await call(server.baseUrl, 'POST', '/auth/signup', {
    body: { email: uniqueEmail('avatar'), password: 'password123' },
  });
  await completeOnboarding(server.baseUrl, signup.token, { instructor_gender: 'female' });

  const before = await call(server.baseUrl, 'GET', '/profile/avatar', { token: signup.token });
  assert.equal(before.status, 200);
  assert.equal(before.body.avatarPreference.instructorGender, 'female');
  assert.equal(before.body.avatarPreference.avatarUrl, undefined);

  const patched = await call(server.baseUrl, 'PATCH', '/profile/avatar', {
    token: signup.token, body: { avatarUrl: 'https://models.readyplayer.me/abc123.glb' },
  });
  assert.equal(patched.status, 200);
  assert.equal(patched.body.avatarPreference.avatarUrl, 'https://models.readyplayer.me/abc123.glb');
  assert.equal(patched.body.avatarPreference.instructorGender, 'female');
});

test('PATCH /profile/avatar rejects a non-GLB url', async (t) => {
  const server = await startTestServer();
  t.after(() => server.close());

  const { body: signup } = await call(server.baseUrl, 'POST', '/auth/signup', {
    body: { email: uniqueEmail('avatarbad'), password: 'password123' },
  });

  const res = await call(server.baseUrl, 'PATCH', '/profile/avatar', {
    token: signup.token, body: { avatarUrl: 'https://evil.example.com/not-a-model' },
  });
  assert.equal(res.status, 400);
});
