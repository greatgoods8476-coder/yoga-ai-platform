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
- [ ] Real LLM integration for onboarding conversation + meditation script variety
- [x] Expand pose library beyond seed set (137 poses + 18 pranayama, full taxonomy)
- [x] Staged routine sequencing (warm_up/build/peak/cooldown) + hard difficulty cap
- [x] Smart notification suggestions (streak risk, stress, re-engagement, recovery) —
      logic + in-app banner only; actual push delivery needs an APNs/FCM device-token
      pipeline that's out of scope here
- [ ] Wearable heart-rate ingestion (manual import first, then Health/Google Fit)
- [ ] Push notification delivery (APNs/FCM) on top of the existing suggestion engine
- [ ] Social: friends, challenges, streak sharing

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
