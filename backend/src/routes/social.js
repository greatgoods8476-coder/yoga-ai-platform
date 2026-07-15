const express = require('express');
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

async function findExistingFriendship(userA, userB) {
  const { rows } = await pool.query(
    `SELECT * FROM friendships
     WHERE (requester_id = $1 AND addressee_id = $2) OR (requester_id = $2 AND addressee_id = $1)`,
    [userA, userB]
  );
  return rows[0] || null;
}

router.post('/friends/request', async (req, res) => {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: 'email is required' });

  const { rows: targetRows } = await pool.query('SELECT id, display_name FROM users WHERE email = $1', [email.toLowerCase()]);
  if (targetRows.length === 0) return res.status(404).json({ error: 'no user found with that email' });
  const target = targetRows[0];

  if (target.id === req.userId) return res.status(400).json({ error: 'cannot send a friend request to yourself' });

  const existing = await findExistingFriendship(req.userId, target.id);
  if (existing?.status === 'accepted') return res.status(409).json({ error: 'already friends' });
  if (existing?.status === 'pending') return res.status(409).json({ error: 'a request is already pending between you two' });

  const { rows } = await pool.query(
    `INSERT INTO friendships (requester_id, addressee_id, status) VALUES ($1, $2, 'pending')
     RETURNING *`,
    [req.userId, target.id]
  );
  res.status(201).json({ friendship: rows[0] });
});

router.get('/friends/requests', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT f.id, f.created_at, u.id AS requester_user_id, u.display_name, u.email
     FROM friendships f JOIN users u ON u.id = f.requester_id
     WHERE f.addressee_id = $1 AND f.status = 'pending'
     ORDER BY f.created_at DESC`,
    [req.userId]
  );
  res.json({ requests: rows });
});

router.post('/friends/:id/accept', async (req, res) => {
  const { rows } = await pool.query(
    `UPDATE friendships SET status = 'accepted', updated_at = now()
     WHERE id = $1 AND addressee_id = $2 AND status = 'pending' RETURNING *`,
    [req.params.id, req.userId]
  );
  if (rows.length === 0) return res.status(404).json({ error: 'pending request not found' });
  res.json({ friendship: rows[0] });
});

router.post('/friends/:id/decline', async (req, res) => {
  const { rows } = await pool.query(
    `DELETE FROM friendships WHERE id = $1 AND addressee_id = $2 AND status = 'pending' RETURNING *`,
    [req.params.id, req.userId]
  );
  if (rows.length === 0) return res.status(404).json({ error: 'pending request not found' });
  res.json({ ok: true });
});

router.get('/friends', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT
       f.id AS friendship_id,
       CASE WHEN f.requester_id = $1 THEN f.addressee_id ELSE f.requester_id END AS friend_user_id,
       u.display_name
     FROM friendships f
     JOIN users u ON u.id = CASE WHEN f.requester_id = $1 THEN f.addressee_id ELSE f.requester_id END
     WHERE (f.requester_id = $1 OR f.addressee_id = $1) AND f.status = 'accepted'
     ORDER BY u.display_name ASC`,
    [req.userId]
  );
  res.json({ friends: rows });
});

router.get('/leaderboard', async (req, res) => {
  const { rows: friendRows } = await pool.query(
    `SELECT CASE WHEN f.requester_id = $1 THEN f.addressee_id ELSE f.requester_id END AS friend_user_id
     FROM friendships f
     WHERE (f.requester_id = $1 OR f.addressee_id = $1) AND f.status = 'accepted'`,
    [req.userId]
  );
  const userIds = [req.userId, ...friendRows.map((r) => r.friend_user_id)];

  const { rows } = await pool.query(
    `SELECT u.id AS user_id, u.display_name,
       COALESCE(latest.streak_days, 0) AS streak_days,
       COALESCE(latest.workout_minutes, 0) AS workout_minutes
     FROM users u
     LEFT JOIN LATERAL (
       SELECT streak_days, workout_minutes FROM progress_metrics
       WHERE user_id = u.id ORDER BY metric_date DESC LIMIT 1
     ) latest ON true
     WHERE u.id = ANY($1::uuid[])
     ORDER BY streak_days DESC, workout_minutes DESC`,
    [userIds]
  );

  res.json({
    leaderboard: rows.map((r) => ({ ...r, isYou: r.user_id === req.userId })),
  });
});

module.exports = router;
