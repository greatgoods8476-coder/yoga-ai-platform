const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { startTestServer, call, uniqueEmail } = require('./util');
const { completeOnboarding } = require('./fixtures');
const { sequencePhase } = require('../src/services/routineGenerator');
const pool = require('../src/db/pool');

after(() => pool.end());

test('sequencePhase: classifies representative poses into the expected stage', () => {
  assert.equal(sequencePhase({ category: 'tabletop', difficulty: 'beginner', focus_tags: [] }), 'warm_up');
  assert.equal(sequencePhase({ category: 'standing', difficulty: 'beginner', focus_tags: [] }), 'warm_up');
  assert.equal(sequencePhase({ category: 'standing', difficulty: 'intermediate', focus_tags: ['strength'] }), 'build');
  assert.equal(sequencePhase({ category: 'inversion', difficulty: 'advanced', focus_tags: [] }), 'peak');
  assert.equal(sequencePhase({ category: 'backbend', difficulty: 'advanced', focus_tags: ['backbend'] }), 'peak');
  assert.equal(sequencePhase({ category: 'restorative', difficulty: 'beginner', focus_tags: [] }), 'cooldown');
  assert.equal(sequencePhase({ category: 'supine', difficulty: 'beginner', focus_tags: [] }), 'cooldown');
  assert.equal(sequencePhase({ category: 'supine', difficulty: 'beginner', focus_tags: ['backbend'] }), 'build');
  assert.equal(sequencePhase({ category: 'breathwork', difficulty: 'beginner', focus_tags: ['calming'] }), 'cooldown');
  assert.equal(sequencePhase({ category: 'breathwork', difficulty: 'advanced', focus_tags: ['energizing'] }), 'warm_up');
  // A beginner-difficulty inversion (Downward Dog) is a flow pose, not a
  // session peak — only intermediate+ inversions/arm balances/backbends count.
  assert.equal(sequencePhase({ category: 'inversion', difficulty: 'beginner', focus_tags: ['inversion'] }), 'build');
  assert.equal(sequencePhase({ category: 'inversion', difficulty: 'intermediate', focus_tags: [] }), 'peak');
});

test('routine generation: a full-length session progresses warm_up -> build -> peak -> cooldown, not sorted purely by score', async (t) => {
  const server = await startTestServer();
  t.after(() => server.close());

  const { body: signup } = await call(server.baseUrl, 'POST', '/auth/signup', {
    body: { email: uniqueEmail('seq'), password: 'password123' },
  });
  // advanced + broad equipment so peak-phase poses (arm balances, inversions) are eligible
  await completeOnboarding(server.baseUrl, signup.token, {
    yoga_experience: 'advanced', fitness_level: 'advanced',
    available_equipment: ['mat', 'blocks', 'strap', 'bolster', 'wall', 'chair'],
    current_injuries: ['none'], back_pain: 0, neck_pain: 0, hip_pain: 0, knee_pain: 0,
  });

  const res = await call(server.baseUrl, 'POST', '/routines/generate', {
    token: signup.token, body: { routineType: 'one_hour_full_body', durationMin: 30 },
  });
  assert.equal(res.status, 201);

  const PHASE_RANK = { warm_up: 0, build: 1, peak: 2, cooldown: 3 };
  const phases = res.body.items.map((it) => sequencePhase(it.pose));

  // The sequence of phase-ranks across the routine should be non-decreasing —
  // once we've moved past warm_up we shouldn't see another warm_up pose later,
  // etc. (a pure score-sorted list would freely interleave phases.)
  let maxSeen = -1;
  let outOfOrder = false;
  for (const phase of phases) {
    const rank = PHASE_RANK[phase];
    if (rank < maxSeen) outOfOrder = true;
    maxSeen = Math.max(maxSeen, rank);
  }
  assert.ok(!outOfOrder, `expected non-decreasing phase order, got: ${phases.join(', ')}`);

  // A 30-minute advanced session with full equipment should actually reach
  // a peak phase, not just warm_up/build/cooldown.
  assert.ok(phases.includes('peak'), `expected a peak phase in a 30-min advanced session, got: ${phases.join(', ')}`);
});

test('routine generation: a short session (< 10 min) skips formal phase structure', async (t) => {
  const server = await startTestServer();
  t.after(() => server.close());

  const { body: signup } = await call(server.baseUrl, 'POST', '/auth/signup', {
    body: { email: uniqueEmail('seqshort'), password: 'password123' },
  });
  await completeOnboarding(server.baseUrl, signup.token);

  const res = await call(server.baseUrl, 'POST', '/routines/generate', {
    token: signup.token, body: { routineType: 'five_minute_stretch' },
  });
  assert.equal(res.status, 201);
  assert.ok(res.body.items.length > 0);
});
