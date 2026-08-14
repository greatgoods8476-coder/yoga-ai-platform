-- Month-to-month mobility progress: when a new test is taken and a prior
-- one exists, the assessment call also produces a comparison note and a
-- trend (improved/same/regressed), which -- combined with a concrete,
-- verifiable signal (did the flagged-limitation count go down or up) --
-- nudges the athlete's practice level up or down via levelAssessment.stepLevel.

ALTER TABLE mobility_tests ADD COLUMN IF NOT EXISTS progress_note TEXT;
ALTER TABLE mobility_tests ADD COLUMN IF NOT EXISTS trend TEXT;
ALTER TABLE mobility_tests ADD COLUMN IF NOT EXISTS level_change TEXT;
