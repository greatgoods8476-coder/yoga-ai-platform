const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parseSorenessText } = require('../src/services/sorenessParser');

// No ANTHROPIC_API_KEY is set in the test environment -- same no-LLM-configured
// code paths every caller must handle (see llmClient.js), matching the pattern
// in answerParser.test.js.

test('parseSorenessText: empty text returns no soreness without calling the model', async () => {
  const result = await parseSorenessText('   ');
  assert.deepEqual(result, { soreness: {}, unavailable: false });
});

test('parseSorenessText: non-empty text reports unavailable when no LLM is configured', async () => {
  const result = await parseSorenessText('my hips and hamstrings are pretty sore today');
  assert.deepEqual(result, { soreness: {}, unavailable: true });
});
