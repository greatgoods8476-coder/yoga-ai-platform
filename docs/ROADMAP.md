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
- [ ] Social: friends + streak leaderboard (challenges/marketplace/live classes remain
      out of scope — genuinely large product features, not reasonable to fake)

## Phase 3 — Sensing
- [ ] On-device pose detection (MoveNet/BlazePose) in mobile app
- [ ] Live form scoring UI + corrective cue overlay
- [ ] Reference-pose angle authoring pipeline (`poses.pose_reference_angles`)

## Phase 4 — Avatar & environments
- [ ] 3D avatar rendering pipeline + avatar customization
- [ ] Voice synthesis + coaching personality selection
- [ ] Immersive environments (visuals + ambient audio mixer)

## Phase 5 — Platform
- [ ] Native iOS/Android shells (or React Native → native modules as needed)
- [ ] Music service OAuth integrations
- [ ] Instructor marketplace, live classes
- [ ] Premium billing/entitlements
