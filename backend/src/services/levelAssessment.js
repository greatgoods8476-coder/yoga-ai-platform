// Turns onboarding answers into a friendly practice level, used to greet the
// user right after onboarding and to seed their first tailored class.

const SCALE_MAPS = {
  yoga_experience: { none: 0, beginner: 1, intermediate: 2, advanced: 3 },
  fitness_level: { beginner: 0, intermediate: 1, advanced: 2, athlete: 3 },
  current_flexibility: { poor: 0, fair: 1, good: 2, excellent: 3 },
  current_mobility: { limited: 0, moderate: 1, good: 2, excellent: 3 },
};

const LEVELS = [
  {
    level: 'rooted_beginner', label: 'Rooted Beginner', min: 0,
    tagline: "Everyone starts here — we'll build your foundation slow and steady.",
  },
  {
    level: 'growing_practice', label: 'Growing Practice', min: 1,
    tagline: "You've got some groundwork down — time to build consistency.",
  },
  {
    level: 'confident_flow', label: 'Confident Flow', min: 2,
    tagline: 'You move with intention — time to deepen your practice.',
  },
  {
    level: 'deep_practice', label: 'Deep Practice', min: 2.7,
    tagline: "Strong foundation, real capability — we'll push your edges safely.",
  },
];

const PAIN_FIELDS = ['back_pain', 'neck_pain', 'hip_pain', 'knee_pain'];

function assessYogaLevel(answers) {
  const scores = Object.keys(SCALE_MAPS).map((key) => SCALE_MAPS[key][answers[key]] ?? 0);
  const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;

  const painTotal = PAIN_FIELDS.reduce((sum, key) => sum + (Number(answers[key]) || 0), 0);
  const painMax = Math.max(0, ...PAIN_FIELDS.map((key) => Number(answers[key]) || 0));
  const hasCurrentInjury = Array.isArray(answers.current_injuries)
    && answers.current_injuries.some((v) => v && String(v).toLowerCase() !== 'none');
  const cautious = painTotal >= 8 || painMax >= 4 || hasCurrentInjury;

  let picked = [...LEVELS].reverse().find((l) => avgScore >= l.min) || LEVELS[0];
  if (cautious && picked.level !== 'rooted_beginner') picked = LEVELS[0];

  return { level: picked.level, label: picked.label, tagline: picked.tagline, cautious };
}

// Moves one step up or down the same LEVELS ladder assessYogaLevel picks
// from, bounded at both ends. Used by the mobility-test retest cycle to
// promote/demote based on measured progress rather than recomputing from
// onboarding answers (which don't change month to month).
function stepLevel(currentLevelKey, direction) {
  const index = LEVELS.findIndex((l) => l.level === currentLevelKey);
  if (index === -1) return currentLevelKey;

  const nextIndex = direction === 'up'
    ? Math.min(LEVELS.length - 1, index + 1)
    : direction === 'down'
      ? Math.max(0, index - 1)
      : index;

  return LEVELS[nextIndex].level;
}

function levelInfo(levelKey) {
  return LEVELS.find((l) => l.level === levelKey) || null;
}

// Combines the model's qualitative trend judgment (from a mobility retest)
// with a concrete, checkable signal -- did the flagged-limitation count
// actually go down or up -- before ever moving the athlete's level. Neither
// signal alone is trusted on its own, matching the safety-first spirit of
// assessYogaLevel's pain cap: a conflicting/ambiguous signal means no change.
function decideLevelChange(trend, prevFlaggedCount, newFlaggedCount) {
  if (trend === 'improved' && newFlaggedCount <= prevFlaggedCount) return 'up';
  if (trend === 'regressed' && newFlaggedCount >= prevFlaggedCount) return 'down';
  return null;
}

module.exports = { assessYogaLevel, stepLevel, levelInfo, decideLevelChange, LEVELS };
