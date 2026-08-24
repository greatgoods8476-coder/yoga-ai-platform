const express = require('express');
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const { assessMobility, MOBILITY_TEST_POSES } = require('../services/mobilityAssessment');
const { stepLevel, levelInfo, decideLevelChange } = require('../services/levelAssessment');
const { recordMobilityScores } = require('../services/progressMetrics');

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

  const { rows: profileRows } = await pool.query('SELECT yoga_level FROM user_profiles WHERE user_id = $1', [req.userId]);
  if (profileRows.length === 0) return res.status(404).json({ error: 'profile not found' });

  const { rows: priorRows } = await pool.query(
    'SELECT assessment, flagged_limitations FROM mobility_tests WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1',
    [req.userId]
  );
  const previousTest = priorRows[0]
    ? { assessment: priorRows[0].assessment, flaggedLimitations: priorRows[0].flagged_limitations || [] }
    : null;

  const result = await assessMobility(photos, previousTest);
  if (result.unavailable) return res.status(409).json({ error: 'AI mobility assessment is not configured on this server' });
  if (!result.assessment) return res.status(502).json({ error: 'could not generate an assessment, please try again' });

  let levelChange = null;
  let newYogaLevel = profileRows[0].yoga_level;
  if (previousTest && result.trend) {
    levelChange = decideLevelChange(result.trend, previousTest.flaggedLimitations.length, result.flaggedLimitations.length);
    if (levelChange) newYogaLevel = stepLevel(profileRows[0].yoga_level, levelChange);
  }

  const { rows } = await pool.query(
    `INSERT INTO mobility_tests (user_id, photos, assessment, flagged_limitations, progress_note, trend, level_change, scores)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id, assessment, flagged_limitations, progress_note, trend, level_change, scores, created_at`,
    [
      req.userId,
      JSON.stringify(photos.map((p) => ({ poseKey: p.poseKey, mediaType: p.mediaType }))),
      result.assessment, result.flaggedLimitations, result.progressNote, result.trend, levelChange,
      result.scores ? JSON.stringify(result.scores) : null,
    ]
  );

  await pool.query(
    'UPDATE user_profiles SET mobility_flags = $1, yoga_level = $2, updated_at = now() WHERE user_id = $3',
    [result.flaggedLimitations, newYogaLevel, req.userId]
  );

  if (result.scores) await recordMobilityScores({ userId: req.userId, scores: result.scores });

  res.status(201).json({ test: rows[0], yogaLevel: levelInfo(newYogaLevel) });
});

router.get('/tests', async (req, res) => {
  const { rows } = await pool.query(
    'SELECT id, assessment, flagged_limitations, progress_note, trend, level_change, scores, created_at FROM mobility_tests WHERE user_id = $1 ORDER BY created_at DESC LIMIT 12',
    [req.userId]
  );
  res.json({ tests: rows });
});

router.get('/tests/latest', async (req, res) => {
  const { rows } = await pool.query(
    'SELECT id, assessment, flagged_limitations, progress_note, trend, level_change, scores, created_at FROM mobility_tests WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1',
    [req.userId]
  );
  res.json({ test: rows[0] || null });
});

module.exports = router;
