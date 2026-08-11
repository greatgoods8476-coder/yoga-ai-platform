const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { startTestServer, call, uniqueEmail } = require('./util');
const { completeOnboarding, signupAndOnboard } = require('./fixtures');
const pool = require('../src/db/pool');

after(() => pool.end());

test('POST /plans/generate schedules a plan on the athlete\'s reported available days, superseding any prior plan', async (t) => {
  const server = await startTestServer();
  t.after(() => server.close());

  const athlete = await signupAndOnboard(server.baseUrl, uniqueEmail('plan1'), 'password123', {
    sport: 'basketball', primary_athletic_goal: 'build_strength', available_days: ['monday', 'wednesday', 'friday'],
  });

  const first = await call(server.baseUrl, 'POST', '/plans/generate', { token: athlete.token });
  assert.equal(first.status, 201);
  assert.equal(first.body.plan.routine_type, 'strength_yoga');
  assert.ok(first.body.days.length > 0);
  assert.ok(first.body.days.every((d) => d.status === 'pending' && d.routine_id === null));

  const second = await call(server.baseUrl, 'POST', '/plans/generate', { token: athlete.token });
  assert.equal(second.status, 201);
  assert.notEqual(second.body.plan.id, first.body.plan.id);

  const { rows } = await pool.query('SELECT status FROM training_plans WHERE id = $1', [first.body.plan.id]);
  assert.equal(rows[0].status, 'superseded');

  const current = await call(server.baseUrl, 'GET', '/plans/current', { token: athlete.token });
  assert.equal(current.body.plan.id, second.body.plan.id);
});

test('POST /plans/generate rejects before onboarding is completed', async (t) => {
  const server = await startTestServer();
  t.after(() => server.close());

  const { body: signup } = await call(server.baseUrl, 'POST', '/auth/signup', { body: { email: uniqueEmail('plan2'), password: 'password123' } });
  const res = await call(server.baseUrl, 'POST', '/plans/generate', { token: signup.token });
  assert.equal(res.status, 409);
});

test('generate-routine fills in a real routine for a plan day, and link-session marks it completed', async (t) => {
  const server = await startTestServer();
  t.after(() => server.close());

  const athlete = await signupAndOnboard(server.baseUrl, uniqueEmail('plan3'), 'password123', {
    available_days: ['monday', 'wednesday', 'friday'],
  });
  const plan = (await call(server.baseUrl, 'POST', '/plans/generate', { token: athlete.token })).body;
  const day = plan.days[0];

  const generated = await call(server.baseUrl, 'POST', `/plans/days/${day.id}/generate-routine`, { token: athlete.token });
  assert.equal(generated.status, 201);
  assert.ok(generated.body.items.length > 0);

  const started = await call(server.baseUrl, 'POST', '/sessions', { token: athlete.token, body: { routineId: generated.body.routine.id } });
  const completed = await call(server.baseUrl, 'POST', `/sessions/${started.body.sessionLog.id}/complete`, {
    token: athlete.token, body: { completionPct: 100 },
  });
  assert.equal(completed.status, 200);

  const linked = await call(server.baseUrl, 'POST', `/plans/days/${day.id}/link-session`, {
    token: athlete.token, body: { sessionLogId: completed.body.sessionLog.id },
  });
  assert.equal(linked.status, 200);
  assert.equal(linked.body.day.status, 'completed');

  const current = await call(server.baseUrl, 'GET', '/plans/current', { token: athlete.token });
  const refreshedDay = current.body.days.find((d) => d.id === day.id);
  assert.equal(refreshedDay.status, 'completed');
  assert.equal(refreshedDay.session_log_id, completed.body.sessionLog.id);
});

test('link-session rejects a session that was never completed', async (t) => {
  const server = await startTestServer();
  t.after(() => server.close());

  const athlete = await signupAndOnboard(server.baseUrl, uniqueEmail('plan4'), 'password123', {
    available_days: ['monday', 'wednesday', 'friday'],
  });
  const plan = (await call(server.baseUrl, 'POST', '/plans/generate', { token: athlete.token })).body;
  const day = plan.days[0];

  const routine = await call(server.baseUrl, 'POST', '/routines/generate', { token: athlete.token, body: { routineType: 'custom' } });
  const started = await call(server.baseUrl, 'POST', '/sessions', { token: athlete.token, body: { routineId: routine.body.routine.id } });

  const linked = await call(server.baseUrl, 'POST', `/plans/days/${day.id}/link-session`, {
    token: athlete.token, body: { sessionLogId: started.body.sessionLog.id },
  });
  assert.equal(linked.status, 404);
});

test('POST /plans/checkins records soreness and folds it into adaptation_state via the existing engine', async (t) => {
  const server = await startTestServer();
  t.after(() => server.close());

  const athlete = await signupAndOnboard(server.baseUrl, uniqueEmail('plan5'), 'password123');

  const checkin = await call(server.baseUrl, 'POST', '/plans/checkins', {
    token: athlete.token, body: { soreness: { hamstrings: 3 }, notes: 'tight after yesterday' },
  });
  assert.equal(checkin.status, 201);
  assert.equal(checkin.body.adaptationState.sorenessAreas.hamstrings, 3);

  const { rows } = await pool.query('SELECT adaptation_state FROM user_profiles WHERE user_id = $1', [athlete.userId]);
  assert.equal(rows[0].adaptation_state.sorenessAreas.hamstrings, 3);

  // same-day check-in updates rather than duplicating
  const again = await call(server.baseUrl, 'POST', '/plans/checkins', {
    token: athlete.token, body: { soreness: { hamstrings: 1 } },
  });
  assert.equal(again.status, 201);

  const list = await call(server.baseUrl, 'GET', '/plans/checkins', { token: athlete.token });
  assert.equal(list.body.checkins.length, 1);
});

test('POST /plans/checkins rejects a non-object soreness payload', async (t) => {
  const server = await startTestServer();
  t.after(() => server.close());

  const athlete = await signupAndOnboard(server.baseUrl, uniqueEmail('plan6'), 'password123');
  const res = await call(server.baseUrl, 'POST', '/plans/checkins', { token: athlete.token, body: { soreness: 'a lot' } });
  assert.equal(res.status, 400);
});
