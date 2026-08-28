// Turns an athlete's free-text "what's sore today" answer into the exact
// body-area vocabulary routineGenerator.scorePose already checks against
// pose.primary_muscles (see poses.js / seed.js) -- not a prettier list that
// would silently never match anything. A friendlier synonym list widens
// what the model is allowed to hear without changing what gets stored.
const { generateText, isAvailable } = require('./llmClient');

const SORENESS_AREAS = [
  'neck', 'shoulders', 'upperback', 'lowerback', 'back', 'spine', 'spinalerectors',
  'chest', 'core', 'obliques', 'hips', 'hipflexors', 'hiprotators', 'outerhips',
  'groin', 'innerthighs', 'glutes', 'hamstrings', 'quadriceps', 'calves', 'ankles',
  'wrists', 'throat', 'diaphragm',
];

function buildSystem() {
  return 'An athlete is describing what feels sore, tight, or bothered today, in their own words. '
    + `Extract which of these exact body areas they mentioned, spelled exactly as shown: ${SORENESS_AREAS.join(', ')} `
    + '(map casual wording to the closest one -- e.g. "lower back" -> lowerback, "quads" -> quadriceps, '
    + '"butt"/"glute" -> glutes, "groin"/"inner thigh" -> groin or innerthighs, "hip flexor" -> hipflexors). '
    + 'For each area mentioned, estimate severity 1 (barely noticeable) to 5 (significant pain) from their '
    + 'wording -- "a little tight"/"kind of sore" is 1-2, "pretty sore"/"really tight" is 3-4, "can barely move '
    + 'it"/"sharp pain"/"hurts a lot" is 5. Respond with ONLY a comma-separated list of area=severity pairs '
    + 'using those exact area names, nothing else. If nothing sounds sore, respond with exactly: none';
}

function parseResponse(raw) {
  const soreness = {};
  if (raw.trim().toLowerCase() === 'none') return soreness;
  for (const pair of raw.split(',')) {
    const [rawKey, rawValue] = pair.split('=').map((s) => s && s.trim());
    if (!rawKey) continue;
    const key = rawKey.toLowerCase();
    if (!SORENESS_AREAS.includes(key)) continue;
    const n = parseInt(rawValue, 10);
    if (Number.isFinite(n) && n >= 1 && n <= 5) soreness[key] = n;
  }
  return soreness;
}

// freeText: the athlete's own words, e.g. "my hips are pretty sore and my
// left shoulder feels tight". Returns { soreness, unavailable }. soreness
// is {} both when nothing sounds sore AND when no LLM is configured -- the
// check-in itself (and any notes) still saves either way, this just won't
// bias pose selection without an API key, same graceful-degrade pattern the
// rest of the AI features use.
async function parseSorenessText(freeText) {
  const trimmed = String(freeText || '').trim();
  if (!trimmed) return { soreness: {}, unavailable: false };
  if (!isAvailable()) return { soreness: {}, unavailable: true };

  const raw = await generateText({ system: buildSystem(), prompt: `Athlete's answer: "${trimmed}"`, maxTokens: 100 });
  if (raw === null) return { soreness: {}, unavailable: false };

  return { soreness: parseResponse(raw), unavailable: false };
}

module.exports = { parseSorenessText, SORENESS_AREAS };
