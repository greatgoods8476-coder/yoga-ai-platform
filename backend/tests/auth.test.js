const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { startTestServer, call, uniqueEmail } = require('./util');
const pool = require('../src/db/pool');

after(() => pool.end());

test('auth: signup, duplicate email, login, bad password', async (t) => {
  const server = await startTestServer();
  t.after(() => server.close());

  const email = uniqueEmail('auth');

  const signup = await call(server.baseUrl, 'POST', '/auth/signup', { body: { email, password: 'password123' } });
  assert.equal(signup.status, 201);
  assert.ok(signup.body.token);

  const dup = await call(server.baseUrl, 'POST', '/auth/signup', { body: { email, password: 'password123' } });
  assert.equal(dup.status, 409);

  const shortPw = await call(server.baseUrl, 'POST', '/auth/signup', { body: { email: uniqueEmail('auth'), password: 'short' } });
  assert.equal(shortPw.status, 400);

  const login = await call(server.baseUrl, 'POST', '/auth/login', { body: { email, password: 'password123' } });
  assert.equal(login.status, 200);
  assert.ok(login.body.token);

  const badLogin = await call(server.baseUrl, 'POST', '/auth/login', { body: { email, password: 'wrongpass' } });
  assert.equal(badLogin.status, 401);
});

test('auth: protected routes reject missing/invalid token', async (t) => {
  const server = await startTestServer();
  t.after(() => server.close());

  const noToken = await call(server.baseUrl, 'GET', '/onboarding/status');
  assert.equal(noToken.status, 401);

  const badToken = await call(server.baseUrl, 'GET', '/onboarding/status', { token: 'not-a-real-token' });
  assert.equal(badToken.status, 401);
});
