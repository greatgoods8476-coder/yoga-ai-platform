const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db/pool');
const { jwtSecret } = require('../config');

const router = express.Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function issueToken(userId) {
  return jwt.sign({ sub: userId }, jwtSecret, { expiresIn: '30d' });
}

router.post('/signup', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !EMAIL_RE.test(email)) return res.status(400).json({ error: 'valid email required' });
  if (!password || password.length < 8) return res.status(400).json({ error: 'password must be at least 8 characters' });

  const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
  if (existing.rows.length > 0) return res.status(409).json({ error: 'email already registered' });

  const passwordHash = await bcrypt.hash(password, 10);
  const { rows } = await pool.query(
    'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id',
    [email.toLowerCase(), passwordHash]
  );
  const userId = rows[0].id;
  await pool.query('INSERT INTO user_profiles (user_id) VALUES ($1)', [userId]);

  res.status(201).json({ token: issueToken(userId), userId });
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'email and password required' });

  const { rows } = await pool.query('SELECT id, password_hash FROM users WHERE email = $1', [email.toLowerCase()]);
  if (rows.length === 0) return res.status(401).json({ error: 'invalid credentials' });

  const valid = await bcrypt.compare(password, rows[0].password_hash);
  if (!valid) return res.status(401).json({ error: 'invalid credentials' });

  res.json({ token: issueToken(rows[0].id), userId: rows[0].id });
});

module.exports = router;
