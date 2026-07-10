# AI Yoga & Meditation Platform

Phase 1 foundation for a personalized AI yoga, mobility, breathing, and
meditation platform. See `docs/ARCHITECTURE.md` for what's built vs. deferred,
and `docs/ROADMAP.md` for what comes next.

## Backend (`backend/`)

Node.js/Express API backed by PostgreSQL.

```bash
cd backend
npm install

# Create the database once (adjust user/db name as needed):
#   createuser yoga_app --pwprompt --createdb
#   createdb -O yoga_app yoga_ai_platform
# or set DATABASE_URL to point at an existing Postgres instance.

npm run migrate   # applies backend/src/db/migrations/*.sql
npm run seed       # loads the pose library
npm start           # listens on :4000 (PORT env var to override)
npm test             # integration tests against a real Postgres DB
```

Env vars: `DATABASE_URL`, `JWT_SECRET`, `PORT` (all have dev-friendly defaults,
see `backend/src/config.js` and `backend/src/db/pool.js`; `backend/.env.example`
documents them for a deployed environment).

### Deploying the backend (Railway)

`backend/railway.toml` is ready to go, mirroring the setup used for the
sibling memebot-hq project:

1. New Railway project → **Deploy from GitHub repo** → this repo, with
   **Root Directory** set to `backend/`.
2. Add a **Postgres** plugin to the same project — Railway auto-injects
   `DATABASE_URL` into the backend service, no manual wiring needed.
3. Set `JWT_SECRET` to a real random value in the service's variables tab.
4. Deploy. The start command (`migrate → seed → server`) is idempotent, so
   every redeploy re-applies safely.

Any other Node+Postgres host (Render, Fly.io, etc.) works the same way —
`railway.toml` is just Railway's config format, the app itself has no
Railway-specific code.

## Mobile app (`mobile/`)

Expo (React Native + TypeScript) client: auth, AI onboarding interview, home
routine picker, session player, meditation, and progress dashboard.

```bash
cd mobile
npm install
EXPO_PUBLIC_API_URL=http://localhost:4000 npx expo start
```

`EXPO_PUBLIC_API_URL` should point at the backend — use your machine's LAN IP
(or `10.0.2.2:4000` for the Android emulator) when running on a physical
device or simulator, since `localhost` there resolves to the device itself.

Both pieces were verified together in this session: full onboarding →
personalized routine generation → session playback → adaptation feedback →
progress dashboard → meditation generation, running against a live Postgres
instance and driven through the actual UI in a browser.
