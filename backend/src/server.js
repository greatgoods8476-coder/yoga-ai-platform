require('dotenv').config();
const createApp = require('./app');
const { port } = require('./config');
const { sweepAllUsers } = require('./services/notificationService');

const app = createApp();
app.listen(port, () => console.log(`yoga-ai-backend listening on :${port}`));

// Daily-ish smart notification sweep. Deliberately not wired into app.js —
// tests build the app directly via createApp() and shouldn't have a
// background timer running during the suite.
const SWEEP_INTERVAL_MS = 60 * 60 * 1000; // hourly; sweepAllUsers itself skips users already notified today
setInterval(() => {
  sweepAllUsers()
    .then(({ usersChecked, notified }) => {
      if (usersChecked > 0) console.log(`notification sweep: checked ${usersChecked}, notified ${notified}`);
    })
    .catch((err) => console.error('notification sweep failed:', err.message));
}, SWEEP_INTERVAL_MS);
