// Thin wrapper around the Anthropic API. Every caller must work with no
// ANTHROPIC_API_KEY set — this is the piece meant to activate the moment a
// real key is supplied, not something the rest of the app depends on.
let Anthropic = null;
try {
  // Lazy require so a missing/broken install doesn't crash the app when unused.
  Anthropic = require('@anthropic-ai/sdk');
} catch {
  Anthropic = null;
}

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5';

let client = null;
function getClient() {
  if (!Anthropic || !process.env.ANTHROPIC_API_KEY) return null;
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

function isAvailable() {
  return getClient() !== null;
}

// Returns generated text, or null if no API key is configured or the call
// fails — callers must have a template-based fallback for both cases.
async function generateText({ system, prompt, maxTokens = 400 }) {
  const anthropic = getClient();
  if (!anthropic) return null;

  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: prompt }],
    });
    const text = response.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('\n')
      .trim();
    return text || null;
  } catch (err) {
    console.error('llmClient.generateText failed, falling back to template:', err.message);
    return null;
  }
}

// Same contract as generateText, but with image inputs (Claude's vision
// capability -- there's no separate "video" endpoint; frame/photo images are
// the actual API surface). images: [{ mediaType: 'image/jpeg'|'image/png', data: base64 }].
async function generateVisionText({ system, prompt, images, maxTokens = 500 }) {
  const anthropic = getClient();
  if (!anthropic) return null;

  try {
    const content = [
      { type: 'text', text: prompt },
      ...images.map((img) => ({ type: 'image', source: { type: 'base64', media_type: img.mediaType, data: img.data } })),
    ];
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content }],
    });
    const text = response.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('\n')
      .trim();
    return text || null;
  } catch (err) {
    console.error('llmClient.generateVisionText failed:', err.message);
    return null;
  }
}

module.exports = { generateText, generateVisionText, isAvailable };
