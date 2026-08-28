const express = require('express');
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const { generateRoutine } = require('../services/routineGenerator');
const { applyFeedback } = require('../services/adaptationEngine');
const { pickScheduledDates } = require('../services/planGenerator');
const { parseSorenessText } = require('../services/sorenessParser');

const router = express.Router();
router.use(requireAuth);

const GOAL_ROUTINE_TYPE = {
  build_strength: 'strength_yoga',
  explosiveness: 'power_yoga',
  injury_prevention: 'athlete_recovery',
  inseason_recovery: 'athlete_recovery',
  mobility_for_sport: 'hip_mobility',
};

async function insertGeneratedRoutine(client, userId, routineTypeKey, result) {
  const { rows: routineRows } = await client.query(
    `INSERT INTO routines (user_id, type, title, goal_tags, total_duration_sec, generated_reason)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [userId, routineTypeKey, result.title, result.goalTags, result.totalDurationSec, result.generatedReason]
  );
  const routine = routineRows[0];
  const items = [];
  for (let idx = 0; idx < result.items.length; idx += 1) {
    const it = result.items[idx];
    const { rows: itemRows } = await client.query(
      `INSERT INTO routine_items (routine_id, pose_id, sequence_index, duration_sec, cue_timestamps)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [routine.id, it.pose.id, idx, it.durationSec, { startSec: it.startSec }]
    );
    items.push({ ...itemRows[0], pose: it.pose });
  }
  return { routine, items };
}

