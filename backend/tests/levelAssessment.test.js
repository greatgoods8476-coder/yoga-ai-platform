const { test } = require('node:test');
const assert = require('node:assert/strict');
const { stepLevel, decideLevelChange, LEVELS } = require('../src/services/levelAssessment');

test('stepLevel: moves one step up or down the ladder, bounded at both ends', () => {
  assert.equal(stepLevel('rooted_beginner', 'up'), 'growing_practice');
  assert.equal(stepLevel('growing_practice', 'up'), 'confident_flow');
  assert.equal(stepLevel('deep_practice', 'up'), 'deep_practice'); // already at the top
  assert.equal(stepLevel('rooted_beginner', 'down'), 'rooted_beginner'); // already at the bottom
  assert.equal(stepLevel('confident_flow', 'down'), 'growing_practice');
});

test('stepLevel: an unknown level key is returned unchanged', () => {
  assert.equal(stepLevel('not_a_real_level', 'up'), 'not_a_real_level');
});

test('LEVELS ladder is in ascending order (sanity check the other tests rely on)', () => {
  const keys = LEVELS.map((l) => l.level);
  assert.deepEqual(keys, ['rooted_beginner', 'growing_practice', 'confident_flow', 'deep_practice']);
});

test('decideLevelChange: promotes only when the model says improved AND the flag count didn\'t get worse', () => {
  assert.equal(decideLevelChange('improved', 2, 1), 'up');
  assert.equal(decideLevelChange('improved', 2, 2), 'up');
  assert.equal(decideLevelChange('improved', 1, 2), null, 'model says improved but flags went up -- conflicting signals, no change');
});

test('decideLevelChange: demotes only when the model says regressed AND the flag count didn\'t get better', () => {
  assert.equal(decideLevelChange('regressed', 1, 2), 'down');
  assert.equal(decideLevelChange('regressed', 1, 1), 'down');
  assert.equal(decideLevelChange('regressed', 2, 1), null, 'model says regressed but flags went down -- conflicting signals, no change');
});

test('decideLevelChange: "same" trend or no trend never changes the level', () => {
  assert.equal(decideLevelChange('same', 1, 1), null);
  assert.equal(decideLevelChange(null, 1, 1), null);
});
