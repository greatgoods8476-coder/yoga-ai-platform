const express = require('express');
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const { applyFeedback } = require('../services/adaptationEngine');
const { recordSessionCompletion } = require('../services/progressMetrics');

const router = express.Router();
router.use(requireAuth);

router.post('/', async (req, res) => {
  const { routineId } = req.body || {};
  if (!routineId) return res.status(400).json({ error: 'routineId is required' });

  const { rows: routineRows } = await pool.query('SELECT * FROM routines WHERE id = $1 AND user_id = $2', [routineId, req.userId]);
  if (routineRows.length === 0) return res.status(404).json({ error: 'routine not found' });

  const { rows } = await pool.query(
    'INSERT INTO session_logs (user_id, routine_id) VALUES ($1, $2) RETURNING *',
    [req.userId, routineId]
  );
  res.status(201).json({ sessionLog: rows[0] });
});

// Sanity bounds for manually-entered heart rate — not a medical validation,
// just enough to reject obvious typos/garbage before it pollutes an average.
const PLAUSIBLE_HEART_RATE = { min: 30, max: 220 };
function sanitizeHeartRate(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  if (n < PLAUSIBLE_HEART_RATE.min || n > PLAUSIBLE_HEART_RATE.max) return null;
  return Math.round(n);
}

router.post('/:id/complete', async (req, res) => {
  const {
    completionPct = 100, skippedPoseIds = [], painReported = {}, difficultyFeedback, enjoymentRating, notes,
    avgHeartRate, maxHeartRate,
  } = req.body || {};

  const { rows: logRows } = await pool.query('SELECT * FROM session_logs WHERE id = $1 AND user_id = $2', [req.params.id, req.userId]);
  if (logRows.length === 0) return res.status(404).json({ error: 'session log not found' });
  const log = logRows[0];

  const { rows: routineRows } = await pool.query('SELECT * FROM routines WHERE id = $1', [log.routine_id]);
  const routine = routineRows[0];

  const sanitizedAvgHr = avgHeartRate !== undefined ? sanitizeHeartRate(avgHeartRate) : null;
  const sanitizedMaxHr = maxHeartRate !== undefined ? sanitizeHeartRate(maxHeartRate) : null;

  const { rows: updatedLogRows } = await pool.query(
    `UPDATE session_logs SET completed_at = now(), completion_pct = $1, poses_skipped = $2,
       pain_reported = $3, difficulty_feedback = $4, enjoyment_rating = $5, notes = $6,
       avg_heart_rate = $7, max_heart_rate = $8
     WHERE id = $9 RETURNING *`,
    [completionPct, skippedPoseIds, painReported, difficultyFeedback, enjoymentRating, notes,
      sanitizedAvgHr, sanitizedMaxHr, req.params.id]
  );

  const { rows: profileRows } = await pool.query('SELECT adaptation_state FROM user_profiles WHERE user_id = $1', [req.userId]);
  const currentState = profileRows[0]?.adaptation_state || {};
  const nextState = applyFeedback(currentState, {
    difficultyFeedback, painReported, skippedPoseIds, enjoymentRating, routineId: log.routine_id,
  });
  await pool.query('UPDATE user_profiles SET adaptation_state = $1, updated_at = now() WHERE user_id = $2', [nextState, req.userId]);

  const workoutMinutes = (routine.total_duration_sec / 60) * (completionPct / 100);
  await recordSessionCompletion({
    userId: req.userId,
    workoutMinutes,
    completionPct,
    enjoymentRating,
    difficultyFeedback,
    goalTags: routine.goal_tags || [],
    avgHeartRate: sanitizedAvgHr,
  });

  res.json({ sessionLog: updatedLogRows[0], adaptationState: nextState });
});

router.get('/:id', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM session_logs WHERE id = $1 AND user_id = $2', [req.params.id, req.userId]);
  if (rows.length === 0) return res.status(404).json({ error: 'session log not found' });
  res.json({ sessionLog: rows[0] });
});

module.exports = router;
