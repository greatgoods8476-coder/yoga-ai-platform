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
- **Adaptation feedback**: a pose skipped 3+ times gets added to
  `avoidedPoses` and stops being suggested; sore muscle groups reported via
  session feedback reduce that pose's score for a while (decays over time).
- **Advanced pranayama gating**: retention-based techniques (Kumbhaka,
  Nadi Shodhana's retention variant, Murccha) are marked `difficulty:
  advanced` with explicit caution language in `beginnerModifications` —
  the mobile client doesn't currently enforce a hard gate on this, which
  is a gap worth closing before recommending pranayama to brand-new users.

## Sequencing logic (partially implemented)

The routine generator does **not** yet implement staged sequencing (warm-up
→ build → peak → cooldown) — it scores and picks poses, then orders
already-used-recently poses last for variety. It does *not* guarantee a
backbend peak is preceded by prep, or that a session ends with rest. That's
a real gap against the "safe sequencing" principle and is the natural next
improvement to `routineGenerator.generateRoutine`: bucket candidate poses
by a `sequencePhase` (warm_up / build / peak / cooldown) and assemble in
that order rather than by score alone.

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
