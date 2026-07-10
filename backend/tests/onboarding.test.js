const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { startTestServer, call, uniqueEmail } = require('./util');
const { completeOnboarding, DEFAULT_ANSWERS } = require('./fixtures');
const pool = require('../src/db/pool');

after(() => pool.end());

test('onboarding: full flow completes and persists profile fields', async (t) => {
  const server = await startTestServer();
  t.after(() => server.close());

  const { body: signup } = await call(server.baseUrl, 'POST', '/auth/signup', {
    body: { email: uniqueEmail('onboard'), password: 'password123' },
  });

  const finalState = await completeOnboarding(server.baseUrl, signup.token, {
    current_injuries: ['knee'], knee_pain: 4,
  });
  assert.equal(finalState.done, true);

  const status = await call(server.baseUrl, 'GET', '/onboarding/status', { token: signup.token });
  assert.equal(status.body.onboardingCompleted, true);

  const { rows } = await pool.query('SELECT * FROM user_profiles WHERE user_id = $1', [signup.userId]);
  const profile = rows[0];
  assert.equal(profile.onboarding_completed, true);
  assert.deepEqual(profile.current_injuries, ['knee']);
  assert.equal(profile.joint_pain.knee, 4);
  assert.ok(Array.isArray(profile.goals));
});

test('onboarding: injury follow-up question is injected dynamically', async (t) => {
  const server = await startTestServer();
  t.after(() => server.close());

  const { body: signup } = await call(server.baseUrl, 'POST', '/auth/signup', {
    body: { email: uniqueEmail('followup'), password: 'password123' },
  });

  let { body: state } = await call(server.baseUrl, 'POST', '/onboarding/start', { token: signup.token });
  const seenKeys = [];
  while (state.question) {
    seenKeys.push(state.question.key);
    const key = state.question.key;
    const value = key === 'current_injuries' ? ['shoulder'] : (DEFAULT_ANSWERS[key] ?? 'n/a');
    ({ body: state } = await call(server.baseUrl, 'POST', '/onboarding/answer', {
      token: signup.token, body: { sessionId: state.sessionId, field: key, value },
    }));
  }

  assert.ok(seenKeys.includes('injury_follow_up'), 'expected dynamic follow-up question to be asked after reporting an injury');
});

test('onboarding: pregnancy_status is skipped for male gender', async (t) => {
  const server = await startTestServer();
  t.after(() => server.close());

  const { body: signup } = await call(server.baseUrl, 'POST', '/auth/signup', {
    body: { email: uniqueEmail('malegender'), password: 'password123' },
  });

  let { body: state } = await call(server.baseUrl, 'POST', '/onboarding/start', { token: signup.token });
  const seenKeys = [];
  while (state.question) {
    seenKeys.push(state.question.key);
    const key = state.question.key;
    const value = key === 'gender' ? 'male' : (DEFAULT_ANSWERS[key] ?? 'n/a');
    ({ body: state } = await call(server.baseUrl, 'POST', '/onboarding/answer', {
      token: signup.token, body: { sessionId: state.sessionId, field: key, value },
    }));
  }

  assert.ok(!seenKeys.includes('pregnancy_status'), 'pregnancy_status should be skipped when gender is male');
});
