const pool = require('../db/pool');
const { computeSuggestions } = require('./notificationEngine');
const { sendExpoPush } = require('./pushNotifications');

async function loadSuggestionInputs(userId) {
  const { rows: profileRows } = await pool.query(
    'SELECT stress_level, goals FROM user_profiles WHERE user_id = $1',
    [userId]
  );
  if (profileRows.length === 0) return null;

  const { rows: sessionRows } = await pool.query(
    `SELECT completed_at, difficulty_feedback FROM session_logs
     WHERE user_id = $1 AND completed_at IS NOT NULL
     ORDER BY completed_at DESC LIMIT 1`,
    [userId]
  );
  const { rows: meditationRows } = await pool.query(
    'SELECT created_at FROM meditation_sessions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1',
    [userId]
  );
  const { rows: countRows } = await pool.query(
    'SELECT count(*) FROM session_logs WHERE user_id = $1 AND completed_at IS NOT NULL',
    [userId]
  );
  const { rows: streakRows } = await pool.query(
    'SELECT streak_days FROM progress_metrics WHERE user_id = $1 ORDER BY metric_date DESC LIMIT 1',
    [userId]
  );

  return {
    profile: profileRows[0],
    lastSession: sessionRows[0] || null,
    lastMeditation: meditationRows[0] || null,
    currentStreak: streakRows[0]?.streak_days || 0,
    hasEverPracticed: Number(countRows[0].count) > 0,
  };
}

async function getSuggestionsForUser(userId) {
  const inputs = await loadSuggestionInputs(userId);
  if (!inputs) return null;
  return computeSuggestions(inputs);
}

// Sends the user's top suggestion as a push to every device they've
// registered, and logs it so the daily sweep won't repeat it today.
async function notifyUserOfTopSuggestion(userId) {
  const suggestions = await getSuggestionsForUser(userId);
  if (!suggestions || suggestions.length === 0) return { sent: false, reason: 'no suggestions' };

  const top = suggestions[0];
  const { rows: tokenRows } = await pool.query('SELECT token FROM push_tokens WHERE user_id = $1', [userId]);
  if (tokenRows.length === 0) return { sent: false, reason: 'no registered devices', suggestion: top };

  const result = await sendExpoPush(tokenRows.map((r) => r.token), {
    title: 'Your practice',
    body: top.message,
    data: { suggestionId: top.id, type: top.type },
  });

  await pool.query(
    `INSERT INTO notification_log (user_id, suggestion_id) VALUES ($1, $2)
     ON CONFLICT (user_id, sent_date) DO UPDATE SET suggestion_id = EXCLUDED.suggestion_id`,
    [userId, top.id]
  );

  return { sent: result.sent > 0, suggestion: top, pushResult: result };
}

// Daily sweep: every user with at least one registered device who hasn't
// already been notified today gets their top suggestion sent. Meant to be
// called on an interval from server.js (not wired into app.js/tests — the
// interval itself isn't something a test suite should wait on).
async function sweepAllUsers() {
  const { rows } = await pool.query(
    `SELECT DISTINCT pt.user_id FROM push_tokens pt
     WHERE NOT EXISTS (
       SELECT 1 FROM notification_log nl
       WHERE nl.user_id = pt.user_id AND nl.sent_date = CURRENT_DATE
     )`
  );

  let notified = 0;
  for (const { user_id: userId } of rows) {
    try {
      const result = await notifyUserOfTopSuggestion(userId);
      if (result.sent) notified += 1;
    } catch (err) {
      console.error(`notification sweep failed for user ${userId}:`, err.message);
    }
  }
  return { usersChecked: rows.length, notified };
}

module.exports = { getSuggestionsForUser, notifyUserOfTopSuggestion, sweepAllUsers };
