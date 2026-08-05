const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('express-async-errors');

const authRoutes = require('./routes/auth');
const onboardingRoutes = require('./routes/onboarding');
const routineRoutes = require('./routes/routines');
const sessionRoutes = require('./routes/sessions');
const meditationRoutes = require('./routes/meditations');
const progressRoutes = require('./routes/progress');
const notificationRoutes = require('./routes/notifications');
const socialRoutes = require('./routes/social');

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
});

function createApp() {
  const app = express();
  app.use(helmet());
  app.use(cors());
  app.use(express.json());

  app.get('/health', (req, res) => res.json({ ok: true }));

  app.use('/auth', authLimiter, authRoutes);
  app.use('/onboarding', onboardingRoutes);
  app.use('/routines', routineRoutes);
  app.use('/sessions', sessionRoutes);
  app.use('/meditations', meditationRoutes);
  app.use('/progress', progressRoutes);
  app.use('/notifications', notificationRoutes);
  app.use('/social', socialRoutes);

  app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ error: 'internal server error' });
  });

  return app;
}

module.exports = createApp;
