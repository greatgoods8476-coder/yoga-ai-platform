const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { startTestServer, call, uniqueEmail } = require('./util');
const pool = require('../src/db/pool');

after(() => pool.end());

async function signup(baseUrl, prefix) {
  const email = uniqueEmail(prefix);
  const { body } = await call(baseUrl, 'POST', '/auth/signup', { body: { email, password: 'password123' } });
  return { ...body, email };
}

test('social: full friend request -> accept -> leaderboard flow', async (t) => {
  const server = await startTestServer();
  t.after(() => server.close());

  const a = await signup(server.baseUrl, 'social-a');
  const b = await signup(server.baseUrl, 'social-b');

  const req1 = await call(server.baseUrl, 'POST', '/social/friends/request', { token: a.token, body: { email: b.email } });
  assert.equal(req1.status, 201);
  assert.equal(req1.body.friendship.status, 'pending');

  const incoming = await call(server.baseUrl, 'GET', '/social/friends/requests', { token: b.token });
  assert.equal(incoming.status, 200);
  assert.equal(incoming.body.requests.length, 1);
  assert.equal(incoming.body.requests[0].email, a.email);

  const accept = await call(server.baseUrl, 'POST', `/social/friends/${req1.body.friendship.id}/accept`, { token: b.token });
  assert.equal(accept.status, 200);
  assert.equal(accept.body.friendship.status, 'accepted');

  const friendsOfA = await call(server.baseUrl, 'GET', '/social/friends', { token: a.token });
  assert.equal(friendsOfA.body.friends.length, 1);
  assert.equal(friendsOfA.body.friends[0].friend_user_id, b.userId);

  const friendsOfB = await call(server.baseUrl, 'GET', '/social/friends', { token: b.token });
  assert.equal(friendsOfB.body.friends.length, 1);
  assert.equal(friendsOfB.body.friends[0].friend_user_id, a.userId);

  const leaderboard = await call(server.baseUrl, 'GET', '/social/leaderboard', { token: a.token });
  assert.equal(leaderboard.status, 200);
  const ids = leaderboard.body.leaderboard.map((r) => r.user_id).sort();
  assert.deepEqual(ids, [a.userId, b.userId].sort());
  assert.ok(leaderboard.body.leaderboard.find((r) => r.user_id === a.userId).isYou);
});

test('social: cannot friend request yourself, a nonexistent email, or send a duplicate pending request', async (t) => {
  const server = await startTestServer();
  t.after(() => server.close());

  const a = await signup(server.baseUrl, 'social-self');
  const b = await signup(server.baseUrl, 'social-dup');

  const self = await call(server.baseUrl, 'POST', '/social/friends/request', { token: a.token, body: { email: a.email } });
  assert.equal(self.status, 400);

  const missing = await call(server.baseUrl, 'POST', '/social/friends/request', { token: a.token, body: { email: 'nobody-here@example.com' } });
  assert.equal(missing.status, 404);

  const first = await call(server.baseUrl, 'POST', '/social/friends/request', { token: a.token, body: { email: b.email } });
  assert.equal(first.status, 201);
  const dupe = await call(server.baseUrl, 'POST', '/social/friends/request', { token: a.token, body: { email: b.email } });
  assert.equal(dupe.status, 409);
});

test('social: declining a request removes it, and a fresh request can be sent afterward', async (t) => {
  const server = await startTestServer();
  t.after(() => server.close());

  const a = await signup(server.baseUrl, 'social-decline-a');
  const b = await signup(server.baseUrl, 'social-decline-b');

  const req1 = await call(server.baseUrl, 'POST', '/social/friends/request', { token: a.token, body: { email: b.email } });
  const declined = await call(server.baseUrl, 'POST', `/social/friends/${req1.body.friendship.id}/decline`, { token: b.token });
  assert.equal(declined.status, 200);

  const req2 = await call(server.baseUrl, 'POST', '/social/friends/request', { token: a.token, body: { email: b.email } });
  assert.equal(req2.status, 201, 'should be able to re-request after a decline');
});

test('social: leaderboard only includes accepted friends, not everyone', async (t) => {
  const server = await startTestServer();
  t.after(() => server.close());

  const a = await signup(server.baseUrl, 'social-lb-a');
  const stranger = await signup(server.baseUrl, 'social-lb-stranger');

  const leaderboard = await call(server.baseUrl, 'GET', '/social/leaderboard', { token: a.token });
  assert.equal(leaderboard.status, 200);
  assert.equal(leaderboard.body.leaderboard.length, 1);
  assert.equal(leaderboard.body.leaderboard[0].user_id, a.userId);
  assert.ok(!leaderboard.body.leaderboard.some((r) => r.user_id === stranger.userId));
});
