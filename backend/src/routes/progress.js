const express = require('express');
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

router.get('/dashboard', async (req, res) => {
  const days = Math.min(parseInt(req.query.days, 10) || 30, 365);

  const { rows } = await pool.query(
    `SELECT * FROM progress_metrics WHERE user_id = $1
     AND metric_date >= (CURRENT_DATE - $2::int)
     ORDER BY metric_date ASC`,
    [req.userId, days]
  );

  const latest = rows[rows.length - 1];
  const totals = rows.reduce(
    (acc, r) => ({
      workoutMinutes: acc.workoutMinutes + Number(r.workout_minutes || 0),
      meditationMinutes: acc.meditationMinutes + Number(r.meditation_minutes || 0),
    }),
    { workoutMinutes: 0, meditationMinutes: 0 }
  );

  res.json({
    days: rows,
    currentStreak: latest?.streak_days || 0,
    totals,
  });
});

module.exports = router;
