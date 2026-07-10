const pool = require('./pool');
const poses = require('../data/poses');

async function seed() {
  for (const p of poses) {
    await pool.query(
      `INSERT INTO poses (
        slug, name, category, difficulty, styles, primary_muscles, secondary_muscles,
        benefits, common_mistakes, contraindications, equipment, default_duration_sec, breathing_cue
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
      ON CONFLICT (slug) DO UPDATE SET
        name = EXCLUDED.name,
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
        breathing_cue = EXCLUDED.breathing_cue`,
      [
        p.slug, p.name, p.category, p.difficulty, p.styles, p.primaryMuscles, p.secondaryMuscles,
        p.benefits, p.commonMistakes, p.contraindications, p.equipment, p.defaultDurationSec, p.breathingCue,
      ]
    );
  }
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
