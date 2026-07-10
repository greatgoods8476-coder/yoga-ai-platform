-- Expand pose metadata: Sanskrit names, alignment cues, modifications,
-- variations, related poses, media reference, and cross-cutting focus tags
-- (category stays the anatomical position family; focus_tags carries
-- functional groupings like "backbend" or "hip_opener" that cut across
-- position families, matching how yoga references commonly cross-list poses).

ALTER TABLE poses ADD COLUMN IF NOT EXISTS sanskrit_name TEXT;
ALTER TABLE poses ADD COLUMN IF NOT EXISTS alignment_cues TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE poses ADD COLUMN IF NOT EXISTS beginner_modifications TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE poses ADD COLUMN IF NOT EXISTS advanced_variations TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE poses ADD COLUMN IF NOT EXISTS related_pose_slugs TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE poses ADD COLUMN IF NOT EXISTS media_url TEXT;
ALTER TABLE poses ADD COLUMN IF NOT EXISTS focus_tags TEXT[] NOT NULL DEFAULT '{}';

-- Pre-existing rows used 'lower_back' as a contraindication tag, but the
-- safety filter (and onboarding's joint_pain fields) only ever use 'back'.
-- That mismatch meant those poses' back-pain safety check never fired.
UPDATE poses SET contraindications = array_replace(contraindications, 'lower_back', 'back');
