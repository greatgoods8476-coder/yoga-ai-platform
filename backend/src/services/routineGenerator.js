const crypto = require('crypto');
const ROUTINE_TYPES = require('../data/routineTypes');

const DIFFICULTY_RANK = { beginner: 0, intermediate: 1, advanced: 2 };

// Values here are matched against a pose's `category` (position family) OR
// its `focus_tags` (cross-cutting functional labels) — see tagMatches().
const GOAL_CATEGORY_MAP = {
  flexibility: ['hamstring', 'hip_opener', 'chest_opener', 'shoulder_opener'],
  mobility: ['hip_opener', 'shoulder_opener', 'spine_mobility'],
  pain_reduction: ['restorative', 'office_friendly'],
  stress_reduction: ['restorative', 'calming', 'breathwork'],
  posture: ['backbend', 'chest_opener', 'office_friendly', 'posture'],
  balance: ['balance'],
  recovery: ['restorative', 'hamstring'],
  breathing: ['breathwork'],
  mindfulness: ['calming', 'restorative', 'breathwork'],
  sleep: ['restorative', 'sleep', 'calming'],
  strength: ['strength', 'core', 'arm_balance'],
  body_awareness: ['balance'],
  habit_building: [],
};

function tagMatches(pose, tags) {
  return tags.some((t) => t === pose.category || (pose.focus_tags || []).includes(t));
}

const JOINT_PAIN_TAGS = ['back', 'neck', 'hip', 'knee'];
const JOINT_PAIN_SEVERITY_THRESHOLD = 3;

// Deterministic 0..1 pseudo-random value so the same user gets a stable-but-
// varying pick per pose per day, instead of true randomness (reproducible,
// debuggable) or a static top-N (repetitive).
function jitter(seedParts) {
  const hash = crypto.createHash('sha256').update(seedParts.join('|')).digest();
  return hash.readUInt32BE(0) / 0xffffffff;
}

function targetDifficulty(profile, routineType) {
  if (routineType.targetDifficulty) return routineType.targetDifficulty;

  const base = { none: 'beginner', beginner: 'beginner', intermediate: 'intermediate', advanced: 'advanced' };
  let rank = DIFFICULTY_RANK[base[profile.yoga_experience] || 'beginner'];

  const trend = profile.adaptation_state?.difficultyTrend || 0;
  if (trend >= 2) rank = Math.min(2, rank + 1);
  if (trend <= -2) rank = Math.max(0, rank - 1);

  return Object.keys(DIFFICULTY_RANK).find((k) => DIFFICULTY_RANK[k] === rank);
}

// This is a simplified rule-based safety heuristic, not medical advice —
// real contraindications need a clinician's sign-off, especially for pregnancy.
function isSafeForProfile(pose, profile) {
  const injuries = (profile.current_injuries || []).map((s) => s.toLowerCase());
  const jointPain = profile.joint_pain || {};

  for (const tag of pose.contraindications || []) {
    if (injuries.some((injury) => injury.includes(tag))) return false;
    if (JOINT_PAIN_TAGS.includes(tag) && (jointPain[tag] || 0) >= JOINT_PAIN_SEVERITY_THRESHOLD) return false;
  }

  if (profile.pregnancy_status === 'pregnant') {
    const isPrenatalOverride = (pose.styles || []).includes('prenatal') || (pose.focus_tags || []).includes('prenatal_safe');
    const isGentle = ['breathwork', 'restorative', 'seated', 'tabletop'].includes(pose.category);
    const isRisky = ['arm_balance', 'inversion', 'backbend', 'balance'].includes(pose.category)
      || (pose.focus_tags || []).includes('backbend') || (pose.focus_tags || []).includes('twist');
    if (!isPrenatalOverride && (!isGentle || isRisky)) return false;
  }

  const equipment = profile.available_equipment || [];
  if ((pose.equipment || []).length > 0) {
    const hasNone = equipment.includes('none') || equipment.length === 0;
    const overlaps = pose.equipment.some((e) => equipment.includes(e));
    if (hasNone && !overlaps) return false;
    if (!hasNone && !overlaps) return false;
  }

  const avoided = profile.adaptation_state?.avoidedPoses || [];
  if (avoided.includes(pose.id)) return false;

  return true;
}

// Which stage of a session this pose belongs in. Real yoga sequencing
// builds from gentle prep to a harder "peak" and back down to rest — a
// pure top-N-by-score list has no such shape, so it can hand a beginner an
// advanced backbend as the very first pose. This is a heuristic derived
// from category/difficulty/focus_tags, not a hand-tagged field, so it
// applies to every pose in the library without needing per-pose upkeep.
function sequencePhase(pose) {
  const tags = pose.focus_tags || [];

  if (pose.category === 'restorative') return 'cooldown';
  if (pose.category === 'supine' && !tags.includes('backbend') && !tags.includes('core') && !tags.includes('strength')) return 'cooldown';
  if (pose.category === 'breathwork') return tags.includes('energizing') ? 'warm_up' : 'cooldown';

  if (pose.difficulty === 'advanced') return 'peak';
  // A beginner-difficulty pose in one of these categories (e.g. Downward Dog,
  // a beginner 'inversion') is a build/flow pose in practice, not a peak —
  // only treat the category as peak-worthy once it's past beginner level.
  if (['arm_balance', 'inversion', 'backbend'].includes(pose.category) && pose.difficulty !== 'beginner') return 'peak';

  if (pose.category === 'tabletop') return 'warm_up';
  if (pose.difficulty === 'beginner' && ['standing', 'seated'].includes(pose.category)
    && !tags.includes('strength') && !tags.includes('balance')) return 'warm_up';

  return 'build';
}

