const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { startTestServer, call, uniqueEmail } = require('./util');
const { generateScriptWithLLM, generateScript } = require('../src/services/meditationGenerator');
const { isAvailable } = require('../src/services/llmClient');
const pool = require('../src/db/pool');

after(() => pool.end());

test('meditationGenerator: without an API key, the LLM path falls back to the deterministic template', async () => {
  assert.equal(isAvailable(), false, 'this test assumes ANTHROPIC_API_KEY is not set in the test environment');
  const llm = await generateScriptWithLLM({ category: 'stress', durationSec: 120 });
  const template = generateScript({ category: 'stress', durationSec: 120 });
  assert.equal(llm.script, template.script);
  assert.equal(llm.generatedBy, undefined, 'should not claim LLM generation when it fell back to the template');
});

test('meditations: generates a script for a valid category and rejects an invalid one', async (t) => {
  const server = await startTestServer();
  t.after(() => server.close());

  const { body: signup } = await call(server.baseUrl, 'POST', '/auth/signup', {
    body: { email: uniqueEmail('med'), password: 'password123' },
  });

  const ok = await call(server.baseUrl, 'POST', '/meditations/generate', {
    token: signup.token, body: { category: 'sleep', durationSec: 180 },
  });
  assert.equal(ok.status, 201);
  assert.ok(ok.body.meditation.script.length > 0);

  const bad = await call(server.baseUrl, 'POST', '/meditations/generate', {
    token: signup.token, body: { category: 'not-a-real-category' },
  });
  assert.equal(bad.status, 400);
});

test('meditations: completing a session adds meditation minutes to today\'s progress', async (t) => {
  const server = await startTestServer();
  t.after(() => server.close());

  const { body: signup } = await call(server.baseUrl, 'POST', '/auth/signup', {
    body: { email: uniqueEmail('medcomplete'), password: 'password123' },
  });

  const generated = await call(server.baseUrl, 'POST', '/meditations/generate', {
    token: signup.token, body: { category: 'focus', durationSec: 300 },
  });
  const completed = await call(server.baseUrl, 'POST', `/meditations/${generated.body.meditation.id}/complete`, { token: signup.token });
  assert.equal(completed.status, 200);

  const dashboard = await call(server.baseUrl, 'GET', '/progress/dashboard', { token: signup.token });
  assert.equal(dashboard.body.totals.meditationMinutes, 5);
});
