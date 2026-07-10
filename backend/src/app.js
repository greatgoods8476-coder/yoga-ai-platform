const express = require('express');
const cors = require('cors');
require('express-async-errors');

const authRoutes = require('./routes/auth');
const onboardingRoutes = require('./routes/onboarding');
const routineRoutes = require('./routes/routines');
const sessionRoutes = require('./routes/sessions');
const meditationRoutes = require('./routes/meditations');
const progressRoutes = require('./routes/progress');

function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get('/health', (req, res) => res.json({ ok: true }));

  app.use('/auth', authRoutes);
  app.use('/onboarding', onboardingRoutes);
  app.use('/routines', routineRoutes);
  app.use('/sessions', sessionRoutes);
  app.use('/meditations', meditationRoutes);
  app.use('/progress', progressRoutes);

  app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ error: 'internal server error' });
  });

  return app;
}

module.exports = createApp;
