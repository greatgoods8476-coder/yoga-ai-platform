const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { startTestServer, call, uniqueEmail } = require('./util');
const { completeOnboarding } = require('./fixtures');
const pool = require('../src/db/pool');

after(() => pool.end());

test('routines: generation is blocked until onboarding completes', async (t) => {
  const server = await startTestServer();
  t.after(() => server.close());

  const { body: signup } = await call(server.baseUrl, 'POST', '/auth/signup', {
    body: { email: uniqueEmail('gate'), password: 'password123' },
  });

  const res = await call(server.baseUrl, 'POST', '/routines/generate', { token: signup.token, body: { routineType: 'custom' } });
  assert.equal(res.status, 409);
});

test('routines: generation excludes poses contraindicated for reported injuries', async (t) => {
  const server = await startTestServer();
  t.after(() => server.close());

  const { body: signup } = await call(server.baseUrl, 'POST', '/auth/signup', {
    body: { email: uniqueEmail('injury'), password: 'password123' },
  });
  await completeOnboarding(server.baseUrl, signup.token, { current_injuries: ['knee'], knee_pain: 5 });

  const res = await call(server.baseUrl, 'POST', '/routines/generate', {
    token: signup.token, body: { routineType: 'hip_mobility' },
  });
  assert.equal(res.status, 201);

  const kneeContraindicated = res.body.items.filter((it) => (it.pose.contraindications || []).includes('knee'));
  assert.equal(kneeContraindicated.length, 0, 'no knee-contraindicated poses should appear for a user with severe knee pain');
});

test('routines: total duration is close to the requested length', async (t) => {
  const server = await startTestServer();
  t.after(() => server.close());

  const { body: signup } = await call(server.baseUrl, 'POST', '/auth/signup', {
    body: { email: uniqueEmail('duration'), password: 'password123' },
  });
  await completeOnboarding(server.baseUrl, signup.token);

  const res = await call(server.baseUrl, 'POST', '/routines/generate', {
    token: signup.token, body: { routineType: 'custom', durationMin: 10 },
  });
  assert.equal(res.status, 201);
  assert.ok(res.body.routine.total_duration_sec >= 600, 'routine should fill at least the requested duration');
  assert.ok(res.body.routine.total_duration_sec < 900, 'routine should not wildly overshoot the requested duration');
});

test('routines: two profiles with different goals get different routines', async (t) => {
  const server = await startTestServer();
  t.after(() => server.close());

  const a = (await call(server.baseUrl, 'POST', '/auth/signup', { body: { email: uniqueEmail('a'), password: 'password123' } })).body;
  const b = (await call(server.baseUrl, 'POST', '/auth/signup', { body: { email: uniqueEmail('b'), password: 'password123' } })).body;

  await completeOnboarding(server.baseUrl, a.token, { goals: ['strength'], favorite_yoga_styles: ['power'] });
  await completeOnboarding(server.baseUrl, b.token, { goals: ['sleep'], favorite_yoga_styles: ['restorative', 'yin'] });

  const routineA = await call(server.baseUrl, 'POST', '/routines/generate', { token: a.token, body: { routineType: 'custom' } });
  const routineB = await call(server.baseUrl, 'POST', '/routines/generate', { token: b.token, body: { routineType: 'custom' } });

  const slugsA = routineA.body.items.map((i) => i.pose.slug).join(',');
  const slugsB = routineB.body.items.map((i) => i.pose.slug).join(',');
  assert.notEqual(slugsA, slugsB, 'a strength-goal profile and a sleep-goal profile should not get an identical sequence');
});