const PHASE_ORDER = ['warm_up', 'build', 'peak', 'cooldown'];
const PHASE_BUDGET = { warm_up: 0.15, build: 0.45, peak: 0.25, cooldown: 0.15 };
// Below this, a session is too short for a formal warm-up/peak/cooldown
// shape (a 5-minute stretch doesn't need one) — just take the best poses.
const MIN_DURATION_FOR_PHASES_SEC = 600;

function fillFromGroup(group, budgetSec, recentPoseIds, startSec) {
  if (group.length === 0 || budgetSec <= 0) return { items: [], usedSec: 0 };

  const fresh = group.filter((s) => !recentPoseIds.includes(s.pose.id));
  const ordered = [...fresh, ...group.filter((s) => recentPoseIds.includes(s.pose.id))];

  const items = [];
  let usedSec = 0;
  let i = 0;
  while (usedSec < budgetSec && ordered.length > 0) {
    const candidate = ordered[i % ordered.length];
    const durationSec = candidate.pose.default_duration_sec;
    items.push({ pose: candidate.pose, durationSec, startSec: startSec + usedSec });
    usedSec += durationSec;
    i += 1;
    if (i > ordered.length * 3) break; // avoid infinite loop on a tiny group
  }
  return { items, usedSec };
}

// Buckets scored poses into warm_up/build/peak/cooldown and fills each
// phase's time budget in order, so the resulting routine actually has a
// shape instead of being sorted purely by score. Any phase with no eligible
// poses (e.g. peak, when pregnancy/injury safety rules excluded every
// advanced pose) donates its budget to 'build' rather than leaving a gap.
function assemblePhased(scored, targetDurationSec, recentPoseIds) {
  const groups = { warm_up: [], build: [], peak: [], cooldown: [] };
  for (const s of scored) groups[sequencePhase(s.pose)].push(s);

  const fractions = { ...PHASE_BUDGET };
  for (const phase of ['peak', 'warm_up', 'cooldown']) {
    if (groups[phase].length === 0) {
      fractions.build += fractions[phase];
      fractions[phase] = 0;
    }
  }

  const items = [];
  let totalSec = 0;
  for (const phase of PHASE_ORDER) {
    const budgetSec = fractions[phase] * targetDurationSec;
    const { items: phaseItems, usedSec } = fillFromGroup(groups[phase], budgetSec, recentPoseIds, totalSec);
    items.push(...phaseItems);
    totalSec += usedSec;
  }

  return { items, totalSec };
}

function scorePose(pose, profile, routineType, dateStamp) {
  let score = 0;

  if (tagMatches(pose, routineType.categories || [])) score += 3;

  for (const goal of profile.goals || []) {
    if (tagMatches(pose, GOAL_CATEGORY_MAP[goal] || [])) score += 2;
  }

  const favoredStyles = new Set([...(profile.favorite_yoga_styles || []), ...(routineType.stylesBias || [])]);
  if ((pose.styles || []).some((s) => favoredStyles.has(s))) score += 2;

  const target = targetDifficulty(profile, routineType);
  const diff = Math.abs(DIFFICULTY_RANK[pose.difficulty] - DIFFICULTY_RANK[target]);
  score += diff === 0 ? 1 : -diff;

  const soreness = profile.adaptation_state?.sorenessAreas || {};
  const isSore = (pose.primary_muscles || []).some((m) => (soreness[m] || 0) >= 3);
  if (isSore) score -= 3;

  score += jitter([profile.user_id, pose.id, dateStamp]) * 1.5;

  return score;
}

// poses: rows from the `poses` table. profile: user_profiles row.
// recentPoseIds: pose ids used in the user's immediately prior routine (for variety).
function generateRoutine({ profile, poses, routineTypeKey, recentPoseIds = [], durationMinOverride }) {
  const routineType = ROUTINE_TYPES[routineTypeKey] || ROUTINE_TYPES.custom;
  const dateStamp = new Date().toISOString().slice(0, 10);

  const safePoses = poses.filter((p) => isSafeForProfile(p, profile));
  const scored = safePoses
    .map((pose) => ({ pose, score: scorePose(pose, profile, routineType, dateStamp) }))
    .sort((a, b) => b.score - a.score);

  const targetDurationSec = (durationMinOverride || routineType.durationMin || 20) * 60;

  let items, totalSec;
  if (targetDurationSec >= MIN_DURATION_FOR_PHASES_SEC) {
    ({ items, totalSec } = assemblePhased(scored, targetDurationSec, recentPoseIds));
  } else {
    const flat = fillFromGroup(scored, targetDurationSec, recentPoseIds, 0);
    items = flat.items;
    totalSec = flat.usedSec;
  }

  return {
    title: routineType.title,
    goalTags: profile.goals || [],
    totalDurationSec: totalSec,
    items,
    generatedReason: {
      routineType: routineTypeKey,
      targetDifficulty: targetDifficulty(profile, routineType),
      topFactors: scored.slice(0, 3).map((s) => ({ pose: s.pose.slug, score: Math.round(s.score * 100) / 100 })),
    },
  };
}

module.exports = { generateRoutine, isSafeForProfile, scorePose, targetDifficulty, sequencePhase };
