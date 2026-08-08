# Roadmap

## Phase 1 — Foundation (this build)
- [x] Postgres schema: users, profiles, poses, routines, sessions, session logs, meditations, progress
- [x] Auth (email/password + JWT)
- [x] AI onboarding interview engine (adaptive, follow-ups, full field set from spec)
- [x] Routine generation engine (personalized, pose library, style/equipment/injury aware)
- [x] Adaptation engine (feedback → future routine adjustment)
- [x] Meditation script generator
- [x] Progress dashboard aggregation
- [x] Integration tests against real Postgres
- [x] Mobile app shell (Expo): onboarding, home, session player, progress

## Phase 2 — Depth
- [x] Real LLM integration — pluggable (`llmClient.js`), meditation scripts get real
      variety once `ANTHROPIC_API_KEY` is set, falls back to templates without it.
      Onboarding conversation phrasing is still templated (a smaller, lower-value swap
      to make later using the same client).
- [x] Expand pose library beyond seed set (137 poses + 18 pranayama, full taxonomy)
- [x] Staged routine sequencing (warm_up/build/peak/cooldown) + hard difficulty cap
- [x] Smart notification suggestions (streak risk, stress, re-engagement, recovery)
- [x] Push notification delivery via Expo's push service — no APNs/FCM credentials of
      our own needed. Real caveat: Expo Go (SDK 53+) can't receive remote push, only a
      development/production build can — verified the registration code path is
      crash-safe on web/no-device, not end-to-end device delivery (needs `eas build`).
- [x] Manual heart-rate entry on session completion (wearable sync — HealthKit/Google
      Fit — is still real native work, not attempted here)
- [x] Social: friends + streak leaderboard — friend requests by email, accept/decline,
      a leaderboard scoped to accepted friends only (verified two-account flow live in
      a browser). Challenges, an instructor marketplace, and live classes remain out of
      scope — genuinely large product features, not reasonable to fake.

**Phase 2 is now complete.** Everything above works without any external account beyond
what's already set up (Postgres). Where a feature has a real external dependency
(`ANTHROPIC_API_KEY` for LLM variety, an EAS build for push delivery to a physical
device, Health/Google Fit accounts for wearable sync), the integration point is built
and documented so supplying that credential is the only remaining step — see each
bullet above and the relevant `.env.example` / README section.

## Phase 2.5 — Onboarding polish
- [x] Backend hardening: helmet security headers, rate-limited `/auth`, fail-fast on a
      missing `JWT_SECRET` in production
- [x] Warmer onboarding question copy + a progress bar (`answered`/`total`) on every
      in-progress question
- [x] Practice-level assessment (`levelAssessment.js`) computed from experience,
      fitness, flexibility, and mobility answers, safety-capped to "Rooted Beginner"
      when current pain/injury is reported regardless of experience
- [x] Post-onboarding reveal screen: shows the computed level and immediately
      generates a tailored first class (reuses the existing `custom` routine
      generator), with a one-tap "Start my first class" CTA
- [x] Reminders opt-in on the reveal screen, wired into the existing notification
      sweep so it only fires within the user's preferred practice-time window
      (`workout_schedule.preferredTime`, already collected). Caveat: gating runs on
      server UTC hour since no per-user timezone is stored yet — best-effort, not a
      precise local-time schedule.

## Phase 4 (partial) — Avatar
- [x] 3D avatar rendering + customization — real face/hair/outfit customization
      and 3D rendering via Ready Player Me (embedded WebView creator) +
      `<model-viewer>` for display, GLB URL persisted on the profile. Not
      verified end-to-end from the sandbox this was built in (its domains are
      network-blocked there) — needs a live device/browser check. Purchasable
      designer-inspired clothing and a currency/store layer are explicitly
      deferred — real legal exposure (trademark/trade dress) and product scope
      that need a dedicated design pass, not bundled into this foundation.

## Phase 3 — Sensing
- [ ] On-device pose detection (MoveNet/BlazePose) in mobile app
- [ ] Live form scoring UI + corrective cue overlay
- [ ] Reference-pose angle authoring pipeline (`poses.pose_reference_angles`)

## Phase 4 — Avatar & environments
- [x] 3D avatar rendering + customization (see Phase 4 (partial) above)
- [ ] Voice synthesis + coaching personality selection
- [ ] Immersive environments (visuals + ambient audio mixer)

## Phase 5 — Platform
- [ ] Native iOS/Android shells (or React Native → native modules as needed)
- [ ] Music service OAuth integrations
- [ ] Instructor marketplace, live classes
- [ ] Premium billing/entitlements

## Phase 6 — Athletic programs (B2B2C pivot)
- [x] Org/coach/athlete data model (`organizations`, `org_memberships`) — a
      coach owns an organization and sees only that organization's athletes;
      row-level checks enforce a non-coach (or a coach of a different org)
      can't read another program's roster
- [x] Athletic identity in onboarding — sport, position, season phase, and
      primary training goal, conditionally asked only when a sport is
      reported (the general consumer onboarding is unaffected)
- [x] Strength-building yoga routing — primary training goal maps to an
      existing strength/power/recovery/mobility routine type
      (`data/routineTypes.js` already had these; no new pose-scoring logic
      needed)
- [x] Coach dashboard (mobile app, works on web via `react-native-web`):
      roster list + per-athlete questionnaire results and latest AI-generated
      training. Coach accounts skip athlete onboarding entirely.
- [x] Demo data generator (`seedDemoAthletes.js`) — 12 simulated athletes
      through the real signup/onboarding/level-assessment/routine-generation
      pipeline, for sales demos
- [ ] Self-serve org creation / athlete enrollment (invite code, roster
      import) — currently a coach only gets an org via the seed script or a
      direct `POST /orgs` call; no UI for it yet
- [ ] Seat/roster-based billing for programs — deferred pending a pricing
      model decision (seat-based vs. flat program license)
