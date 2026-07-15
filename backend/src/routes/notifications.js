const express = require('express');
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const { computeSuggestions } = require('../services/notificationEngine');

const router = express.Router();
router.use(requireAuth);

router.get('/suggestions', async (req, res) => {
  const { rows: profileRows } = await pool.query(
    'SELECT stress_level, goals FROM user_profiles WHERE user_id = $1',
    [req.userId]
  );
  if (profileRows.length === 0) return res.status(404).json({ error: 'profile not found' });

  const { rows: sessionRows } = await pool.query(
    `SELECT completed_at, difficulty_feedback FROM session_logs
     WHERE user_id = $1 AND completed_at IS NOT NULL
     ORDER BY completed_at DESC LIMIT 1`,
    [req.userId]
  );
  const { rows: meditationRows } = await pool.query(
    'SELECT created_at FROM meditation_sessions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1',
    [req.userId]
  );
  const { rows: countRows } = await pool.query(
    'SELECT count(*) FROM session_logs WHERE user_id = $1 AND completed_at IS NOT NULL',
    [req.userId]
  );
  const { rows: streakRows } = await pool.query(
    `SELECT streak_days FROM progress_metrics WHERE user_id = $1
     ORDER BY metric_date DESC LIMIT 1`,
    [req.userId]
  );

  const suggestions = computeSuggestions({
    profile: profileRows[0],
    lastSession: sessionRows[0] || null,
    lastMeditation: meditationRows[0] || null,
    currentStreak: streakRows[0]?.streak_days || 0,
    hasEverPracticed: Number(countRows[0].count) > 0,
  });

  res.json({ suggestions });
});

module.exports = router;
