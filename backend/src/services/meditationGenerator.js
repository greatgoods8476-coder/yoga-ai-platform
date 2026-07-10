const CATEGORIES = require('../data/meditationCategories');

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

module.exports = { generateScript, CATEGORIES };
