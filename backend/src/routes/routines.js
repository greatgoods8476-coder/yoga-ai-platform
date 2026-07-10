const express = require('express');
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const { generateRoutine } = require('../services/routineGenerator');

const router = express.Router();
router.use(requireAuth);

async function getProfile(userId) {
  const { rows } = await pool.query('SELECT * FROM user_profiles WHERE user_id = $1', [userId]);
  return rows[0];
}

router.post('/generate', async (req, res) => {
  const { routineType = 'custom', durationMin } = req.body || {};

  const profile = await getProfile(req.userId);
  if (!profile) return res.status(404).json({ error: 'profile not found' });
  if (!profile.onboarding_completed) return res.status(409).json({ error: 'complete onboarding before generating a routine' });

  const { rows: poses } = await pool.query('SELECT * FROM poses');
  const lastRoutine = await pool.query(
    `SELECT ri.pose_id FROM routine_items ri
     JOIN routines r ON r.id = ri.routine_id
     WHERE r.user_id = $1 ORDER BY r.created_at DESC LIMIT 20`,
    [req.userId]
  );
  const recentPoseIds = lastRoutine.rows.map((r) => r.pose_id);

  const profileForEngine = { ...profile, user_id: req.userId };

  const result = generateRoutine({
    profile: profileForEngine,
    poses,
    routineTypeKey: routineType,
    recentPoseIds,
    durationMinOverride: durationMin,
  });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: routineRows } = await client.query(
      `INSERT INTO routines (user_id, type, title, goal_tags, total_duration_sec, generated_reason)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [req.userId, routineType, result.title, result.goalTags, result.totalDurationSec, result.generatedReason]
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

    await client.query('COMMIT');
    res.status(201).json({ routine, items });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

router.get('/:id', async (req, res) => {
  const { rows: routineRows } = await pool.query('SELECT * FROM routines WHERE id = $1 AND user_id = $2', [req.params.id, req.userId]);
  if (routineRows.length === 0) return res.status(404).json({ error: 'routine not found' });

  const { rows: items } = await pool.query(
    `SELECT ri.*, row_to_json(p.*) AS pose FROM routine_items ri
     JOIN poses p ON p.id = ri.pose_id
     WHERE ri.routine_id = $1 ORDER BY ri.sequence_index ASC`,
    [req.params.id]
  );

  res.json({ routine: routineRows[0], items });
});

router.get('/', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM routines WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50', [req.userId]);
  res.json({ routines: rows });
});

module.exports = router;
