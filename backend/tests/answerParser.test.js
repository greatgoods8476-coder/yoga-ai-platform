const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parseOpenEndedAnswer } = require('../src/services/answerParser');

// No ANTHROPIC_API_KEY is set in the test environment, so these exercise the
// no-LLM-configured code paths -- the one every caller must handle regardless
// of whether a key is ever set (see llmClient.js).

test('parseOpenEndedAnswer: text fields pass through directly, no LLM required', async () => {
  const field = { key: 'occupation', type: 'text', prompt: 'What do you do?' };
  const result = await parseOpenEndedAnswer(field, '  physical therapist  ');
  assert.deepEqual(result, { value: 'physical therapist' });
});

test('parseOpenEndedAnswer: multi_text fields split on commas, no LLM required', async () => {
  const field = { key: 'past_injuries', type: 'multi_text', prompt: 'Past injuries?' };
  const result = await parseOpenEndedAnswer(field, 'torn ACL, shoulder impingement');
  assert.deepEqual(result, { value: ['torn ACL', 'shoulder impingement'] });
});

test('parseOpenEndedAnswer: empty answer returns null value without calling the model', async () => {
  const field = { key: 'fitness_level', type: 'single_select', options: ['beginner', 'advanced'], prompt: 'Fitness level?' };
  const result = await parseOpenEndedAnswer(field, '   ');
  assert.deepEqual(result, { value: null });
});

test('parseOpenEndedAnswer: single_select/scale fields report unavailable when no LLM is configured', async () => {
  const selectField = { key: 'fitness_level', type: 'single_select', options: ['beginner', 'advanced'], prompt: 'Fitness level?' };
  const selectResult = await parseOpenEndedAnswer(selectField, 'pretty fit, I lift weights 5x a week');
  assert.deepEqual(selectResult, { value: null, unavailable: true });

  const scaleField = { key: 'knee_pain', type: 'scale', min: 0, max: 5, prompt: 'Knee pain?' };
  const scaleResult = await parseOpenEndedAnswer(scaleField, 'moderate, maybe a 3');
  assert.deepEqual(scaleResult, { value: null, unavailable: true });
});
