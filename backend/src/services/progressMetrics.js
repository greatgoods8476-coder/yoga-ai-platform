const pool = require('../db/pool');

const EMA_ALPHA = 0.3; // weight given to the newest session vs. running average

function ema(previous, sample) {
  if (previous === null || previous === undefined) return sample;
  return previous * (1 - EMA_ALPHA) + sample * EMA_ALPHA;
}

// Rough proxy scores derived from completion quality — not a clinical
// flexibility/mobility measurement, just a trend indicator for the dashboard.
function deriveScoreDeltas({ completionPct, enjoymentRating, difficultyFeedback, goalTags = [] }) {
  const base = (completionPct / 100) * 100;
  const bump = difficultyFeedback === 'too_easy' ? 5 : difficultyFeedback === 'too_hard' ? -5 : 0;
  const sample = clampScore(base + bump);

  const deltas = {};
  if (goalTags.includes('flexibility')) deltas.flexibility_score = sample;
  if (goalTags.includes('mobility')) deltas.mobility_score = sample;
  if (goalTags.includes('balance')) deltas.balance_score = sample;
  if (goalTags.includes('strength')) deltas.strength_score = sample;
  if (goalTags.includes('stress_reduction')) deltas.stress_score = clampScore(100 - (enjoymentRating ? (5 - enjoymentRating) * 20 : 50));
  deltas.mood_score = enjoymentRating ? clampScore(enjoymentRating * 20) : undefined;
  return deltas;
}

function clampScore(n) {
  return Math.max(0, Math.min(100, n));
}

async function recordSessionCompletion({ userId, workoutMinutes, completionPct, enjoymentRating, difficultyFeedback, goalTags, avgHeartRate }) {
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

  const { rows: yRows } = await pool.query(
    'SELECT streak_days FROM progress_metrics WHERE user_id = $1 AND metric_date = $2',
    [userId, yesterday]
  );
  const { rows: existingRows } = await pool.query(
    'SELECT * FROM progress_metrics WHERE user_id = $1 AND metric_date = $2',
    [userId, today]
  );
  const existing = existingRows[0];
  const streak = existing ? existing.streak_days : (yRows[0]?.streak_days || 0) + 1;

  const deltas = deriveScoreDeltas({ completionPct, enjoymentRating, difficultyFeedback, goalTags });

  const next = {
    flexibility_score: deltas.flexibility_score !== undefined ? ema(existing?.flexibility_score, deltas.flexibility_score) : existing?.flexibility_score ?? null,
    mobility_score: deltas.mobility_score !== undefined ? ema(existing?.mobility_score, deltas.mobility_score) : existing?.mobility_score ?? null,
    balance_score: deltas.balance_score !== undefined ? ema(existing?.balance_score, deltas.balance_score) : existing?.balance_score ?? null,
    strength_score: deltas.strength_score !== undefined ? ema(existing?.strength_score, deltas.strength_score) : existing?.strength_score ?? null,
    mood_score: deltas.mood_score !== undefined ? ema(existing?.mood_score, deltas.mood_score) : existing?.mood_score ?? null,
    stress_score: deltas.stress_score !== undefined ? ema(existing?.stress_score, deltas.stress_score) : existing?.stress_score ?? null,
    workout_minutes: Number(existing?.workout_minutes || 0) + workoutMinutes,
    meditation_minutes: Number(existing?.meditation_minutes || 0),
    streak_days: streak,
    avg_heart_rate: avgHeartRate !== null && avgHeartRate !== undefined
      ? ema(existing?.avg_heart_rate, avgHeartRate)
      : existing?.avg_heart_rate ?? null,
  };

  await pool.query(
    `INSERT INTO progress_metrics (
       user_id, metric_date, flexibility_score, mobility_score, balance_score, strength_score,
       meditation_minutes, workout_minutes, streak_days, mood_score, stress_score, avg_heart_rate
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     ON CONFLICT (user_id, metric_date) DO UPDATE SET
       flexibility_score = EXCLUDED.flexibility_score,
       mobility_score = EXCLUDED.mobility_score,
       balance_score = EXCLUDED.balance_score,
       strength_score = EXCLUDED.strength_score,
       meditation_minutes = EXCLUDED.meditation_minutes,
       workout_minutes = EXCLUDED.workout_minutes,
       streak_days = EXCLUDED.streak_days,
       mood_score = EXCLUDED.mood_score,
       stress_score = EXCLUDED.stress_score,
       avg_heart_rate = EXCLUDED.avg_heart_rate`,
    [userId, today, next.flexibility_score, next.mobility_score, next.balance_score, next.strength_score,
      next.meditation_minutes, next.workout_minutes, next.streak_days, next.mood_score, next.stress_score, next.avg_heart_rate]
  );
}

