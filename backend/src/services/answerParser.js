// Turns a free-text onboarding answer into the exact structured value the
// rest of the app already relies on (buildProfileUpdate, routine generation,
// level assessment all expect fixed option strings / numbers, not prose).
// Never guesses: if the model can't confidently map the answer, this returns
// null rather than silently storing something wrong — some of these fields
// (injury/pain severity) gate which poses are even safe to suggest.
const { generateText, isAvailable } = require('./llmClient');

function buildInstructions(field) {
  switch (field.type) {
    case 'single_select':
      return `Respond with exactly one of these values, spelled exactly as shown: ${field.options.join(', ')}`;
    case 'multi_select':
      return `Respond with a comma-separated list using only these exact values: ${field.options.join(', ')}. If none apply, respond with exactly: none`;
    case 'scale':
    case 'number':
      return `Respond with a single whole number between ${field.min} and ${field.max}, nothing else.`;
    default:
      return 'Respond with a short, direct answer.';
  }
}

function validateAndCoerce(field, raw) {
  const trimmed = raw.trim();
  if (trimmed.toUpperCase() === 'UNSURE' || trimmed === '') return null;

  if (field.type === 'single_select') {
    const match = (field.options || []).find((o) => o.toLowerCase() === trimmed.toLowerCase());
    return match || null;
  }

  if (field.type === 'multi_select') {
    if (trimmed.toLowerCase() === 'none') return [];
    const picked = trimmed.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
    const resolved = picked
      .map((p) => (field.options || []).find((o) => o.toLowerCase() === p))
      .filter(Boolean);
    return resolved.length > 0 ? resolved : null;
  }

  if (field.type === 'scale' || field.type === 'number') {
    const n = parseInt(trimmed, 10);
    if (!Number.isFinite(n)) return null;
    if (field.min !== undefined && n < field.min) return null;
    if (field.max !== undefined && n > field.max) return null;
    return n;
  }

  // text / multi_text: already free-form by nature, nothing to coerce.
  return field.type === 'multi_text' ? [trimmed] : trimmed;
}

// Returns { value } on success (value may be [] for a valid "none" answer),
// or { value: null, unavailable: true } if there's no LLM configured at all,
// or { value: null } if the model couldn't confidently parse the answer.
async function parseOpenEndedAnswer(field, freeText) {
  if (!freeText || !String(freeText).trim()) return { value: null };

  // text/multi_text fields are already open-ended by design -- no LLM needed,
  // and no API key required, matching how they already behave in the app.
  if (field.type === 'text') return { value: String(freeText).trim() };
  if (field.type === 'multi_text') return { value: String(freeText).split(',').map((s) => s.trim()).filter(Boolean) };

  if (!isAvailable()) return { value: null, unavailable: true };

  const system = 'You extract one structured value from a user\'s free-text answer to an onboarding '
    + 'question. Respond with ONLY the extracted value, in the exact format requested -- no explanation, '
    + 'no extra words, no punctuation beyond what\'s asked for. If the answer genuinely does not give '
    + 'enough information to confidently determine the value, respond with exactly: UNSURE';
  const prompt = `Question: "${field.prompt}"\n${buildInstructions(field)}\n\nUser's answer: "${String(freeText).trim()}"`;

  const raw = await generateText({ system, prompt, maxTokens: 60 });
  if (raw === null) return { value: null };

  return { value: validateAndCoerce(field, raw) };
}

module.exports = { parseOpenEndedAnswer };
