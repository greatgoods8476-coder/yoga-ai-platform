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
- [x] Monthly training plans — a ~30-day calendar scheduled on the athlete's
      actual reported available days (not a guessed pattern), each day's
      routine generated lazily so it reflects same-day check-ins
- [x] Daily check-ins — soreness reports feed straight into the existing
      adaptation engine (`applyFeedback`), reusing its soreness-penalty
      scoring rather than a second parallel system
- [x] Open-ended, fill-in-the-blank onboarding — free-text answers parsed by
      an LLM into the same structured values the rest of the app already
      relies on, with strict validation (an answer the model can't
      confidently map is rejected and re-asked, never silently guessed).
      Requires `ANTHROPIC_API_KEY`; falls back to the existing multiple-
      choice/scale UI with no regression when unset (`aiModeEnabled` flag
      from `/onboarding/start`)
- [x] AI mobility test — the athlete records a short video per stretch pose;
      the app extracts 2 frames per clip (`expo-video-thumbnails` +
      `expo-image-manipulator` for resize/compress) and sends them to
      Claude's vision API (`mobilityAssessment.js`) for a qualitative
      movement assessment plus a controlled set of "flagged limitation"
      tags. Those tags are written to `user_profiles.mobility_flags` and
      bias pose selection in `routineGenerator.scorePose` — the same
      `tagMatches` mechanism goals/routine-type already use — so every
      future routine or training-plan generation (including next month's
      plan) automatically leans into what the test found. Real scope
      limit, stated plainly: Claude analyzes images, not raw video, so
      this is a qualitative visual impression from a couple of frames, not
      numeric range-of-motion measurement — that still needs a dedicated
      pose-estimation pipeline (Phase 3) if ever wanted. Requires
      `ANTHROPIC_API_KEY`; returns 409 without it. Raw photo bytes are not
      persisted (avoids unbounded row growth) — only the assessment text
      and flagged tags survive per test.
- [x] Mobility test grounded in the written assessment, not standalone — the
      route pulls the athlete's sport, position, season phase, primary
      training goal, injury history, and joint pain straight from
      `user_profiles` (populated by onboarding) and passes it into
      `assessMobility` as `athleteContext`. The vision system prompt uses it
      to weight which compensation patterns matter most for that sport/
      position and sharpen scrutiny around any joint tied to a reported
      injury, rather than assessing the movements in a vacuum — this is why
      the written assessment is step 1 and the mobility test is step 2, not
      the other way around.
- [x] Named biomechanics checklist (`BIOMECHANICS_CHECKLIST` in
      `mobilityAssessment.js`) drives the vision assessment with the actual
      criteria a strength coach/PT would check per movement — knee valgus vs.
      varus, ankle dorsiflexion via heel lift, scapular winging, hip flexor
      tightness via lunge depth/lumbar compensation, single-leg balance hip
      drop (Trendelenburg sign), etc. — and reasons from the observed
      compensation to the training focus that corrects it (e.g. knee valgus
      → flag strength + balance, not just "knee"), not a generic body-part
      checklist.
- [x] Seven-dimension monthly progression scoring — strength, mobility,
      stability, flexibility, balance, movement_control, athletic_performance
      (`SCORE_KEYS`), each a 0-100 visual estimate from the same model call,
      EMA-blended into `progress_metrics` (`recordMobilityScores`) so the
      trend is smoothed rather than noisy test-to-test jumps.
- [x] Full athlete-side flow rebuild end to end: an intro-video screen
      (`IntroVideoScreen`, gated behind a one-time `AsyncStorage` flag) with
      a real player (`expo-video`, works on native and web) and a slogan
      ("UNLOCK YOUR NEXT LEVEL.") as a genuine animated text overlay, not
      baked into the video pixels, so it changes without re-rendering
      footage. Real scope note: no footage has been supplied yet
      (`INTRO_VIDEO_URL` is `null`), so it's currently a graceful no-op —
      point that constant at a sports montage clip (yours, or AI-generated
      once this workspace has video-generation credits, currently 0) and
      playback + overlay take over automatically. Then: a
      "Start Now" assessment landing screen with time estimates
      (`AssessmentStartScreen`), the baseline mobility test running
      immediately after the written assessment completes, a calendar-based
      "Your Month, Mapped Out" plan reveal (`PlanRevealScreen` +
      `PlanCalendar`) with a choice between customizing the coach avatar or
      auto-generating a default one from Ready Player Me's `quickStart` mode
      keyed off the onboarding-collected `instructor_gender`
      (`DefaultAvatarScreen` — real caveat: whether RPM's quickStart truly
      exports with zero taps versus one confirm tap isn't verifiable from
      this sandbox, since its domain is network-blocked here; the screen
      stays visible rather than hidden so it degrades to "one quick tap"
      instead of silently breaking either way), a simplified two-button Home
      screen (Scheduled Stretch / Custom Stretch, replacing the old 10-card
      routine grid), and a Monthly Exam entry point that appears once the
      active plan's end date is reached, retests mobility, and re-reveals
      the regenerated plan (skipping the avatar setup card the second time
      around, since the athlete already has a coach by then).
- [x] Monthly retest + rank up/down cycle — retaking the mobility test with
      a prior test on file gets a genuine before/after comparison
      (`progress_note`, `trend`) from the same model call, not a separate
      pass. Promotion/demotion (`levelAssessment.stepLevel`) only fires when
      two independent signals agree — the model's qualitative trend AND a
      concrete, checkable one (did the flagged-limitation count actually go
      down or up) — via `decideLevelChange`; a conflicting signal (e.g. the
      model says "improved" but flags went up) makes no change rather than
      guessing. The new level immediately shapes the next plan/routine
      generated, and the coach dashboard surfaces the athlete's latest
      trend + assessment (`GET /orgs/:id/athletes/:userId` →
      `latestMobilityTest`).
- [ ] Seat/roster-based billing for programs — deferred pending a pricing
      model decision (seat-based vs. flat program license)
