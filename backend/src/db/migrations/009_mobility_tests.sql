-- AI mobility test: a handful of frames extracted from a short video of the
-- athlete performing a fixed set of stretch positions, analyzed by Claude's
-- vision API for a qualitative movement assessment. mobility_flags on the
-- profile is the current/latest result, applied automatically to every
-- future routine/plan generation (see routineGenerator.scorePose) --
-- mobility_tests keeps the full history for the coach dashboard.

ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS mobility_flags TEXT[] NOT NULL DEFAULT '{}';

-- `photos` stores which poses were captured (poseKey/mediaType), not the raw
-- image bytes -- those are only needed for the one-time analysis call and
-- aren't persisted, to avoid unbounded row growth from image blobs.
CREATE TABLE IF NOT EXISTS mobility_tests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  photos JSONB NOT NULL DEFAULT '[]',
  assessment TEXT NOT NULL,
  flagged_limitations TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mobility_tests_user ON mobility_tests(user_id, created_at DESC);
