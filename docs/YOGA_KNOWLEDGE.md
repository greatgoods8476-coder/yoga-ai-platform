# Yoga Knowledge → App Behavior

This is a working reference for how the yoga knowledge behind the app maps
to actual code and data, not a standalone manuscript. Where the underlying
concept has real depth (philosophy, history, anatomy), the point here is
just "what does this mean for what the app does" — see `docs/ARCHITECTURE.md`
for the system design and `backend/src/data/poses.js` for the pose library
itself.

## Taxonomy: category vs. focus_tags

Every pose has a `category` — its anatomical/positional family (`standing`,
`seated`, `tabletop`, `supine`, `prone`, `balance`, `arm_balance`,
`inversion`, `backbend`, `restorative`, `breathwork`) — and `focus_tags`,
cross-cutting functional labels (`hip_opener`, `backbend`, `twist`,
`hamstring`, `shoulder_opener`, `core`, `strength`, `chest_opener`,
`office_friendly`, `senior_friendly`, `prenatal_safe`, `sleep`, `calming`,
`balancing`, `energizing`, `spine_mobility`, `balance`).

A pose is tagged with *both* because many poses genuinely belong to more
than one browsing category — Bridge Pose is anatomically `supine` but
functionally a `backbend`. Routine generation, safety filtering, and goal
matching all check category and focus_tags together
(`routineGenerator.tagMatches`).

## Safety rules actually enforced in code

- **Contraindications** (`poses.contraindications`): a pose is excluded if
  the user's `current_injuries` free text mentions the tag, or their
  `joint_pain` score for that area is ≥ 3/5. Implemented in
  `routineGenerator.isSafeForProfile`.
- **Pregnancy**: unless a pose is styled `prenatal` or tagged
  `prenatal_safe`, only gentle categories (`breathwork`, `restorative`,
  `seated`, `tabletop`) are allowed, and `arm_balance` / `inversion` /
  `backbend` / `balance` categories (plus anything tagged `backbend` or
  `twist`) are excluded outright. This is a simplified heuristic, not
  medical advice — a real product needs clinician sign-off here.
- **Equipment**: a pose requiring equipment the user doesn't have is
  excluded (`available_equipment` from onboarding).
- **Difficulty ceiling**: a pose more than one difficulty rank above the
  user's `targetDifficulty` is hard-excluded from `generateRoutine`, not
  just down-scored — this closes a real gap where a thin phase bucket
  (e.g. `peak`, once injury/pregnancy rules excluded most advanced poses)
  could still hand an advanced pose to a total beginner. One step of
  stretch (beginner → occasional intermediate) is still allowed.
- **Adaptation feedback**: a pose skipped 3+ times gets added to
  `avoidedPoses` and stops being suggested; sore muscle groups reported via
  session feedback reduce that pose's score for a while (decays over time).
- **Advanced pranayama gating**: retention-based techniques (Kumbhaka,
  Nadi Shodhana's retention variant, Murccha) are marked `difficulty:
  advanced` with explicit caution language in `beginnerModifications` —
  the mobile client doesn't currently enforce a hard gate on this, which
  is a gap worth closing before recommending pranayama to brand-new users.

## Sequencing logic

Sessions ≥10 minutes are assembled in stages, not just sorted by score:
`routineGenerator.sequencePhase(pose)` classifies each pose into
`warm_up` / `build` / `peak` / `cooldown` from its category, difficulty,
and focus_tags (a heuristic, not a hand-tagged field — applies to every
pose without per-pose upkeep). `assemblePhased` fills each phase's time
budget (15% / 45% / 25% / 15%) in order, so a session actually warms up
before anything hard and winds down at the end, rather than potentially
handing a beginner an advanced backbend as the first pose. If a phase has
no eligible poses (e.g. `peak`, when pregnancy/injury safety rules
excluded every advanced pose), its budget flows to `build` instead of
leaving a gap. Sessions under 10 minutes skip this — a 5-minute stretch
doesn't need a formal warm-up/peak/cooldown shape.

Still missing: this doesn't guarantee a *specific* backbend has its
*specific* counterpose nearby (e.g. Wheel followed by a twist), just that
the general difficulty arc is right. Prep-pose/counter-pose pairing would
need `related_pose_slugs` to carry that semantic (it's currently just a
loose "see also" list) — a reasonable next increment.

## Style vocabulary

The app's `favorite_yoga_styles` and pose `styles` fields are intentionally
a small closed set (`hatha`, `vinyasa`, `yin`, `power`, `restorative`,
`prenatal`, `breathwork`) rather than the full range of studio style names
(Iyengar, Ashtanga, Kundalini, etc.) — narrow enough to drive
recommendations meaningfully, broad enough to not force false precision.

## Teaching language

Cue text in the pose data (`breathingCue`, `alignmentCues`,
`commonMistakes`) is written to invite rather than command — "let the head
hang heavy" rather than "you must relax your neck" — and consistently
offers a modification rather than treating one body shape as the only
correct version. Keep that tone if you add more content.

## What's explicitly not built from the fuller knowledge base

Sanskrit pronunciation guidance, the eight-limbs framework as user-facing
content, a philosophy/history section, and prep-pose/counter-pose sequencing
metadata (`related_pose_slugs` exists in the schema but is currently just a
loose "see also" list, not prep/counter semantics) are all reasonable
Phase 2 additions once the core personalization loop is validated with
real users.
