const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { startTestServer, call, uniqueEmail } = require('./util');
const { completeOnboarding } = require('./fixtures');
const pool = require('../src/db/pool');

after(() => pool.end());

async function setupUserWithRoutine(baseUrl, overrides = {}) {
  const { body: signup } = await call(baseUrl, 'POST', '/auth/signup', { body: { email: uniqueEmail('sess'), password: 'password123' } });
  await completeOnboarding(baseUrl, signup.token, overrides);
  const routine = await call(baseUrl, 'POST', '/routines/generate', { token: signup.token, body: { routineType: 'custom' } });
  return { signup, routine: routine.body };
}

test('sessions: complete flow updates adaptation state and progress metrics', async (t) => {
  const server = await startTestServer();
  t.after(() => server.close());

  const { signup, routine } = await setupUserWithRoutine(server.baseUrl);

  const started = await call(server.baseUrl, 'POST', '/sessions', { token: signup.token, body: { routineId: routine.routine.id } });
  assert.equal(started.status, 201);

  const completed = await call(server.baseUrl, 'POST', `/sessions/${started.body.sessionLog.id}/complete`, {
    token: signup.token,
    body: { completionPct: 80, painReported: { neck: 4 }, difficultyFeedback: 'too_hard', enjoymentRating: 3 },
  });
  assert.equal(completed.status, 200);
  assert.equal(completed.body.adaptationState.sorenessAreas.neck, 4);
  assert.equal(completed.body.adaptationState.difficultyTrend, -1);

  const dashboard = await call(server.baseUrl, 'GET', '/progress/dashboard', { token: signup.token });
  assert.equal(dashboard.status, 200);
  assert.equal(dashboard.body.currentStreak, 1);
  assert.ok(dashboard.body.totals.workoutMinutes > 0);
});

test('sessions: repeated skips of the same pose eventually mark it avoided', async (t) => {
  const server = await startTestServer();
  t.after(() => server.close());

  const { signup, routine } = await setupUserWithRoutine(server.baseUrl);
  const skippedPoseId = routine.items[0].pose.id;

  let lastState;
  for (let i = 0; i < 3; i += 1) {
    const started = await call(server.baseUrl, 'POST', '/sessions', { token: signup.token, body: { routineId: routine.routine.id } });
    const completed = await call(server.baseUrl, 'POST', `/sessions/${started.body.sessionLog.id}/complete`, {
      token: signup.token,
      body: { completionPct: 70, skippedPoseIds: [skippedPoseId] },
    });
    lastState = completed.body.adaptationState;
  }

  assert.ok(lastState.avoidedPoses.includes(skippedPoseId), 'pose skipped 3 times in a row should be marked avoided');
});

test('sessions: workout minutes accumulate numerically across same-day completions', async (t) => {
  const server = await startTestServer();
  t.after(() => server.close());

  const { signup, routine } = await setupUserWithRoutine(server.baseUrl);

  let lastWorkoutMinutes = 0;
  for (let i = 0; i < 2; i += 1) {
    const started = await call(server.baseUrl, 'POST', '/sessions', { token: signup.token, body: { routineId: routine.routine.id } });
    await call(server.baseUrl, 'POST', `/sessions/${started.body.sessionLog.id}/complete`, {
      token: signup.token,
      body: { completionPct: 100 },
    });
    const dashboard = await call(server.baseUrl, 'GET', '/progress/dashboard', { token: signup.token });
    lastWorkoutMinutes = dashboard.body.totals.workoutMinutes;
  }

  // Postgres returns NUMERIC columns as strings; a naive `existing + new` add
  // would silently string-concatenate instead of summing on the second
  // same-day completion. Two full-length completions should roughly double,
  // not produce a value many times larger from concatenated digits.
  const singleSessionMinutes = routine.routine.total_duration_sec / 60;
  assert.ok(
    lastWorkoutMinutes < singleSessionMinutes * 2.5,
    `expected ~2x a single session's minutes (${singleSessionMinutes}), got ${lastWorkoutMinutes}`
  );
});

test('sessions: complete rejects unknown session id', async (t) => {
  const server = await startTestServer();
  t.after(() => server.close());

  const { signup } = await setupUserWithRoutine(server.baseUrl);
  const res = await call(server.baseUrl, 'POST', '/sessions/00000000-0000-0000-0000-000000000000/complete', {
    token: signup.token, body: { completionPct: 100 },
  });
  assert.equal(res.status, 404);
});
