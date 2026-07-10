const SKIP_COUNT_TO_AVOID = 3;
const SORENESS_DECAY = 0.6;
const SORENESS_FLOOR = 0.5;

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

// Folds one session's feedback into the rolling adaptation_state so the next
// generated routine responds to it (difficulty, sore areas, poses to avoid).
function applyFeedback(state, feedback) {
  const {
    difficultyFeedback, painReported = {}, skippedPoseIds = [], enjoymentRating, routineId,
  } = feedback;

  let trend = state.difficultyTrend || 0;
  if (difficultyFeedback === 'too_easy') trend = clamp(trend + 1, -3, 3);
  else if (difficultyFeedback === 'too_hard') trend = clamp(trend - 1, -3, 3);
  else if (difficultyFeedback === 'just_right') trend *= 0.5;

  const soreness = { ...(state.sorenessAreas || {}) };
  for (const key of Object.keys(soreness)) {
    soreness[key] = soreness[key] * SORENESS_DECAY;
  }
  for (const [area, severity] of Object.entries(painReported)) {
    soreness[area] = Math.max(soreness[area] || 0, Number(severity) || 0);
  }
  for (const key of Object.keys(soreness)) {
    if (soreness[key] < SORENESS_FLOOR) delete soreness[key];
  }

  const skipCounts = { ...(state.skipCounts || {}) };
  for (const poseId of skippedPoseIds) {
    skipCounts[poseId] = (skipCounts[poseId] || 0) + 1;
  }
  const avoidedPoses = new Set(state.avoidedPoses || []);
  for (const [poseId, count] of Object.entries(skipCounts)) {
    if (count >= SKIP_COUNT_TO_AVOID) avoidedPoses.add(poseId);
  }

  const recentEnjoyment = [...(state.recentEnjoyment || [])];
  if (enjoymentRating !== undefined && enjoymentRating !== null) {
    recentEnjoyment.push({ routineId, rating: enjoymentRating });
  }

  return {
    difficultyTrend: trend,
    sorenessAreas: soreness,
    skipCounts,
    avoidedPoses: [...avoidedPoses],
    recentEnjoyment: recentEnjoyment.slice(-10),
  };
}

module.exports = { applyFeedback };
