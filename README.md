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

`ANTHROPIC_API_KEY` (optional) enables real LLM-generated meditation scripts
via `backend/src/services/llmClient.js` — everything works without it, this
just adds session-to-session script variety on top of the built-in templates
once set. No code changes needed, just set the env var.

The same key also unlocks **open-ended onboarding**: instead of tapping
multiple-choice options, users type a free-text answer and
`backend/src/services/answerParser.js` maps it onto the exact structured
value the rest of the app relies on (e.g. "pretty fit, I lift 5x a week" →
`fitness_level: advanced`). It never guesses — an answer it can't confidently
map is rejected and re-asked rather than silently stored wrong, since some of
these fields (injury/pain severity) gate which poses are safe to suggest.
`GET/POST /onboarding/*` responses carry an `aiModeEnabled` flag so the
mobile client falls back to the original multiple-choice/scale UI with zero
behavior change when no key is set.

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

### Push notifications

Devices register for push automatically (`src/hooks/usePushNotifications.ts`)
via Expo's push service — no Apple/Google developer account needed for this
to work in principle. Two real limits to know about:

- **Simulators/emulators can't receive push at all.** Test on a physical device.
- **Expo Go (SDK 53+) can't receive remote push notifications** — only a
  development or production build can (`eas build --profile development`).
  Registration silently no-ops on Expo Go rather than erroring.

The backend sends via `backend/src/services/pushNotifications.js` (Expo's
public push API, no credentials required) on a call to
`POST /notifications/send-top`, and via an hourly sweep
(`notificationService.sweepAllUsers`, wired in `server.js`) that skips users
already notified today.

Both pieces were verified together in this session: full onboarding →
personalized routine generation → session playback → adaptation feedback →
progress dashboard → meditation generation, running against a live Postgres
instance and driven through the actual UI in a browser.

### AI coach avatar (3D, customizable)

`src/screens/AvatarScreen.tsx` embeds [Ready Player Me](https://readyplayer.me)'s
web avatar creator in a `WebView` (their `demo.readyplayer.me` quickstart
subdomain — no account or API key needed for this) so users get a real,
professional-looking 3D character with face/hair/outfit customization, not a
placeholder. On export it receives a GLB model URL via `postMessage`, saves it
to `PATCH /profile/avatar` (`user_profiles.avatar_preference.avatarUrl`), and
renders it back with Google's `<model-viewer>` web component (also loaded in a
`WebView`, so no native 3D engine/linking is needed — works in Expo Go).

### Coach dashboard (athletic programs)

The product now also serves strength coaches at college athletic programs, not
just individual users. A coach owns an `organization` (`backend/src/routes/orgs.js`)
and sees a roster of athletes — their onboarding questionnaire results
(sport, position, season phase, training goal), computed practice level, and
latest AI-generated training — instead of the athlete-facing onboarding/home
flow. The mobile app auto-detects this: on login, `App.tsx` checks
`GET /orgs/mine` and routes coach accounts straight to
`CoachDashboardScreen`/`CoachAthleteDetailScreen`, skipping the athlete
questionnaire entirely.

Athletic identity is now part of onboarding too: reporting a sport (anything
but "none") unlocks position, season phase, and primary training goal
questions (`build_strength`, `explosiveness`, `injury_prevention`,
`inseason_recovery`, or `mobility_for_sport`). That goal maps to an existing
strength-oriented routine type (`strength_yoga`, `power_yoga`,
`athlete_recovery`, `hip_mobility`) already present in
`data/routineTypes.js` — no new pose-scoring logic was needed, the routine
generator already supported strength/core/balance-focused sessions.

**There's currently no self-serve "create your program" UI** — a user becomes
a coach only by creating an organization (`POST /orgs`), which the demo seed
script below does for you. Real enrollment (invite codes, roster import) is
explicitly out of scope for this pass; athletes are added directly.

**Demo data**: `backend/src/db/seedDemoAthletes.js` populates a coach's
roster with 12 simulated athletes across basketball, football, soccer,
track, volleyball, swimming, and baseball — each one goes through the real
signup, onboarding-completion, level-assessment, and routine-generation code
paths (not fabricated data), so the dashboard shows exactly what a real
athlete's account would produce, including two athletes seeded with a
current injury to demonstrate the safety-capped level assessment.

```bash
# 1. Sign up as the coach through the app (or curl /auth/signup) first.
# 2. Then, from backend/:
npm run seed:demo -- coach@example.com "State University Athletics"
```

All seeded athletes share the password `DemoAthlete123!` (see the script for
the exact roster) — useful if you want to log in as one to see the athlete
side too.

**Real caveat:** this integration was built to Ready Player Me's documented
API but could not be exercised end-to-end from the sandbox this was built in
— its domains are blocked by that environment's outbound network policy (the
same kind of block that affected verifying the Railway deploy directly; the
deploy itself was still confirmed working via logs and a browser check). Test
it live on a device/browser before relying on it. Purchasable/branded
clothing and a virtual currency store are explicitly out of scope for this
pass — this is the free customization foundation only.

### Monthly training plans + daily check-ins

