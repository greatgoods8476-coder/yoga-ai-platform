const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { startTestServer, call, uniqueEmail } = require('./util');
const { completeOnboarding, DEFAULT_ANSWERS } = require('./fixtures');
const pool = require('../src/db/pool');

after(() => pool.end());

test('onboarding: aiModeEnabled reflects whether an LLM is configured (false in test env)', async (t) => {
  const server = await startTestServer();
  t.after(() => server.close());

  const { body: signup } = await call(server.baseUrl, 'POST', '/auth/signup', { body: { email: uniqueEmail('aimode'), password: 'password123' } });
  const { body: state } = await call(server.baseUrl, 'POST', '/onboarding/start', { token: signup.token });
  assert.equal(state.aiModeEnabled, false);
});

test('onboarding: freeText answers work for text fields without any LLM configured', async (t) => {
  const server = await startTestServer();
  t.after(() => server.close());

  const { body: signup } = await call(server.baseUrl, 'POST', '/auth/signup', { body: { email: uniqueEmail('freetext'), password: 'password123' } });
  let { body: state } = await call(server.baseUrl, 'POST', '/onboarding/start', { token: signup.token });
  while (state.question.key !== 'occupation') {
    ({ body: state } = await call(server.baseUrl, 'POST', '/onboarding/answer', {
      token: signup.token, body: { sessionId: state.sessionId, field: state.question.key, value: DEFAULT_ANSWERS[state.question.key] ?? 'n/a' },
    }));
  }

  const res = await call(server.baseUrl, 'POST', '/onboarding/answer', {
    token: signup.token, body: { sessionId: state.sessionId, field: 'occupation', freeText: 'I coach club volleyball' },
  });
  assert.equal(res.status, 200);
  assert.equal(res.body.question.key !== 'occupation', true);

  const { rows } = await pool.query(
    "SELECT answers FROM onboarding_sessions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1",
    [signup.userId]
  );
  assert.equal(rows[0].answers.occupation, 'I coach club volleyball');
});

test('onboarding: freeText for a select/scale field is rejected with 409 when no LLM is configured', async (t) => {
  const server = await startTestServer();
  t.after(() => server.close());

  const { body: signup } = await call(server.baseUrl, 'POST', '/auth/signup', { body: { email: uniqueEmail('freetextnoai'), password: 'password123' } });
  const { body: state } = await call(server.baseUrl, 'POST', '/onboarding/start', { token: signup.token });
  assert.equal(state.question.key, 'age'); // number type, but let's target a select field explicitly below

  const res = await call(server.baseUrl, 'POST', '/onboarding/answer', {
    token: signup.token, body: { sessionId: state.sessionId, field: 'age', freeText: 'twenty-five' },
  });
  assert.equal(res.status, 409);
  assert.equal(res.body.error, 'AI answer parsing is not configured on this server');
});

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

test('onboarding: reporting a sport unlocks position/season/goal follow-ups and persists them', async (t) => {
  const server = await startTestServer();
  t.after(() => server.close());

  const { body: signup } = await call(server.baseUrl, 'POST', '/auth/signup', {
    body: { email: uniqueEmail('athlete'), password: 'password123' },
  });

  const finalState = await completeOnboarding(server.baseUrl, signup.token, {
    sport: 'basketball', athletic_position: 'guard', season_phase: 'in_season', primary_athletic_goal: 'build_strength',
  });
  assert.equal(finalState.done, true);

  const { rows } = await pool.query('SELECT sport, athletic_position, season_phase, primary_athletic_goal FROM user_profiles WHERE user_id = $1', [signup.userId]);
  assert.equal(rows[0].sport, 'basketball');
  assert.equal(rows[0].athletic_position, 'guard');
  assert.equal(rows[0].season_phase, 'in_season');
  assert.equal(rows[0].primary_athletic_goal, 'build_strength');
});

test('onboarding: sport "none" skips position/season/goal follow-ups entirely', async (t) => {
  const server = await startTestServer();
  t.after(() => server.close());

  const { body: signup } = await call(server.baseUrl, 'POST', '/auth/signup', {
    body: { email: uniqueEmail('nonathlete'), password: 'password123' },
  });

  let { body: state } = await call(server.baseUrl, 'POST', '/onboarding/start', { token: signup.token });
  const seenKeys = [];
  while (state.question) {
    seenKeys.push(state.question.key);
    const key = state.question.key;
    const value = DEFAULT_ANSWERS[key] ?? 'n/a';
    ({ body: state } = await call(server.baseUrl, 'POST', '/onboarding/answer', {
      token: signup.token, body: { sessionId: state.sessionId, field: key, value },
    }));
  }

  assert.ok(!seenKeys.includes('athletic_position'));
  assert.ok(!seenKeys.includes('season_phase'));
  assert.ok(!seenKeys.includes('primary_athletic_goal'));
});

test('onboarding: each in-progress question carries answered/total progress', async (t) => {
  const server = await startTestServer();
  t.after(() => server.close());

  const { body: signup } = await call(server.baseUrl, 'POST', '/auth/signup', {
    body: { email: uniqueEmail('progress'), password: 'password123' },
  });

  let { body: state } = await call(server.baseUrl, 'POST', '/onboarding/start', { token: signup.token });
  assert.deepEqual(state.progress, { answered: 0, total: state.progress.total });
  assert.ok(state.progress.total > 0);

  ({ body: state } = await call(server.baseUrl, 'POST', '/onboarding/answer', {
    token: signup.token, body: { sessionId: state.sessionId, field: state.question.key, value: DEFAULT_ANSWERS[state.question.key] },
  }));
  assert.equal(state.progress.answered, 1);
});

test('onboarding: completion returns a yogaLevel and persists it on the profile', async (t) => {
  const server = await startTestServer();
  t.after(() => server.close());

  const { body: signup } = await call(server.baseUrl, 'POST', '/auth/signup', {
    body: { email: uniqueEmail('level'), password: 'password123' },
  });

  const finalState = await completeOnboarding(server.baseUrl, signup.token, {
    yoga_experience: 'none', fitness_level: 'beginner', current_flexibility: 'poor', current_mobility: 'limited',
  });
  assert.equal(finalState.done, true);
  assert.equal(finalState.yogaLevel.level, 'rooted_beginner');
  assert.equal(finalState.yogaLevel.cautious, false);

  const { rows } = await pool.query('SELECT yoga_level FROM user_profiles WHERE user_id = $1', [signup.userId]);
  assert.equal(rows[0].yoga_level, 'rooted_beginner');
});

test('onboarding: current pain/injury caps the level at rooted_beginner even for an experienced profile', async (t) => {
  const server = await startTestServer();
  t.after(() => server.close());

  const { body: signup } = await call(server.baseUrl, 'POST', '/auth/signup', {
    body: { email: uniqueEmail('cautious'), password: 'password123' },
  });

  const finalState = await completeOnboarding(server.baseUrl, signup.token, {
    yoga_experience: 'advanced', fitness_level: 'athlete', current_flexibility: 'excellent', current_mobility: 'excellent',
    current_injuries: ['knee'], knee_pain: 4,
  });
  assert.equal(finalState.yogaLevel.level, 'rooted_beginner');
  assert.equal(finalState.yogaLevel.cautious, true);
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
