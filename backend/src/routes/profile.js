const express = require('express');
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

router.get('/avatar', async (req, res) => {
  const { rows } = await pool.query('SELECT avatar_preference FROM user_profiles WHERE user_id = $1', [req.userId]);
  if (rows.length === 0) return res.status(404).json({ error: 'profile not found' });
  res.json({ avatarPreference: rows[0].avatar_preference });
});

// Merges into the existing avatar_preference JSONB rather than replacing it,
// so instructorGender (set during onboarding) survives an avatar save.
router.patch('/avatar', async (req, res) => {
  const { avatarUrl } = req.body || {};
  if (!avatarUrl || typeof avatarUrl !== 'string') return res.status(400).json({ error: 'avatarUrl is required' });
  if (!/^https:\/\/[^\s]+\.glb$/i.test(avatarUrl)) return res.status(400).json({ error: 'avatarUrl must be an https URL ending in .glb' });

  const { rows } = await pool.query(
    `UPDATE user_profiles SET avatar_preference = avatar_preference || $1::jsonb, updated_at = now()
     WHERE user_id = $2 RETURNING avatar_preference`,
    [JSON.stringify({ avatarUrl }), req.userId]
  );
  if (rows.length === 0) return res.status(404).json({ error: 'profile not found' });
  res.json({ avatarPreference: rows[0].avatar_preference });
});

module.exports = router;