`backend/src/routes/plans.js` generates a ~30-day calendar of sessions
scheduled on the athlete's actual reported available days (onboarding's
`available_days` — specific weekdays, not just a count). Each day's routine
is generated lazily (when the athlete opens it, via
`POST /plans/days/:dayId/generate-routine`), not baked in up front, so it
reflects `adaptation_state` as of that moment — including a same-day
check-in. `POST /plans/checkins` feeds soreness straight into the existing
adaptation engine (`applyFeedback`), the exact mechanism a completed
session's pain report already used, so it decays over time and steers
pose selection the same way — no second "assistance" system.

### AI mobility test

Real, honest scope: Claude's API analyzes images, not raw video files, so
"watching a stretch test" means the athlete records a short clip per pose
(`MobilityTestScreen.tsx`, `expo-image-picker`) and the app pulls 2 frames
out of it (`expo-video-thumbnails`), resizes/compresses them
(`expo-image-manipulator`), and sends those to Claude's vision API
(`backend/src/services/mobilityAssessment.js`, `llmClient.generateVisionText`)
for a qualitative movement assessment — visible range of motion, form,
asymmetry — plus a small set of "flagged limitation" tags from a controlled
vocabulary. This is a genuine visual impression from real frames of a real
recording, not a numeric range-of-motion measurement; that would need a
dedicated pose-estimation pipeline (see ROADMAP Phase 3).

The assessment is grounded in real biomechanics, not generic encouragement:
the vision system prompt (`BIOMECHANICS_CHECKLIST`) tells the model exactly
what a strength coach or PT checks per movement — knee valgus vs. varus,
ankle dorsiflexion via heel lift, scapular winging, hip flexor tightness via
lunge depth/lumbar compensation, hip drop during single-leg balance
(a Trendelenburg sign) — and requires reasoning from the observed
compensation to the training focus that corrects it (knee valgus → flag
strength + balance, not just "knee"). It also isn't a standalone test: the
route pulls the athlete's sport, position, season phase, primary training
goal, injury history, and joint pain straight from `user_profiles`
(populated by the written onboarding assessment) and passes it in as
`athleteContext`, so the model weights the movements and compensation
patterns most relevant to that sport/position and looks harder at any joint
tied to a reported injury. This is exactly why the app always runs the
written assessment before the mobility test, never the other way around.

Each test also returns a 0-100 visual estimate across seven training
dimensions — strength, mobility, stability, flexibility, balance,
movement_control, athletic_performance (`SCORE_KEYS`) — EMA-blended into
`progress_metrics` so month-to-month trend lines are smoothed rather than
noisy test-to-test jumps.

Flagged tags are written to `user_profiles.mobility_flags` and bias pose
selection via the same `tagMatches` scoring mechanism goals and routine type
already use (`routineGenerator.scorePose`) — so a mobility test's findings
automatically shape every subsequent routine and training plan, including
next month's, with no extra step. Requires `ANTHROPIC_API_KEY` (`POST
/mobility/tests` returns 409 without it). Raw photo bytes aren't persisted
after analysis — only the assessment text and flagged tags are kept, to
avoid unbounded row growth from image data.

Retaking the test with a prior one on file gets a genuine before/after
comparison (`progress_note`, `trend`) from the same model call. Level
promotion/demotion only fires when two independent signals agree — the
model's qualitative trend and a concrete, checkable one (did the flagged-
limitation count actually go down or up) — via `decideLevelChange`; a
conflicting signal makes no change rather than guessing.

**Not built**: true numeric range-of-motion tracking — that still needs a
dedicated pose-estimation pipeline (ROADMAP Phase 3), not silently skipped.

### Full athlete-side flow

The first-time sequence an athlete walks through end to end: a first-open
welcome moment (`WelcomeScreen`, gated behind a one-time `AsyncStorage` flag
so it only ever shows once per device) — no video, no external footage, no
generation dependency. Three animated "level" bars stack up in sequence
(echoing the app's actual level/progression system), the slogan ("UNLOCK
YOUR NEXT LEVEL.") and a subline fade in underneath, and the screen becomes
tappable to continue, auto-advancing a couple seconds later regardless so
nobody gets stuck on a splash screen. Deliberately built this way instead of
around licensed or AI-generated video footage: it ships today with zero
rights risk and zero dependency on this workspace's video-generation
credits (currently 0).

After that: a "Start Now" assessment landing screen with time estimates for
each step (`AssessmentStartScreen`), the written onboarding assessment, the
baseline mobility test immediately after (see above for why that order
matters), a calendar-based "Your Month, Mapped Out" plan reveal
(`PlanRevealScreen` + `PlanCalendar`) with a choice between customizing the
coach avatar or auto-generating a default one from Ready Player Me's
`quickStart` mode keyed off the onboarding-collected `instructor_gender`
(`DefaultAvatarScreen` — real caveat: this sandbox can't verify whether
RPM's quickStart truly exports with zero taps or needs one confirm tap,
since its domain is network-blocked here; the screen stays visible rather
than hidden so it degrades to "one quick tap" instead of silently breaking
either way), and a simplified two-button Home screen (Scheduled Stretch /
Custom Stretch, replacing the earlier 10-card routine grid). Once the
active plan's end date is reached, a Monthly Exam card appears on Home that
retests mobility and re-reveals the regenerated plan — skipping the avatar
setup card the second time around, since the athlete already has a coach by
then.
