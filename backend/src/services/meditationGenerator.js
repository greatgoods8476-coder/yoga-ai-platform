const CATEGORIES = require('../data/meditationCategories');
const llmClient = require('./llmClient');

const OPENINGS = {
  calm_meditative: 'Find a comfortable position. Let your eyes close, or soften your gaze.',
  traditional: 'Settle into your seat, spine tall, hands resting easy.',
  energetic: "Alright — take a seat, shake out any tension, and let's begin.",
  clinical_pt: 'Find a supported, comfortable position where your body can fully relax.',
  minimal: 'Get comfortable.',
  silent: '',
};

const CLOSINGS = {
  calm_meditative: 'When you are ready, gently bring your awareness back to the room.',
  traditional: 'Slowly deepen your breath, and open your eyes when ready.',
  energetic: "Great work. Take one more big breath, and let's carry this forward.",
  clinical_pt: 'Take your time returning to full alertness before standing.',
  minimal: 'Open your eyes when ready.',
  silent: '',
};

const PAUSE_SEC = 8;

// Builds a full script (with rough per-line timestamps) sized to durationSec
// by cycling through the category's technique lines with pauses between them.
function generateScript({ category, durationSec = 300, coachingStyle = 'calm_meditative', goal }) {
  const def = CATEGORIES[category] || CATEGORIES.relaxation;
  const style = OPENINGS[coachingStyle] ? coachingStyle : 'calm_meditative';

  const lines = [];
  let t = 0;

  const opening = OPENINGS[style];
  if (opening) {
    lines.push({ atSec: t, text: opening });
    t += PAUSE_SEC;
  }

  if (def.techniques.length > 0) {
    lines.push({ atSec: t, text: `This session is about ${def.focus}.` });
    t += PAUSE_SEC;

    let i = 0;
    while (t < durationSec - PAUSE_SEC * 2) {
      const technique = def.techniques[i % def.techniques.length];
      lines.push({ atSec: t, text: technique });
      t += PAUSE_SEC + 4;
      i += 1;
    }
  } else {
    lines.push({ atSec: t, text: `Silence for ${Math.round((durationSec - PAUSE_SEC * 2) / 60)} minutes. A bell will sound at the end.` });
    t = durationSec - PAUSE_SEC;
  }

  const closing = CLOSINGS[style];
  if (closing) lines.push({ atSec: Math.max(t, durationSec - PAUSE_SEC), text: closing });

  const script = lines.map((l) => l.text).filter(Boolean).join('\n\n');

  return { script, lines, category, goal: goal || def.focus, durationSec };
}

const COACHING_STYLE_DESCRIPTIONS = {
  calm_meditative: 'a soft, unhurried, meditative tone',
  traditional: 'a grounded, classical yoga-teacher tone',
  energetic: 'a warm but upbeat, encouraging tone',
  clinical_pt: 'a clear, clinical, physical-therapist tone — precise, reassuring, no mysticism',
  minimal: 'sparse, minimal language — short sentences, lots of silence implied',
  silent: 'almost no guidance at all, just a few grounding lines',
};

// Splits LLM output into timed lines the same shape as the template
// generator produces, spreading paragraphs evenly across durationSec so the
// mobile player can show text at roughly the right pace during the hold.
function toTimedLines(text, durationSec) {
  const paragraphs = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  if (paragraphs.length === 0) return [];
  const step = durationSec / paragraphs.length;
  return paragraphs.map((p, i) => ({ atSec: Math.round(i * step), text: p }));
}

// LLM-backed script generation for real variety session to session; falls
// back to the deterministic template (generateScript) with no API key
// configured, on any API error, or on a malformed/empty response — this
// must never be the only path or meditation generation breaks whenever the
// LLM is unavailable.
async function generateScriptWithLLM({ category, durationSec = 300, coachingStyle = 'calm_meditative', goal }) {
  if (!llmClient.isAvailable()) return generateScript({ category, durationSec, coachingStyle, goal });

  const def = CATEGORIES[category] || CATEGORIES.relaxation;
  const minutes = Math.round(durationSec / 60);
  const styleDesc = COACHING_STYLE_DESCRIPTIONS[coachingStyle] || COACHING_STYLE_DESCRIPTIONS.calm_meditative;

  const system = [
    'You write guided meditation scripts for a wellness app.',
    'Write only the spoken script — no headers, no stage directions, no asterisks, no explanations.',
    'Separate each spoken line/pause with a blank line so it can be paced out loud.',
    'Keep language plain, second-person, and inviting. Never use shame, urgency, or performance language.',
    'Never make medical claims, diagnose, or promise a specific health outcome — this is wellness content, not treatment.',
    "Never suggest breath retention or intense techniques unless the category explicitly calls for it, and even then keep it gentle.",
  ].join(' ');

  const prompt = [
    `Write a ${minutes}-minute guided meditation script for the "${category}" category.`,
    `The session's focus: ${def.focus}.`,
    `Coaching tone: ${styleDesc}.`,
    `Include a brief opening to settle in, several short guided passages (roughly one every 20-30 seconds of runtime), and a brief closing to return awareness to the room.`,
  ].join(' ');

  const text = await llmClient.generateText({ system, prompt, maxTokens: Math.min(1200, 200 + minutes * 60) });
  if (!text) return generateScript({ category, durationSec, coachingStyle, goal });

  const lines = toTimedLines(text, durationSec);
  if (lines.length === 0) return generateScript({ category, durationSec, coachingStyle, goal });

  return { script: text, lines, category, goal: goal || def.focus, durationSec, generatedBy: 'llm' };
}

module.exports = { generateScript, generateScriptWithLLM, CATEGORIES };
