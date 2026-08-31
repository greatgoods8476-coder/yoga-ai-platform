const express = require('express');
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

async function isCoachOfOrg(orgId, userId) {
  const { rows } = await pool.query(
    "SELECT 1 FROM org_memberships WHERE org_id = $1 AND user_id = $2 AND role = 'coach'",
    [orgId, userId]
  );
  return rows.length > 0;
}

router.post('/', async (req, res) => {
  const { name } = req.body || {};
  if (!name || !name.trim()) return res.status(400).json({ error: 'name is required' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: orgRows } = await client.query('INSERT INTO organizations (name) VALUES ($1) RETURNING *', [name.trim()]);
    const organization = orgRows[0];
    await client.query(
      "INSERT INTO org_memberships (org_id, user_id, role) VALUES ($1, $2, 'coach')",
      [organization.id, req.userId]
    );
    await client.query('COMMIT');
    res.status(201).json({ organization });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

router.get('/mine', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT o.*, om.role,
       (SELECT count(*) FROM org_memberships a WHERE a.org_id = o.id AND a.role = 'athlete')::int AS athlete_count
     FROM organizations o
     JOIN org_memberships om ON om.org_id = o.id
     WHERE om.user_id = $1
     ORDER BY o.created_at DESC`,
    [req.userId]
  );
  res.json({ organizations: rows });
});

const INACTIVE_DAYS_THRESHOLD = 10;
const SORE_SEVERITY_THRESHOLD = 3;

// Turns the raw signals the app already tracks per athlete into a single
// scannable flag + the specific reasons why -- a coach managing a roster of
// 20-80 athletes needs to know who to look at first, not just a directory.
function computeAttention({ currentInjuries, sorenessAreas, latestTrend, daysSinceLastSession, onboardingCompleted }) {
  const reasons = [];
  const injuries = (currentInjuries || []).filter((v) => v && v.toLowerCase() !== 'none');
  if (injuries.length > 0) reasons.push(`current injury reported: ${injuries.join(', ')}`);

  const soreAreas = Object.entries(sorenessAreas || {}).filter(([, v]) => Number(v) >= SORE_SEVERITY_THRESHOLD).map(([k]) => k);
  if (soreAreas.length > 0) reasons.push(`sore: ${soreAreas.join(', ').replace(/_/g, ' ')}`);

  if (latestTrend === 'regressed') reasons.push('mobility trend regressed on last test');

  if (onboardingCompleted && (daysSinceLastSession === null || daysSinceLastSession > INACTIVE_DAYS_THRESHOLD)) {
    reasons.push(daysSinceLastSession === null ? 'no session completed yet' : `no session in ${daysSinceLastSession} days`);
  }

  return { needsAttention: reasons.length > 0, attentionReasons: reasons };
}

router.get('/:id/roster', async (req, res) => {
  if (!(await isCoachOfOrg(req.params.id, req.userId))) return res.status(403).json({ error: 'not a coach of this organization' });

  const { rows } = await pool.query(
    `SELECT u.id AS user_id, u.email, u.display_name,
            p.sport, p.athletic_position, p.season_phase, p.primary_athletic_goal,
            p.yoga_level, p.onboarding_completed, p.current_injuries, p.adaptation_state,
            mt.trend AS latest_trend, mt.created_at AS latest_mobility_test_at,
            sl.completed_at AS last_session_completed_at
     FROM org_memberships om
     JOIN users u ON u.id = om.user_id
     JOIN user_profiles p ON p.user_id = u.id
     LEFT JOIN LATERAL (
       SELECT trend, created_at FROM mobility_tests WHERE user_id = u.id ORDER BY created_at DESC LIMIT 1
     ) mt ON true
     LEFT JOIN LATERAL (
       SELECT completed_at FROM session_logs WHERE user_id = u.id AND completed_at IS NOT NULL ORDER BY completed_at DESC LIMIT 1
     ) sl ON true
     WHERE om.org_id = $1 AND om.role = 'athlete'
     ORDER BY u.display_name NULLS LAST, u.email`,
    [req.params.id]
  );

  const roster = rows.map((r) => {
    const daysSinceLastSession = r.last_session_completed_at
      ? Math.floor((Date.now() - new Date(r.last_session_completed_at).getTime()) / 86400000)
      : null;
    const { needsAttention, attentionReasons } = computeAttention({
      currentInjuries: r.current_injuries,
      sorenessAreas: r.adaptation_state?.sorenessAreas,
      latestTrend: r.latest_trend,
      daysSinceLastSession,
      onboardingCompleted: r.onboarding_completed,
    });
    const { adaptation_state, current_injuries, latest_mobility_test_at, last_session_completed_at, ...rest } = r;
    return { ...rest, daysSinceLastSession, needsAttention, attentionReasons };
  });

  // Athletes needing attention surface first -- everyone else keeps the
  // existing alphabetical order beneath them.
  roster.sort((a, b) => Number(b.needsAttention) - Number(a.needsAttention));

  res.json({ roster });
});

router.get('/:id/athletes/:userId', async (req, res) => {
  if (!(await isCoachOfOrg(req.params.id, req.userId))) return res.status(403).json({ error: 'not a coach of this organization' });

  const membership = await pool.query(
    "SELECT 1 FROM org_memberships WHERE org_id = $1 AND user_id = $2 AND role = 'athlete'",
    [req.params.id, req.params.userId]
  );
  if (membership.rows.length === 0) return res.status(404).json({ error: 'athlete not found in this organization' });

  const { rows: profileRows } = await pool.query(
    'SELECT u.email, u.display_name, p.* FROM users u JOIN user_profiles p ON p.user_id = u.id WHERE u.id = $1',
    [req.params.userId]
  );

  const { rows: routineRows } = await pool.query(
    'SELECT * FROM routines WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1',
    [req.params.userId]
  );
  let latestRoutine = null;
  if (routineRows.length > 0) {
    const { rows: items } = await pool.query(
      `SELECT ri.*, row_to_json(po.*) AS pose FROM routine_items ri
       JOIN poses po ON po.id = ri.pose_id
       WHERE ri.routine_id = $1 ORDER BY ri.sequence_index ASC`,
      [routineRows[0].id]
    );
    latestRoutine = { routine: routineRows[0], items };
  }

  const { rows: mobilityRows } = await pool.query(
    `SELECT id, assessment, flagged_limitations, progress_note, trend, level_change, scores, created_at
     FROM mobility_tests WHERE user_id = $1 ORDER BY created_at DESC LIMIT 6`,
    [req.params.userId]
  );

  const { rows: checkinRows } = await pool.query(
    'SELECT checkin_date, soreness, notes FROM daily_checkins WHERE user_id = $1 ORDER BY checkin_date DESC LIMIT 7',
    [req.params.userId]
  );

  const { rows: planRows } = await pool.query(
    `SELECT id, start_date, end_date, status FROM training_plans WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [req.params.userId]
  );
  let planAdherence = null;
  if (planRows.length > 0) {
    const { rows: dayCounts } = await pool.query(
      `SELECT count(*)::int AS total, count(*) FILTER (WHERE status = 'completed')::int AS completed
       FROM training_plan_days WHERE plan_id = $1`,
      [planRows[0].id]
    );
    planAdherence = {
      startDate: planRows[0].start_date,
      endDate: planRows[0].end_date,
      status: planRows[0].status,
      totalDays: dayCounts[0].total,
      completedDays: dayCounts[0].completed,
    };
  }

  res.json({
    profile: profileRows[0],
    latestRoutine,
    latestMobilityTest: mobilityRows[0] || null,
    mobilityTestHistory: mobilityRows,
    recentCheckins: checkinRows,
    planAdherence,
  });
});

// Adds an existing user (by email) to the org as an athlete. Real
// self-enrollment (join code, roster import) is out of scope for this pass;
// this is the primitive a coach-invoked "add athlete" flow would call.
router.post('/:id/athletes', async (req, res) => {
  if (!(await isCoachOfOrg(req.params.id, req.userId))) return res.status(403).json({ error: 'not a coach of this organization' });

  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: 'email is required' });

  const { rows: userRows } = await pool.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
  if (userRows.length === 0) return res.status(404).json({ error: 'no user with that email' });

  await pool.query(
    `INSERT INTO org_memberships (org_id, user_id, role) VALUES ($1, $2, 'athlete')
     ON CONFLICT (org_id, user_id) DO UPDATE SET role = 'athlete'`,
    [req.params.id, userRows[0].id]
  );
  res.status(201).json({ ok: true });
});

module.exports = router;
