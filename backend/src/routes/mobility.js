const express = require('express');
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const { assessMobility, MOBILITY_TEST_POSES } = require('../services/mobilityAssessment');

const router = express.Router();
router.use(requireAuth);

const MAX_PHOTO_BASE64_CHARS = 4 * 1024 * 1024; // ~3MB of actual image data, generous but bounded
const VALID_POSE_KEYS = new Set(MOBILITY_TEST_POSES.map((p) => p.key));
const VALID_MEDIA_TYPES = new Set(['image/jpeg', 'image/png']);

router.get('/test-poses', (req, res) => {
  res.json({ poses: MOBILITY_TEST_POSES });
});

router.post('/tests', async (req, res) => {
  const { photos } = req.body || {};
  if (!Array.isArray(photos) || photos.length === 0) return res.status(400).json({ error: 'photos array is required' });

  for (const p of photos) {
    if (!p || !VALID_POSE_KEYS.has(p.poseKey)) return res.status(400).json({ error: `invalid poseKey: ${p && p.poseKey}` });
    if (!p.data || typeof p.data !== 'string') return res.status(400).json({ error: 'each photo needs base64 data' });
    if (p.data.length > MAX_PHOTO_BASE64_CHARS) return res.status(413).json({ error: 'photo too large' });
    if (!VALID_MEDIA_TYPES.has(p.mediaType)) return res.status(400).json({ error: 'mediaType must be image/jpeg or image/png' });
  }

  const result = await assessMobility(photos);
  if (result.unavailable) return res.status(409).json({ error: 'AI mobility assessment is not configured on this server' });
  if (!result.assessment) return res.status(502).json({ error: 'could not generate an assessment, please try again' });

  const { rows } = await pool.query(
    `INSERT INTO mobility_tests (user_id, photos, assessment, flagged_limitations)
     VALUES ($1, $2, $3, $4) RETURNING id, assessment, flagged_limitations, created_at`,
    [req.userId, JSON.stringify(photos.map((p) => ({ poseKey: p.poseKey, mediaType: p.mediaType }))), result.assessment, result.flaggedLimitations]
  );

  await pool.query('UPDATE user_profiles SET mobility_flags = $1, updated_at = now() WHERE user_id = $2', [result.flaggedLimitations, req.userId]);

  res.status(201).json({ test: rows[0] });
});

router.get('/tests', async (req, res) => {
  const { rows } = await pool.query(
    'SELECT id, assessment, flagged_limitations, created_at FROM mobility_tests WHERE user_id = $1 ORDER BY created_at DESC LIMIT 12',
    [req.userId]
  );
  res.json({ tests: rows });
});

router.get('/tests/latest', async (req, res) => {
  const { rows } = await pool.query(
    'SELECT id, assessment, flagged_limitations, created_at FROM mobility_tests WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1',
    [req.userId]
  );
  res.json({ test: rows[0] || null });
});

module.exports = router;
