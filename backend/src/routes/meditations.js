const express = require('express');
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const { generateScript, CATEGORIES } = require('../services/meditationGenerator');
const { recordMeditationMinutes } = require('../services/progressMetrics');

const router = express.Router();
router.use(requireAuth);

router.get('/categories', (req, res) => {
  res.json({ categories: Object.keys(CATEGORIES) });
});

router.post('/generate', async (req, res) => {
  const { category, durationSec = 300, goal } = req.body || {};
  if (!category || !CATEGORIES[category]) {
    return res.status(400).json({ error: `category must be one of: ${Object.keys(CATEGORIES).join(', ')}` });
  }

  const { rows: profileRows } = await pool.query('SELECT preferred_coaching_style FROM user_profiles WHERE user_id = $1', [req.userId]);
  const coachingStyle = profileRows[0]?.preferred_coaching_style;

  const result = generateScript({ category, durationSec, coachingStyle, goal });

  const { rows } = await pool.query(
    `INSERT INTO meditation_sessions (user_id, category, goal, duration_sec, script)
     VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [req.userId, category, result.goal, durationSec, result.script]
  );

  res.status(201).json({ meditation: rows[0], lines: result.lines });
});

router.post('/:id/complete', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM meditation_sessions WHERE id = $1 AND user_id = $2', [req.params.id, req.userId]);
  if (rows.length === 0) return res.status(404).json({ error: 'meditation session not found' });

  await recordMeditationMinutes({ userId: req.userId, minutes: rows[0].duration_sec / 60 });
  res.json({ ok: true });
});

router.get('/', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM meditation_sessions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50', [req.userId]);
  res.json({ meditations: rows });
});

module.exports = router;
