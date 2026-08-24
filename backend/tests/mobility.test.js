const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { startTestServer, call, uniqueEmail } = require('./util');
const { signupAndOnboard } = require('./fixtures');
const pool = require('../src/db/pool');

after(() => pool.end());

test('GET /mobility/test-poses lists the fixed stretch-test poses', async (t) => {
  const server = await startTestServer();
  t.after(() => server.close());

  const athlete = await signupAndOnboard(server.baseUrl, uniqueEmail('mobposes'), 'password123');
  const res = await call(server.baseUrl, 'GET', '/mobility/test-poses', { token: athlete.token });
  assert.equal(res.status, 200);
  assert.ok(res.body.poses.length >= 3);
  assert.ok(res.body.poses.every((p) => p.key && p.label && p.instructions));
});

test('POST /mobility/tests reports unavailable when no LLM is configured (test env has no ANTHROPIC_API_KEY)', async (t) => {
  const server = await startTestServer();
  t.after(() => server.close());

  const athlete = await signupAndOnboard(server.baseUrl, uniqueEmail('mobnoai'), 'password123');
  const res = await call(server.baseUrl, 'POST', '/mobility/tests', {
    token: athlete.token,
    body: { photos: [{ poseKey: 'foot_ankle', mediaType: 'image/jpeg', data: 'ZmFrZS1pbWFnZS1kYXRh' }] },
  });
  assert.equal(res.status, 409);
  assert.equal(res.body.error, 'AI mobility assessment is not configured on this server');
});

test('POST /mobility/tests validates photos before ever calling the model', async (t) => {
  const server = await startTestServer();
  t.after(() => server.close());

  const athlete = await signupAndOnboard(server.baseUrl, uniqueEmail('mobvalidate'), 'password123');

  const noPhotos = await call(server.baseUrl, 'POST', '/mobility/tests', { token: athlete.token, body: { photos: [] } });
  assert.equal(noPhotos.status, 400);

  const badPose = await call(server.baseUrl, 'POST', '/mobility/tests', {
    token: athlete.token, body: { photos: [{ poseKey: 'not_a_real_pose', mediaType: 'image/jpeg', data: 'abc' }] },
  });
  assert.equal(badPose.status, 400);

  const badMediaType = await call(server.baseUrl, 'POST', '/mobility/tests', {
    token: athlete.token, body: { photos: [{ poseKey: 'foot_ankle', mediaType: 'image/gif', data: 'abc' }] },
  });
  assert.equal(badMediaType.status, 400);

  const missingData = await call(server.baseUrl, 'POST', '/mobility/tests', {
    token: athlete.token, body: { photos: [{ poseKey: 'foot_ankle', mediaType: 'image/jpeg' }] },
  });
  assert.equal(missingData.status, 400);
});

test('POST /mobility/tests still 409s cleanly (no crash) when a prior test exists to compare against', async (t) => {
  const server = await startTestServer();
  t.after(() => server.close());

  const athlete = await signupAndOnboard(server.baseUrl, uniqueEmail('mobprior'), 'password123');
  await pool.query(
    `INSERT INTO mobility_tests (user_id, photos, assessment, flagged_limitations)
     VALUES ($1, '[]', 'previous assessment text', $2)`,
    [athlete.userId, ['hip_opener']]
  );

  const res = await call(server.baseUrl, 'POST', '/mobility/tests', {
    token: athlete.token,
    body: { photos: [{ poseKey: 'foot_ankle', mediaType: 'image/jpeg', data: 'ZmFrZS1pbWFnZS1kYXRh' }] },
  });
  assert.equal(res.status, 409);

  const latest = await call(server.baseUrl, 'GET', '/mobility/tests/latest', { token: athlete.token });
  assert.equal(latest.body.test.assessment, 'previous assessment text');
});

test('GET /mobility/tests and /mobility/tests/latest return empty state cleanly before any test exists', async (t) => {
  const server = await startTestServer();
  t.after(() => server.close());

  const athlete = await signupAndOnboard(server.baseUrl, uniqueEmail('mobempty'), 'password123');
  const list = await call(server.baseUrl, 'GET', '/mobility/tests', { token: athlete.token });
  assert.deepEqual(list.body.tests, []);

  const latest = await call(server.baseUrl, 'GET', '/mobility/tests/latest', { token: athlete.token });
  assert.equal(latest.body.test, null);
});
