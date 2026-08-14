const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { startTestServer, call, uniqueEmail } = require('./util');
const { completeOnboarding } = require('./fixtures');
const pool = require('../src/db/pool');

after(() => pool.end());

async function signupOnboarded(baseUrl, prefix, overrides = {}) {
  const { body: signup } = await call(baseUrl, 'POST', '/auth/signup', {
    body: { email: uniqueEmail(prefix), password: 'password123' },
  });
  await completeOnboarding(baseUrl, signup.token, overrides);
  return signup;
}

test('POST /orgs creates an organization and makes the creator its coach', async (t) => {
  const server = await startTestServer();
  t.after(() => server.close());

  const coach = await signupOnboarded(server.baseUrl, 'coach1');
  const res = await call(server.baseUrl, 'POST', '/orgs', { token: coach.token, body: { name: 'State University Athletics' } });
  assert.equal(res.status, 201);
  assert.equal(res.body.organization.name, 'State University Athletics');

  const mine = await call(server.baseUrl, 'GET', '/orgs/mine', { token: coach.token });
  assert.equal(mine.body.organizations.length, 1);
  assert.equal(mine.body.organizations[0].role, 'coach');
  assert.equal(mine.body.organizations[0].athlete_count, 0);
});

test('roster: only visible to a coach of that org, includes athletic profile fields', async (t) => {
  const server = await startTestServer();
  t.after(() => server.close());

  const coach = await signupOnboarded(server.baseUrl, 'coach2');
  const org = (await call(server.baseUrl, 'POST', '/orgs', { token: coach.token, body: { name: 'Riverside Athletics' } })).body.organization;

  const athlete = await signupOnboarded(server.baseUrl, 'athlete1', {
    sport: 'basketball', athletic_position: 'guard', season_phase: 'in_season', primary_athletic_goal: 'build_strength',
    fitness_level: 'athlete', yoga_experience: 'none',
  });
  const email = (await pool.query('SELECT email FROM users WHERE id = $1', [athlete.userId])).rows[0].email;
  const added = await call(server.baseUrl, 'POST', `/orgs/${org.id}/athletes`, { token: coach.token, body: { email } });
  assert.equal(added.status, 201);

  const roster = await call(server.baseUrl, 'GET', `/orgs/${org.id}/roster`, { token: coach.token });
  assert.equal(roster.status, 200);
  assert.equal(roster.body.roster.length, 1);
  assert.equal(roster.body.roster[0].sport, 'basketball');
  assert.equal(roster.body.roster[0].athletic_position, 'guard');
  assert.ok(roster.body.roster[0].yoga_level);

  // a non-coach (the athlete themself) cannot see the roster
  const forbidden = await call(server.baseUrl, 'GET', `/orgs/${org.id}/roster`, { token: athlete.token });
  assert.equal(forbidden.status, 403);
});

test('athlete detail: returns profile and latest generated routine, 404s for a non-member', async (t) => {
  const server = await startTestServer();
  t.after(() => server.close());

  const coach = await signupOnboarded(server.baseUrl, 'coach3');
  const org = (await call(server.baseUrl, 'POST', '/orgs', { token: coach.token, body: { name: 'Lakeside Athletics' } })).body.organization;

  const athlete = await signupOnboarded(server.baseUrl, 'athlete2', {
    sport: 'track', primary_athletic_goal: 'explosiveness', fitness_level: 'advanced',
  });
  const email = (await pool.query('SELECT email FROM users WHERE id = $1', [athlete.userId])).rows[0].email;
  await call(server.baseUrl, 'POST', `/orgs/${org.id}/athletes`, { token: coach.token, body: { email } });

  await call(server.baseUrl, 'POST', '/routines/generate', { token: athlete.token, body: { routineType: 'power_yoga' } });

  const detail = await call(server.baseUrl, 'GET', `/orgs/${org.id}/athletes/${athlete.userId}`, { token: coach.token });
  assert.equal(detail.status, 200);
  assert.equal(detail.body.profile.sport, 'track');
  assert.ok(detail.body.latestRoutine.routine);
  assert.ok(detail.body.latestRoutine.items.length > 0);
  assert.equal(detail.body.latestMobilityTest, null);

  await pool.query(
    `INSERT INTO mobility_tests (user_id, photos, assessment, flagged_limitations) VALUES ($1, '[]', 'solid mobility overall', $2)`,
    [athlete.userId, ['hamstring']]
  );
  const detailWithMobility = await call(server.baseUrl, 'GET', `/orgs/${org.id}/athletes/${athlete.userId}`, { token: coach.token });
  assert.equal(detailWithMobility.body.latestMobilityTest.assessment, 'solid mobility overall');
  assert.deepEqual(detailWithMobility.body.latestMobilityTest.flagged_limitations, ['hamstring']);

  const outsider = await signupOnboarded(server.baseUrl, 'athlete3');
  const notFound = await call(server.baseUrl, 'GET', `/orgs/${org.id}/athletes/${outsider.userId}`, { token: coach.token });
  assert.equal(notFound.status, 404);
});

test('POST /orgs/:id/athletes rejects an unknown email and a non-coach caller', async (t) => {
  const server = await startTestServer();
  t.after(() => server.close());

  const coach = await signupOnboarded(server.baseUrl, 'coach4');
  const org = (await call(server.baseUrl, 'POST', '/orgs', { token: coach.token, body: { name: 'Northside Athletics' } })).body.organization;

  const unknownEmail = await call(server.baseUrl, 'POST', `/orgs/${org.id}/athletes`, { token: coach.token, body: { email: 'nobody@example.com' } });
  assert.equal(unknownEmail.status, 404);

  const stranger = await signupOnboarded(server.baseUrl, 'stranger1');
  const nonCoach = await call(server.baseUrl, 'POST', `/orgs/${org.id}/athletes`, { token: stranger.token, body: { email: 'nobody@example.com' } });
  assert.equal(nonCoach.status, 403);
});
