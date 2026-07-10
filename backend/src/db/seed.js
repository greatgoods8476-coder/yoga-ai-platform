const pool = require('./pool');
const poses = require('../data/poses');

async function seed() {
  for (const p of poses) {
    await pool.query(
      `INSERT INTO poses (
        slug, name, sanskrit_name, category, difficulty, styles, primary_muscles, secondary_muscles,
        benefits, common_mistakes, contraindications, equipment, default_duration_sec, breathing_cue,
        alignment_cues, beginner_modifications, advanced_variations, related_pose_slugs, media_url, focus_tags
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
      ON CONFLICT (slug) DO UPDATE SET
        name = EXCLUDED.name,
        sanskrit_name = EXCLUDED.sanskrit_name,
        category = EXCLUDED.category,
        difficulty = EXCLUDED.difficulty,
        styles = EXCLUDED.styles,
        primary_muscles = EXCLUDED.primary_muscles,
        secondary_muscles = EXCLUDED.secondary_muscles,
        benefits = EXCLUDED.benefits,
        common_mistakes = EXCLUDED.common_mistakes,
        contraindications = EXCLUDED.contraindications,
        equipment = EXCLUDED.equipment,
        default_duration_sec = EXCLUDED.default_duration_sec,
        breathing_cue = EXCLUDED.breathing_cue,
        alignment_cues = EXCLUDED.alignment_cues,
        beginner_modifications = EXCLUDED.beginner_modifications,
        advanced_variations = EXCLUDED.advanced_variations,
        related_pose_slugs = EXCLUDED.related_pose_slugs,
        media_url = EXCLUDED.media_url,
        focus_tags = EXCLUDED.focus_tags`,
      [
        p.slug, p.name, p.sanskritName || null, p.category, p.difficulty, p.styles, p.primaryMuscles, p.secondaryMuscles,
        p.benefits, p.commonMistakes, p.contraindications, p.equipment, p.defaultDurationSec, p.breathingCue,
        p.alignmentCues || [], p.beginnerModifications || [], p.advancedVariations || [], p.relatedPoses || [],
        p.mediaUrl || null, p.focusTags || [],
      ]
    );
  }
  // Drop poses that were renamed/removed from the source data and aren't
  // referenced by any existing routine (referenced ones are left in place —
  // deleting them would violate the routine_items foreign key).
  const currentSlugs = poses.map((p) => p.slug);
  const { rowCount } = await pool.query(
    `DELETE FROM poses WHERE slug != ALL($1::text[])
       AND id NOT IN (SELECT DISTINCT pose_id FROM routine_items)`,
    [currentSlugs]
  );
  if (rowCount > 0) console.log(`removed ${rowCount} stale pose(s) no longer in the source data`);

  console.log(`seeded ${poses.length} poses`);
}

if (require.main === module) {
  seed()
    .then(() => pool.end())
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = seed;
