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

router.get('/:id/roster', async (req, res) => {
  if (!(await isCoachOfOrg(req.params.id, req.userId))) return res.status(403).json({ error: 'not a coach of this organization' });

  const { rows } = await pool.query(
    `SELECT u.id AS user_id, u.email, u.display_name,
            p.sport, p.athletic_position, p.season_phase, p.primary_athletic_goal,
            p.yoga_level, p.onboarding_completed
     FROM org_memberships om
     JOIN users u ON u.id = om.user_id
     JOIN user_profiles p ON p.user_id = u.id
     WHERE om.org_id = $1 AND om.role = 'athlete'
     ORDER BY u.display_name NULLS LAST, u.email`,
    [req.params.id]
  );
  res.json({ roster: rows });
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

  res.json({ profile: profileRows[0], latestRoutine });
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
