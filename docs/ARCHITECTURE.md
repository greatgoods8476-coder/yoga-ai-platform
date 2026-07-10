# Architecture

## Scope reality check

The product brief describes a full ecosystem: native iOS/Android apps, a real-time
3D animated avatar coach, camera-based pose detection with live form scoring,
a music-service integration layer, and a social platform. That is a multi-quarter,
multi-team build. This repo is the foundation those pieces plug into, built in the
order that de-risks the most uncertain parts first (personalization logic and data
model) rather than the most visible parts (3D avatar, native shells).

## Phase 1 (this build)

- **`backend/`** — Node.js/Express API + PostgreSQL. Owns:
  - Auth (email/password now; Google/Apple/biometric are additive later — same
    `users` table, different `auth_provider`).
  - The onboarding interview engine — adaptive question flow, asks follow-ups,
    persists a structured `user_profiles` row.
  - The routine generation engine — turns a profile + recent history into a
    concrete, ordered pose sequence. Deterministic-but-personalized: same profile
    fields always bias the output the same way, but no two distinct profiles
    converge on the same routine, and repeat calls introduce controlled variety.
  - The adaptation engine — every completed/skipped session and pain report
    updates `user_profiles` (soreness, avoided poses, difficulty trend) so the
    *next* generated routine reflects it. This is the "AI learns" loop from the
    brief, implemented as a feedback-adjusted scoring function rather than a
    trained model — a real ML model needs training data this product doesn't
    have on day one.
  - Meditation script generation, keyed by category + profile.
  - Progress dashboard aggregation endpoints.

- **`mobile/`** — Expo (React Native) client. Owns the onboarding conversation UI,
  home/plan view, a session player (pose list + timer + cues), and a progress
  dashboard. No native modules yet.

## Explicitly deferred (not started here)

These require capabilities (native camera ML pipelines, 3D character rendering
pipelines, licensed music SDKs, wearable SDKs) that need their own dedicated
build track, hardware/device testing, and often paid platform agreements. Building
stubs for these would create false confidence, so they're left as designed-but-
not-built:

1. **3D avatar coach** — needs a rigged character pipeline (e.g. Unity/Unreal or
   a WebGL/RealityKit avatar runtime) driven by pose-timing data our routine
   engine already emits (`durationSec`, `cueTimestamps` per pose are in the API
   response today specifically so an avatar renderer can consume them later).
2. **Camera-based pose detection & live form scoring** — needs an on-device pose
   estimation model (e.g. MoveNet/BlazePose) per mobile platform, plus a
   reference-pose comparison model. The API already has a `pose_reference_angles`
   column reserved on `poses` for this.
3. **Music service integrations** (Spotify/Apple Music/etc.) — each requires a
   developer agreement + OAuth app registration owned by the business, not
   something to fake with placeholder credentials.
4. **Wearable integrations** (Apple Watch/Wear OS/Health app) — needs native
   companion targets.
5. **Social features, instructor marketplace, native iOS/Android shells** —
   downstream of the API being stable first.

## Data flow (Phase 1)

```
Client (mobile/web)
  → POST /auth/signup|login              → JWT
  → POST /onboarding/answer (loop)        → builds user_profiles row
  → POST /routines/generate               → routine + ordered pose sequence
  → POST /sessions/:id/complete           → logs completion, feedback, pain
        └─ adaptation engine updates user_profiles.adaptation_state
  → GET  /progress/dashboard              → streaks, scores, trend charts
  → POST /meditations/generate            → personalized script
```

## Tech choices

- **PostgreSQL** (not SQLite) — per spec, and because the personalization model
  is relational (profiles ↔ poses ↔ sessions ↔ logs) with real query needs
  (windowed progress aggregates).
- **Plain SQL over an ORM** — the schema is small enough that hand-written SQL
  in `backend/src/db/queries/*.js` is easier to reason about than an ORM's
  generated queries, and keeps a hard dependency count down.
- **No LLM API dependency for routine generation** — the generator is a scoring/
  selection algorithm over a hand-authored pose library (`backend/src/data/poses.js`),
  not a call to an external LLM. This keeps the whole system runnable offline/
  in CI with no API keys. The onboarding *conversation* text (follow-up question
  phrasing) is templated for the same reason; swapping in a real LLM call for
  more natural phrasing is a drop-in change in `services/onboardingEngine.js`.