// Creates a new ~30-day plan scheduled on the athlete's actual available
// days, superseding any prior active plan. Each day's specific routine is
// NOT generated up front -- see POST /days/:dayId/generate-routine -- so it
// can reflect adaptation_state (soreness, difficulty trend) as of the day
// it's actually taken, including same-day check-ins.
router.post('/generate', async (req, res) => {
  const { rows: profileRows } = await pool.query('SELECT * FROM user_profiles WHERE user_id = $1', [req.userId]);
  const profile = profileRows[0];
  if (!profile) return res.status(404).json({ error: 'profile not found' });
  if (!profile.onboarding_completed) return res.status(409).json({ error: 'complete onboarding before generating a plan' });

  const routineType = req.body?.routineType || GOAL_ROUTINE_TYPE[profile.primary_athletic_goal] || 'custom';
  const dates = pickScheduledDates(profile, new Date(), 30);
  if (dates.length === 0) return res.status(400).json({ error: 'no available days found to schedule a plan' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("UPDATE training_plans SET status = 'superseded' WHERE user_id = $1 AND status = 'active'", [req.userId]);
    const { rows: planRows } = await client.query(
      'INSERT INTO training_plans (user_id, routine_type, start_date, end_date) VALUES ($1,$2,$3,$4) RETURNING *',
      [req.userId, routineType, dates[0], dates[dates.length - 1]]
    );
    const plan = planRows[0];
    for (const date of dates) {
      await client.query('INSERT INTO training_plan_days (plan_id, scheduled_date) VALUES ($1, $2)', [plan.id, date]);
    }
    await client.query('COMMIT');
    const { rows: days } = await pool.query('SELECT * FROM training_plan_days WHERE plan_id = $1 ORDER BY scheduled_date ASC', [plan.id]);
    res.status(201).json({ plan, days });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

router.get('/current', async (req, res) => {
  const { rows: planRows } = await pool.query(
    "SELECT * FROM training_plans WHERE user_id = $1 AND status = 'active' ORDER BY created_at DESC LIMIT 1",
    [req.userId]
  );
  if (planRows.length === 0) return res.json({ plan: null, days: [] });

  const { rows: days } = await pool.query('SELECT * FROM training_plan_days WHERE plan_id = $1 ORDER BY scheduled_date ASC', [planRows[0].id]);
  res.json({ plan: planRows[0], days });
});

// Generates that day's routine right now, using the athlete's current
// adaptation_state -- reuses the exact same engine as on-demand routines, so
// a same-day check-in (soreness) already shapes pose selection.
router.post('/days/:dayId/generate-routine', async (req, res) => {
  const { rows: dayRows } = await pool.query(
    `SELECT tpd.*, tp.user_id, tp.routine_type FROM training_plan_days tpd
     JOIN training_plans tp ON tp.id = tpd.plan_id WHERE tpd.id = $1`,
    [req.params.dayId]
  );
  if (dayRows.length === 0 || dayRows[0].user_id !== req.userId) return res.status(404).json({ error: 'plan day not found' });
  const day = dayRows[0];

  const { rows: profileRows } = await pool.query('SELECT * FROM user_profiles WHERE user_id = $1', [req.userId]);
  const { rows: poses } = await pool.query('SELECT * FROM poses');
  const lastRoutines = await pool.query(
    `SELECT ri.pose_id FROM routine_items ri JOIN routines r ON r.id = ri.routine_id
     WHERE r.user_id = $1 ORDER BY r.created_at DESC LIMIT 20`,
    [req.userId]
  );

  const result = generateRoutine({
    profile: { ...profileRows[0], user_id: req.userId },
    poses,
    routineTypeKey: day.routine_type,
    recentPoseIds: lastRoutines.rows.map((r) => r.pose_id),
  });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { routine, items } = await insertGeneratedRoutine(client, req.userId, day.routine_type, result);
    await client.query('UPDATE training_plan_days SET routine_id = $1 WHERE id = $2', [routine.id, day.id]);
    await client.query('COMMIT');
    res.status(201).json({ routine, items });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

// Links an already-completed session (POST /sessions/:id/complete) back to
// its plan day so the calendar shows it done.
router.post('/days/:dayId/link-session', async (req, res) => {
  const { sessionLogId } = req.body || {};
  if (!sessionLogId) return res.status(400).json({ error: 'sessionLogId is required' });

  const { rows: dayRows } = await pool.query(
    `SELECT tpd.* FROM training_plan_days tpd JOIN training_plans tp ON tp.id = tpd.plan_id
     WHERE tpd.id = $1 AND tp.user_id = $2`,
    [req.params.dayId, req.userId]
  );
  if (dayRows.length === 0) return res.status(404).json({ error: 'plan day not found' });

  const { rows: logRows } = await pool.query(
    'SELECT * FROM session_logs WHERE id = $1 AND user_id = $2 AND completed_at IS NOT NULL',
    [sessionLogId, req.userId]
  );
  if (logRows.length === 0) return res.status(404).json({ error: 'completed session not found' });

  const { rows } = await pool.query(
    "UPDATE training_plan_days SET session_log_id = $1, status = 'completed' WHERE id = $2 RETURNING *",
    [sessionLogId, req.params.dayId]
  );
  res.json({ day: rows[0] });
});

// A daily check-in is the athlete's own words ("what's sore today?") --
// parsed server-side into the exact body-area vocabulary routineGenerator
// already checks pose.primary_muscles against, then fed straight into the
// *existing* adaptation engine (applyFeedback) as a painReported event --
// same mechanism a completed session's soreness report uses -- so it
// naturally decays over time and down-weights aggravating poses in
// whichever day's routine gets generated next (including today's, if it
// hasn't been generated yet), without a second parallel "assistance" system.
router.post('/checkins', async (req, res) => {
  const { sorenessText } = req.body || {};
  if (sorenessText !== undefined && typeof sorenessText !== 'string') {
    return res.status(400).json({ error: 'sorenessText must be a string' });
  }

  const { rows: profileRows } = await pool.query('SELECT adaptation_state FROM user_profiles WHERE user_id = $1', [req.userId]);
  if (profileRows.length === 0) return res.status(404).json({ error: 'profile not found' });

  const { soreness, unavailable } = await parseSorenessText(sorenessText);

  const nextState = applyFeedback(profileRows[0].adaptation_state || {}, { painReported: soreness });
  await pool.query('UPDATE user_profiles SET adaptation_state = $1, updated_at = now() WHERE user_id = $2', [nextState, req.userId]);

  const { rows } = await pool.query(
    `INSERT INTO daily_checkins (user_id, soreness, notes) VALUES ($1, $2, $3)
     ON CONFLICT (user_id, checkin_date) DO UPDATE SET soreness = $2, notes = $3
     RETURNING *`,
    [req.userId, JSON.stringify(soreness), sorenessText?.trim() || null]
  );
  res.status(201).json({ checkin: rows[0], adaptationState: nextState, sorenessUnavailable: unavailable });
});

router.get('/checkins', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM daily_checkins WHERE user_id = $1 ORDER BY checkin_date DESC LIMIT 30', [req.userId]);
  res.json({ checkins: rows });
});

module.exports = router;