async function recordMeditationMinutes({ userId, minutes }) {
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

  const { rows: yRows } = await pool.query(
    'SELECT streak_days FROM progress_metrics WHERE user_id = $1 AND metric_date = $2',
    [userId, yesterday]
  );
  const { rows: existingRows } = await pool.query(
    'SELECT * FROM progress_metrics WHERE user_id = $1 AND metric_date = $2',
    [userId, today]
  );
  const existing = existingRows[0];
  const streak = existing ? existing.streak_days : (yRows[0]?.streak_days || 0) + 1;

  await pool.query(
    `INSERT INTO progress_metrics (user_id, metric_date, meditation_minutes, streak_days)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT (user_id, metric_date) DO UPDATE SET
       meditation_minutes = progress_metrics.meditation_minutes + $3,
       streak_days = EXCLUDED.streak_days`,
    [userId, today, minutes, streak]
  );
}

// Writes a mobility test's 7-dimension scores into today's progress_metrics
// row, EMA-blended the same way session-derived scores are -- so a Monthly
// Exam moves the same dashboard the rest of the app shows, not a separate
// disconnected number. scores keys: strength, mobility, stability,
// flexibility, balance, movement_control, athletic_performance (0-100,
// any subset may be present/missing per mobilityAssessment's parsing).
async function recordMobilityScores({ userId, scores }) {
  if (!scores) return;
  const today = new Date().toISOString().slice(0, 10);

  const { rows: existingRows } = await pool.query(
    'SELECT * FROM progress_metrics WHERE user_id = $1 AND metric_date = $2',
    [userId, today]
  );
  const existing = existingRows[0];

  const next = {
    flexibility_score: scores.flexibility !== undefined ? ema(existing?.flexibility_score, scores.flexibility) : existing?.flexibility_score ?? null,
    mobility_score: scores.mobility !== undefined ? ema(existing?.mobility_score, scores.mobility) : existing?.mobility_score ?? null,
    balance_score: scores.balance !== undefined ? ema(existing?.balance_score, scores.balance) : existing?.balance_score ?? null,
    strength_score: scores.strength !== undefined ? ema(existing?.strength_score, scores.strength) : existing?.strength_score ?? null,
    stability_score: scores.stability !== undefined ? ema(existing?.stability_score, scores.stability) : existing?.stability_score ?? null,
    movement_control_score: scores.movement_control !== undefined ? ema(existing?.movement_control_score, scores.movement_control) : existing?.movement_control_score ?? null,
    athletic_performance_score: scores.athletic_performance !== undefined ? ema(existing?.athletic_performance_score, scores.athletic_performance) : existing?.athletic_performance_score ?? null,
  };

  await pool.query(
    `INSERT INTO progress_metrics (
       user_id, metric_date, flexibility_score, mobility_score, balance_score, strength_score,
       stability_score, movement_control_score, athletic_performance_score
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     ON CONFLICT (user_id, metric_date) DO UPDATE SET
       flexibility_score = EXCLUDED.flexibility_score,
       mobility_score = EXCLUDED.mobility_score,
       balance_score = EXCLUDED.balance_score,
       strength_score = EXCLUDED.strength_score,
       stability_score = EXCLUDED.stability_score,
       movement_control_score = EXCLUDED.movement_control_score,
       athletic_performance_score = EXCLUDED.athletic_performance_score`,
    [userId, today, next.flexibility_score, next.mobility_score, next.balance_score, next.strength_score,
      next.stability_score, next.movement_control_score, next.athletic_performance_score]
  );
}

module.exports = { recordSessionCompletion, recordMeditationMinutes, recordMobilityScores };
