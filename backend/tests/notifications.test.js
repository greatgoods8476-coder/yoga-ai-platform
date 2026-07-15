const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { computeSuggestions } = require('../src/services/notificationEngine');
const { startTestServer, call, uniqueEmail } = require('./util');
const { completeOnboarding } = require('./fixtures');
const pool = require('../src/db/pool');

after(() => pool.end());

test('computeSuggestions: brand-new user gets only a first-timer nudge', () => {
  const suggestions = computeSuggestions({
    profile: { stress_level: 5, goals: [] },
    lastSession: null,
    lastMeditation: null,
    currentStreak: 0,
    hasEverPracticed: false,
  });
  assert.equal(suggestions.length, 1);
  assert.equal(suggestions[0].id, 'first_timer');
});

test('computeSuggestions: an active streak with no session today surfaces a streak-at-risk nudge', () => {
  const now = new Date('2026-01-15T12:00:00Z');
  const suggestions = computeSuggestions({
    profile: { stress_level: 3, goals: [] },
    lastSession: { completed_at: '2026-01-14T09:00:00Z', difficulty_feedback: 'just_right' },
    lastMeditation: null,
    currentStreak: 4,
    hasEverPracticed: true,
    now,
  });
  assert.ok(suggestions.some((s) => s.id === 'streak_at_risk'), JSON.stringify(suggestions));
});

test('computeSuggestions: high stress with no meditation today surfaces a stress-relief nudge', () => {
  const now = new Date('2026-01-15T12:00:00Z');
  const suggestions = computeSuggestions({
    profile: { stress_level: 8, goals: [] },
    lastSession: { completed_at: '2026-01-15T08:00:00Z', difficulty_feedback: 'just_right' },
    lastMeditation: null,
    currentStreak: 1,
    hasEverPracticed: true,
    now,
  });
  assert.ok(suggestions.some((s) => s.id === 'stress_relief'), JSON.stringify(suggestions));
});

test('computeSuggestions: 3+ days inactive surfaces a gentle-restart nudge', () => {
  const now = new Date('2026-01-15T12:00:00Z');
  const suggestions = computeSuggestions({
    profile: { stress_level: 3, goals: [] },
    lastSession: { completed_at: '2026-01-10T08:00:00Z', difficulty_feedback: 'just_right' },
    lastMeditation: null,
    currentStreak: 0,
    hasEverPracticed: true,
    now,
  });
  assert.ok(suggestions.some((s) => s.id === 'gentle_restart'), JSON.stringify(suggestions));
});

test('GET /notifications/suggestions returns first_timer for a freshly onboarded user', async (t) => {
  const server = await startTestServer();
  t.after(() => server.close());

  const { body: signup } = await call(server.baseUrl, 'POST', '/auth/signup', {
    body: { email: uniqueEmail('notif'), password: 'password123' },
  });
  await completeOnboarding(server.baseUrl, signup.token, { stress_level: 8 });

  const res = await call(server.baseUrl, 'GET', '/notifications/suggestions', { token: signup.token });
  assert.equal(res.status, 200);
  assert.equal(res.body.suggestions.length, 1);
  assert.equal(res.body.suggestions[0].id, 'first_timer');
});

test('GET /notifications/suggestions reflects stress level after onboarding and a completed session', async (t) => {
  const server = await startTestServer();
  t.after(() => server.close());

  const { body: signup } = await call(server.baseUrl, 'POST', '/auth/signup', {
    body: { email: uniqueEmail('notif2'), password: 'password123' },
  });
  await completeOnboarding(server.baseUrl, signup.token, { stress_level: 9 });

  const routine = await call(server.baseUrl, 'POST', '/routines/generate', { token: signup.token, body: { routineType: 'custom' } });
  const started = await call(server.baseUrl, 'POST', '/sessions', { token: signup.token, body: { routineId: routine.body.routine.id } });
  await call(server.baseUrl, 'POST', `/sessions/${started.body.sessionLog.id}/complete`, {
    token: signup.token, body: { completionPct: 100 },
  });

  const res = await call(server.baseUrl, 'GET', '/notifications/suggestions', { token: signup.token });
  assert.equal(res.status, 200);
  assert.ok(res.body.suggestions.some((s) => s.id === 'stress_relief'), JSON.stringify(res.body.suggestions));
});

test('POST /notifications/send-top reports no registered devices when none are registered', async (t) => {
  const server = await startTestServer();
  t.after(() => server.close());

  const { body: signup } = await call(server.baseUrl, 'POST', '/auth/signup', {
    body: { email: uniqueEmail('notiftoken1'), password: 'password123' },
  });
  await completeOnboarding(server.baseUrl, signup.token);

  const res = await call(server.baseUrl, 'POST', '/notifications/send-top', { token: signup.token });
  assert.equal(res.status, 200);
  assert.equal(res.body.sent, false);
  assert.equal(res.body.reason, 'no registered devices');
});

test('POST /notifications/register-token then send-top finds the device but rejects a malformed token', async (t) => {
  const server = await startTestServer();
  t.after(() => server.close());

  const { body: signup } = await call(server.baseUrl, 'POST', '/auth/signup', {
    body: { email: uniqueEmail('notiftoken2'), password: 'password123' },
  });
  await completeOnboarding(server.baseUrl, signup.token);

  const registered = await call(server.baseUrl, 'POST', '/notifications/register-token', {
    token: signup.token, body: { token: 'not-a-real-expo-token', platform: 'ios' },
  });
  assert.equal(registered.status, 201);

  const res = await call(server.baseUrl, 'POST', '/notifications/send-top', { token: signup.token });
  assert.equal(res.status, 200);
  // A device is registered, but the token doesn't look like a real Expo push
  // token, so sendExpoPush filters it out before making any network call —
  // this is the observable, network-free way to verify that filtering works.
  assert.equal(res.body.sent, false);
  assert.equal(res.body.pushResult.sent, 0);
});

test('POST /notifications/register-token is idempotent for the same token', async (t) => {
  const server = await startTestServer();
  t.after(() => server.close());

  const { body: signup } = await call(server.baseUrl, 'POST', '/auth/signup', {
    body: { email: uniqueEmail('notiftoken3'), password: 'password123' },
  });

  const first = await call(server.baseUrl, 'POST', '/notifications/register-token', {
    token: signup.token, body: { token: 'ExponentPushToken[dupe-test]', platform: 'ios' },
  });
  const second = await call(server.baseUrl, 'POST', '/notifications/register-token', {
    token: signup.token, body: { token: 'ExponentPushToken[dupe-test]', platform: 'ios' },
  });
  assert.equal(first.status, 201);
  assert.equal(second.status, 201);
});
