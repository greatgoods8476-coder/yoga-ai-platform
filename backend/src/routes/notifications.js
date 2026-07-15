const express = require('express');
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const { getSuggestionsForUser, notifyUserOfTopSuggestion } = require('../services/notificationService');

const router = express.Router();
router.use(requireAuth);

router.get('/suggestions', async (req, res) => {
  const suggestions = await getSuggestionsForUser(req.userId);
  if (suggestions === null) return res.status(404).json({ error: 'profile not found' });
  res.json({ suggestions });
});

router.post('/register-token', async (req, res) => {
  const { token, platform } = req.body || {};
  if (!token) return res.status(400).json({ error: 'token is required' });

  await pool.query(
    `INSERT INTO push_tokens (user_id, token, platform) VALUES ($1, $2, $3)
     ON CONFLICT (user_id, token) DO UPDATE SET platform = EXCLUDED.platform`,
    [req.userId, token, platform || null]
  );
  res.status(201).json({ ok: true });
});

// Sends the user's current top suggestion as a real push notification right
// now (rather than waiting for the daily sweep) — useful for the mobile app
// to offer a "remind me later today" action, and for verifying the whole
// push pipeline end-to-end without waiting on the scheduler.
router.post('/send-top', async (req, res) => {
  const result = await notifyUserOfTopSuggestion(req.userId);
  res.json(result);
});

module.exports = router;
