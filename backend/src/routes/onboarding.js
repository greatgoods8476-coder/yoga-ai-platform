const express = require('express');
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const { getNextQuestion, computeFollowUps, buildProfileUpdate } = require('../services/onboardingEngine');

const router = express.Router();
router.use(requireAuth);

async function getOrCreateSession(userId) {
  const existing = await pool.query(
    "SELECT * FROM onboarding_sessions WHERE user_id = $1 AND status = 'in_progress' ORDER BY created_at DESC LIMIT 1",
    [userId]
  );
  if (existing.rows.length > 0) return existing.rows[0];

  const { rows } = await pool.query(
    "INSERT INTO onboarding_sessions (user_id, answers, pending_fields) VALUES ($1, '{}', '{}') RETURNING *",
    [userId]
  );
  return rows[0];
}

function serializeQuestion(session, question) {
  if (!question) return { done: true, sessionId: session.id };
  const { condition, ...publicFields } = question;
  return { done: false, sessionId: session.id, question: publicFields };
}

// pending_fields stores only keys; reconstruct full field defs for any queued follow-ups.
const { FOLLOW_UP_RULES } = require('../data/onboardingQuestions');
function extraFieldsFromKeys(keys) {
  const byKey = new Map(FOLLOW_UP_RULES.map((r) => [r.field.key, r.field]));
  return (keys || []).map((k) => byKey.get(k)).filter(Boolean);
}

router.post('/start', async (req, res) => {
  const session = await getOrCreateSession(req.userId);
  const question = getNextQuestion(session.answers, extraFieldsFromKeys(session.pending_fields));
  res.json(serializeQuestion(session, question));
});

router.post('/answer', async (req, res) => {
  const { sessionId, field, value } = req.body || {};
  if (!sessionId || !field) return res.status(400).json({ error: 'sessionId and field are required' });

  const { rows } = await pool.query('SELECT * FROM onboarding_sessions WHERE id = $1 AND user_id = $2', [sessionId, req.userId]);
  if (rows.length === 0) return res.status(404).json({ error: 'onboarding session not found' });
  const session = rows[0];

  const answers = { ...session.answers, [field]: value };
  let extraFields = extraFieldsFromKeys(session.pending_fields);
  extraFields = computeFollowUps(answers, extraFields);
  const pendingFields = extraFields.map((f) => f.key);

  const nextQuestion = getNextQuestion(answers, extraFields);
  const status = nextQuestion ? 'in_progress' : 'completed';

  const updated = await pool.query(
    'UPDATE onboarding_sessions SET answers = $1, pending_fields = $2, status = $3, updated_at = now() WHERE id = $4 RETURNING *',
    [answers, pendingFields, status, sessionId]
  );

  if (status === 'completed') {
    const profileUpdate = buildProfileUpdate(answers);
    const cols = Object.keys(profileUpdate);
    const setClause = cols.map((c, i) => `${c} = $${i + 2}`).join(', ');
    await pool.query(
      `UPDATE user_profiles SET ${setClause}, onboarding_completed = true, updated_at = now() WHERE user_id = $1`,
      [req.userId, ...cols.map((c) => profileUpdate[c])]
    );
  }

  res.json(serializeQuestion(updated.rows[0], nextQuestion));
});

router.get('/status', async (req, res) => {
  const { rows } = await pool.query('SELECT onboarding_completed FROM user_profiles WHERE user_id = $1', [req.userId]);
  if (rows.length === 0) return res.status(404).json({ error: 'profile not found' });
  res.json({ onboardingCompleted: rows[0].onboarding_completed });
});

module.exports = router;
